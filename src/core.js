/* VEKTRA – kjerne: datalager, meny, faner, lærerlås, dialoger og hjelpefunksjoner */
'use strict';

const api = window.klarApi || null;            // finnes bare i det installerte programmet
/* TESTKNAPPER: «Slett valgte» i avvik og risikovurderinger. Bare for testing.
   SKAL FJERNES i endelig versjon: sett til false (eller slett alt som bruker TESTKNAPPER). */
const TESTKNAPPER = true;
const STANDARD_PW = '63f61a28f36649c3630ad9dba1718dbf2076368e63e6594202860fdf4f8aeaf4';      // felles lærerpassord: Malakoff
const GAMMELT_PW = '25a2c693d1d9835d8f9c6636fa7e60ec7c4bbfc7a49a5bd735bc889f3638a7c4';      // tidligere standardpassord

/* ============ Hjelpefunksjoner ============ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const nyId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const idag = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const visDato = (s) => { if (!s) return '–'; const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
const dagerTil = (s) => s ? Math.round((new Date(s) - new Date(idag())) / 86400000) : null;
const ukenr = (dato) => { const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate())); const dag = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dag); const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - start) / 86400000 + 1) / 7); };
const elevNavn = (e) => e ? (e.navn ?? `${e.fornavn || ''} ${e.etternavn || ''}`.trim()) : '';
const initialer = (t) => String(t || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';
const sortNavn = (a, b) => a.localeCompare(b, 'nb');
const st = (t, k) => `<span class="status st-${k}">${esc(t)}</span>`;
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function blander(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/* ============ Datalager ============ */
function standardData() {
  return {
    versjon: 2,
    innst: { navn: '', rolle: 'laerer', klasse: '', pwHash: STANDARD_PW, tema: 'mork', fullfortOppstart: false },
    klasser: [],     // {id, navn, regler}
    elever: [],      // {id, navn, klasseId, bilde}
    laerere: [],     // {id, navn, epost}
    rom: [], oppsett: [],
    prosjekter: [], oppgaver: [],
    hmsMal: ['Alle bruker riktig verneutstyr', 'Rømningsveier er frie og ryddige', 'Elektroverktøy og ledninger er kontrollert', 'Førstehjelpsskrin og øyeskyll er på plass', 'Støvavsug og ventilasjon er i gang', 'Stiger og stillas er kontrollert']
      .map(t => ({ id: nyId(), tekst: t })),
    hmsLogg: [], verneutstyr: [], verktoy: [], deler: [], avvik: [], logger: [], opplaering: [], opplMaler: {},
    risiko: []
  };
}
function migrer(d) {
  const s = standardData();
  if (!d || typeof d !== 'object') return s;
  const gammel = !d.versjon || d.versjon < 2;
  for (const k of Object.keys(s)) if (d[k] === undefined) d[k] = s[k];
  d.innst = Object.assign({}, s.innst, d.innst);
  if (d.innst.pwHash === GAMMELT_PW) d.innst.pwHash = STANDARD_PW;   // bytt det gamle standardpassordet til det nye
  if (gammel) {
    // versjon 1 -> 2: elevene flyttes ut av klassene, og bare fornavnet beholdes
    (d.klasser || []).forEach(k => {
      const brukt = new Set(d.elever.filter(e => e.klasseId === k.id).map(e => e.navn.toLowerCase()));
      (k.elever || []).forEach(e => {
        let navn = (e.fornavn || '').trim() || 'Uten navn';
        if (brukt.has(navn.toLowerCase()) && e.etternavn) navn = `${navn} ${e.etternavn.trim().charAt(0)}.`;
        brukt.add(navn.toLowerCase());
        d.elever.push({ id: e.id, navn, klasseId: k.id, bilde: e.bilde || '' });
      });
      k._gamle = k.elever; delete k.elever;
    });
    if (d.innst.navn && d.innst.rolle !== 'elev' && !d.laerere.length) d.laerere.push({ id: nyId(), navn: d.innst.navn, epost: '' });
    // navn som var skrevet inn som tekst, kobles til personene i registeret
    const fulltNavn = {};
    (d.klasser || []).forEach(k => (k._gamle || []).forEach(e => { fulltNavn[`${e.fornavn} ${e.etternavn || ''}`.trim().toLowerCase()] = e.id; }));
    d.laerere.forEach(l => { fulltNavn[l.navn.toLowerCase()] = l.id; });
    const tilId = v => (typeof v === 'string' && fulltNavn[v.trim().toLowerCase()]) || v;
    (d.prosjekter || []).forEach(p => { p.ansvarlig = tilId(p.ansvarlig); if (Array.isArray(p.elever)) p.elever = p.elever.map(tilId); });
    (d.oppgaver || []).forEach(o => { o.ansvarlig = tilId(o.ansvarlig); });
    (d.avvik || []).forEach(a => { a.ansvarlig = tilId(a.ansvarlig); });
    (d.klasser || []).forEach(k => delete k._gamle);
    d.versjon = 2;
  }
  if (typeof migrerAvvik === 'function') migrerAvvik(d);   // nytt avviksskjema (v1.13)
  if (typeof migrerLogger === 'function') migrerLogger(d);
  if (typeof migrerOpplaering === 'function') migrerOpplaering(d);
  return d;
}

const Lager = {
  d: null, timer: null,
  async start() {
    let tekst = null;   // i nettleseren tas data fra KLAR (det gamle navnet) med
    try { tekst = api ? await api.les() : (localStorage.getItem('vektra-data') ?? localStorage.getItem('klar-data')); } catch (e) { tekst = null; }
    let d = null;
    if (tekst) {
      try { d = JSON.parse(tekst); }
      catch (e) { setTimeout(() => toast('Datafila kunne ikke leses. Hent en sikkerhetskopi under Innstillinger.', true), 800); }
    }
    this.d = migrer(d);
    settLagreStatus(api ? 'Data lagres lokalt på denne PC-en' : 'Testmodus: data lagres i nettleseren');
  },
  lagre() {
    clearTimeout(this.timer);
    settLagreStatus('Lagrer …');
    this.timer = setTimeout(() => this.skrivNa(), 350);
  },
  async skrivNa() {
    clearTimeout(this.timer); this.timer = null;
    const tekst = JSON.stringify(this.d);
    try {
      if (api) {
        const r = await api.skriv(tekst);
        if (!r.ok) throw new Error(r.feil);
      } else localStorage.setItem('vektra-data', tekst);
      settLagreStatus('Lagret ' + new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      settLagreStatus('Kunne ikke lagre: ' + (e.message || e), true);
    }
  }
};
const D = () => Lager.d;
window.addEventListener('beforeunload', () => { if (Lager.timer) Lager.skrivNa(); });
function settLagreStatus(t, feil) { const el = $('#lagrestatus'); if (el) { el.textContent = t; el.classList.toggle('feil', !!feil); } }

/* ============ Personregister (klasser, elever, lærere) ============ */
/* Elevlistene er bare tilgjengelige for lærer, så elevene ikke ser dem på sin egen PC */
const harRegister = () => !!D() && (D().innst.rolle === 'laerer' || opplast);
const sorterteKlasser = () => [...D().klasser].sort((a, b) => sortNavn(a.navn, b.navn));
const klassensElever = (klasseId) => D().elever.filter(e => e.klasseId === klasseId).sort((a, b) => sortNavn(a.navn, b.navn));
const sorterteLaerere = () => [...D().laerere].sort((a, b) => sortNavn(a.navn, b.navn));
const finnPerson = (id) => D().elever.find(e => e.id === id) || D().laerere.find(l => l.id === id) || null;
const meg = () => { const d = D(); const l = d.laerere.find(x => x.navn === d.innst.navn); return l ? l.id : d.innst.navn; };
const klasseNavn = (id) => (D().klasser.find(k => k.id === id) || {}).navn || '';
/* Navn for en lagret verdi: enten id til en person i registeret, eller fritekst */
function personNavn(v) {
  if (!v) return '';
  const p = finnPerson(v);
  if (p) return p.navn;
  return /^[a-z0-9]{11,}$/.test(v) ? '(slettet person)' : v;
}
const personListe = (liste) => (Array.isArray(liste) ? liste : [liste]).map(personNavn).filter(Boolean).join(', ');
const bildeHtml = (e, kl = '') => e && e.bilde ? `<img src="${e.bilde}" alt="" class="${kl}">` : `<span class="ini ${kl}">${esc(initialer(elevNavn(e)))}</span>`;

/* ============ Felles personvelger ============
   Brukes overalt der man velger elev eller lærer – også i nye faner.
   html:  personVelgerHtml('mitt-id', { flere: true })
   kobl:  const hent = koblPersonVelger(element, { verdi, flere, lagreSom: 'id'|'navn', bare: 'elever'|'laerere', endret: fn })
   hent() gir id (eller navn) – eller en liste når flere: true. Fritekst er lov der navnet ikke finnes i registeret. */
function personVelgerHtml(id, { flere = false } = {}) {
  return `<div class="pv ${flere ? 'pv-flere' : ''}" id="${id}">${flere ? '<div class="navnchips"></div>' : ''}
    <div class="pv-felt"><input type="text" class="pv-inn" autocomplete="off" placeholder="${harRegister() ? (flere ? 'Søk eller velg, du kan velge flere …' : 'Søk eller velg …') : 'Skriv navn'}">
    <span class="pv-pil">▾</span><div class="pv-panel skjult"></div></div></div>`;
}
let pvFilterHusk = '';
function koblPersonVelger(root, { verdi, flere = false, lagreSom = 'id', bare = '', endret } = {}) {
  const inn = $('.pv-inn', root), panel = $('.pv-panel', root), chips = $('.navnchips', root);
  let valgt = flere ? [...(verdi || [])] : (verdi || '');
  let filter = pvFilterHusk, markert = 0, synlige = [];
  const reg = harRegister();
  const tilVerdi = p => lagreSom === 'navn' ? p.navn : p.id;
  const visNavn = v => lagreSom === 'navn' ? v : personNavn(v);
  const meld = () => { if (endret) endret(flere ? [...valgt] : valgt); };

  const tegnChips = () => { if (chips) chips.innerHTML = valgt.length ? valgt.map((v, i) => `<span class="navnchip">${esc(visNavn(v))}<button type="button" data-i="${i}" title="Fjern">×</button></span>`).join('') : '<span class="smaa">Ingen valgt ennå</span>'; };
  const kandidater = () => {
    const q = inn.value.trim().toLowerCase();
    const ut = [];
    if (bare !== 'laerere') sorterteKlasser().forEach(k => { if (!filter || filter === k.id) klassensElever(k.id).forEach(e => ut.push({ p: e, gruppe: k.navn })); });
    if (bare !== 'elever' && (!filter || filter === 'laerere')) sorterteLaerere().forEach(l => ut.push({ p: l, gruppe: 'Lærere' }));
    return ut.filter(x => !q || x.p.navn.toLowerCase().includes(q)).filter(x => !flere || !valgt.includes(tilVerdi(x.p)));
  };
  const tegnPanel = () => {
    synlige = kandidater(); markert = Math.min(markert, Math.max(0, synlige.length - 1));
    const faner = [['', 'Alle'], ...(bare !== 'laerere' ? sorterteKlasser().map(k => [k.id, k.navn]) : []), ...(bare !== 'elever' ? [['laerere', 'Lærere']] : [])];
    let gr = '';
    panel.innerHTML = `<div class="pv-faner">${faner.map(([v, t]) => `<button type="button" data-filter="${v}" class="${v === filter ? 'aktiv' : ''}">${esc(t)}</button>`).join('')}</div>
      ${flere && filter && filter !== 'laerere' && synlige.length ? `<button type="button" class="pv-alle" data-alle>+ Velg alle i ${esc(klasseNavn(filter))} (${synlige.length})</button>` : ''}
      <div class="pv-liste">${synlige.map((x, i) => { const h = x.gruppe !== gr ? `<div class="pv-gruppe">${esc(x.gruppe)}</div>` : ''; gr = x.gruppe;
        return h + `<button type="button" class="pv-rad ${i === markert ? 'markert' : ''}" data-i="${i}">${bildeHtml(x.p, 'pv-bilde')}<span>${esc(x.p.navn)}</span></button>`; }).join('')
        || `<div class="pv-tom">${D().elever.length || D().laerere.length ? 'Ingen treff' : 'Registeret er tomt. Legg inn klasser og elever under Register.'}${inn.value.trim() ? '<br>Trykk Enter for å bruke det du har skrevet.' : ''}</div>`}</div>`;
    const m = $('.markert', panel); if (m) m.scrollIntoView({ block: 'nearest' });
  };
  /* Lista legges oppå alt annet (fast posisjon), så den aldri blir kuttet av kort eller dialoger.
     Er det for lite plass under feltet, åpnes den oppover. */
  const plasser = () => {
    if (panel.classList.contains('skjult')) return;
    const r = inn.getBoundingClientRect();
    const under = window.innerHeight - r.bottom - 12, over = r.top - 12;
    const oppover = under < 260 && over > under;
    const h = Math.max(160, Math.min(380, oppover ? over : under));
    Object.assign(panel.style, { position: 'fixed', left: Math.min(r.left, window.innerWidth - Math.max(r.width, 280) - 8) + 'px', right: 'auto',
      width: Math.max(r.width, 280) + 'px', maxHeight: h + 'px',
      top: oppover ? 'auto' : (r.bottom + 4) + 'px', bottom: oppover ? (window.innerHeight - r.top + 4) + 'px' : 'auto' });
  };
  const apne = () => {
    if (!reg) return;
    const varApen = !panel.classList.contains('skjult');
    panel.classList.remove('skjult'); tegnPanel(); plasser();
    if (!varApen) { window.addEventListener('scroll', plasser, true); window.addEventListener('resize', plasser); }
  };
  const lukk = () => { panel.classList.add('skjult'); window.removeEventListener('scroll', plasser, true); window.removeEventListener('resize', plasser); };
  const velg = (p) => {
    if (flere) { valgt.push(tilVerdi(p)); inn.value = ''; tegnChips(); tegnPanel(); plasser(); inn.focus(); }
    else { valgt = tilVerdi(p); inn.value = p.navn; lukk(); }
    meld();
  };
  const fritekst = () => {
    const t = inn.value.trim(); if (!t) return;
    const treff = reg && kandidater().find(x => x.p.navn.toLowerCase() === t.toLowerCase());
    if (treff) { velg(treff.p); return; }
    if (flere) { if (!valgt.includes(t)) valgt.push(t); inn.value = ''; tegnChips(); }
    else valgt = t;
    meld();
  };

  if (!flere) inn.value = visNavn(valgt);
  tegnChips();
  inn.addEventListener('focus', apne);
  inn.addEventListener('click', apne);
  inn.addEventListener('input', () => { markert = 0; if (!flere && !inn.value.trim()) { valgt = ''; meld(); } if (reg) apne(); });
  inn.addEventListener('keydown', e => {
    const n = synlige.length, apen = !panel.classList.contains('skjult');
    if (e.key === 'ArrowDown' && apen) { e.preventDefault(); markert = (markert + 1) % Math.max(1, n); tegnPanel(); }
    else if (e.key === 'ArrowUp' && apen) { e.preventDefault(); markert = (markert - 1 + n) % Math.max(1, n); tegnPanel(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (apen && synlige[markert] && inn.value.trim()) velg(synlige[markert].p); else if (apen && synlige[markert] && !flere) velg(synlige[markert].p); else fritekst(); }
    else if (e.key === 'Escape' && apen) { e.stopPropagation(); lukk(); }
    else if (e.key === 'Tab') lukk();
  });
  inn.addEventListener('blur', () => setTimeout(() => {
    if (root.contains(document.activeElement)) return;
    lukk();
    if (flere) { if (inn.value.trim()) fritekst(); }
    else if (inn.value.trim() !== visNavn(valgt)) fritekst();
  }, 120));
  panel.addEventListener('mousedown', e => e.preventDefault());   // behold fokus i feltet
  panel.addEventListener('click', e => {
    const f = e.target.closest('[data-filter]'); if (f) { filter = pvFilterHusk = f.dataset.filter; markert = 0; tegnPanel(); return; }
    if (e.target.closest('[data-alle]')) { synlige.forEach(x => valgt.push(tilVerdi(x.p))); tegnChips(); tegnPanel(); plasser(); meld(); return; }
    const r = e.target.closest('.pv-rad'); if (r) velg(synlige[+r.dataset.i].p);
  });
  if (chips) chips.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { valgt.splice(+b.dataset.i, 1); tegnChips(); if (!panel.classList.contains('skjult')) { tegnPanel(); plasser(); } meld(); } });
  $('.pv-pil', root).onclick = () => { inn.focus(); apne(); };
  return () => flere ? [...valgt] : valgt;
}

/* ============ Ikoner ============ */
const I = {
  hjem: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  kart: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h3v3H7zM14 9h3v3h-3zM7 15h10"/>',
  prosjekt: '<path d="M3 7h18v13H3z"/><path d="M8 7V4h8v3"/><path d="M3 12h18"/>',
  arbeid: '<path d="M4 14a8 8 0 0 1 16 0v2H4z"/><path d="M12 6V3M2 18h20"/>',
  risiko: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  innst: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>',
  tema: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  hjelp: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5"/>',
  pil: '<path d="M9 6l6 6-6 6"/>',
  laas: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  elev: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  oppd: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5M20 19v-4h-4"/>',
  logg: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6M9 11h4"/>',
  hms: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
};
const svg = (d, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${d}</svg>`;

/* ============ Meny og sider ============ */
const MENY = [
  { id: 'hjem', navn: 'Oversikt', ikon: 'hjem', farge: 'var(--blue2)' },
  { seksjon: 'Grunnlag' },
  { id: 'register', navn: 'Register', ikon: 'elev', farge: 'var(--cyan)', laerer: true, under: [
    { id: 'reg-klasser', navn: 'Klasser og elever' },
    { id: 'reg-laerere', navn: 'Lærere' }] },
  { seksjon: 'Moduler' },
  { id: 'klassekart', navn: 'Klassekart', ikon: 'kart', farge: 'var(--green)', laerer: true, under: [
    { id: 'kk-kart', navn: 'Klassekart' },
    { id: 'kk-makker', navn: 'Makkerpar' }] },
  { id: 'elevlogg', navn: 'Elevmappe', ikon: 'logg', farge: 'var(--green)', under: [
    { id: 'lg-loggbok', navn: 'Loggbok' },
    { id: 'lg-oversikt', navn: 'Lærerens oversikt', laerer: true },
    { id: 'hms-kompetanse', navn: 'Kompetanse og opplæring', laerer: true }] },
  { id: 'ledelse', navn: 'Ledelse av prosjekter', ikon: 'prosjekt', farge: 'var(--purple)', under: [
    { id: 'lp-prosjekter', navn: 'Prosjekter' },
    { id: 'lp-oppgaver', navn: 'Oppgavetavle' },
    { id: 'lp-tidsplan', navn: 'Tidsplan' }] },
  { id: 'arbeidsmiljo', navn: 'Arbeidsmiljø', ikon: 'arbeid', farge: 'var(--orange)', under: [
    { id: 'am-sjekk', navn: 'HMS-sjekkliste' },
    { id: 'am-verneutstyr', navn: 'Verneutstyr' },
    { id: 'am-verktoy', navn: 'Verktøy' },
    { id: 'am-deler', navn: 'Deler' },
    { id: 'am-avvik', navn: 'Avvik' }] },
  { id: 'hms', navn: 'HMS', ikon: 'hms', farge: 'var(--yellow)', under: [
    { id: 'hms-org', navn: 'Organisering og ansvar' },
    { id: 'hms-regler', navn: 'Regler og rutiner' },
    { id: 'hms-risiko', navn: 'Risikovurderinger' },
    { id: 'hms-utstyr', navn: 'Utstyr og stoffer' },
    { id: 'hms-oppfolging', navn: 'Oppfølging' }] },
  { seksjon: 'System' },
  { id: 'innstillinger', navn: 'Innstillinger', ikon: 'innst', farge: 'var(--cyan)' },
  { id: 'tema', navn: 'Bytt tema', ikon: 'tema', handling: 'tema' },
  { id: 'hjelp', navn: 'Hjelp', ikon: 'hjelp', farge: 'var(--cyan)' },
  { id: 'oppdater', navn: 'Se etter oppdateringer', ikon: 'oppd', handling: 'oppdater' }
];
const SIDER = {};        // id -> {navn, farge, forelder, laerer}
MENY.forEach(m => {
  if (!m.id || m.handling) return;
  SIDER[m.id] = { navn: m.navn, farge: m.farge, forelder: null, laerer: !!m.laerer };
  (m.under || []).forEach(u => SIDER[u.id] = { navn: u.navn, farge: m.farge, forelder: m, laerer: !!(m.laerer || u.laerer) });
});
const SIDE = {};         // id -> function(el)  – fylles av modulene
const registrer = (id, fn) => { SIDE[id] = fn; };

let faner = ['hjem'];
let aktiv = 'hjem';
const apne = new Set(['ledelse']);
/* Lærerpassordet er fjernet (nov. 2026): alle sider er åpne. Lisenskoden med modulvalg skal senere bestemme hvem som ser hva.
   Merkingen «laerer» i MENY beholdes til det. */
let opplast = true;
/* Elever: lærersider er alltid skjult. Moduler kan i tillegg skjules av læreren (innst.moduler, fra nøkkelfila i elevmappen).
   innst.moduler = null betyr alle elevmodulene. */
const ELEV_MODULER = MENY.filter(m => m.under && !m.laerer).map(m => m.id);
function erSkjult(id) {
  const i = D()?.innst; const s = SIDER[id];
  if (!i || i.rolle !== 'elev' || !s) return false;
  if (s.laerer) return true;
  const modul = s.forelder ? s.forelder.id : id;
  return Array.isArray(i.moduler) && ELEV_MODULER.includes(modul) && !i.moduler.includes(modul);
}
const erLast = id => erSkjult(id);

function tegnMeny() {
  const forelder = SIDER[aktiv]?.forelder?.id;
  const deler = MENY.map(m => {
    if (m.seksjon) return `<div class="seksjon">${m.seksjon}</div>`;
    if (erSkjult(m.id)) return '';
    const gruppeLast = false;
    const synligeUnder = (m.under || []).filter(u => !erSkjult(u.id));
    if (m.under && !synligeUnder.length) return '';
    const harUnder = synligeUnder.length > 0 && !gruppeLast;
    const erAktiv = aktiv === m.id || (forelder === m.id && (gruppeLast || !apne.has(m.id)));
    const laasIkon = '';
    let h = `<button class="mi ${erAktiv ? 'aktiv' : ''} ${harUnder && apne.has(m.id) ? 'apen' : ''}" data-id="${m.id}" title="${m.navn}">
      ${svg(I[m.ikon])}<span class="lbl">${m.navn}${laasIkon}</span>${harUnder ? svg(I.pil, 'pil') : ''}</button>`;
    if (harUnder) h += `<div class="sub ${apne.has(m.id) ? 'vis' : ''}">` + synligeUnder.map(u =>
      `<button class="si ${aktiv === u.id ? 'aktiv' : ''}" data-id="${u.id}">${u.navn}</button>`).join('') + '</div>';
    return h;
  }).filter(Boolean);
  /* en seksjonsoverskrift uten noe under seg vises ikke */
  $('#nav').innerHTML = deler.filter((h, i) => !h.startsWith('<div class="seksjon">') || (deler[i + 1] && !deler[i + 1].startsWith('<div class="seksjon">'))).join('');
}

function apneSide(id, { tegn = true } = {}) {
  if (!SIDER[id] || erSkjult(id)) id = 'hjem';
  if (!faner.includes(id)) faner.push(id);
  aktiv = id;
  const f = SIDER[id].forelder; if (f && !erLast(id)) apne.add(f.id);
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  if (tegn) { tegnMeny(); tegnFaner(); visSide(); }
}
function lukkFane(id) {
  const i = faner.indexOf(id); if (i < 0) return;
  faner.splice(i, 1);
  if (!faner.length) faner = ['hjem'];
  if (aktiv === id) aktiv = faner[Math.max(0, i - 1)];
  apneSide(aktiv);
}
function faneNavn(id) {
  const s = SIDER[id];
  if (erLast(id)) return s.forelder ? s.forelder.navn : s.navn;
  return (s.forelder ? s.forelder.navn + ' · ' : '') + s.navn;
}
function tegnFaner() {
  $('#faner').innerHTML = faner.map(id => {
    const s = SIDER[id];
    return `<button class="fane ${id === aktiv ? 'aktiv' : ''}" role="tab" data-id="${id}" style="--fc:${s.farge}">
      <span class="prikk" style="background:${s.farge}"></span>${esc(faneNavn(id))}
      ${faner.length > 1 || id !== 'hjem' ? `<span class="x" data-lukk="${id}" title="Lukk fane">×</span>` : ''}</button>`;
  }).join('');
}

/* Tegner aktiv side på nytt. Kalles etter endringer i data. */
function visSide() {
  if (erSkjult(aktiv)) { faner = faner.filter(f => !erSkjult(f)); if (!faner.length) faner = ['hjem']; aktiv = 'hjem'; tegnMeny(); tegnFaner(); }
  const el = $('#innhold');
  const s = SIDER[aktiv];
  const scroll = el.scrollTop;
  const fn = SIDE[aktiv];
  el.innerHTML = '';
  const ramme = document.createElement('div');   // ny ramme hver gang, så hendelser ikke hoper seg opp
  el.appendChild(ramme);
  if (fn) fn(ramme); else ramme.innerHTML = '<p class="tom">Denne siden finnes ikke ennå.</p>';
  gjorSorterbar(ramme);
  if (el.dataset.side === aktiv) el.scrollTop = scroll;
  el.dataset.side = aktiv;
}
/* ============ Sortering av tabeller ============
   Alle tabeller med én overskriftsrad kan sorteres ved å klikke på kolonneoverskriften.
   Klikk én gang = stigende, to ganger = synkende, tre ganger = tilbake til vanlig rekkefølge.
   Rader med klassen «grp» er gruppeoverskrifter: det sorteres innenfor hver gruppe. */
const SORTERING = {};   // "side|tabellnr" -> { kol, retning }
function celleVerdi(td) {
  if (!td) return '';
  if (td.dataset.sort !== undefined) return td.dataset.sort;   // egen sorteringsverdi, f.eks. Lav/Middels/Høy
  const inn = td.querySelector('input:not([type=checkbox]):not([type=file]), select, textarea');
  let t = inn ? inn.value : (td.querySelector('input[type=checkbox]') ? (td.querySelector('input[type=checkbox]').checked ? '1' : '0') : td.textContent);
  t = (t || '').trim();
  const dato = t.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dato) return `${dato[3]}-${dato[2]}-${dato[1]}`;
  return t;
}
function sammenlign(a, b) {
  const tomA = !a || a === '–', tomB = !b || b === '–';
  if (tomA || tomB) return tomA === tomB ? 0 : tomA ? 1 : -1;      // tomme felt nederst
  const na = parseFloat(a.replace(',', '.')), nb = parseFloat(b.replace(',', '.'));
  if (/^-?\d/.test(a) && /^-?\d/.test(b) && !/^\d{4}-\d{2}-\d{2}/.test(a) && !isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, 'nb', { numeric: true, sensitivity: 'base' });
}
function gjorSorterbar(rot) {
  $$('table', rot).forEach((tab, nr) => {
    const thead = tab.tHead, tbody = tab.tBodies[0];
    if (!thead || !tbody || thead.rows.length !== 1 || tab.classList.contains('ikke-sorter')) return;
    const nokkel = aktiv + '|' + nr;
    const opprinnelig = [...tbody.rows];
    const sorter = () => {
      const s = SORTERING[nokkel];
      $$('th', thead).forEach((th, i) => { const p = th.querySelector('.sortpil'); if (p) p.textContent = s && s.kol === i ? (s.retning > 0 ? ' ▲' : ' ▼') : ''; });
      // del opp i grupper (rader med klassen grp starter en ny gruppe)
      const grupper = []; let g = { hode: null, rader: [] };
      opprinnelig.forEach(r => { if (r.classList.contains('grp')) { grupper.push(g); g = { hode: r, rader: [] }; } else g.rader.push(r); });
      grupper.push(g);
      grupper.forEach(gr => {
        const rader = s ? [...gr.rader].sort((x, y) => sammenlign(celleVerdi(x.cells[s.kol]), celleVerdi(y.cells[s.kol])) * s.retning) : gr.rader;
        if (gr.hode) tbody.appendChild(gr.hode);
        rader.forEach(r => tbody.appendChild(r));
      });
    };
    [...thead.rows[0].cells].forEach((th, i) => {
      if (!th.textContent.trim() || th.querySelector('input')) return;
      th.classList.add('sorterbar');
      th.title = 'Klikk for å sortere';
      th.insertAdjacentHTML('beforeend', '<span class="sortpil"></span>');
      th.onclick = () => {
        const s = SORTERING[nokkel];
        SORTERING[nokkel] = !s || s.kol !== i ? { kol: i, retning: 1 } : s.retning > 0 ? { kol: i, retning: -1 } : undefined;
        sorter();
      };
    });
    if (SORTERING[nokkel]) sorter();
  });
}

/* Felles sidehode */
function sidehode(tittel, tekst = '', verktoy = '') {
  const s = SIDER[aktiv];
  return `<div class="sidehode"><div>${s && s.forelder ? `<div class="sti">${esc(s.forelder.navn)} ›</div>` : ''}<h1>${esc(tittel)}</h1>${tekst ? `<p>${tekst}</p>` : ''}</div>${verktoy ? `<div class="verktoy">${verktoy}</div>` : ''}</div>`;
}


/* ============ Dialoger ============ */
function modal(html, { bred = false } = {}) {
  const bak = document.createElement('div');
  bak.className = 'modalbak';
  bak.innerHTML = `<div class="modal ${bred ? 'bred' : ''}" role="dialog">${html}</div>`;
  document.body.appendChild(bak);
  const lukk = () => { bak.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') lukk(); };
  document.addEventListener('keydown', esc_);
  bak.addEventListener('mousedown', e => { if (e.target === bak) lukk(); });
  const forste = bak.querySelector('input,select,textarea'); if (forste) setTimeout(() => forste.focus(), 30);
  return { el: bak.firstElementChild, lukk };
}
function bekreft(tekst, { ja = 'Ja', nei = 'Avbryt', fare = false, tittel = 'Er du sikker?' } = {}) {
  return new Promise(res => {
    const m = modal(`<h2>${esc(tittel)}</h2><p>${tekst}</p><div class="knapper"><button class="btn sek" data-v="0">${esc(nei)}</button><button class="btn ${fare ? 'fare' : ''}" data-v="1">${esc(ja)}</button></div>`);
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { m.lukk(); res(b.dataset.v === '1'); } });
  });
}
function velg(tittel, tekst, knapper) {
  return new Promise(res => {
    const m = modal(`<h2>${esc(tittel)}</h2><p>${tekst}</p><div class="knapper">${knapper.map(k => `<button class="btn ${k.sek ? 'sek' : ''}" data-v="${k.v}">${esc(k.t)}</button>`).join('')}</div>`);
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { m.lukk(); res(b.dataset.v); } });
  });
}
/* Skjema-dialog. felt: [{navn, etikett, type:'text'|'date'|'number'|'select'|'textarea', verdi, valg:[[verdi,tekst]], kreves}] */
function skjema({ tittel, felt, lagreTekst = 'Lagre', slett, bred }) {
  return new Promise(res => {
    const inn = felt.map(f => {
      const v = f.verdi ?? '';
      let k;
      if (f.type === 'select') k = `<select name="${f.navn}">${f.valg.map(([val, t]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') k = `<textarea name="${f.navn}">${esc(v)}</textarea>`;
      else if (f.type === 'person' || f.type === 'personer') k = personVelgerHtml('pv-' + f.navn, { flere: f.type === 'personer' });
      else k = `<input type="${f.type || 'text'}" name="${f.navn}" value="${esc(v)}" ${f.min !== undefined ? `min="${f.min}"` : ''}>`;
      const tag = f.type === 'person' || f.type === 'personer' ? 'div' : 'label';
      const bredde = f.kvart ? 'calc(25% - 6px)' : f.halv ? 'calc(50% - 6px)' : '';
      return `<${tag} class="felt" style="${bredde ? `display:inline-block;width:${bredde};margin-right:6px;vertical-align:top` : ''}"><span>${esc(f.etikett)}${f.kreves ? ' *' : ''}</span>${k}</${tag}>`;
    }).join('');
    const m = modal(`<h2>${esc(tittel)}</h2><form id="mskjema">${inn}<div class="laasfeil" id="mfeil"></div>
      <div class="knapper">${slett ? '<button type="button" class="btn fare" data-slett style="margin-right:auto">Slett</button>' : ''}
      <button type="button" class="btn sek" data-avbryt>Avbryt</button><button class="btn" type="submit">${esc(lagreTekst)}</button></div></form>`, { bred });
    const f = m.el.querySelector('form');
    const velgere = {};
    felt.filter(fe => fe.type === 'person' || fe.type === 'personer').forEach(fe => {
      velgere[fe.navn] = koblPersonVelger(m.el.querySelector('#pv-' + fe.navn), { verdi: fe.verdi, flere: fe.type === 'personer', lagreSom: fe.lagreSom || 'id', bare: fe.bare || '' });
    });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const ut = {};
      for (const fe of felt) {
        if (velgere[fe.navn]) {
          const v = velgere[fe.navn]();
          if (fe.kreves && (!v || !v.length)) { $('#mfeil', m.el).textContent = `«${fe.etikett}» må fylles ut.`; return; }
          ut[fe.navn] = v; continue;
        }
        const val = f.elements[fe.navn].value.trim();
        if (fe.kreves && !val) { $('#mfeil', m.el).textContent = `«${fe.etikett}» må fylles ut.`; f.elements[fe.navn].focus(); return; }
        ut[fe.navn] = fe.type === 'number' ? (val === '' ? 0 : Number(val)) : val;
      }
      m.lukk(); res(ut);
    });
    m.el.querySelector('[data-avbryt]').onclick = () => { m.lukk(); res(null); };
    const sb = m.el.querySelector('[data-slett]');
    if (sb) sb.onclick = async () => { m.lukk(); if (await bekreft('Dette kan ikke angres.', { ja: 'Slett', fare: true })) { slett(); } res(null); };
  });
}
let toastTimer;
function toast(t, feil = false) {
  $$('.toast').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'toast' + (feil ? ' feil' : ''); el.textContent = t;
  document.body.appendChild(el);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), feil ? 6000 : 2600);
}

/* ============ Filer ============ */
async function lagreFil(navn, innhold, filter) {
  if (api) return api.lagreFil({ navn, innhold, filter });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([innhold], { type: 'application/json' }));
  a.download = navn; a.click(); return navn;
}
async function apneFiler(filter, flere = false) {
  if (api) return api.apneFil({ filter, flere });
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = flere;
    if (filter) i.accept = filter.flatMap(f => f.extensions.map(x => '.' + x)).join(',');
    i.onchange = async () => res(await Promise.all([...i.files].map(async f => ({ navn: f.name, innhold: await f.text() }))));
    i.click();
  });
}
/* Bilde fra fil -> komprimert dataURL (kvadratisk utsnitt) */
function lesBilde(fil, str = 240) {
  return new Promise((res, rej) => {
    const tegn = (src) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = str;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, str, str);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej; img.src = src;
    };
    if (typeof fil === 'string') { tegn(fil); return; }      // dataURL fra bildemappe
    const r = new FileReader();
    r.onload = () => tegn(r.result);
    r.onerror = rej; r.readAsDataURL(fil);
  });
}
/* Velg en mappe med bilder. Gir [{navn, kilde}] der kilde er File eller dataURL */
async function apneBildemappe() {
  if (api && api.apneBildemappe) return (await api.apneBildemappe()) || [];
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.webkitdirectory = true; i.multiple = true;
    i.onchange = () => res([...i.files].filter(f => /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name)).map(f => ({ navn: f.name, kilde: f })));
    i.click();
  });
}
/* Skriv ut: legger html i utskriftsområdet og åpner utskriftsdialogen */
/* Skriv ut: viser en forhåndsvisning med knapper for utskrift og PDF.
   Utskriften bruker innholdet i #utskrift (se @media print i style.css). */
function skrivUt(html, tittel = 'Utskrift', { staende = false } = {}) {
  $('#utskrift').innerHTML = html;
  let so = $('#sideoppsett'); if (!so) { so = document.createElement('style'); so.id = 'sideoppsett'; document.head.appendChild(so); }
  so.textContent = staende ? '@media print{@page{size:A4 portrait;margin:12mm}}' : '';
  $$('.forhand-bak').forEach(x => x.remove());
  const v = document.createElement('div');
  v.className = 'visning forhand-bak';
  v.innerHTML = `<div class="forhand-topp">
      <b>Forhåndsvisning</b><span class="smaa">${api ? (staende ? 'A4 stående' : 'A4 liggende') : 'Utskrift og PDF virker i det installerte programmet. I nettleseren kan utskrift være blokkert.'}</span>
      <span class="spacer"></span>
      <button class="btn" id="fh-skriv">Skriv ut</button>
      ${api ? '<button class="btn sek" id="fh-pdf">Lagre som PDF</button>' : ''}
      <button class="btn sek" id="fh-lukk">Lukk (Esc)</button></div>
    <div class="forhand ${staende ? 'staende' : ''}">${html}</div>`;
  document.body.appendChild(v);
  const lukk = () => { v.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') lukk(); };
  document.addEventListener('keydown', esc_);
  $('#fh-lukk', v).onclick = lukk;
  $('#fh-skriv', v).onclick = async () => {
    try {
      if (api && api.skrivUt) { const r = await api.skrivUt(staende); if (r && r.feil) toast('Utskriften ble avbrutt: ' + r.feil, true); }
      else window.print();
    } catch (e) { toast('Utskrift er ikke tilgjengelig her. Bruk det installerte programmet.', true); }
  };
  const pdf = $('#fh-pdf', v);
  if (pdf) pdf.onclick = async () => {
    const navn = (tittel || 'Utskrift').replace(/[\\/:*?"<>|]/g, '').slice(0, 100) + '.pdf';
    const r = await api.lagrePdf(navn, staende);
    if (r) toast('PDF er lagret og åpnet.');
  };
}

/* ============ Diagrammer ============ */
function smultring(deler, senter, under) {
  const tot = deler.reduce((a, d) => a + d.v, 0);
  if (!tot) return `<div class="tom">Ingen data ennå.</div>`;
  const r = 70, c = 2 * Math.PI * r, gap = deler.filter(d => d.v).length > 1 ? 6 : 0; let off = 0;
  const buer = deler.filter(d => d.v).map(d => {
    const l = d.v / tot * c - gap;
    const s = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${d.f}" stroke-width="20" stroke-linecap="${gap ? 'round' : 'butt'}" stroke-dasharray="${Math.max(l, 1)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)" style="filter:drop-shadow(0 0 6px ${d.f})"/>`;
    off += d.v / tot * c; return s;
  }).join('');
  return `<svg viewBox="0 0 200 200" style="width:200px;display:block;margin:0 auto">${buer}
    <text x="100" y="100" text-anchor="middle" fill="currentColor" font-size="28" font-weight="800">${senter}</text>
    <text x="100" y="122" text-anchor="middle" fill="var(--muted)" font-size="11">${esc(under)}</text></svg>
    <div class="legende">${deler.map(d => `<span><i style="background:${d.f}"></i>${esc(d.n)} (${d.v})</span>`).join('')}</div>`;
}
function linje(serier, etiketter) {
  const W = 520, H = 200, P = 30, maks = Math.max(1, ...serier.flatMap(s => s.d)) * 1.15;
  const x = i => P + i * (W - P * 1.5) / Math.max(1, etiketter.length - 1), y = v => H - P - (v / maks) * (H - P * 1.6);
  const rut = [0, .25, .5, .75, 1].map(t => `<line x1="${P}" x2="${W}" y1="${y(maks * t)}" y2="${y(maks * t)}" stroke="var(--line)" stroke-dasharray="3 5"/>`).join('');
  const lin = serier.map(s => {
    const p = s.d.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
    return `<path d="${p} L${x(s.d.length - 1)},${H - P} L${x(0)},${H - P}Z" fill="${s.f}" opacity=".08"/><path d="${p}" fill="none" stroke="${s.f}" stroke-width="2.5" style="filter:drop-shadow(0 0 5px ${s.f})"/>`;
  }).join('');
  const et = etiketter.map((e, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--dim)">${e}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${rut}${lin}${et}</svg>`;
}
const kort = (tittel, html, kl = '', hoyre = '') => `<div class="kort ${kl}"><div class="kh"><h3>${tittel}</h3>${hoyre ? `<div class="hoyre">${hoyre}</div>` : ''}</div>${html}</div>`;
const fremdrift = (p, f) => `<div style="display:flex;align-items:center;gap:8px;min-width:120px"><div class="bar" style="flex:1"><span style="width:${p}%;background:${f};box-shadow:0 0 8px ${f}"></span></div><span class="smaa">${p}%</span></div>`;
