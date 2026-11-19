/* VEKTRA – OneDrive-kobling (prøveversjon)
   Læreren lager en mappe per elev på sin OneDrive og deler den med eleven.
   Eleven kobler VEKTRA til mappen sin. Logg leveres til «Til lærer», tilbakemeldinger kommer i «Fra lærer».
   Mappene:  VEKTRA/Lærer, VEKTRA/HMS/..., VEKTRA/Elever <skoleår>/<klasse>/<fornavn>/{Elevdata, Til lærer, Fra lærer} */
'use strict';

const OD_HMS = ['Organisering og ansvar', 'Regler og rutiner', 'Risikovurderinger', 'Utstyr og stoffer', 'Sikkerhetsdatablader', 'Oppfølging'];
const OD_TILBAKE = 'Tilbakemeldinger.json';
const OD_LOGG = 'Loggbok.json';
const odFinnes = () => !!(api && api.odLagMapper);
/* Skoleåret skifter 1. august: november 2026 -> «2026-27» */
function odSkolear(dato = new Date()) { const y = dato.getFullYear(); const s = dato.getMonth() >= 7 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, '0')}`; }
const odRensNavn = n => String(n || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
function odOppsett() {
  const d = D();
  if (!d.onedrive || typeof d.onedrive !== 'object') d.onedrive = { rot: '', skolear: '', mapper: {} };
  if (!d.onedrive.mapper) d.onedrive.mapper = {};
  return d.onedrive;
}
/* Jobb- og skolekontoer synkroniseres til en mappe som heter «OneDrive - <organisasjon>».
   Den private OneDrive-mappen heter bare «OneDrive», og der skal elevdata aldri ligge. */
const odErJobbkonto = sti => /(^|[\\/])OneDrive\s*[-–]\s*[^\\/]+([\\/]|$)/i.test(String(sti || ''));
const OD_IKKE_JOBB = 'Mappen ligger ikke på OneDrive-kontoen på jobb. Elevdata skal bare ligge der. Velg en mappe under «OneDrive – Østfold fylkeskommune» (eller skolens OneDrive). Finnes den ikke på denne PC-en, er jobbkontoen ikke logget inn i OneDrive her.';
const odElevRel = id => (D().onedrive?.mapper || {})[id] || '';
const odErKoblet = () => !!(D().innst.rolle === 'elev' && D().innst.elevmappe && api && api.odLever);

/* ============ Lærer: kort i Innstillinger ============ */
function odLaererKortHtml() {
  if (!odFinnes()) return kort('OneDrive (prøveversjon)', '<p class="smaa" style="margin-top:0">Mapper på OneDrive virker bare i det installerte programmet.</p>', 's6 gronn');
  const o = odOppsett();
  const antall = Object.keys(o.mapper).length;
  return kort('OneDrive (prøveversjon)', `
    <p class="smaa" style="margin-top:0">VEKTRA lager én mappe per elev i VEKTRA-mappen din på OneDrive. Du deler hver elevmappe med eleven. Da kommer loggene inn med ett trykk, og tilbakemeldingene dine går rett til eleven.</p>
    <label class="felt"><span>VEKTRA-mappe på OneDrive</span><input type="text" readonly value="${esc(o.rot || 'Ikke valgt')}"></label>
    ${o.rot && !odErJobbkonto(o.rot) ? `<p class="smaa" style="color:var(--pink)">${OD_IKKE_JOBB} Trykk «Bytt mappe …».</p>` : ''}
    <p class="smaa">Elevmappene legges i «Elever ${esc(o.skolear || odSkolear())}».${antall ? ` ${antall} elever har mappe.` : ''}</p>
    <div class="verktoylinje">
      <button class="btn ${o.rot ? 'sek' : ''}" id="od-velg">${o.rot ? 'Bytt mappe …' : 'Velg mappe …'}</button>
      ${o.rot ? `<button class="btn" id="od-lag" ${odErJobbkonto(o.rot) ? '' : 'disabled'}>Lag OneDrive-mapper</button>
      <button class="btn sek" id="od-deling" ${antall ? '' : 'disabled'}>Deling og e-post …</button>
      <button class="btn sek" id="od-apne">Åpne mappen</button>` : ''}
    </div>`, 's6 gronn');
}
function odKoblLaererKort(el) {
  const v = $('#od-velg', el); if (!v) return;
  v.onclick = async () => {
    const m = await api.odVelgMappe('Velg VEKTRA-mappen på OneDrive (for eksempel OneDrive – Østfold fylkeskommune\\Vektra)');
    if (!m) return;
    if (!odErJobbkonto(m)) { await velg('Feil OneDrive', `${esc(m)}<br><br>${OD_IKKE_JOBB}`, [{ v: 'ok', t: 'OK' }]); return; }
    const o = odOppsett();
    if (o.rot && o.rot !== m && Object.keys(o.mapper).length && !await bekreft('Du bytter VEKTRA-mappe. Elevmappene i den gamle mappen blir liggende, men VEKTRA bruker den nye. Trykk «Lag OneDrive-mapper» etterpå.', { ja: 'Bytt mappe', tittel: 'Bytte mappe' })) return;
    if (o.rot !== m) o.mapper = {};
    o.rot = m; Lager.lagre(); visSide();
  };
  const lag = $('#od-lag', el); if (lag) lag.onclick = odLagMapper;
  const del = $('#od-deling', el); if (del) del.onclick = () => odDelingsliste();
  const ap = $('#od-apne', el); if (ap) ap.onclick = () => api.odApne(odOppsett().rot, '');
}

/* ============ Lærer: lag mappene ============ */
/* Lager planen. En elev som allerede har mappe, beholder den (også etter navne- eller klassebytte). */
function odPlan(bareNye = false) {
  const d = D(), o = odOppsett();
  if (!o.skolear) o.skolear = odSkolear();
  const elevRot = `Elever ${o.skolear}`;
  const mapper = bareNye ? [] : ['Lærer', 'HMS', ...OD_HMS.map(h => `HMS/${h}`), elevRot];
  const nokler = [], hoppet = [], rel = {};
  for (const k of sorterteKlasser()) {
    const elever = klassensElever(k.id);
    const kNavn = odRensNavn(k.navn); if (!kNavn) continue;
    for (const e of elever) {
      let r = o.mapper[e.id];
      if (bareNye && r) continue;
      if (!r) {
        const fNavn = odRensNavn(e.navn);
        if (!fNavn || elever.some(x => x !== e && likNavn(x.navn, e.navn))) { hoppet.push(`${e.navn} (${k.navn})`); continue; }
        r = `${elevRot}/${kNavn}/${fNavn}`;
        if (Object.values(o.mapper).includes(r) || Object.values(rel).includes(r)) { hoppet.push(`${e.navn} (${k.navn})`); continue; }
      }
      mapper.push(r, `${r}/Elevdata`, `${r}/Til lærer`, `${r}/Fra lærer`);
      nokler.push({ rel: r, innhold: JSON.stringify({ type: 'vektra-elev', versjon: 1, id: e.id, navn: e.navn, klasse: k.navn, skolear: o.skolear, laerer: d.innst.navn, laget: new Date().toISOString() }, null, 1) });
      rel[e.id] = r;
    }
  }
  return { mapper, nokler, hoppet, rel, elevRot };
}
async function odLagMapper() {
  const o = odOppsett();
  if (!o.rot) { toast('Velg VEKTRA-mappen på OneDrive først.', true); return; }
  if (!odErJobbkonto(o.rot)) { toast(OD_IKKE_JOBB, true); return; }
  const { mapper, nokler, hoppet, rel, elevRot } = odPlan();
  if (!nokler.length) { toast('Legg inn klasser og elever under Register først.', true); return; }
  const nye = nokler.filter(n => !Object.values(o.mapper).includes(n.rel)).length;
  if (!await bekreft(`VEKTRA lager mapper i <b>${esc(o.rot)}</b>:<br>• Lærer<br>• HMS med ${OD_HMS.length} undermapper<br>• ${elevRot} med <b>${nokler.length} elevmapper</b>${nye < nokler.length ? ` (${nye} nye)` : ''} – hver med Elevdata, Til lærer og Fra lærer<br><br>Mapper som finnes fra før, blir ikke rørt. Elever som har mappe, beholder den selv om navn eller klasse er endret.${hoppet.length ? `<br><br><span style="color:var(--pink)">Hoppes over fordi to elever i samme klasse har samme navn: ${esc(hoppet.join(', '))}. Gi dem forskjellige navn under Register (f.eks. «Ola H.» og «Ola B.»), og trykk på knappen igjen.</span>` : ''}`, { ja: 'Lag mappene', tittel: 'Lag OneDrive-mapper' })) return;
  const r = await api.odLagMapper(o.rot, { mapper, nokler });
  if (!r.ok) { toast('Kunne ikke lage mappene: ' + r.feil, true); return; }
  Object.assign(o.mapper, rel); Lager.lagre(); visSide();
  toast(`Mappene er laget (${r.nye} nye). Husk å dele nye elevmapper.`);
  odDelingsliste();
}
/* Kalles fra Register når nye elever er lagt inn: lager mappene med en gang hvis OneDrive er satt opp */
async function odLagManglende() {
  const o = D().onedrive;
  if (!odFinnes() || !o?.rot || !odErJobbkonto(o.rot) || !Object.keys(o.mapper || {}).length) return;
  const { mapper, nokler, hoppet, rel } = odPlan(true);
  if (!nokler.length) { if (hoppet.length) toast(`Fikk ikke laget OneDrive-mappe for ${hoppet.join(', ')}: samme navn som en annen elev i klassen.`, true); return; }
  const r = await api.odLagMapper(o.rot, { mapper, nokler });
  if (!r.ok) { toast('Kunne ikke lage OneDrive-mappe: ' + r.feil, true); return; }
  Object.assign(o.mapper, rel); Lager.lagre();
  const navn = Object.keys(rel).map(personNavn);
  toast(`OneDrive-mappe er laget for ${navn.join(', ')}. Husk å dele den med eleven (Innstillinger → Deling og e-post).`);
}

/* ============ Lærer: liste for deling ============ */
function odDelingsliste() {
  const d = D(), o = odOppsett();
  const klasser = sorterteKlasser().map(k => ({ k, elever: klassensElever(k.id).filter(e => o.mapper[e.id]) })).filter(x => x.elever.length);
  const m = modal(`<h2>Del elevmappene</h2>
    <ol class="smaa" style="line-height:1.7;margin-top:0;padding-left:18px">
      <li>Trykk <b>«Åpne mappen»</b> og gå inn i «Elever ${esc(o.skolear)}» og klassen.</li>
      <li>Høyreklikk på elevmappen og velg <b>Del</b> (OneDrive-ikonet).</li>
      <li>Lim inn elevens e-post (kopier fra lista under), velg <b>«Kan redigere»</b> og trykk <b>Send</b>.</li>
      <li>Del mappen <b>HMS</b> med alle elevene med <b>«Kan vise»</b>. Bruk «Kopier alle» for å få alle e-postene på én gang.</li>
    </ol>
    ${klasser.map(({ k, elever }) => `<h3 style="margin:14px 0 6px">${esc(k.navn)}</h3>
      <table><thead><tr><th>Elev</th><th>Mappe</th><th>E-post</th><th style="width:90px"></th></tr></thead><tbody>
      ${elever.map(e => `<tr><td><b>${esc(e.navn)}</b></td><td class="smaa">${esc(o.mapper[e.id].split('/').slice(1).join(' › '))}</td>
        <td>${e.epost ? esc(e.epost) : '<span class="smaa" style="color:var(--pink)">Mangler – legg inn under Register</span>'}</td>
        <td>${e.epost ? `<button class="lenkeknapp" data-kopier="${esc(e.epost)}">Kopier</button>` : ''}</td></tr>`).join('')}
      </tbody></table>
      ${elever.some(e => e.epost) ? `<button class="lenkeknapp" data-kopier="${esc(elever.filter(e => e.epost).map(e => e.epost).join('; '))}" style="margin-top:6px">Kopier alle e-poster i ${esc(k.navn)}</button>` : ''}`).join('')
      || '<div class="tom">Ingen elevmapper ennå. Trykk «Lag OneDrive-mapper».</div>'}
    <div class="knapper"><button class="btn sek" id="od-apne2" style="margin-right:auto">Åpne mappen</button><button class="btn" id="od-lukk">Lukk</button></div>`, { bred: true });
  $$('[data-kopier]', m.el).forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.kopier); toast('Kopiert.'); } catch (e) { toast('Kunne ikke kopiere. Merk teksten og kopier den selv.', true); }
  });
  $('#od-apne2', m.el).onclick = () => api.odApne(o.rot, `Elever ${o.skolear}`);
  $('#od-lukk', m.el).onclick = m.lukk;
}

/* ============ Elev: kort i Innstillinger og kobling ============ */
function odElevKortHtml() {
  const i = D().innst;
  if (!odFinnes()) return kort('Elevmappe på OneDrive', '<p class="smaa" style="margin-top:0">Virker bare i det installerte programmet.</p>', 's6 gronn');
  return kort('Elevmappe på OneDrive', i.elevmappe ? `
    <p class="smaa" style="margin-top:0">VEKTRA er koblet til elevmappen din. Loggboka di lagres der, og «Lever logg» sender den rett til læreren.</p>
    <label class="felt"><span>Elevmappe</span><input type="text" readonly value="${esc(i.elevmappe)}"></label>
    <div class="verktoylinje"><button class="btn sek" id="od-koble">Koble til på nytt …</button><button class="btn sek" id="od-sjekk">Se etter tilbakemeldinger</button></div>`
    : `<p class="smaa" style="margin-top:0">Har læreren delt en mappe med navnet ditt på OneDrive? Legg den til med «Legg til snarvei i Mine filer», og koble VEKTRA til den her.</p>
    <div class="verktoylinje"><button class="btn" id="od-koble">Koble til elevmappen …</button></div>`, 's6 gronn');
}
function odKoblElevKort(el) {
  const k = $('#od-koble', el); if (k) k.onclick = odKobleElevmappe;
  const s = $('#od-sjekk', el); if (s) s.onclick = async () => { const n = await odLesTilbakemeldinger(); if (!n) toast('Ingen nye tilbakemeldinger.'); };
}
async function odKobleElevmappe() {
  if (!odFinnes()) { toast('Dette virker bare i det installerte programmet.', true); return; }
  const r = await api.odVelgElevmappe();
  if (!r) return;
  if (r.feil) { toast(r.feil, true); return; }
  const n = r.nokkel || {};
  if (n.type !== 'vektra-elev' || !n.navn) { toast('Dette er ikke en elevmappe fra VEKTRA.', true); return; }
  if (!await bekreft(`Du blir koblet til som <b>${esc(n.navn)}</b> i <b>${esc(n.klasse || '')}</b>.<br><br>${r.harData ? 'Det ligger allerede en loggbok i elevmappen (for eksempel fra en annen PC). VEKTRA bruker den.' : 'Loggboka di blir kopiert til elevmappen på OneDrive. Den er da trygg selv om du bytter PC. Originalen blir liggende på denne PC-en.'}`, { ja: 'Koble til', tittel: 'Koble til elevmappen' })) return;
  const settProfil = () => { const i = D().innst; Object.assign(i, { navn: n.navn, klasse: n.klasse || '', rolle: 'elev', elevId: n.id, elevmappe: r.mappe, fullfortOppstart: true }); };
  settProfil();
  await Lager.skrivNa();
  const modus = r.harData ? 'bruk' : 'kopier';
  const res = await api.byttMappe(r.elevdata, modus, JSON.stringify(D()));
  if (!res.ok) { toast('Kunne ikke koble til: ' + res.feil, true); return; }
  if (modus === 'bruk' && res.tekst) { Lager.d = migrer(JSON.parse(res.tekst)); settProfil(); settTema(D().innst.tema); }
  Lager.lagre(); oppdaterProfil(); visSide();
  toast(`Koblet til elevmappen som ${n.navn}.`);
  odLesTilbakemeldinger();
}

/* ============ Elev: lever loggboka til «Til lærer» ============ */
async function odLeverLogg(innhold, video) {
  const r = await api.odLever(D().innst.elevmappe, { filnavn: OD_LOGG, innhold, media: video });
  if (!r.ok) { toast('Kunne ikke levere til OneDrive: ' + r.feil, true); return false; }
  return r;
}

/* ============ Elev: les tilbakemeldinger fra «Fra lærer» ============ */
async function odLesTilbakemeldinger() {
  if (!odErKoblet() || !api.odLesFraLaerer) return 0;
  const filer = await api.odLesFraLaerer(D().innst.elevmappe);
  const f = filer.find(x => x.navn === OD_TILBAKE); if (!f) return 0;
  let o; try { o = JSON.parse(f.innhold); } catch (e) { return 0; }
  if (o.type !== 'vektra-tilbakemelding' || !o.tilbakemeldinger) return 0;
  let nye = 0, endret = false;
  D().logger.forEach(l => {
    const t = o.tilbakemeldinger[l.id];
    if (t && t.tekst) {
      if (l.tilbakemelding?.tekst !== t.tekst) { if (!l.tilbakemelding?.tekst) nye++; endret = true; }
      l.tilbakemelding = { tekst: t.tekst, av: t.av || 'Lærer', dato: t.dato, viaOneDrive: true };
    } else if (l.tilbakemelding?.viaOneDrive) { l.tilbakemelding = null; endret = true; }
  });
  if (endret) { Lager.lagre(); if (aktiv === 'lg-loggbok') visSide(); }
  if (nye) toast(nye === 1 ? 'Du har fått en ny tilbakemelding fra læreren.' : `Du har fått ${nye} nye tilbakemeldinger fra læreren.`);
  return nye;
}

/* ============ Lærer: send tilbakemeldingene til elevens «Fra lærer» ============ */
async function odSendTilbakemeldinger(elevId, { stille = false } = {}) {
  const o = D().onedrive; const rel = odElevRel(elevId);
  if (!odFinnes() || !o?.rot || !rel) return false;
  const tb = {};
  lgLoggerFor(elevId).forEach(l => { if (l.tilbakemelding?.tekst) tb[l.id] = { tekst: l.tilbakemelding.tekst, av: personNavn(l.tilbakemelding.av) || 'Lærer', dato: l.tilbakemelding.dato }; });
  const innhold = JSON.stringify({ type: 'vektra-tilbakemelding', versjon: 1, elevId, oppdatert: new Date().toISOString(), tilbakemeldinger: tb }, null, 1);
  const r = await api.odSkrivTilElev(o.rot, rel, OD_TILBAKE, innhold);
  if (!r.ok) { toast('Tilbakemeldingen ble lagret, men kunne ikke sendes til elevmappen: ' + r.feil, true); return false; }
  if (!stille) toast(`Tilbakemeldingen er sendt til ${personNavn(elevId)} via OneDrive.`);
  return true;
}

/* ============ Lærer: hent alle loggene fra «Til lærer» ============ */
async function odHentInnleveringer() {
  const o = D().onedrive;
  return api.odHentInnleveringer(o.rot, Object.values(o.mapper));
}
const odLaererKlar = () => odFinnes() && !!D().onedrive?.rot && Object.keys(D().onedrive.mapper || {}).length > 0;

/* Elevens PC: se etter tilbakemeldinger ved oppstart og hvert annet minutt */
setTimeout(() => { odLesTilbakemeldinger(); setInterval(odLesTilbakemeldinger, 120000); }, 3000);
