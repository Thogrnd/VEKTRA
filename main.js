// VEKTRA – hovedprosess (Electron)
// Data lagres bare lokalt: i en mappe du velger (standard Dokumenter\VEKTRA, kan være en OneDrive-mappe).
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Bilder og video fra elevloggen lagres som egne filer i «Logg-media» i datamappen
// og vises i vinduet via adressen klar-media://f/<filnavn>
protocol.registerSchemesAsPrivileged([{ scheme: 'klar-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }]);
const trygtNavn = n => typeof n === 'string' && /^[\w.-]+$/.test(n) && !n.startsWith('.');

app.commandLine.appendSwitch('lang', 'nb');   // norsk datoformat og stavekontroll

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { autoUpdater = null; }

const DATAFIL = 'vektra-data.json';
let vindu = null;

// ---------- Innstillinger for selve programmet (hvor datamappen ligger) ----------
const innstFil = () => path.join(app.getPath('userData'), 'innstillinger.json');
function lesInnst() {
  try { return JSON.parse(fs.readFileSync(innstFil(), 'utf8')); } catch (e) { return {}; }
}
function skrivInnst(o) {
  fs.mkdirSync(path.dirname(innstFil()), { recursive: true });
  fs.writeFileSync(innstFil(), JSON.stringify(o, null, 2), 'utf8');
}
function dataMappe() {
  const i = lesInnst();
  return i.dataMappe || path.join(app.getPath('documents'), 'VEKTRA');
}

// ---------- Første oppstart: ta med data fra KLAR (det gamle navnet) ----------
// KLAR-dataene kopieres, originalen blir liggende urørt som sikkerhetskopi.
function hentFraKlar() {
  try {
    if (fs.existsSync(path.join(dataMappe(), DATAFIL))) return;
    const standardKlar = path.join(app.getPath('documents'), 'KLAR');
    let gammelMappe = standardKlar;
    try { const i = JSON.parse(fs.readFileSync(path.join(app.getPath('appData'), 'KLAR', 'innstillinger.json'), 'utf8')); if (i.dataMappe) gammelMappe = i.dataMappe; } catch (e) { /* ingen KLAR-innstillinger */ }
    const gammelFil = path.join(gammelMappe, 'klar-data.json');
    if (!fs.existsSync(gammelFil)) return;
    // brukte KLAR en egen mappe (f.eks. i OneDrive), fortsetter VEKTRA i samme mappe
    if (gammelMappe !== standardKlar && !lesInnst().dataMappe) { const i = lesInnst(); i.dataMappe = gammelMappe; skrivInnst(i); }
    const mappe = dataMappe();
    fs.mkdirSync(mappe, { recursive: true });
    fs.copyFileSync(gammelFil, path.join(mappe, DATAFIL));
    const gm = path.join(gammelMappe, 'Logg-media'), nm = path.join(mappe, 'Logg-media');
    if (fs.existsSync(gm) && gm !== nm) fs.cpSync(gm, nm, { recursive: true });
  } catch (e) { /* starter tomt hvis noe går galt */ }
}

// ---------- Trygg skriving med daglige sikkerhetskopier ----------
function skrivData(tekst) {
  const mappe = dataMappe();
  fs.mkdirSync(mappe, { recursive: true });
  const fil = path.join(mappe, DATAFIL);
  const tmp = fil + '.tmp';
  fs.writeFileSync(tmp, tekst, 'utf8');
  fs.renameSync(tmp, fil);

  // én sikkerhetskopi per dag, de 14 siste beholdes
  const kopiMappe = path.join(mappe, 'Sikkerhetskopier');
  fs.mkdirSync(kopiMappe, { recursive: true });
  const dag = new Date().toISOString().slice(0, 10);
  const kopi = path.join(kopiMappe, `vektra-data ${dag}.json`);
  fs.writeFileSync(kopi, tekst, 'utf8');
  const alle = fs.readdirSync(kopiMappe).filter(f => f.startsWith('vektra-data ')).sort();
  while (alle.length > 14) fs.unlinkSync(path.join(kopiMappe, alle.shift()));
}

const mediaMappe = () => path.join(dataMappe(), 'Logg-media');

function lagVindu() {
  vindu = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#10122a',
    title: 'VEKTRA',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });
  vindu.webContents.session.setSpellCheckerLanguages(['nb']);
  vindu.loadFile(path.join(__dirname, 'src', 'index.html'));
  vindu.once('ready-to-show', () => { vindu.maximize(); vindu.show(); });

  // lenker åpnes i vanlig nettleser
  vindu.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  vindu.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
}

// ---------- Kun én VEKTRA åpen om gangen ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (vindu) { if (vindu.isMinimized()) vindu.restore(); vindu.focus(); }
  });
  app.whenReady().then(() => {
    hentFraKlar();
    protocol.handle('klar-media', req => {
      const navn = decodeURIComponent(new URL(req.url).pathname.replace(/^\//, ''));
      if (!trygtNavn(navn)) return new Response('', { status: 400 });
      return net.fetch(pathToFileURL(path.join(mediaMappe(), navn)).toString(), { headers: req.headers });
    });
    lagVindu();
    settOppOppdatering();
  });
  app.on('window-all-closed', () => app.quit());
}

// ---------- Data ----------
ipcMain.handle('data:les', () => {
  try { return fs.readFileSync(path.join(dataMappe(), DATAFIL), 'utf8'); }
  catch (e) { return null; }
});

ipcMain.handle('data:skriv', (e, tekst) => {
  try { skrivData(tekst); return { ok: true }; }
  catch (err) { return { ok: false, feil: String(err.message || err) }; }
});

ipcMain.handle('data:info', () => ({
  mappe: dataMappe(),
  versjon: app.getVersion(),
  pakket: app.isPackaged
}));

// Velg ny datamappe. Returnerer om mappen allerede har VEKTRA-data.
ipcMain.handle('data:velgMappe', async () => {
  const r = await dialog.showOpenDialog(vindu, {
    title: 'Velg mappe for VEKTRA-data (for eksempel en mappe i OneDrive)',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const mappe = r.filePaths[0];
  return { mappe, finnes: fs.existsSync(path.join(mappe, DATAFIL)) };
});

// Bytt til ny mappe. modus: 'bruk' = les dataene som ligger der, 'kopier' = skriv mine data dit
ipcMain.handle('data:byttMappe', (e, mappe, modus, tekst) => {
  try {
    const gammelMedia = mediaMappe();
    const i = lesInnst(); i.dataMappe = mappe; skrivInnst(i);
    if (modus === 'kopier') {
      skrivData(tekst);
      // bilder og video blir med (kopieres, originalene blir liggende)
      const nyMedia = mediaMappe();
      if (fs.existsSync(gammelMedia) && gammelMedia !== nyMedia) fs.cpSync(gammelMedia, nyMedia, { recursive: true, force: false, errorOnExist: false });
    }
    return { ok: true, tekst: fs.existsSync(path.join(mappe, DATAFIL)) ? fs.readFileSync(path.join(mappe, DATAFIL), 'utf8') : null };
  } catch (err) { return { ok: false, feil: String(err.message || err) }; }
});

ipcMain.handle('data:apneMappe', () => shell.openPath(dataMappe()));

// ---------- Filer (eksport/import, innlevering) ----------
ipcMain.handle('fil:lagre', async (e, { navn, innhold, filter }) => {
  const r = await dialog.showSaveDialog(vindu, {
    defaultPath: path.join(app.getPath('documents'), navn),
    filters: filter || [{ name: 'VEKTRA-fil', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, innhold, 'utf8');
  return r.filePath;
});

ipcMain.handle('fil:apne', async (e, { filter, flere }) => {
  const r = await dialog.showOpenDialog(vindu, {
    filters: filter || [{ name: 'VEKTRA-fil', extensions: ['json'] }],
    properties: flere ? ['openFile', 'multiSelections'] : ['openFile']
  });
  if (r.canceled) return [];
  return r.filePaths.map(f => ({ navn: path.basename(f), innhold: fs.readFileSync(f, 'utf8') }));
});

// Velg en mappe med elevbilder. Filnavnet (uten filtype) blir elevens navn.
ipcMain.handle('fil:bildemappe', async () => {
  const r = await dialog.showOpenDialog(vindu, { title: 'Velg mappen med elevbilder', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return [];
  const mappe = r.filePaths[0];
  const typer = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.gif': 'gif', '.webp': 'webp', '.bmp': 'bmp' };
  return fs.readdirSync(mappe)
    .filter(f => typer[path.extname(f).toLowerCase()])
    .map(f => ({ navn: f, kilde: `data:image/${typer[path.extname(f).toLowerCase()]};base64,` + fs.readFileSync(path.join(mappe, f)).toString('base64') }));
});

// Skriv ut det som ligger i utskriftsområdet (vanlig utskriftsdialog)
ipcMain.handle('fil:skrivUt', (e, staende) => new Promise(res => {
  vindu.webContents.print({ silent: false, printBackground: true, landscape: !staende }, (ok, feil) => res(ok ? { ok: true } : { ok: false, feil: feil === 'cancelled' ? '' : feil }));
}));

ipcMain.handle('fil:pdf', async (e, navn, staende) => {
  const r = await dialog.showSaveDialog(vindu, {
    defaultPath: path.join(app.getPath('documents'), navn),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (r.canceled || !r.filePath) return null;
  const pdf = await vindu.webContents.printToPDF({ printBackground: true, landscape: !staende, pageSize: 'A4' });
  fs.writeFileSync(r.filePath, pdf);
  shell.openPath(r.filePath);
  return r.filePath;
});

// ---------- Elevlogg: video og innlevering ----------
ipcMain.handle('media:lagre', (e, navn, data) => {
  try {
    if (!trygtNavn(navn)) throw new Error('Ugyldig filnavn');
    fs.mkdirSync(mediaMappe(), { recursive: true });
    fs.writeFileSync(path.join(mediaMappe(), navn), Buffer.from(data));
    return { ok: true };
  } catch (err) { return { ok: false, feil: String(err.message || err) }; }
});
ipcMain.handle('media:slett', (e, navn) => {
  try { if (trygtNavn(navn)) fs.unlinkSync(path.join(mediaMappe(), navn)); } catch (err) { /* finnes ikke */ }
  return { ok: true };
});

// Eleven leverer: loggfila lagres der eleven velger (f.eks. Teams-mappa), og videoene kopieres til samme mappe
ipcMain.handle('logg:lever', async (e, { filnavn, innhold, media }) => {
  const r = await dialog.showSaveDialog(vindu, {
    title: 'Lever logg – velg for eksempel innleveringsmappa i Teams',
    defaultPath: path.join(app.getPath('documents'), filnavn),
    filters: [{ name: 'VEKTRA-logg', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return null;
  const mappe = path.dirname(r.filePath);
  fs.writeFileSync(r.filePath, innhold, 'utf8');
  let mangler = 0;
  for (const n of media || []) {
    if (!trygtNavn(n)) continue;
    const fra = path.join(mediaMappe(), n), til = path.join(mappe, n);
    try { if (!fs.existsSync(til)) fs.copyFileSync(fra, til); } catch (err) { mangler++; }
  }
  return { fil: r.filePath, mangler };
});

// Læreren henter: velg loggfiler, videoene i samme mappe kopieres inn i Logg-media
ipcMain.handle('logg:hent', async () => {
  const r = await dialog.showOpenDialog(vindu, {
    title: 'Hent innleverte logger',
    filters: [{ name: 'VEKTRA-logg', extensions: ['json'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (r.canceled) return [];
  fs.mkdirSync(mediaMappe(), { recursive: true });
  return r.filePaths.map(f => {
    const innhold = fs.readFileSync(f, 'utf8');
    let mangler = 0;
    try {
      const o = JSON.parse(innhold);
      (o.logger || []).forEach(l => (l.media || []).forEach(m => {
        if (m.type !== 'video' || !trygtNavn(m.fil)) return;
        const fra = path.join(path.dirname(f), m.fil), til = path.join(mediaMappe(), m.fil);
        if (fs.existsSync(til)) return;
        if (fs.existsSync(fra)) fs.copyFileSync(fra, til); else mangler++;
      }));
    } catch (err) { /* leses som feil i vinduet */ }
    return { navn: path.basename(f), innhold, mangler };
  });
});

// ---------- OneDrive: mapper for lærer og elever ----------
// Stier fra vinduet er relative til VEKTRA-mappen på OneDrive og kan ikke gå ut av den.
const NOKKELFIL = 'vektra-elev.json';
const trygtMappenavn = n => typeof n === 'string' && n.trim() && !/[\\/:*?"<>|]/.test(n) && n !== '.' && n !== '..';
const trygRel = rel => typeof rel === 'string' && rel.split('/').every(trygtMappenavn);
const fullSti = (rot, rel) => path.join(rot, ...rel.split('/'));

ipcMain.handle('od:velgMappe', async (e, tittel) => {
  const r = await dialog.showOpenDialog(vindu, { title: tittel || 'Velg mappe på OneDrive', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

// Lager mappestrukturen. plan: { mapper: [rel, ...], nokler: [{ rel, innhold }] }
ipcMain.handle('od:lagMapper', (e, rot, plan) => {
  try {
    if (!rot || !fs.existsSync(rot)) throw new Error('Finner ikke VEKTRA-mappen på OneDrive.');
    let nye = 0;
    for (const rel of plan.mapper || []) {
      if (!trygRel(rel)) continue;
      const m = fullSti(rot, rel);
      if (!fs.existsSync(m)) { fs.mkdirSync(m, { recursive: true }); nye++; }
    }
    for (const n of plan.nokler || []) {
      if (!trygRel(n.rel)) continue;
      fs.mkdirSync(fullSti(rot, n.rel), { recursive: true });
      fs.writeFileSync(path.join(fullSti(rot, n.rel), NOKKELFIL), n.innhold, 'utf8');
    }
    return { ok: true, nye };
  } catch (err) { return { ok: false, feil: String(err.message || err) }; }
});

ipcMain.handle('od:apne', (e, rot, rel) => {
  const m = rel ? (trygRel(rel) ? fullSti(rot, rel) : rot) : rot;
  return shell.openPath(m);
});

// Eleven kobler til: velg elevmappen, les nøkkelfila
ipcMain.handle('od:velgElevmappe', async () => {
  const r = await dialog.showOpenDialog(vindu, { title: 'Velg elevmappen din (mappen med navnet ditt fra læreren)', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const mappe = r.filePaths[0];
  const elevdata = path.join(mappe, 'Elevdata');
  try { return { mappe, elevdata, harData: fs.existsSync(path.join(elevdata, DATAFIL)), nokkel: JSON.parse(fs.readFileSync(path.join(mappe, NOKKELFIL), 'utf8')) }; }
  catch (err) { return { mappe, feil: 'Fant ikke nøkkelfila i mappen. Velg mappen med navnet ditt, ikke en mappe inni den.' }; }
});

// Eleven leverer: loggfila og videoene legges i «Til lærer» i elevmappen
ipcMain.handle('od:lever', (e, elevmappe, { filnavn, innhold, media }) => {
  try {
    if (!trygtMappenavn(filnavn)) throw new Error('Ugyldig filnavn');
    const til = path.join(elevmappe, 'Til lærer');
    fs.mkdirSync(til, { recursive: true });
    fs.writeFileSync(path.join(til, filnavn), innhold, 'utf8');
    let mangler = 0;
    for (const n of media || []) {
      if (!trygtNavn(n)) continue;
      const fra = path.join(mediaMappe(), n), mal = path.join(til, n);
      try { if (!fs.existsSync(mal)) fs.copyFileSync(fra, mal); } catch (err) { mangler++; }
    }
    return { ok: true, mangler };
  } catch (err) { return { ok: false, feil: String(err.message || err) }; }
});

// Eleven leser det læreren har lagt i «Fra lærer»
ipcMain.handle('od:lesFraLaerer', (e, elevmappe) => {
  try {
    const fra = path.join(elevmappe, 'Fra lærer');
    if (!fs.existsSync(fra)) return [];
    return fs.readdirSync(fra).filter(f => f.toLowerCase().endsWith('.json'))
      .map(f => ({ navn: f, innhold: fs.readFileSync(path.join(fra, f), 'utf8') }));
  } catch (err) { return []; }
});

// Læreren henter: alle loggfiler i «Til lærer» for elevmappene som er oppgitt (rel-stier)
ipcMain.handle('od:hentInnleveringer', (e, rot, elevmapper) => {
  fs.mkdirSync(mediaMappe(), { recursive: true });
  const ut = [];
  for (const rel of elevmapper || []) {
    if (!trygRel(rel)) continue;
    const til = path.join(fullSti(rot, rel), 'Til lærer');
    if (!fs.existsSync(til)) continue;
    for (const f of fs.readdirSync(til).filter(x => x.toLowerCase().endsWith('.json'))) {
      const fil = path.join(til, f);
      const innhold = fs.readFileSync(fil, 'utf8');
      let mangler = 0;
      try {
        const o = JSON.parse(innhold);
        (o.logger || []).forEach(l => (l.media || []).forEach(m => {
          if (m.type !== 'video' || !trygtNavn(m.fil)) return;
          const fra = path.join(til, m.fil), mal = path.join(mediaMappe(), m.fil);
          if (fs.existsSync(mal)) return;
          if (fs.existsSync(fra)) fs.copyFileSync(fra, mal); else mangler++;
        }));
      } catch (err) { /* leses som feil i vinduet */ }
      ut.push({ navn: f, innhold, mangler, rel });
    }
  }
  return ut;
});

// HMS-mappene: list filene i en mappe og åpne en fil i standardprogrammet
ipcMain.handle('od:listFiler', (e, base, rel) => {
  try {
    if (!base || (rel && !trygRel(rel))) return { ok: false, feil: 'Ugyldig mappe' };
    const m = rel ? fullSti(base, rel) : base;
    if (!fs.existsSync(m)) return { ok: true, finnes: false, filer: [] };
    const filer = fs.readdirSync(m, { withFileTypes: true })
      .filter(f => f.isFile() && !f.name.startsWith('.') && !f.name.startsWith('~$') && f.name.toLowerCase() !== 'desktop.ini')
      .map(f => { let st = null; try { st = fs.statSync(path.join(m, f.name)); } catch (err) { /* sky-fil */ } return { navn: f.name, str: st ? st.size : 0, endret: st ? st.mtime.toISOString() : '' }; });
    return { ok: true, finnes: true, filer };
  } catch (err) { return { ok: false, feil: String(err.message || err) }; }
});
ipcMain.handle('od:apneFil', (e, base, rel, navn) => {
  if (!base || (rel && !trygRel(rel)) || (navn && !trygtMappenavn(navn))) return 'Ugyldig fil';
  const m = rel ? fullSti(base, rel) : base;
  return shell.openPath(navn ? path.join(m, navn) : m);
});
// Elevens HMS-snarvei ligger som regel ved siden av elevmappen i OneDrive
ipcMain.handle('od:finnHms', (e, elevmappe) => {
  try { const m = path.join(path.dirname(elevmappe), 'HMS'); return fs.existsSync(m) ? m : null; } catch (err) { return null; }
});

// Læreren skriver til eleven: fila legges i «Fra lærer» i elevmappen
ipcMain.handle('od:skrivTilElev', (e, rot, rel, filnavn, innhold) => {
  try {
    if (!trygRel(rel) || !trygtMappenavn(filnavn)) throw new Error('Ugyldig mappe eller filnavn');
    const fra = path.join(fullSti(rot, rel), 'Fra lærer');
    if (!fs.existsSync(fullSti(rot, rel))) throw new Error('Finner ikke elevmappen ' + rel);
    fs.mkdirSync(fra, { recursive: true });
    const fil = path.join(fra, filnavn), tmp = fil + '.tmp';
    fs.writeFileSync(tmp, innhold, 'utf8'); fs.renameSync(tmp, fil);
    return { ok: true };
  } catch (err) { return { ok: false, feil: String(err.message || err) }; }
});

// ---------- Oppdateringer fra GitHub ----------
function send(status) { if (vindu) vindu.webContents.send('oppd:status', status); }

function settOppOppdatering() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => send({ type: 'sjekker' }));
  autoUpdater.on('update-available', i => send({ type: 'tilgjengelig', versjon: i.version }));
  autoUpdater.on('update-not-available', () => send({ type: 'ingen' }));
  autoUpdater.on('download-progress', p => send({ type: 'laster', prosent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', i => send({ type: 'klar', versjon: i.version }));
  autoUpdater.on('error', err => send({ type: 'feil', melding: String(err && err.message || err).split('\n')[0] }));
  // stille sjekk ved oppstart
  if (app.isPackaged) setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}

ipcMain.handle('oppd:sjekk', async () => {
  if (!autoUpdater || !app.isPackaged) { send({ type: 'feil', melding: 'Oppdatering virker bare i det installerte programmet.' }); return; }
  try { await autoUpdater.checkForUpdates(); } catch (e) { /* sendes som feil-hendelse */ }
});
ipcMain.handle('oppd:last', async () => { try { await autoUpdater.downloadUpdate(); } catch (e) {} });
ipcMain.handle('oppd:installer', () => { autoUpdater.quitAndInstall(false, true); });
