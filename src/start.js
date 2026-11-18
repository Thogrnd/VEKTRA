/* VEKTRA – oppstart og globale hendelser */
'use strict';

function oppdaterProfil() {
  const i = D().innst;
  const meg_ = (D().laerere || []).find(l => l.navn === i.navn);
  if (meg_ && meg_.bilde) $('#avatar').innerHTML = `<img src="${meg_.bilde}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  else $('#avatar').textContent = initialer(i.navn || '?');
  $('#profilnavn').textContent = i.navn || 'Ukjent bruker';
  $('#profilrolle').textContent = i.rolle === 'elev' ? `Elev${i.klasse ? ' · ' + i.klasse : ''}` : 'Lærer Vg1 bygg- og anleggsteknikk';
}
function settTema(t) {
  document.body.classList.toggle('lys', t === 'lys');
  D().innst.tema = t;
}

/* ---------- Meny, faner og toppfelt ---------- */
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.id;
  const m = MENY.find(x => x.id === id);
  if (m && m.handling === 'tema') { settTema(document.body.classList.contains('lys') ? 'mork' : 'lys'); Lager.lagre(); return; }
  if (m && m.under) {
    if (m.laerer && !opplast) { apneSide(m.under[0].id); return; }
    const side = $('#side');
    if (side.classList.contains('smal')) { side.classList.remove('smal'); apne.add(id); }
    else apne.has(id) ? apne.delete(id) : apne.add(id);
    if (apne.has(id) && SIDER[aktiv]?.forelder?.id !== id) apneSide(m.under[0].id); else tegnMeny();
    return;
  }
  apneSide(id);
});
$('#faner').addEventListener('click', e => {
  const x = e.target.closest('[data-lukk]'); if (x) { e.stopPropagation(); lukkFane(x.dataset.lukk); return; }
  const b = e.target.closest('.fane'); if (b) apneSide(b.dataset.id);
});
$('#faner').addEventListener('auxclick', e => { const b = e.target.closest('.fane'); if (b && e.button === 1) lukkFane(b.dataset.id); });
$('#skjulmeny').onclick = () => $('#side').classList.toggle('smal');
$('#profil').onclick = () => apneSide('innstillinger');
$('#laerermodus').onclick = () => { settLaas(false); toast('Lærermodus er låst.'); };
$('#dato').textContent = new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }) + ` · uke ${ukenr(new Date())}`;
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (SIDER[id] && id !== aktiv) apneSide(id); });

/* Ctrl+W lukker fane, Ctrl+Tab bytter fane */
document.addEventListener('keydown', e => {
  if (document.querySelector('.modalbak')) return;
  if (e.ctrlKey && e.key.toLowerCase() === 'w') { e.preventDefault(); lukkFane(aktiv); }
  if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); const i = faner.indexOf(aktiv); apneSide(faner[(i + (e.shiftKey ? -1 : 1) + faner.length) % faner.length]); }
  if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#sok').focus(); }
});

/* ---------- Søk ---------- */
function sokTreff(q) {
  q = q.toLowerCase();
  const ut = [];
  for (const [id, s] of Object.entries(SIDER)) {
    if (s.laerer && !opplast) continue;
    if (s.navn.toLowerCase().includes(q) || (s.forelder && s.forelder.navn.toLowerCase().includes(q))) ut.push({ t: s.navn, u: s.forelder ? s.forelder.navn : 'Side', id });
  }
  const d = D();
  if (opplast) {
    d.elever.forEach(e => { if (e.navn.toLowerCase().includes(q)) ut.push({ t: e.navn, u: 'Elev i ' + klasseNavn(e.klasseId), id: 'reg-klasser', k: e.klasseId }); });
    d.laerere.forEach(l => { if (l.navn.toLowerCase().includes(q)) ut.push({ t: l.navn, u: 'Lærer', id: 'reg-laerere' }); });
  }
  d.prosjekter.forEach(p => { if (p.navn.toLowerCase().includes(q)) ut.push({ t: p.navn, u: 'Prosjekt', id: 'lp-prosjekter' }); });
  d.oppgaver.forEach(o => { if (o.tittel.toLowerCase().includes(q)) ut.push({ t: o.tittel, u: 'Oppgave', id: 'lp-oppgaver' }); });
  d.avvik.forEach(a => { if (avvikSok(a).includes(q)) ut.push({ t: a.tittel || a.beskrivelse, u: 'Avvik ' + (a.kode || ''), id: 'am-avvik', avvik: a.id }); });
  d.risiko.forEach(r => { if ((r.tittel + ' ' + r.elev).toLowerCase().includes(q) && (r.kilde !== 'innlevert' || opplast)) ut.push({ t: r.tittel || 'Risikovurdering', u: 'Risikovurdering · ' + r.elev, id: 'hms-risiko', r: r.id }); });
  return ut.slice(0, 9);
}
let sokValgt = 0, sokListe = [];
function visSok() {
  const q = $('#sok').value.trim(); const box = $('#sokliste');
  if (!q) { box.classList.add('skjult'); return; }
  sokListe = sokTreff(q); sokValgt = 0;
  box.innerHTML = sokListe.length ? sokListe.map((t, i) => `<button data-i="${i}" class="${i === 0 ? 'valgt' : ''}">${esc(t.t)}<small>${esc(t.u)}</small></button>`).join('') : '<button disabled>Ingen treff</button>';
  box.classList.remove('skjult');
}
function velgSok(i) {
  const t = sokListe[i]; if (!t) return;
  $('#sok').value = ''; $('#sokliste').classList.add('skjult');
  if (t.k) { kkValgtKlasse = t.k; regValgtKlasse = t.k; }
  if (t.r) hrApne = t.r;
  apneSide(t.id);
  if (t.avvik) { const a = D().avvik.find(x => x.id === t.avvik); if (a) setTimeout(() => redigerAvvik(a), 50); }
}
$('#sok').addEventListener('input', visSok);
$('#sok').addEventListener('keydown', e => {
  const n = sokListe.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!n) return; sokValgt = (sokValgt + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; $$('#sokliste button').forEach((b, i) => b.classList.toggle('valgt', i === sokValgt)); }
  if (e.key === 'Enter') { e.preventDefault(); velgSok(sokValgt); }
  if (e.key === 'Escape') { $('#sok').value = ''; $('#sokliste').classList.add('skjult'); }
});
$('#sokliste').addEventListener('mousedown', e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); velgSok(+b.dataset.i); } });
$('#sok').addEventListener('blur', () => setTimeout(() => $('#sokliste').classList.add('skjult'), 150));

/* ---------- Første oppstart ---------- */
async function forsteOppstart() {
  const r = await skjema({
    tittel: 'Velkommen til VEKTRA',
    lagreTekst: 'Kom i gang',
    felt: [
      { navn: 'navn', etikett: 'Ditt navn', kreves: true },
      { navn: 'rolle', etikett: 'Hvem bruker denne PC-en?', type: 'select', valg: [['laerer', 'Lærer'], ['elev', 'Elev']], verdi: 'laerer' },
      { navn: 'klasse', etikett: 'Klasse (for elever, f.eks. 1BA)' }
    ]
  });
  const i = D().innst;
  if (r) {
    i.navn = r.navn; i.rolle = r.rolle; i.klasse = r.klasse;
    if (r.rolle === 'laerer' && !D().laerere.some(l => l.navn === r.navn)) D().laerere.push({ id: nyId(), navn: r.navn, epost: '' });
  }
  i.fullfortOppstart = true;
  Lager.lagre(); oppdaterProfil(); visSide();
}

/* ---------- Start ---------- */
(async function start() {
  await Lager.start();
  settTema(D().innst.tema);
  oppdaterProfil();
  if (api) api.vedOppdatering(s => { if (typeof vedOppdateringStatus === 'function') vedOppdateringStatus(s); });
  const h = location.hash.slice(1);
  apneSide(SIDER[h] ? h : 'hjem');
  if (!D().innst.fullfortOppstart) forsteOppstart();
})();
