/* VEKTRA – modul: Ledelse av prosjekter (prosjekter, oppgavetavle, tidsplan) */
'use strict';

const P_STATUS = ['Planlagt', 'Pågår', 'På vent', 'Ferdig'];
const P_STATUS_KL = { 'Planlagt': 'ny', 'Pågår': 'pa', 'På vent': 'gul', 'Ferdig': 'ok' };
const KOLONNER = [['gjore', 'Å gjøre', 'var(--blue2)'], ['pagar', 'Pågår', 'var(--orange)'], ['ferdig', 'Ferdig', 'var(--green)']];
const P_FARGER = ['#5b8cff', '#a35cff', '#ff3d7f', '#3ee08f', '#ff8a3d', '#33d6ff', '#ffd23d'];
let lpFilter = '';

const prosjektFarge = (p) => P_FARGER[Math.max(0, D().prosjekter.indexOf(p)) % P_FARGER.length];
/* Fremdrift for en oppgave i prosent (0–100, trinn på 10). Eldre oppgaver uten tall regnes ut fra status. */
const oppgFremdrift = o => o.fremdrift !== undefined && o.fremdrift !== '' ? +o.fremdrift : (o.kolonne === 'ferdig' ? 100 : 0);
/* Prosjektets fremdrift = gjennomsnittet av oppgavene */
function prosjektFremdrift(p) {
  const o = D().oppgaver.filter(x => x.prosjektId === p.id);
  if (!o.length) return p.status === 'Ferdig' ? 100 : 0;
  return Math.round(o.reduce((sum, x) => sum + oppgFremdrift(x), 0) / o.length);
}
/* Holder status og fremdrift i takt: 100 % = ferdig, ferdig = 100 %, over 0 % betyr at oppgaven er i gang */
function synkFremdrift(o, endret) {
  if (endret === 'fremdrift') {
    if (o.fremdrift === 100) o.kolonne = 'ferdig';
    else if (o.fremdrift > 0 && o.kolonne !== 'pagar') o.kolonne = 'pagar';
    else if (o.fremdrift === 0 && o.kolonne === 'ferdig') o.kolonne = 'pagar';
  } else {
    if (o.kolonne === 'ferdig') o.fremdrift = 100;
    else if (o.kolonne === 'gjore' && oppgFremdrift(o) === 100) o.fremdrift = 0;
    else if (o.kolonne === 'pagar' && oppgFremdrift(o) === 100) o.fremdrift = 90;
  }
}
function fristTekst(dato, ferdig) {
  if (!dato) return '–';
  const n = dagerTil(dato);
  if (ferdig) return visDato(dato);
  if (n < 0) return `${visDato(dato)} ${st(`${-n} d over`, 'hoy')}`;
  if (n <= 3) return `${visDato(dato)} ${st(n === 0 ? 'i dag' : `om ${n} d`, 'pa')}`;
  return visDato(dato);
}
async function redigerProsjekt(p) {
  const ny = !p;
  const r = await skjema({
    tittel: ny ? 'Nytt prosjekt' : 'Rediger prosjekt',
    slett: ny ? null : () => { const d = D(); d.prosjekter = d.prosjekter.filter(x => x !== p); d.oppgaver = d.oppgaver.filter(o => o.prosjektId !== p.id); Lager.lagre(); visSide(); },
    felt: [
      { navn: 'navn', etikett: 'Prosjektnavn', verdi: p?.navn, kreves: true },
      { navn: 'gruppe', etikett: 'Gruppenavn', verdi: p?.gruppe, halv: true },
      { navn: 'ansvarlig', etikett: 'Ansvarlig', type: 'person', verdi: p?.ansvarlig ?? meg(), halv: true },
      { navn: 'elever', etikett: 'Elever i prosjektet', type: 'personer', bare: 'elever', verdi: p?.elever || [] },
      { navn: 'start', etikett: 'Start', type: 'date', verdi: p?.start ?? idag(), halv: true },
      { navn: 'frist', etikett: 'Frist', type: 'date', verdi: p?.frist, halv: true },
      { navn: 'status', etikett: 'Status', type: 'select', valg: P_STATUS.map(s => [s, s]), verdi: p?.status ?? 'Planlagt' },
      { navn: 'beskrivelse', etikett: 'Beskrivelse', type: 'textarea', verdi: p?.beskrivelse }
    ]
  });
  if (!r) return;
  if (r.start && r.frist && r.frist < r.start) { toast('Fristen kan ikke være før start. Fristen ble satt lik start.', true); r.frist = r.start; }
  if (ny) D().prosjekter.push({ id: nyId(), ...r }); else Object.assign(p, r);
  Lager.lagre(); visSide();
}
const leggDager = (s, n) => { const t = new Date(s + 'T12:00:00'); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
const dagerMellom = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const oppgStart = o => o.start || o.frist || '';
const oppgSlutt = o => o.frist || o.start || '';
const KOL_FARGE = { gjore: '#5b8cff', pagar: '#ff8a3d', ferdig: '#3ee08f' };
let lpVisning = 'tavle';

/* Risiko for en oppgave: radene i den koblede risikovurderingen som hører til oppgaven */
function oppgaveRisiko(o) {
  const v = o.risikoId && D().risiko.find(x => x.id === o.risikoId);
  if (!v) return null;
  const rader = v.rader.filter(r => r.oppgaveId === o.id);
  const for_ = rader.length ? Math.max(...rader.map(rVerdi)) : null;
  const etterListe = rader.map(rEtter);
  const etter = rader.length && etterListe.every(x => x !== null) ? Math.max(...etterListe) : null;
  return { v, rader, for: for_, etter };
}
function risikoMerke(o) {
  const r = oppgaveRisiko(o);
  if (!r) return '';
  if (!r.rader.length) return `<button class="risikolenke" data-risiko="${o.id}" title="Åpne risikovurderingen">🛡 Ikke vurdert</button>`;
  return `<button class="risikolenke" data-risiko="${o.id}" title="Risiko før → etter tiltak. Klikk for å åpne">🛡 ${rBoks(r.for)} → ${rBoks(r.etter)}</button>`;
}
/* Åpner risikovurderingen til en oppgave */
function apneOppgaveRisiko(o) {
  const r = oppgaveRisiko(o); if (!r) return;
  apneVurdering(r.v.id);
}
/* Kobler oppgaven til en risikovurdering, og lager en rad for oppgaven hvis den ikke har noen */
function kobleRisiko(o, v) {
  o.risikoId = v.id;
  if (!v.prosjektId) v.prosjektId = o.prosjektId;
  if (!v.rader.some(r => r.oppgaveId === o.id)) {
    const tom = v.rader.find(r => !r.oppgaveId && !r.fare.trim() && !r.operasjon.trim());
    if (tom) { tom.oppgaveId = o.id; tom.operasjon = tom.operasjon || o.tittel; }
    else v.rader.push({ ...nyRad(), oppgaveId: o.id, operasjon: o.tittel });
  }
}
function nyRisikovurdering(prosjektId, tittel) {
  const i = D().innst;
  const v = { id: nyId(), tittel: tittel || '', elev: i.navn, klasse: i.klasse || '', dato: idag(), sone: 'rabygg', prosjektId: prosjektId || '', rader: [], status: 'Utkast', kommentar: '', kilde: 'egen' };
  D().risiko.push(v); return v;
}

async function redigerOppgave(o, kolonne = 'gjore', forslag = {}) {
  const d = D(); const ny = !o;
  if (!d.prosjekter.length) { toast('Opprett et prosjekt først.', true); return; }
  const prosjektId = o?.prosjektId ?? forslag.prosjektId ?? (lpFilter || d.prosjekter[0].id);
  const p = d.prosjekter.find(x => x.id === prosjektId);
  const vurd = d.risiko.filter(v => v.kilde !== 'innlevert').sort((a, b) => (b.prosjektId === prosjektId) - (a.prosjektId === prosjektId));
  const r = await skjema({
    tittel: ny ? 'Ny oppgave' : 'Rediger oppgave',
    slett: ny ? null : () => { d.oppgaver = d.oppgaver.filter(x => x !== o); Lager.lagre(); visSide(); },
    felt: [
      { navn: 'tittel', etikett: 'Oppgave', verdi: o?.tittel, kreves: true },
      { navn: 'prosjektId', etikett: 'Prosjekt', type: 'select', valg: d.prosjekter.map(x => [x.id, x.navn]), verdi: prosjektId },
      { navn: 'ansvarlig', etikett: 'Ansvarlig', type: 'person', verdi: o?.ansvarlig },
      { navn: 'start', etikett: 'Startdato', type: 'date', verdi: o?.start ?? forslag.start ?? (p && p.start > idag() ? p.start : idag()), halv: true },
      { navn: 'frist', etikett: 'Sluttdato', type: 'date', verdi: o?.frist ?? forslag.frist ?? '', halv: true },
      { navn: 'kolonne', etikett: 'Status', type: 'select', valg: KOLONNER.map(k => [k[0], k[1]]), verdi: o?.kolonne ?? kolonne, kvart: true },
      { navn: 'fremdrift', etikett: 'Fremdrift', type: 'select', valg: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => [n, n + ' %']), verdi: o ? oppgFremdrift(o) : (kolonne === 'ferdig' ? 100 : 0), kvart: true },
      { navn: 'risikoId', etikett: 'Risikovurdering', type: 'select', halv: true, verdi: o?.risikoId || '',
        valg: [['', 'Ingen'], ['__ny', '+ Lag ny risikovurdering'], ...vurd.map(v => [v.id, (v.tittel || 'Uten tittel') + (v.prosjektId === prosjektId ? ' (dette prosjektet)' : '')])] },
      { navn: 'beskrivelse', etikett: 'Beskrivelse', type: 'textarea', verdi: o?.beskrivelse }
    ]
  });
  if (!r) return;
  if (r.start && r.frist && r.frist < r.start) { toast('Sluttdato kan ikke være før start. Sluttdatoen ble satt lik start.', true); r.frist = r.start; }
  const risValg = r.risikoId; delete r.risikoId;
  r.fremdrift = +r.fremdrift;
  const forFrem = o ? oppgFremdrift(o) : null, forKol = o ? o.kolonne : null;
  if (ny) { o = { id: nyId(), ...r }; d.oppgaver.push(o); } else Object.assign(o, r);
  // den som ble endret, bestemmer: endret fremdrift -> status følger, endret status -> fremdrift følger
  if (ny ? r.fremdrift !== (r.kolonne === 'ferdig' ? 100 : 0) : r.fremdrift !== forFrem) synkFremdrift(o, 'fremdrift');
  else if (ny || r.kolonne !== forKol) synkFremdrift(o, 'kolonne');
  let apne = false;
  if (risValg === '__ny') { const pr = d.prosjekter.find(x => x.id === o.prosjektId); kobleRisiko(o, nyRisikovurdering(o.prosjektId, pr ? pr.navn : o.tittel)); apne = true; }
  else if (risValg) kobleRisiko(o, d.risiko.find(v => v.id === risValg));
  else o.risikoId = '';
  const pr = d.prosjekter.find(x => x.id === o.prosjektId);
  if (pr && o.frist && pr.frist && o.frist > pr.frist) toast(`Obs: oppgaven slutter etter prosjektets frist (${visDato(pr.frist)}).`, true);
  oppdaterProsjektStatus(pr);
  Lager.lagre();
  if (apne) { toast('Risikovurderingen er laget. Fyll inn farene for oppgaven.'); apneOppgaveRisiko(o); } else visSide();
}
/* Prosjekt går automatisk til «Pågår» når en oppgave startes, og til «Ferdig» når alle er ferdige */
function oppdaterProsjektStatus(p) {
  if (!p || p.status === 'På vent') return;
  const o = D().oppgaver.filter(x => x.prosjektId === p.id);
  if (!o.length) return;
  if (o.every(x => x.kolonne === 'ferdig')) p.status = 'Ferdig';
  else if (o.some(x => x.kolonne !== 'gjore')) p.status = 'Pågår';
  else if (p.status === 'Ferdig') p.status = 'Pågår';
}

/* ================= Prosjekter ================= */
registrer('lp-prosjekter', el => {
  const d = D();
  const liste = [...d.prosjekter].sort((a, b) => (a.status === 'Ferdig') - (b.status === 'Ferdig') || (a.frist || '9').localeCompare(b.frist || '9'));
  const aktive = d.prosjekter.filter(p => p.status !== 'Ferdig');
  el.innerHTML = sidehode('Prosjekter', `${aktive.length} aktive · ${d.prosjekter.length - aktive.length} ferdige`, '<button class="btn" id="nytt">+ Nytt prosjekt</button>') +
    `<div class="kort s12 lilla">${liste.length ? `<table><thead><tr><th>Prosjekt</th><th>Gruppe</th><th>Ansvarlig</th><th>Start</th><th>Frist</th><th>Fremdrift</th><th>Status</th><th></th></tr></thead><tbody>
      ${liste.map(p => `<tr class="klikk" data-p="${p.id}"><td><b><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${prosjektFarge(p)};margin-right:8px"></span>${esc(p.navn)}</b>${p.beskrivelse ? `<div class="smaa" style="margin-top:3px">${esc(p.beskrivelse.slice(0, 90))}${p.beskrivelse.length > 90 ? '…' : ''}</div>` : ''}</td>
        <td>${esc(p.gruppe || '–')}${p.elever && p.elever.length ? `<div class="elevnavn">${esc(personListe(p.elever))}</div>` : ''}</td><td>${esc(personNavn(p.ansvarlig) || '–')}</td><td>${visDato(p.start)}</td><td>${fristTekst(p.frist, p.status === 'Ferdig')}</td>
        <td>${fremdrift(prosjektFremdrift(p), prosjektFarge(p))}</td><td>${st(p.status, P_STATUS_KL[p.status])}</td>
        <td><button class="lenkeknapp vis-oppg" data-p="${p.id}">Oppgaver (${d.oppgaver.filter(o => o.prosjektId === p.id).length})</button></td></tr>`).join('')}
    </tbody></table>` : '<div class="tom">Ingen prosjekter ennå. Lag det første med «+ Nytt prosjekt».</div>'}</div>`;
  $('#nytt', el).onclick = () => redigerProsjekt(null);
  $$('tr[data-p]', el).forEach(tr => tr.onclick = e => {
    if (e.target.closest('.vis-oppg')) { lpFilter = tr.dataset.p; apneSide('lp-oppgaver'); return; }
    redigerProsjekt(d.prosjekter.find(p => p.id === tr.dataset.p));
  });
});

/* ================= Oppgavetavle (tavle, Gantt og liste) ================= */
registrer('lp-oppgaver', el => {
  const d = D();
  if (lpFilter && !d.prosjekter.some(p => p.id === lpFilter)) lpFilter = '';
  const oppg = d.oppgaver.filter(o => !lpFilter || o.prosjektId === lpFilter);
  const vis = [['tavle', 'Tavle'], ['gantt', 'Gantt'], ['liste', 'Liste']];
  el.innerHTML = sidehode('Oppgavetavle', lpVisning === 'gantt' ? 'Dra en stolpe for å flytte oppgaven, eller dra i kantene for å endre start og slutt.' : lpVisning === 'tavle' ? 'Dra oppgavene mellom kolonnene. Klikk på en oppgave for å endre den.' : 'Alle oppgaver med datoer, ansvarlig og risiko.', '<button class="btn" id="ny">+ Oppgave</button>') +
    `<div class="kort s12 lilla">
      <div class="verktoylinje"><span class="smaa">Prosjekt</span><select id="filter"><option value="">Alle prosjekter</option>${d.prosjekter.map(p => `<option value="${p.id}" ${p.id === lpFilter ? 'selected' : ''}>${esc(p.navn)}</option>`).join('')}</select>
        <span class="spacer"></span><div class="pv-faner" style="padding:0;border:0">${vis.map(([v, t]) => `<button type="button" data-vis="${v}" class="${v === lpVisning ? 'aktiv' : ''}">${t}</button>`).join('')}</div></div>
      <div id="lp-innhold"></div></div>`;
  const inn = $('#lp-innhold', el);
  $('#ny', el).onclick = () => redigerOppgave(null, 'gjore', { prosjektId: lpFilter || undefined });
  $('#filter', el).onchange = e => { lpFilter = e.target.value; visSide(); };
  $$('[data-vis]', el).forEach(b => b.onclick = () => { lpVisning = b.dataset.vis; visSide(); });
  el.addEventListener('click', e => { const b = e.target.closest('[data-risiko]'); if (b) { e.stopPropagation(); apneOppgaveRisiko(d.oppgaver.find(o => o.id === b.dataset.risiko)); } }, true);

  if (lpVisning === 'gantt') {
    gantt(inn, d.prosjekter.filter(p => !lpFilter || p.id === lpFilter));
    inn.insertAdjacentHTML('afterbegin', '<div class="verktoylinje" style="justify-content:flex-end;margin-top:-6px"><button class="btn sek liten" id="skriv-plan">Skriv ut tidsplan …</button></div>');
    $('#skriv-plan', inn).onclick = () => tidsplanUtskriftValg(lpFilter);
    return;
  }

  if (lpVisning === 'liste') {
    const liste = [...oppg].sort((a, b) => (oppgStart(a) || '9').localeCompare(oppgStart(b) || '9'));
    inn.innerHTML = liste.length ? `<table><thead><tr><th>Oppgave</th><th>Prosjekt</th><th>Ansvarlig</th><th>Start</th><th>Slutt</th><th>Dager</th><th>Status</th><th>Fremdrift</th><th>Risiko før → etter</th></tr></thead><tbody>
      ${liste.map(o => { const p = d.prosjekter.find(x => x.id === o.prosjektId); const kol = KOLONNER.find(k => k[0] === o.kolonne);
        return `<tr class="klikk" data-o="${o.id}"><td><b>${esc(o.tittel)}</b></td><td>${esc(p ? p.navn : '–')}</td><td>${esc(personNavn(o.ansvarlig) || '–')}</td><td>${visDato(o.start)}</td>
          <td>${fristTekst(o.frist, o.kolonne === 'ferdig')}</td><td>${o.start && o.frist ? dagerMellom(o.start, o.frist) + 1 : '–'}</td><td>${st(kol ? kol[1] : '', { gjore: 'ny', pagar: 'pa', ferdig: 'ok' }[o.kolonne])}</td><td data-sort="${oppgFremdrift(o)}">${fremdrift(oppgFremdrift(o), KOL_FARGE[o.kolonne] || '#5b8cff')}</td><td>${risikoMerke(o) || '<span class="smaa">Ingen</span>'}</td></tr>`; }).join('')}
    </tbody></table>` : '<div class="tom">Ingen oppgaver ennå.</div>';
    $$('tr[data-o]', inn).forEach(tr => tr.onclick = () => redigerOppgave(d.oppgaver.find(o => o.id === tr.dataset.o)));
    return;
  }

  inn.innerHTML = `<div class="kanban">${KOLONNER.map(([k, navn, f]) => {
    const her = oppg.filter(o => o.kolonne === k).sort((a, b) => (oppgSlutt(a) || '9').localeCompare(oppgSlutt(b) || '9'));
    return `<div class="kol" data-kol="${k}"><h4><span>${navn}</span><span>${her.length}</span></h4>
      ${her.map(o => { const p = d.prosjekter.find(x => x.id === o.prosjektId); return `<div class="oppg" draggable="true" data-o="${o.id}" style="--kc:${p ? prosjektFarge(p) : f}">
        ${esc(o.tittel)}<small>${esc(p ? p.navn : '')}${o.ansvarlig ? ' · ' + esc(personNavn(o.ansvarlig)) : ''}</small>
        <small>${o.start || o.frist ? `${visDato(o.start)} – ${fristTekst(o.frist, k === 'ferdig')}` : ''}</small>
        <div class="oppg-frem" title="Fremdrift ${oppgFremdrift(o)} %"><div class="bar"><span style="width:${oppgFremdrift(o)}%;background:${KOL_FARGE[k]}"></span></div><span>${oppgFremdrift(o)} %</span></div>${risikoMerke(o)}</div>`; }).join('')}
      <button class="lenkeknapp ny-her" data-kol="${k}">+ Legg til</button></div>`;
  }).join('')}</div>`;
  $$('.ny-her', inn).forEach(b => b.onclick = () => redigerOppgave(null, b.dataset.kol, { prosjektId: lpFilter || undefined }));
  $$('.oppg', inn).forEach(k => k.onclick = () => redigerOppgave(d.oppgaver.find(o => o.id === k.dataset.o)));
  let dras = null;
  inn.addEventListener('dragstart', e => { const k = e.target.closest('.oppg'); if (k) { dras = k.dataset.o; e.dataTransfer.effectAllowed = 'move'; } });
  inn.addEventListener('dragover', e => { const k = e.target.closest('.kol'); if (k && dras) { e.preventDefault(); $$('.kol', inn).forEach(x => x.classList.toggle('over', x === k)); } });
  inn.addEventListener('drop', e => {
    const k = e.target.closest('.kol'); if (!k || !dras) return; e.preventDefault();
    const o = d.oppgaver.find(x => x.id === dras); dras = null;
    if (o && o.kolonne !== k.dataset.kol) { o.kolonne = k.dataset.kol; synkFremdrift(o, 'kolonne'); oppdaterProsjektStatus(d.prosjekter.find(p => p.id === o.prosjektId)); Lager.lagre(); }
    visSide();
  });
  inn.addEventListener('dragend', () => $$('.kol', inn).forEach(x => x.classList.remove('over')));
});

/* ================= Gantt-skjema ================= */
/* Tegner prosjekter med oppgavene under. Stolpene kan dras (flytt) eller strekkes i kantene. */
function gantt(el, prosjekter) {
  const d = D();
  const rader = [];
  prosjekter.sort((a, b) => (a.start || '9').localeCompare(b.start || '9')).forEach(p => {
    rader.push({ type: 'p', p, start: p.start, slutt: p.frist });
    d.oppgaver.filter(o => o.prosjektId === p.id).sort((a, b) => (oppgStart(a) || '9').localeCompare(oppgStart(b) || '9'))
      .forEach(o => rader.push({ type: 'o', o, p, start: oppgStart(o), slutt: oppgSlutt(o) }));
  });
  const datoer = rader.flatMap(r => [r.start, r.slutt]).filter(Boolean);
  if (!datoer.length) { el.innerHTML = '<div class="tom">Legg inn start- og sluttdatoer på prosjekter og oppgaver, så vises de her.</div>'; return; }
  datoer.push(idag()); datoer.sort();
  let min = new Date(datoer[0] + 'T12:00:00'); min.setDate(min.getDate() - ((min.getDay() + 6) % 7));
  let maks = new Date(datoer[datoer.length - 1] + 'T12:00:00'); maks.setDate(maks.getDate() + 8 - (maks.getDay() || 7));
  const minS = min.toISOString().slice(0, 10);
  const tot = dagerMellom(minS, maks.toISOString().slice(0, 10));
  const x = s => dagerMellom(minS, s) / tot * 100;
  const uker = []; for (let i = 0; i < tot; i += 7) { const s = leggDager(minS, i); uker.push({ x: i / tot * 100, n: ukenr(new Date(s + 'T12:00:00')), s }); }
  const rutenett = uker.map(u => `<div class="gantt-uke" style="left:${u.x}%"></div>`).join('') + `<div class="gantt-idag" style="left:${x(idag()) + 50 / tot}%" title="I dag"></div>`;
  const legende = `<div class="gantt-legende">
    <span><span class="gantt-farge gantt-farge-prosjekt"></span>Prosjekt (lys del = fremdrift)</span>
    <span><span class="gantt-farge" style="background:${KOL_FARGE.gjore}"></span>Oppgave: å gjøre</span>
    <span><span class="gantt-farge" style="background:${KOL_FARGE.pagar}"></span>Oppgave: pågår</span>
    <span><span class="gantt-farge" style="background:${KOL_FARGE.ferdig}"></span>Oppgave: ferdig</span>
    <span><span class="gantt-farge gantt-farge-idag"></span>I dag</span></div>`;
  el.innerHTML = legende + `<div class="gantt">
    <div class="gantt-rad gantt-topp"><div class="gantt-navn smaa">Prosjekt / oppgave</div><div class="gantt-ansv smaa">Ansvarlig</div><div class="gantt-spor">${uker.map(u => `<div class="gantt-uke" style="left:${u.x}%">Uke ${u.n}<br><span>${visDato(u.s).slice(0, 5)}</span></div>`).join('')}</div></div>
    ${rader.map((r, i) => {
      const f = r.type === 'p' ? '' : KOL_FARGE[r.o.kolonne] || '#5b8cff';
      const pFrem = r.type === 'p' ? prosjektFremdrift(r.p) : 0;
      const navn = r.type === 'p' ? r.p.navn : r.o.tittel;
      const ansv = personNavn(r.type === 'p' ? r.p.ansvarlig : r.o.ansvarlig);
      const stil = `left:${x(r.start)}%;width:${(dagerMellom(r.start, r.slutt) + 1) / tot * 100}%;` +
        (r.type === 'p' ? '' : `background:${f};box-shadow:0 0 8px ${f};opacity:${r.o.kolonne === 'ferdig' ? .55 : 1}`);
      const bar = r.start && r.slutt ? `<div class="gantt-bar ${r.type === 'p' ? 'gantt-prosjekt' : ''}" data-i="${i}" style="${stil}"
          title="${esc(navn)}: ${visDato(r.start)} – ${visDato(r.slutt)} (${dagerMellom(r.start, r.slutt) + 1} dager)${r.type === 'p' ? ` · ${pFrem} % ferdig` : ` · ${oppgFremdrift(r.o)} % ferdig`}"><span class="gh v"></span>${r.type === 'p' ? `<span class="gantt-frem" style="width:${pFrem}%"></span><span class="gantt-ptekst">${pFrem} %</span>` : `<span class="gantt-ofrem" style="width:${oppgFremdrift(r.o)}%"></span><span class="gantt-otekst">${esc(ansv)}${r.o.kolonne === 'pagar' ? ' · ' + oppgFremdrift(r.o) + ' %' : ''}</span>`}<span class="gh h"></span></div>` : '<span class="smaa" style="position:absolute;left:8px;top:11px">Mangler datoer – klikk for å legge inn</span>';
      return `<div class="gantt-rad ${r.type === 'p' ? 'gantt-prad' : ''}" data-i="${i}"><div class="gantt-navn" title="${esc(navn)}">${r.type === 'o' ? '<span class="gantt-innrykk"></span>' : ''}${esc(navn)} ${r.type === 'o' ? risikoMerke(r.o) : ''}</div>
        <div class="gantt-ansv">${esc(ansv || '–')}</div><div class="gantt-spor">${rutenett}${bar}</div></div>`;
    }).join('')}
  </div>
  <div class="verktoylinje" style="margin-top:12px"><span class="smaa">Klikk på en rad for å endre, og dra stolpene for å flytte datoer.</span>
  ${prosjekter.length === 1 ? `<span class="spacer"></span><button class="btn sek liten" id="g-ny">+ Oppgave i ${esc(prosjekter[0].navn)}</button>` : ''}</div>`;
  const gn = $('#g-ny', el); if (gn) gn.onclick = () => redigerOppgave(null, 'gjore', { prosjektId: prosjekter[0].id });

  // klikk på rad = rediger; dra stolpe = flytt / endre start eller slutt
  let drag = null;
  el.querySelectorAll('.gantt-rad[data-i]').forEach(rad => rad.addEventListener('click', e => {
    if (e.target.closest('[data-risiko]') || (drag && drag.flyttet)) return;
    const r = rader[+rad.dataset.i];
    if (r.type === 'p') redigerProsjekt(r.p); else redigerOppgave(r.o);
  }));
  el.querySelectorAll('.gantt-bar').forEach(bar => bar.addEventListener('mousedown', e => {
    e.preventDefault();
    const r = rader[+bar.dataset.i];
    const spor = bar.parentElement.getBoundingClientRect();
    const modus = e.target.classList.contains('v') ? 'v' : e.target.classList.contains('h') ? 'h' : 'flytt';
    drag = { r, bar, modus, x0: e.clientX, perDag: spor.width / tot, dager: 0, flyttet: false, left: parseFloat(bar.style.left), width: parseFloat(bar.style.width) };
    document.body.style.cursor = modus === 'flytt' ? 'grabbing' : 'ew-resize';
  }));
  const flytt = e => {
    if (!drag) return;
    const n = Math.round((e.clientX - drag.x0) / drag.perDag);
    if (n === drag.dager) return;
    drag.dager = n; drag.flyttet = drag.flyttet || n !== 0;
    const pr = 100 / tot, b = drag.bar;
    if (drag.modus === 'flytt') b.style.left = drag.left + n * pr + '%';
    else if (drag.modus === 'h') b.style.width = Math.max(pr, drag.width + n * pr) + '%';
    else { const nn = Math.min(n, Math.round(drag.width / pr) - 1); b.style.left = drag.left + nn * pr + '%'; b.style.width = drag.width - nn * pr + '%'; }
  };
  const slipp = () => {
    if (!drag) return;
    document.body.style.cursor = '';
    const { r, modus, dager, flyttet } = drag;
    if (flyttet && dager) {
      const obj = r.type === 'p' ? r.p : r.o;
      let s = r.start, f = r.slutt;
      if (modus === 'flytt') { s = leggDager(s, dager); f = leggDager(f, dager); }
      else if (modus === 'h') { f = leggDager(f, dager); if (f < s) f = s; }
      else { s = leggDager(s, dager); if (s > f) s = f; }
      obj.start = s; obj.frist = f;
      Lager.lagre();
      toast(`${r.type === 'p' ? r.p.navn : r.o.tittel}: ${visDato(s)} – ${visDato(f)}`);
      setTimeout(() => { drag = null; visSide(); }, 0);
      return;
    }
    drag = null;
  };
  document.addEventListener('mousemove', flytt);
  document.addEventListener('mouseup', slipp, { once: false });
  // rydd opp lyttere når siden tegnes på nytt
  const obs = new MutationObserver(() => { if (!document.body.contains(el)) { document.removeEventListener('mousemove', flytt); document.removeEventListener('mouseup', slipp); obs.disconnect(); } });
  obs.observe(document.getElementById('innhold'), { childList: true });
}

/* ================= Tidsplan ================= */
registrer('lp-tidsplan', el => {
  const d = D();
  if (lpFilter && !d.prosjekter.some(p => p.id === lpFilter)) lpFilter = '';
  el.innerHTML = sidehode('Tidsplan', 'Gantt-skjema for prosjektene og oppgavene. Dra stolpene for å endre datoer.', '<button class="btn sek" id="skriv-plan">Skriv ut …</button><button class="btn" id="ny">+ Oppgave</button>') +
    `<div class="kort s12 lilla"><div class="verktoylinje"><span class="smaa">Prosjekt</span><select id="filter"><option value="">Alle prosjekter</option>${d.prosjekter.map(p => `<option value="${p.id}" ${p.id === lpFilter ? 'selected' : ''}>${esc(p.navn)}</option>`).join('')}</select></div><div id="g"></div></div>`;
  $('#filter', el).onchange = e => { lpFilter = e.target.value; visSide(); };
  $('#ny', el).onclick = () => redigerOppgave(null, 'gjore', { prosjektId: lpFilter || undefined });
  $('#skriv-plan', el).onclick = () => tidsplanUtskriftValg(lpFilter);
  el.addEventListener('click', e => { const b = e.target.closest('[data-risiko]'); if (b) { e.stopPropagation(); apneOppgaveRisiko(d.oppgaver.find(o => o.id === b.dataset.risiko)); } }, true);
  gantt($('#g', el), d.prosjekter.filter(p => !lpFilter || p.id === lpFilter));
});

/* ================= Utskrift av tidsplan ================= */
/* Bare arbeidsdager (mandag–fredag) tas med på tidslinjen – lørdag og søndag hoppes over. */
const mandagFor = (iso) => { const t = new Date(iso + 'T12:00:00'); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const UKEDAG = ['Ma', 'Ti', 'On', 'To', 'Fr'];
function tidsplanUtskriftValg(forvalgtProsjekt) {
  const d = D();
  if (!d.prosjekter.length) { toast('Det finnes ingen prosjekter å skrive ut.', true); return; }
  // ukeliste: fra tidligste til seneste dato i prosjektene (minst 8 uker fra denne uka)
  const datoer = [idag(), leggDager(idag(), 56), ...d.prosjekter.flatMap(p => [p.start, p.frist]), ...d.oppgaver.flatMap(o => [o.start, o.frist])].filter(Boolean).sort();
  const uker = []; for (let m = mandagFor(datoer[0]); m <= datoer[datoer.length - 1]; m = leggDager(m, 7)) uker.push(m);
  const ukeTekst = m => `Uke ${ukenr(new Date(m + 'T12:00:00'))} (${visDato(m).slice(0, 5)}–${visDato(leggDager(m, 4)).slice(0, 5)})`;
  const denne = mandagFor(idag());
  const m = modal(`<h2>Skriv ut tidsplan</h2>
    <label class="felt"><span>Uker</span></label>
    <div class="rad" style="margin-top:-8px"><select id="t-fra">${uker.map(u => `<option value="${u}" ${u === denne ? 'selected' : ''}>${ukeTekst(u)}</option>`).join('')}</select>
      <span class="auto smaa">til</span>
      <select id="t-til">${uker.map(u => `<option value="${u}" ${u === leggDager(denne, 21) ? 'selected' : ''}>${ukeTekst(u)}</option>`).join('')}</select></div>
    <div class="verktoylinje" style="margin-top:8px"><button type="button" class="btn sek liten" data-snar="0">Denne uka</button><button type="button" class="btn sek liten" data-snar="1">Neste 2 uker</button><button type="button" class="btn sek liten" data-snar="3">Neste 4 uker</button></div>
    <div class="felt" style="margin-top:6px"><span>Prosjekter</span></div>
    ${d.prosjekter.map(p => `<label class="sjekk"><input type="checkbox" data-p="${p.id}" ${!forvalgtProsjekt || forvalgtProsjekt === p.id ? 'checked' : ''}>${esc(p.navn)}</label>`).join('')}
    <div class="felt" style="margin-top:12px"><span>Vis</span></div>
    <label class="sjekk"><input type="checkbox" id="t-oppg" checked>Oppgaver under prosjektene</label>
    <label class="sjekk"><input type="checkbox" id="t-ansv" checked>Ansvarlig</label>
    <label class="sjekk"><input type="checkbox" id="t-bare">Bare oppgaver i perioden</label>
    <label class="sjekk"><input type="checkbox" id="t-dager">Dager (ma–fr) i stedet for uker</label>
    <div class="laasfeil" id="t-feil"></div>
    <div class="knapper"><button class="btn sek" id="t-avbryt">Avbryt</button><button class="btn" id="t-ok">Forhåndsvis</button></div>`);
  const fra = $('#t-fra', m.el), til = $('#t-til', m.el);
  if (!til.value || til.value < fra.value) til.value = uker[Math.min(uker.length - 1, uker.indexOf(fra.value) + 3)];
  // ved en uke eller to passer dagvisning best
  const foreslaDager = () => { const n = (new Date(til.value) - new Date(fra.value)) / 604800000 + 1; $('#t-dager', m.el).checked = n <= 2; };
  $$('[data-snar]', m.el).forEach(b => b.onclick = () => { fra.value = denne; til.value = leggDager(denne, 7 * +b.dataset.snar); foreslaDager(); });
  fra.onchange = () => { if (til.value < fra.value) til.value = fra.value; foreslaDager(); };
  til.onchange = () => { if (til.value < fra.value) fra.value = til.value; foreslaDager(); };
  foreslaDager();
  $('#t-avbryt', m.el).onclick = m.lukk;
  $('#t-ok', m.el).onclick = () => {
    const valgt = $$('[data-p]', m.el).filter(c => c.checked).map(c => c.dataset.p);
    if (!valgt.length) { $('#t-feil', m.el).textContent = 'Velg minst ett prosjekt.'; return; }
    const valg = { fra: fra.value, til: til.value, prosjekter: valgt, oppgaver: $('#t-oppg', m.el).checked, ansvarlig: $('#t-ansv', m.el).checked, bare: $('#t-bare', m.el).checked, dager: $('#t-dager', m.el).checked };
    m.lukk();
    skrivUtTidsplan(valg);
  };
}
function skrivUtTidsplan(v) {
  const d = D();
  const antUker = Math.round((new Date(v.til) - new Date(v.fra)) / 604800000) + 1;
  const dager = [];                                   // alle arbeidsdager i perioden
  for (let u = 0; u < antUker; u++) for (let i = 0; i < 5; i++) dager.push(leggDager(v.fra, u * 7 + i));
  const N = dager.length, sluttDato = dager[N - 1];
  // posisjon på tidslinjen målt i arbeidsdager. Helg flyttes til nærmeste arbeidsdag.
  const indeks = (iso, erSlutt) => {
    if (iso < v.fra) return erSlutt ? -1 : 0;
    if (iso > sluttDato) return erSlutt ? N - 1 : N;
    let t = iso, dag = new Date(t + 'T12:00:00').getDay();
    if (dag === 6 || dag === 0) t = erSlutt ? leggDager(t, dag === 6 ? -1 : -2) : leggDager(t, dag === 6 ? 2 : 1);
    const i = dager.indexOf(t);
    return i < 0 ? (erSlutt ? -1 : N) : i;
  };
  const iPerioden = (s, e) => s && e && s <= sluttDato && e >= v.fra;
  const stolpe = (s, e, stil, tekst = '') => {
    if (!iPerioden(s, e)) return '';
    const a = indeks(s, false), b = indeks(e, true);
    if (b < a) return '';
    const kuttV = s < v.fra, kuttH = e > sluttDato;
    return `<div class="tp-bar" style="left:${a / N * 100}%;width:${(b - a + 1) / N * 100}%;${stil};${kuttV ? 'border-top-left-radius:0;border-bottom-left-radius:0;' : ''}${kuttH ? 'border-top-right-radius:0;border-bottom-right-radius:0;' : ''}">${kuttV ? '<span class="tp-pil tp-pil-v" title="Startet før perioden"></span>' : ''}<span class="tp-btekst" style="${kuttV ? 'padding-left:12px' : ''}">${tekst}</span>${kuttH ? '<span class="tp-pil tp-pil-h" title="Fortsetter etter perioden"></span>' : ''}</div>`;
  };
  const idagI = dager.indexOf(idag());
  const dagLinje = idagI >= 0 ? `<div class="tp-idag" style="left:${(idagI + .5) / N * 100}%"></div>` : '';
  const kolonner = v.dager ? dager.map(x => ({ t: `${UKEDAG[dager.indexOf(x) % 5]} ${visDato(x).slice(0, 5)}`, n: 1 }))
    : Array.from({ length: antUker }, (_, u) => ({ t: `Uke ${ukenr(new Date(leggDager(v.fra, u * 7) + 'T12:00:00'))}`, n: 5 }));
  const rutenett = `--rs:${100 / kolonner.length}%`;   // avstand mellom rutenettlinjene (se .tp-spor i style.css)
  const ansvKol = v.ansvarlig ? 1 : 0;
  const prosjekter = d.prosjekter.filter(p => v.prosjekter.includes(p.id)).sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
  let rader = '';
  prosjekter.forEach(p => {
    const frem = prosjektFremdrift(p);
    rader += `<tr class="tp-p"><td>${esc(p.navn)}</td>${ansvKol ? `<td>${esc(personNavn(p.ansvarlig) || '')}</td>` : ''}
      <td class="tp-spor" style="${rutenett}">${stolpe(p.start, p.frist, `background:linear-gradient(90deg,#9a9a9a ${frem}%,#e4e4e4 ${frem}%);border:1px solid #888`, `${frem} %`)}${dagLinje}</td></tr>`;
    if (!v.oppgaver) return;
    d.oppgaver.filter(o => o.prosjektId === p.id).filter(o => !v.bare || iPerioden(oppgStart(o), oppgSlutt(o)))
      .sort((a, b) => (oppgStart(a) || '9').localeCompare(oppgStart(b) || '9'))
      .forEach(o => {
        rader += `<tr><td class="tp-inn">${esc(o.tittel)}</td>${ansvKol ? `<td>${esc(personNavn(o.ansvarlig) || '')}</td>` : ''}
          <td class="tp-spor" style="${rutenett}">${stolpe(oppgStart(o), oppgSlutt(o), `background:${KOL_FARGE[o.kolonne] || '#5b8cff'}${o.kolonne === 'ferdig' ? ';opacity:.6' : ''}`, o.kolonne === 'pagar' ? oppgFremdrift(o) + ' %' : '')}${dagLinje}</td></tr>`;
      });
  });
  const fraUke = ukenr(new Date(v.fra + 'T12:00:00')), tilUke = ukenr(new Date(v.til + 'T12:00:00'));
  const tittel = fraUke === tilUke ? `Tidsplan uke ${fraUke}` : `Tidsplan uke ${fraUke}–${tilUke}`;
  skrivUt(`<div class="tp">
    <h1>${tittel}</h1>
    <div class="meta">${visDato(v.fra)} – ${visDato(sluttDato)} (mandag–fredag) · ${prosjekter.length} prosjekt${prosjekter.length === 1 ? '' : 'er'} · skrevet ut ${visDato(idag())}</div>
    <div class="tp-legende"><span><i style="background:#e4e4e4;border:1px solid #888"></i>Prosjekt (mørk del = fremdrift)</span><span><i style="background:${KOL_FARGE.gjore}"></i>Å gjøre</span><span><i style="background:${KOL_FARGE.pagar}"></i>Pågår</span><span><i style="background:${KOL_FARGE.ferdig}"></i>Ferdig</span>${idagI >= 0 ? '<span><i style="background:#111;width:2px"></i>I dag</span>' : ''}<span><b style="font-size:10px">▶</b> Fortsetter etter perioden</span></div>
    <table class="tp-tab"><colgroup><col style="width:${ansvKol ? 24 : 30}%">${ansvKol ? '<col style="width:11%">' : ''}<col></colgroup>
      <thead><tr><th>Prosjekt / oppgave</th>${ansvKol ? '<th>Ansvarlig</th>' : ''}<th class="tp-hode"><div class="tp-kol">${kolonner.map(k => `<span style="flex:${k.n}">${k.t}</span>`).join('')}</div></th></tr></thead>
      <tbody>${rader || `<tr><td colspan="${2 + ansvKol}">Ingen oppgaver i perioden.</td></tr>`}</tbody></table>
    <div class="meta" style="margin-top:6px">En pil i enden av en stolpe betyr at prosjektet eller oppgaven fortsetter utenfor perioden (▶ etter, ◀ før). Lørdag og søndag er ikke med.</div></div>`, tittel);
}
