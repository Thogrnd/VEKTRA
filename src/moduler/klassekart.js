/* VEKTRA – modul: Klassekart (klassekart og makkerpar). Bare for lærer. Elevene hentes fra Register. */
'use strict';

let kkValgtKlasse = null, kkValgtRom = null, kkValgtOppsett = null, kkRediger = false, kkRedigerModus = 'pult', kkSnu = false;
let kkFravaer = new Set(), kkGrupper = null, kkGruppeStr = 2;

const kkKlasse = () => { const d = D(); let k = d.klasser.find(x => x.id === kkValgtKlasse); if (!k && d.klasser.length) { k = [...d.klasser].sort((a, b) => sortNavn(a.navn, b.navn))[0]; kkValgtKlasse = k.id; } return k || null; };
const kkRom = () => { const d = D(); let r = d.rom.find(x => x.id === kkValgtRom); if (!r && d.rom.length) { r = d.rom[0]; kkValgtRom = r.id; } return r || null; };
const finnElev = (id) => D().elever.find(x => x.id === id) || null;
const sorterteElever = (k) => klassensElever(k.id);
function klasseVelger(id = 'kk-klassevalg') {
  const d = D();
  return `<select id="${id}">${[...d.klasser].sort((a, b) => sortNavn(a.navn, b.navn)).map(k => `<option value="${k.id}" ${k.id === kkValgtKlasse ? 'selected' : ''}>${esc(k.navn)} (${klassensElever(k.id).length})</option>`).join('')}</select>`;
}
const ingenKlasser = () => `<div class="kort s12 gronn"><div class="tom">Du har ingen klasser ennå. Klasser og elever legges inn i Register.<br><br><button class="btn" id="kk-tilklasser">Gå til Register</button></div></div>`;
function koblIngenKlasser(el) { const b = $('#kk-tilklasser', el); if (b) b.onclick = () => apneSide('reg-klasser'); }

/* ================= Klassekart ================= */
/* Dobbeltpulter: r.par inneholder "i-j" når pult i-j er sydd sammen med pulten til høyre (i-(j+1)) */
const parListe = (r) => (r.par = r.par || []);
function parAv(r, c) {           // gir venstre celle i paret c er med i, eller null
  const [i, j] = c.split('-').map(Number);
  if (parListe(r).includes(c)) return c;
  if (parListe(r).includes(`${i}-${j - 1}`)) return `${i}-${j - 1}`;
  return null;
}
function ryddPar(r) {             // fjerner par som ikke lenger er gyldige (gang, utenfor rommet)
  r.par = parListe(r).filter(c => { const [i, j] = c.split('-').map(Number); const h = `${i}-${j + 1}`;
    return i < r.rader && j + 1 < r.kolonner && !r.gang.includes(c) && !r.gang.includes(h); });
}
/* Pultfarger: 8 farger (4 farger i to toner) man blar gjennom ved å klikke. r.farger = { "i-j": 0–7 } (0 = standard lys grønn) */
const PULTFARGER = [               // fire farger, hver i en lys og en mørk tone
  ['#83E28E', 'Grønn lys'], ['#47D359', 'Grønn mørk'],
  ['#A9D3FF', 'Blå lys'], ['#6FAEF5', 'Blå mørk'],
  ['#FFE38C', 'Gul lys'], ['#FFC93D', 'Gul mørk'],
  ['#D6C4FF', 'Lilla lys'], ['#AE8CF7', 'Lilla mørk']
];
function fargerAv(r) {             // gjør om gamle rom (f2 = to grønnfarger) til det nye fargesystemet
  if (!r.farger) { r.farger = {}; (r.f2 || []).forEach(c => r.farger[c] = 1); }
  delete r.f2;
  return r.farger;
}
const pultFarge = (r, c) => PULTFARGER[fargerAv(r)[c] || 0];
/* Setter farge på en pult – og på begge halvdelene hvis det er en dobbeltpult */
function settPultfarge(r, c, nr) {
  const p = typeof parAv === 'function' ? parAv(r, c) : null;
  const celler = p ? [p, (() => { const [i, j] = p.split('-').map(Number); return `${i}-${j + 1}`; })()] : [c];
  celler.forEach(x => { fargerAv(r)[x] = nr; });
}
function visFargemeny(x, y, r, c) {
  $$('.fargemeny').forEach(m => m.remove());
  const naa = fargerAv(r)[c] || 0;
  const m = document.createElement('div');
  m.className = 'fargemeny';
  m.innerHTML = `<div class="smaa" style="padding:2px 4px 8px">Pultfarge</div><div class="fargemeny-grid">${PULTFARGER.map(([f, n], i) =>
    `<button type="button" data-nr="${i}" title="${n}" aria-label="${n}" class="${i === naa ? 'valgt' : ''}" style="background:${f}"></button>`).join('')}</div>`;
  document.body.appendChild(m);
  const b = m.getBoundingClientRect();
  m.style.left = Math.min(x, window.innerWidth - b.width - 8) + 'px';
  m.style.top = Math.min(y, window.innerHeight - b.height - 8) + 'px';
  const lukk = () => { m.remove(); document.removeEventListener('mousedown', utenfor, true); document.removeEventListener('keydown', esc_); };
  const utenfor = e => { if (!m.contains(e.target)) lukk(); };
  const esc_ = e => { if (e.key === 'Escape') lukk(); };
  setTimeout(() => { document.addEventListener('mousedown', utenfor, true); document.addEventListener('keydown', esc_); }, 0);
  m.addEventListener('click', e => { const k = e.target.closest('[data-nr]'); if (!k) return; settPultfarge(r, c, +k.dataset.nr); lukk(); Lager.lagre(); visSide(); });
}
function nyttRom(navn = 'Klasserom', rader = 5, kolonner = 6) {
  const r = { id: nyId(), navn, rader, kolonner, gang: [], farger: {} };
  for (let i = 0; i < rader; i++) for (let j = 0; j < kolonner; j++) if (j % 2 === 1) r.farger[`${i}-${j}`] = 1;
  D().rom.push(r); return r;
}
function aktueltOppsett(k, r) {
  const d = D();
  const liste = d.oppsett.filter(o => o.klasseId === k.id && o.romId === r.id);
  let o = liste.find(x => x.id === kkValgtOppsett);
  if (!o) o = liste.sort((a, b) => (b.endret || '').localeCompare(a.endret || ''))[0];
  if (!o) { o = { id: nyId(), navn: 'Oppsett 1', klasseId: k.id, romId: r.id, plasser: {}, endret: new Date().toISOString() }; d.oppsett.push(o); Lager.lagre(); }
  kkValgtOppsett = o.id;
  return { o, liste: d.oppsett.filter(x => x.klasseId === k.id && x.romId === r.id) };
}
const pultCeller = (r) => { const ut = []; for (let i = 0; i < r.rader; i++) for (let j = 0; j < r.kolonner; j++) { const c = `${i}-${j}`; if (!r.gang.includes(c)) ut.push(c); } return ut; };

function gridHtml(r, o, { rediger = false, snu = false, utskrift = false } = {}) {
  const rader = [...Array(r.rader).keys()], kol = [...Array(r.kolonner).keys()];
  if (snu) { rader.reverse(); kol.reverse(); }
  const celler = rader.map(i => kol.map(j => {
    const c = `${i}-${j}`;
    if (r.gang.includes(c)) return `<div class="celle gang" data-c="${c}"></div>`;
    const e = o && o.plasser[c] ? finnElev(o.plasser[c]) : null;
    // dobbeltpult: venstre/høyre del slik den vises (snus når kartet vises fra lærerens side)
    const p = parAv(r, c); let del = '';
    if (p) { const erVenstreIData = p === c; del = (erVenstreIData !== snu) ? 'par-v' : 'par-h'; }
    const [farge, fargenavn] = pultFarge(r, c);
    return `<div class="celle pult ${del}" data-c="${c}" style="--pf:${farge}" ${rediger ? `title="${fargenavn}"` : ''} ${e && !rediger && !utskrift ? 'draggable="true"' : ''}>
      ${e ? bildeHtml(e) + `<span class="navn">${esc(e.navn)}</span>` : `<span class="ledig">${rediger ? 'Pult' : ''}</span>`}</div>`;
  }).join('')).join('');
  const tavle = `<div class="kk-tavle">TAVLE</div>`;
  return (snu ? '' : tavle) + `<div class="kk-grid" style="grid-template-columns:repeat(${r.kolonner},minmax(70px,1fr));max-width:${r.kolonner * 130}px">${celler}</div>` + (snu ? `<div style="margin-top:12px">${tavle}</div>` : '');
}

registrer('kk-kart', el => {
  const d = D();
  const k = kkKlasse();
  if (!k) { el.innerHTML = sidehode('Klassekart') + ingenKlasser(); koblIngenKlasser(el); return; }
  let r = kkRom();
  if (!r) { r = nyttRom('Klasserom'); kkValgtRom = r.id; Lager.lagre(); }
  const { o, liste } = aktueltOppsett(k, r);
  // rydd bort plasser som ikke lenger er pulter / elever som er slettet
  for (const c in o.plasser) if (r.gang.includes(c) || !sorterteElever(k).some(e => e.id === o.plasser[c])) delete o.plasser[c];
  const plassert = new Set(Object.values(o.plasser));
  const uplassert = sorterteElever(k).filter(e => !plassert.has(e.id));
  const ledige = pultCeller(r).length - plassert.size;

  el.innerHTML = sidehode('Klassekart', `${sorterteElever(k).length} elever · ${pultCeller(r).length} pulter · ${ledige} ledige`,
    `<button class="btn sek" id="vis-elever">Vis for elever</button><button class="btn sek" id="skriv-ut">Skriv ut</button>`) +
    `<div class="kort s12 gronn">
      <div class="verktoylinje">
        <span class="smaa">Klasse</span>${klasseVelger()}
        <span class="smaa">Rom</span><select id="kk-rom">${d.rom.map(x => `<option value="${x.id}" ${x.id === r.id ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}<option value="__nytt">+ Nytt rom …</option></select>
        <span class="smaa">Oppsett</span><select id="kk-oppsett">${liste.map(x => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}<option value="__nytt">+ Nytt oppsett …</option><option value="__kopi">Kopier dette oppsettet …</option></select>
        <button class="lenkeknapp" id="kk-gi-navn">Gi nytt navn</button>
        ${liste.length > 1 ? '<button class="lenkeknapp fare" id="kk-slett-oppsett">Slett oppsett</button>' : ''}
      </div>
      <div class="verktoylinje">
        ${kkRediger ? `
          <b style="color:var(--green)">Redigerer rommet «${esc(r.navn)}»</b>
          <span class="smaa">Rader</span><input type="number" id="kk-rader" min="1" max="12" value="${r.rader}" style="width:70px">
          <span class="smaa">Kolonner</span><input type="number" id="kk-kol" min="1" max="14" value="${r.kolonner}" style="width:70px">
          <span class="smaa">Klikk på en rute for å</span>
          <select id="kk-modus" style="min-width:0;width:auto"><option value="pult" ${kkRedigerModus === 'pult' ? 'selected' : ''}>bytte mellom pult og gang</option><option value="farge" ${kkRedigerModus === 'farge' ? 'selected' : ''}>bytte pultfarge (8 farger)</option><option value="par" ${kkRedigerModus === 'par' ? 'selected' : ''}>sy sammen eller dele dobbeltpult</option></select>
          <span class="spacer"></span>
          <button class="lenkeknapp" id="kk-romnavn">Gi rommet nytt navn</button>
          ${d.rom.length > 1 ? '<button class="lenkeknapp fare" id="kk-slett-rom">Slett rom</button>' : ''}
          <button class="btn" id="kk-ferdig">Ferdig</button>`
        : `
          <button class="btn" id="kk-tilfeldig">Tilfeldig plassering</button>
          <button class="btn sek" id="kk-fyll">Plasser resten</button>
          <button class="btn sek" id="kk-tom">Tøm kartet</button>
          <label class="smaa" style="display:flex;gap:6px;align-items:center;margin-left:8px"><input type="checkbox" id="kk-snu" ${kkSnu ? 'checked' : ''}>Vis fra lærerens side</label>
          <span class="spacer"></span>
          <button class="btn sek" id="kk-rediger">Rediger rommet</button>`}
      </div>
      <div class="kk-oppsett">
        ${kkRediger ? '' : `<div class="kk-liste" id="kk-liste"><h4>Ikke plassert (${uplassert.length})</h4>
          ${uplassert.map(e => `<div class="elevchip" draggable="true" data-e="${e.id}">${bildeHtml(e)}<span>${esc(elevNavn(e))}</span></div>`).join('') || '<div class="smaa">Alle elevene har fått plass.</div>'}</div>`}
        <div class="kk-flate ${kkRediger ? 'kk-redigerer' : ''}" id="kk-flate">${gridHtml(r, o, { rediger: kkRediger, snu: kkSnu })}</div>
      </div>
      ${kkRediger ? `<p class="kk-hint">Høyreklikk på en pult for å velge farge, eller klikk for neste farge i rekkefølgen: ${PULTFARGER.map(([f, n]) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px"><span style="width:14px;height:14px;border-radius:4px;background:${f};display:inline-block"></span>${n}</span>`).join('')}</p>` : '<p class="kk-hint">Dra elever til pultene, eller klikk på to pulter for å bytte plass. Dra en elev tilbake til lista for å fjerne den fra kartet. Høyreklikk på en pult for å velge farge. Regler for hvem som ikke skal sitte sammen, legger du inn under Makkerpar.</p>'}
    </div>`;

  const lagre = () => { o.endret = new Date().toISOString(); Lager.lagre(); visSide(); };
  $('#kk-klassevalg', el).onchange = e => { kkValgtKlasse = e.target.value; kkValgtOppsett = null; visSide(); };
  $('#kk-rom', el).onchange = async e => {
    if (e.target.value === '__nytt') {
      const s = await skjema({ tittel: 'Nytt rom', felt: [{ navn: 'navn', etikett: 'Navn på rommet', kreves: true }, { navn: 'rader', etikett: 'Rader', type: 'number', verdi: 5, halv: true }, { navn: 'kolonner', etikett: 'Kolonner', type: 'number', verdi: 6, halv: true }] });
      if (s) { const nr = nyttRom(s.navn, Math.min(12, Math.max(1, s.rader || 5)), Math.min(14, Math.max(1, s.kolonner || 6))); kkValgtRom = nr.id; kkValgtOppsett = null; kkRediger = true; Lager.lagre(); }
      visSide(); return;
    }
    kkValgtRom = e.target.value; kkValgtOppsett = null; visSide();
  };
  $('#kk-oppsett', el).onchange = async e => {
    const v = e.target.value;
    if (v === '__nytt' || v === '__kopi') {
      const s = await skjema({ tittel: v === '__kopi' ? 'Kopier oppsett' : 'Nytt oppsett', felt: [{ navn: 'navn', etikett: 'Navn på oppsettet', verdi: v === '__kopi' ? o.navn + ' (kopi)' : `Oppsett ${liste.length + 1}`, kreves: true }] });
      if (s) { const n = { id: nyId(), navn: s.navn, klasseId: k.id, romId: r.id, plasser: v === '__kopi' ? { ...o.plasser } : {}, endret: new Date().toISOString() }; d.oppsett.push(n); kkValgtOppsett = n.id; Lager.lagre(); }
      visSide(); return;
    }
    kkValgtOppsett = v; visSide();
  };
  $('#kk-gi-navn', el).onclick = async () => { const s = await skjema({ tittel: 'Gi oppsettet nytt navn', felt: [{ navn: 'navn', etikett: 'Navn', verdi: o.navn, kreves: true }] }); if (s) { o.navn = s.navn; lagre(); } };
  const so = $('#kk-slett-oppsett', el); if (so) so.onclick = async () => { if (await bekreft(`Slette oppsettet «${esc(o.navn)}»?`, { ja: 'Slett', fare: true })) { d.oppsett = d.oppsett.filter(x => x !== o); kkValgtOppsett = null; Lager.lagre(); visSide(); } };
  $('#vis-elever', el).onclick = () => visForElever(k, r, o);
  $('#skriv-ut', el).onclick = () => skrivUtKart(k, r, o);

  // høyreklikk på en pult: velg farge fra en liten meny (virker både i vanlig visning og når rommet redigeres)
  $('#kk-flate', el).addEventListener('contextmenu', e => {
    const c = e.target.closest('.celle.pult'); if (!c) return;
    e.preventDefault();
    visFargemeny(e.clientX, e.clientY, r, c.dataset.c);
  });

  if (kkRediger) {
    const endreStr = () => {
      r.rader = Math.min(12, Math.max(1, +$('#kk-rader', el).value || 1));
      r.kolonner = Math.min(14, Math.max(1, +$('#kk-kol', el).value || 1));
      const gyldig = c => { const [i, j] = c.split('-').map(Number); return i < r.rader && j < r.kolonner; };
      r.gang = r.gang.filter(gyldig); const fa = fargerAv(r); Object.keys(fa).forEach(c => { if (!gyldig(c)) delete fa[c]; }); ryddPar(r);
      d.oppsett.filter(x => x.romId === r.id).forEach(x => { for (const c in x.plasser) if (!gyldig(c)) delete x.plasser[c]; });
      Lager.lagre(); visSide();
    };
    $('#kk-rader', el).onchange = endreStr; $('#kk-kol', el).onchange = endreStr;
    $('#kk-modus', el).onchange = e => { kkRedigerModus = e.target.value; };
    $('#kk-ferdig', el).onclick = () => { kkRediger = false; visSide(); };
    $('#kk-romnavn', el).onclick = async () => { const s = await skjema({ tittel: 'Gi rommet nytt navn', felt: [{ navn: 'navn', etikett: 'Navn', verdi: r.navn, kreves: true }] }); if (s) { r.navn = s.navn; Lager.lagre(); visSide(); } };
    const sr = $('#kk-slett-rom', el); if (sr) sr.onclick = async () => { if (await bekreft(`Slette rommet «${esc(r.navn)}» og alle oppsett i det?`, { ja: 'Slett', fare: true })) { d.rom = d.rom.filter(x => x !== r); d.oppsett = d.oppsett.filter(x => x.romId !== r.id); kkValgtRom = null; kkRediger = false; Lager.lagre(); visSide(); } };
    $('#kk-flate', el).onclick = e => {
      const c = e.target.closest('.celle'); if (!c) return;
      const id = c.dataset.c;
      if (kkRedigerModus === 'pult') {
        if (r.gang.includes(id)) r.gang = r.gang.filter(x => x !== id);
        else { r.gang.push(id); d.oppsett.filter(x => x.romId === r.id).forEach(x => delete x.plasser[id]); ryddPar(r); }
      } else if (kkRedigerModus === 'par') {
        if (r.gang.includes(id)) return;
        const p = parAv(r, id);
        if (p) { r.par = parListe(r).filter(x => x !== p); toast('Dobbeltpulten er delt i to.'); }
        else {
          const [i, j] = id.split('-').map(Number);
          const ledig = c => { const [a, b] = c.split('-').map(Number); return b >= 0 && b < r.kolonner && !r.gang.includes(c) && !parAv(r, c); };
          const hoyre = `${i}-${j + 1}`, venstre = `${i}-${j - 1}`;
          let start = null, annen = null;
          if (ledig(hoyre)) { start = id; annen = hoyre; } else if (ledig(venstre)) { start = venstre; annen = id; }
          if (!start) { toast('Det må være en ledig enkeltpult rett ved siden av for å lage en dobbeltpult.', true); return; }
          parListe(r).push(start);
          // begge halvdeler får samme farge
          fargerAv(r)[annen] = fargerAv(r)[start] || 0;
          toast('Pultene er sydd sammen til en dobbeltpult.');
        }
      } else if (!r.gang.includes(id)) {
        const p = parAv(r, id);
        const celler = p ? [p, (() => { const [i, j] = p.split('-').map(Number); return `${i}-${j + 1}`; })()] : [id];
        const ny = ((fargerAv(r)[id] || 0) + 1) % PULTFARGER.length;   // neste farge for hvert klikk
        celler.forEach(c => { fargerAv(r)[c] = ny; });
      }
      Lager.lagre(); visSide();
    };
    return;
  }

  $('#kk-rediger', el).onclick = () => { kkRediger = true; visSide(); };
  $('#kk-snu', el).onchange = e => { kkSnu = e.target.checked; visSide(); };
  $('#kk-tom', el).onclick = async () => { if (await bekreft('Fjerne alle elevene fra kartet?', { ja: 'Tøm' })) { o.plasser = {}; lagre(); } };
  $('#kk-tilfeldig', el).onclick = () => { o.plasser = tilfeldigPlassering(k, r, sorterteElever(k).map(e => e.id), {}); lagre(); toast('Elevene er plassert tilfeldig.'); };
  $('#kk-fyll', el).onclick = () => { o.plasser = tilfeldigPlassering(k, r, uplassert.map(e => e.id), o.plasser); lagre(); };

  // ---- dra og slipp + klikk for å bytte ----
  let dras = null, valgt = null;
  const plasser = (elevId, tilCelle, fraCelle) => {
    const der = o.plasser[tilCelle];
    if (fraCelle) { if (der) o.plasser[fraCelle] = der; else delete o.plasser[fraCelle]; }
    else if (der) { /* elev fra lista erstatter – den gamle går tilbake til lista */ }
    o.plasser[tilCelle] = elevId;
    lagre();
  };
  el.addEventListener('dragstart', e => {
    const chip = e.target.closest('.elevchip'), celle = e.target.closest('.celle.pult');
    if (chip) dras = { elev: chip.dataset.e, fra: null };
    else if (celle && o.plasser[celle.dataset.c]) dras = { elev: o.plasser[celle.dataset.c], fra: celle.dataset.c };
    if (dras) e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragover', e => {
    const c = e.target.closest('.celle.pult, #kk-liste'); if (!c || !dras) return;
    e.preventDefault(); $$('.over', el).forEach(x => x !== c && x.classList.remove('over')); c.classList.add('over');
  });
  el.addEventListener('dragleave', e => { const c = e.target.closest('.over'); if (c && !c.contains(e.relatedTarget)) c.classList.remove('over'); });
  el.addEventListener('drop', e => {
    e.preventDefault(); if (!dras) return;
    const c = e.target.closest('.celle.pult');
    if (c) plasser(dras.elev, c.dataset.c, dras.fra);
    else if (e.target.closest('#kk-liste') && dras.fra) { delete o.plasser[dras.fra]; lagre(); }
    dras = null;
  });
  el.addEventListener('dragend', () => { dras = null; $$('.over', el).forEach(x => x.classList.remove('over')); });
  $('#kk-flate', el).addEventListener('click', e => {
    const c = e.target.closest('.celle.pult'); if (!c) return;
    if (!valgt) { if (o.plasser[c.dataset.c]) { valgt = c.dataset.c; c.classList.add('valgt'); } return; }
    if (valgt !== c.dataset.c) plasser(o.plasser[valgt], c.dataset.c, valgt);
    else { c.classList.remove('valgt'); valgt = null; }
  });
});

/* Tilfeldig plassering som prøver å unngå regler (naboer på samme rad) */
function tilfeldigPlassering(k, r, elevIder, faste) {
  const regler = k.regler || [];
  const ledige = pultCeller(r).filter(c => !faste[c] || !sorterteElever(k).some(e => e.id === faste[c]));
  const brudd = (pl) => {
    let n = 0;
    for (const c in pl) {
      const [i, j] = c.split('-').map(Number);
      const nabo = pl[`${i}-${j + 1}`];
      if (nabo && regler.some(x => (x.a === pl[c] && x.b === nabo) || (x.b === pl[c] && x.a === nabo))) n++;
    }
    return n;
  };
  let best = null, bestN = Infinity;
  for (let forsok = 0; forsok < 400 && bestN > 0; forsok++) {
    const pl = { ...faste };
    const celler = blander(ledige), elever = blander(elevIder);
    elever.forEach((e, i) => { if (celler[i]) pl[celler[i]] = e; });
    const n = brudd(pl); if (n < bestN) { best = pl; bestN = n; }
  }
  if (elevIder.length > ledige.length) toast(`Det er ${elevIder.length - ledige.length} flere elever enn ledige pulter.`, true);
  return best || { ...faste };
}

function visForElever(k, r, o) {
  const v = document.createElement('div');
  v.className = 'visning';
  v.innerHTML = `<button class="btn sek lukk">Lukk (Esc)</button><h1>${esc(k.navn)} · ${esc(r.navn)}</h1>${gridHtml(r, o, { snu: false })}`;
  $$('.celle', v).forEach(c => c.removeAttribute('draggable'));
  document.body.appendChild(v);
  const lukk = () => { v.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') lukk(); };
  document.addEventListener('keydown', esc_);
  $('.lukk', v).onclick = lukk;
}
function skrivUtKart(k, r, o) {
  const h = Math.max(16, Math.min(32, Math.floor(150 / r.rader)));
  skrivUt(`<h1>Klassekart ${esc(k.navn)} – ${esc(r.navn)}</h1><div class="meta">${esc(o.navn)} · skrevet ut ${visDato(idag())}${kkSnu ? ' · sett fra lærerens side' : ''}</div>
    <div style="--ch:${h}mm;--bh:${Math.round(h * 0.55)}mm">${gridHtml(r, o, { snu: kkSnu, utskrift: true })}</div>`);
}

/* ================= Makkerpar ================= */
registrer('kk-makker', el => {
  const k = kkKlasse();
  if (!k) { el.innerHTML = sidehode('Makkerpar') + ingenKlasser(); koblIngenKlasser(el); return; }
  k.regler = k.regler || [];
  const elever = sorterteElever(k);
  const tilstede = elever.filter(e => !kkFravaer.has(e.id));
  const navnTil = id => esc(elevNavn(finnElev(id)) || '(slettet elev)');
  el.innerHTML = sidehode('Makkerpar og grupper', 'Trekk tilfeldige par eller grupper. Reglene brukes både her og ved tilfeldig plassering i klassekartet.',
    kkGrupper ? '<button class="btn sek" id="mp-stor">Vis for elever</button>' : '') +
    `<div class="grid">
      ${kort('Trekk', `
        <div class="verktoylinje"><span class="smaa">Klasse</span>${klasseVelger()}
          <span class="smaa">Gruppestørrelse</span><select id="mp-str" style="min-width:0;width:auto">${[2, 3, 4, 5].map(n => `<option ${n === kkGruppeStr ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <button class="btn" id="mp-trekk" ${tilstede.length < 2 ? 'disabled' : ''}>Trekk ${kkGruppeStr === 2 ? 'par' : 'grupper'}</button>
          <span class="smaa">${tilstede.length} av ${elever.length} til stede</span></div>
        ${kkGrupper ? `<div class="paret">${kkGrupper.map((g, i) => `<div class="parkort"><b>${kkGruppeStr === 2 ? 'Par' : 'Gruppe'} ${i + 1}</b>${g.map(id => `<div>${navnTil(id)}</div>`).join('')}</div>`).join('')}</div>`
          : '<div class="tom">Trykk «Trekk» for å lage par eller grupper.</div>'}`, 's8 gronn')}
      <div class="kort s4 rosa" style="grid-row:span 2"><div class="kh"><h3>Fravær i dag</h3><div class="hoyre"><button class="lenkeknapp" id="mp-alle">Alle til stede</button></div></div>
        ${elever.map(e => `<label class="sjekk"><input type="checkbox" data-f="${e.id}" ${kkFravaer.has(e.id) ? '' : 'checked'}>${esc(elevNavn(e))}</label>`).join('') || '<div class="tom">Ingen elever.</div>'}</div>
      ${kort('Regler – skal ikke være sammen', `
        <div class="rad"><select id="mp-a">${elever.map(e => `<option value="${e.id}">${esc(elevNavn(e))}</option>`).join('')}</select>
        <select id="mp-b">${elever.map((e, i) => `<option value="${e.id}" ${i === 1 ? 'selected' : ''}>${esc(elevNavn(e))}</option>`).join('')}</select>
        <button class="btn auto" id="mp-ny-regel" ${elever.length < 2 ? 'disabled' : ''}>Legg til regel</button></div>
        ${k.regler.length ? k.regler.map(x => `<div class="sjekk">✕ ${navnTil(x.a)} og ${navnTil(x.b)}<button class="lenkeknapp fare slett" data-r="${x.id}">Fjern</button></div>`).join('') : '<p class="smaa">Ingen regler ennå.</p>'}`, 's8 rosa')}
    </div>`;

  $('#kk-klassevalg', el).onchange = e => { kkValgtKlasse = e.target.value; kkGrupper = null; kkFravaer.clear(); visSide(); };
  $('#mp-str', el).onchange = e => { kkGruppeStr = +e.target.value; kkGrupper = null; visSide(); };
  $$('[data-f]', el).forEach(c => c.onchange = () => { c.checked ? kkFravaer.delete(c.dataset.f) : kkFravaer.add(c.dataset.f); kkGrupper = null; visSide(); });
  $('#mp-alle', el).onclick = () => { kkFravaer.clear(); visSide(); };
  $('#mp-trekk', el).onclick = () => { kkGrupper = lagGrupper(tilstede.map(e => e.id), kkGruppeStr, k.regler); visSide(); };
  const stor = $('#mp-stor', el); if (stor) stor.onclick = () => {
    const v = document.createElement('div'); v.className = 'visning';
    v.innerHTML = `<button class="btn sek lukk">Lukk (Esc)</button><h1>${kkGruppeStr === 2 ? 'Makkerpar' : 'Grupper'} – ${esc(k.navn)}</h1>` + $('.paret', el).outerHTML;
    document.body.appendChild(v);
    const lukk = () => { v.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = e => { if (e.key === 'Escape') lukk(); };
    document.addEventListener('keydown', esc_); $('.lukk', v).onclick = lukk;
  };
  $('#mp-ny-regel', el).onclick = () => {
    const a = $('#mp-a', el).value, b = $('#mp-b', el).value;
    if (a === b) { toast('Velg to forskjellige elever.', true); return; }
    if (k.regler.some(x => (x.a === a && x.b === b) || (x.a === b && x.b === a))) { toast('Denne regelen finnes allerede.', true); return; }
    k.regler.push({ id: nyId(), a, b }); Lager.lagre(); visSide();
  };
  $$('[data-r]', el).forEach(b => b.onclick = () => { k.regler = k.regler.filter(x => x.id !== b.dataset.r); Lager.lagre(); visSide(); });
});

function lagGrupper(ider, str, regler) {
  const antall = Math.max(1, Math.floor(ider.length / str));
  const brudd = gr => gr.reduce((n, g) => n + regler.filter(r => g.includes(r.a) && g.includes(r.b)).length, 0);
  let best = null, bestN = Infinity;
  for (let f = 0; f < 600 && bestN > 0; f++) {
    const b = blander(ider);
    const gr = Array.from({ length: antall }, (_, i) => b.slice(i * str, i * str + str));
    b.slice(antall * str).forEach((id, i) => gr[i % antall].push(id));
    const n = brudd(gr); if (n < bestN) { best = gr; bestN = n; }
  }
  if (bestN > 0) toast('Klarte ikke å følge alle reglene denne gangen. Prøv å trekke på nytt.', true);
  return best;
}
