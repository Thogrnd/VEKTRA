/* VEKTRA – HMS › Risikovurderinger
   Nytt kortbasert skjema, oversikt over alle vurderinger og alle risikoer delt inn i faresoner,
   og utskrift av én eller flere vurderinger. Bruker de samme risikovurderingene som Risiko-modulen. */
'use strict';

let hrApne = null;                 // id til vurderingen som redigeres
let hrFane = 'vurderinger';        // 'vurderinger' | 'risikoer'
let hrSone = '';                   // filter på faresone i «Alle risikoer»
let hrValgt = new Set();           // vurderinger som er krysset av for utskrift
let hrMatriseEtter = false;
const HR_FORSLAG = ['Verneutstyr', 'Opplæring først', 'Rekkverk', 'Løft to og to', 'God ventilasjon', 'Sperr av området'];

const hrRadSone = (r, v) => r.sone || v.sone;
const hrFarge = (v) => !v ? 'r-ingen' : rKlasse(v);
const hrBoks = (v, str = '') => `<span class="rverdi ${hrFarge(v)} ${str}">${v || '–'}</span>`;
const hrVurderinger = () => D().risiko.filter(v => v.kilde !== 'innlevert' || opplast)
  .sort((a, b) => (b.dato || '').localeCompare(a.dato || ''));
function hrMaks(v) {
  const f = Math.max(0, ...v.rader.map(rVerdi));
  const e = v.rader.map(rEtter);
  return { for: f, etter: e.length && e.every(x => x !== null) ? Math.max(...e) : 0 };
}
function hrMangler(v) {
  const m = [];
  if (!v.tittel.trim()) m.push('Skriv inn arbeidsoppdraget');
  if (!v.elev.trim()) m.push('Skriv inn navn');
  if (!v.rader.length) m.push('Legg inn minst én fare');
  v.rader.forEach((r, i) => {
    if (!r.fare.trim()) m.push(`Fare ${i + 1}: beskriv faren`);
    if (rVerdi(r) >= 10 && !r.tiltak.trim()) m.push(`Fare ${i + 1}: risiko ${rVerdi(r)} trenger tiltak`);
    if (r.tiltak.trim() && rEtter(r) === null) m.push(`Fare ${i + 1}: vurder S og K etter tiltak`);
  });
  return m;
}
/* Åpner en vurdering i HMS › Risikovurderinger (brukes fra oversikten, oppgaver og søk) */
function apneVurdering(id) { hrApne = id; apneSide('hms-risiko'); visSide(); }
function apneRisikoOversikt(fane = 'vurderinger') { hrApne = null; hrFane = fane; apneSide('hms-risiko'); visSide(); }
function hrNy() {
  const i = D().innst;
  const v = { id: nyId(), tittel: '', elev: i.navn, klasse: i.klasse || '', dato: idag(), sone: 'rabygg', prosjektId: '', rader: [nyRad()], status: 'Utkast', kommentar: '', kilde: 'egen' };
  D().risiko.push(v); Lager.lagre();
  hrApne = v.id; visSide();
}

/* ================= Siden ================= */
registrer('hms-risiko', el => {
  const v = hrApne ? D().risiko.find(x => x.id === hrApne) : null;
  if (v && (v.kilde !== 'innlevert' || opplast)) return hrEditor(el, v);
  hrApne = null;
  hrOversikt(el);
});

/* ---------- Oversikt ---------- */
function hrOversikt(el) {
  const alle = hrVurderinger();
  hrValgt = new Set([...hrValgt].filter(id => alle.some(v => v.id === id)));
  const rader = alle.flatMap(v => v.rader.map(r => ({ r, v, sone: hrRadSone(r, v) })));
  const perSone = SONER.map(s => {
    const her = rader.filter(x => x.sone === s.id);
    return { s, antall: her.length, hoy: her.filter(x => rVerdi(x.r) >= 10).length, apne: her.filter(x => x.r.tiltak.trim() && !x.r.utfort).length };
  });

  el.innerHTML = sidehode('Risikovurderinger', 'Alle risikovurderinger og risikoer samlet, delt inn i faresoner.',
    `${opplast ? '<button class="btn sek" id="hr-hent" title="Hent filer elevene har levert i Teams">Hent innleveringer</button>' : ''}<button class="btn sek" id="hr-skriv" ${hrValgt.size ? '' : 'disabled'}>Skriv ut valgte (${hrValgt.size})</button>${TESTKNAPPER ? `<button class="btn fare" id="hr-slett-valgte" title="Bare for testing" ${hrValgt.size ? '' : 'disabled'}>Slett valgte (${hrValgt.size})</button>` : ''}<button class="btn" id="hr-ny">+ Ny risikovurdering</button>`) +
    `<div class="grid">
      ${perSone.map(p => `<div class="kort s3 hr-sonekort" data-sone="${p.s.id}" style="--kc:${p.s.farge};cursor:pointer">
        <div class="kh"><h3 style="color:${p.s.farge}">${p.s.navn}</h3></div>
        <div style="display:flex;gap:18px">
          <div><div class="stor" style="font-size:24px">${p.antall}</div><span class="smaa">risikoer</span></div>
          <div><div class="stor" style="font-size:24px;color:${p.hoy ? 'var(--pink)' : 'inherit'}">${p.hoy}</div><span class="smaa">høy risiko</span></div>
          <div><div class="stor" style="font-size:24px">${p.apne}</div><span class="smaa">åpne tiltak</span></div>
        </div></div>`).join('')}
      <div class="kort s12 gul">
        <div class="verktoylinje"><div class="pv-faner" style="padding:0;border:0">
          <button type="button" data-fane="vurderinger" class="${hrFane === 'vurderinger' ? 'aktiv' : ''}">Vurderinger (${alle.length})</button>
          <button type="button" data-fane="risikoer" class="${hrFane === 'risikoer' ? 'aktiv' : ''}">Alle risikoer (${rader.length})</button></div>
          <span class="spacer"></span>
          ${hrFane === 'risikoer' ? `<button class="btn sek liten" id="hr-skriv-oversikt">Skriv ut oversikten</button>` : ''}
        </div>
        <div id="hr-innhold"></div>
      </div>
    </div>`;

  $('#hr-ny', el).onclick = hrNy;
  const hb = $('#hr-hent', el); if (hb) hb.onclick = hentInnleveringer;
  $('#hr-skriv', el).onclick = () => hrSkrivUt(alle.filter(v => hrValgt.has(v.id)));
  const sv = $('#hr-slett-valgte', el);   // TESTKNAPPER – fjernes i endelig versjon
  if (sv) sv.onclick = async () => {
    if (!await bekreft(`Slette <b>${hrValgt.size}</b> risikovurdering${hrValgt.size > 1 ? 'er' : ''}? Dette kan ikke angres.`, { ja: 'Slett', fare: true })) return;
    D().risiko = D().risiko.filter(v => !hrValgt.has(v.id));
    D().oppgaver.forEach(o => { if (hrValgt.has(o.risikoId)) o.risikoId = ''; });
    toast(`${hrValgt.size} slettet.`); hrValgt = new Set(); Lager.lagre(); visSide();
  };
  $$('[data-fane]', el).forEach(b => b.onclick = () => { hrFane = b.dataset.fane; visSide(); });
  $$('.hr-sonekort', el).forEach(k => k.onclick = () => { hrFane = 'risikoer'; hrSone = k.dataset.sone; visSide(); });
  const inn = $('#hr-innhold', el);

  if (hrFane === 'vurderinger') {
    inn.innerHTML = alle.length ? `<table><thead><tr><th style="width:36px"><input type="checkbox" id="hr-alle" title="Velg alle" ${hrValgt.size === alle.length ? 'checked' : ''}></th>
      <th>Arbeidsoppdrag</th><th>Prosjekt</th><th>Faresoner</th><th>Dato</th><th>Farer</th><th>Høyeste risiko før → etter</th><th>Status</th></tr></thead><tbody>
      ${alle.map(v => { const m = hrMaks(v); const soner = [...new Set(v.rader.map(r => hrRadSone(r, v)))];
        return `<tr class="klikk" data-v="${v.id}"><td><input type="checkbox" data-velg="${v.id}" ${hrValgt.has(v.id) ? 'checked' : ''}></td>
          <td><b>${esc(v.tittel || 'Uten tittel')}</b><div class="smaa">${esc(v.elev)}${v.klasse ? ' · ' + esc(v.klasse) : ''}${v.kilde === 'innlevert' ? ' · innlevert' : ''}</div></td>
          <td>${esc((D().prosjekter.find(p => p.id === v.prosjektId) || {}).navn || '–')}</td>
          <td>${soner.map(s => `<span class="hr-sonemerke" style="--kc:${(SONER.find(x => x.id === s) || {}).farge}">${soneNavn(s)}</span>`).join(' ')}</td>
          <td>${visDato(v.dato)}</td><td>${v.rader.length}</td>
          <td style="white-space:nowrap">${hrBoks(m.for)} → ${hrBoks(m.etter)}</td><td>${st(v.status, R_STATUS_KL[v.status] || 'ny')}</td></tr>`; }).join('')}
    </tbody></table>` : '<div class="tom">Ingen risikovurderinger ennå. Trykk «+ Ny risikovurdering».</div>';
    const a = $('#hr-alle', inn); if (a) a.onchange = () => { hrValgt = a.checked ? new Set(alle.map(v => v.id)) : new Set(); visSide(); };
    $$('[data-velg]', inn).forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = () => { c.checked ? hrValgt.add(c.dataset.velg) : hrValgt.delete(c.dataset.velg); visSide(); }; });
    $$('tr[data-v]', inn).forEach(tr => tr.onclick = () => { hrApne = tr.dataset.v; visSide(); });
    return;
  }

  // Alle risikoer, delt inn i faresoner
  const filtrert = rader.filter(x => !hrSone || x.sone === hrSone);
  inn.innerHTML = `<div class="verktoylinje"><div class="pv-faner" style="padding:0;border:0">
      <button type="button" data-hs="" class="${!hrSone ? 'aktiv' : ''}">Alle soner</button>
      ${SONER.map(s => `<button type="button" data-hs="${s.id}" class="${hrSone === s.id ? 'aktiv' : ''}">${s.navn} (${rader.filter(x => x.sone === s.id).length})</button>`).join('')}</div></div>
    ${filtrert.length ? SONER.filter(s => !hrSone || s.id === hrSone).map(s => {
      const her = filtrert.filter(x => x.sone === s.id).sort((a, b) => rVerdi(b.r) - rVerdi(a.r));
      if (!her.length) return '';
      return `<h4 class="hr-sonetittel" style="--kc:${s.farge}">${s.navn} <span class="smaa">${her.length} risikoer</span></h4>
        <table><thead><tr><th>Risiko før → etter</th><th>Fare</th><th>Arbeidsoperasjon</th><th>Tiltak</th><th>Ansvarlig</th><th>Fra vurdering</th><th style="width:70px">Utført</th></tr></thead><tbody>
        ${her.map(({ r, v }) => `<tr><td style="white-space:nowrap">${hrBoks(rVerdi(r))} → ${hrBoks(rEtter(r))}</td><td><b>${esc(r.fare || '–')}</b></td><td>${esc(r.operasjon || '–')}</td>
          <td>${esc(r.tiltak || '–')}</td><td>${esc(r.ansvar || '–')}</td>
          <td><button class="lenkeknapp" data-apne="${v.id}">${esc(v.tittel || 'Uten tittel')}</button>${finnOppgave(r.oppgaveId) ? `<div class="smaa">${esc(finnOppgave(r.oppgaveId).tittel)}</div>` : ''}</td>
          <td>${r.tiltak.trim() ? `<input type="checkbox" data-utf="${v.id}|${r.id}" ${r.utfort ? 'checked' : ''}>` : ''}</td></tr>`).join('')}
        </tbody></table>`;
    }).join('') : '<div class="tom">Ingen risikoer i denne faresonen.</div>'}`;
  $$('[data-hs]', inn).forEach(b => b.onclick = () => { hrSone = b.dataset.hs; visSide(); });
  $$('[data-apne]', inn).forEach(b => b.onclick = () => { hrApne = b.dataset.apne; visSide(); });
  $$('[data-utf]', inn).forEach(c => c.onchange = () => {
    const [vid, rid] = c.dataset.utf.split('|'); const r = D().risiko.find(x => x.id === vid).rader.find(x => x.id === rid);
    r.utfort = c.checked; Lager.lagre();
  });
  const so = $('#hr-skriv-oversikt', el); if (so) so.onclick = () => hrSkrivOversikt(filtrert);
}

/* ---------- Skjema (nytt kortbasert utseende) ---------- */
function hrEditor(el, v) {
  const d = D();
  const erInnlevert = v.kilde === 'innlevert';
  const { grupper, oppg } = radGrupper(v);
  const mangler = hrMangler(v);
  const m = hrMaks(v);
  const utfort = v.rader.filter(r => r.utfort).length;
  const fyltUt = v.rader.length ? v.rader.filter(r => r.fare.trim() && (!r.tiltak.trim() || rEtter(r) !== null) && (rVerdi(r) < 10 || r.tiltak.trim())).length / v.rader.length : 0;
  const omOk = v.tittel.trim() && v.elev.trim();
  const fremdrift = Math.round((omOk ? 25 : 0) + fyltUt * 50 + (mangler.length ? 0 : 25));
  const sone = SONER.find(s => s.id === v.sone) || SONER[0];
  const knapper = (r, felt, etter, navn) => [1, 2, 3, 4, 5].map(n => `<button type="button" class="hr-sk ${+r[felt] === n ? (etter ? 'valgt-etter' : 'valgt') : ''}" data-sk="${r.id}|${felt}|${n}" aria-label="${navn} ${n}" aria-pressed="${+r[felt] === n}">${n}</button>`).join('');
  const steg = [['hr-om', 'Om arbeidet', !!omOk], ['hr-farer', 'Farer og tiltak', v.rader.length && fyltUt === 1], ['hr-oppsummering', 'Oppsummering', !mangler.length], ['hr-lever', 'Signatur og levering', v.status !== 'Utkast']];

  // matrise
  const tell = {};
  v.rader.forEach(r => { const s = hrMatriseEtter ? +r.s2 : +r.s, k = hrMatriseEtter ? +r.k2 : +r.k; if (s && k) tell[`${s}-${k}`] = (tell[`${s}-${k}`] || 0) + 1; });
  let matrise = '<div class="matrise"><div class="akse"></div>' + [1, 2, 3, 4, 5].map(k => `<div class="akse">K${k}</div>`).join('');
  for (let s = 5; s >= 1; s--) { matrise += `<div class="akse">S${s}</div>`; for (let k = 1; k <= 5; k++) matrise += `<div class="${rKlasse(s * k)} ${tell[`${s}-${k}`] ? 'hr-treff' : ''}">${tell[`${s}-${k}`] || ''}</div>`; }
  matrise += '</div>';

  const radKort = (r, nr) => {
    const rf = rVerdi(r), re = rEtter(r);
    const rs = hrRadSone(r, v);
    return `<article class="hr-fare" data-rad="${r.id}">
      <header><b>Fare ${nr}</b>
        ${oppg.length ? `<select class="hr-mini" data-f="oppgaveId" aria-label="Oppgave"><option value="">Uten oppgave</option>${oppg.map(o => `<option value="${o.id}" ${o.id === r.oppgaveId ? 'selected' : ''}>Oppgave: ${esc(o.tittel)}</option>`).join('')}</select>` : ''}
        <select class="hr-mini" data-f="sone" aria-label="Faresone" style="--kc:${(SONER.find(s => s.id === rs) || {}).farge}">${SONER.map(s => `<option value="${s.id}" ${s.id === rs ? 'selected' : ''}>Faresone: ${s.navn}</option>`).join('')}</select>
        <span class="spacer"></span>
        ${r.tiltak.trim() && re === null ? '<span class="hr-varsel">Mangler vurdering etter tiltak</span>' : ''}
        <button type="button" class="hr-slett" data-slett-rad aria-label="Fjern faren">✕</button></header>
      <div class="hr-fare-innhold">
        <div class="hr-del">
          <label class="felt"><span>Arbeidsoperasjon</span><input type="text" data-f="operasjon" value="${esc(r.operasjon)}" placeholder="Hva skal gjøres?"></label>
          <label class="felt"><span>Fare / uønsket hendelse</span><textarea data-f="fare" placeholder="Hva kan gå galt?">${esc(r.fare)}</textarea></label>
        </div>
        <div class="hr-del">
          <div class="hr-delhode for">FØR TILTAK</div>
          <div class="hr-vurder"><div>
            <div class="hr-skrad" role="group" aria-label="Sannsynlighet før tiltak"><span>S</span>${knapper(r, 's', false, 'Sannsynlighet')}</div>
            <div class="hr-skrad" role="group" aria-label="Konsekvens før tiltak"><span>K</span>${knapper(r, 'k', false, 'Konsekvens')}</div></div>
            <div class="hr-stor">${hrBoks(rf, 'stor')}<span class="smaa">${rTekst(rf)}</span></div></div>
          <label class="felt" style="margin-top:12px"><span>Tiltak</span><textarea data-f="tiltak" placeholder="Hvordan hindrer vi det?">${esc(r.tiltak)}</textarea></label>
          <div class="hr-forslag"><span class="smaa">Forslag:</span>${HR_FORSLAG.map(t => `<button type="button" data-forslag="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>
        </div>
        <div class="hr-del">
          <div class="hr-delhode etter">ETTER TILTAK</div>
          <div class="hr-vurder"><div>
            <div class="hr-skrad" role="group" aria-label="Sannsynlighet etter tiltak"><span>S</span>${knapper(r, 's2', true, 'Sannsynlighet etter tiltak')}</div>
            <div class="hr-skrad" role="group" aria-label="Konsekvens etter tiltak"><span>K</span>${knapper(r, 'k2', true, 'Konsekvens etter tiltak')}</div></div>
            <div class="hr-stor">${hrBoks(rf)} <span class="smaa">→</span> ${hrBoks(re, 'stor')}</div></div>
          <div class="felt" style="margin-top:12px"><span>Ansvarlig (én eller flere)</span>${personVelgerHtml('hr-ansv-' + r.id, { flere: true })}</div>
          <label class="sjekk" style="border:0"><input type="checkbox" data-utfort ${r.utfort ? 'checked' : ''}>Tiltaket er gjennomført</label>
        </div>
      </div></article>`;
  };

  el.innerHTML = sidehode(v.tittel || 'Ny risikovurdering', `${st(v.status, R_STATUS_KL[v.status] || 'ny')} ${erInnlevert ? `Innlevert av ${esc(v.elev)}` : 'Endringer lagres automatisk.'}`,
    `<button class="btn sek" id="hr-tilbake">← Alle vurderinger</button><button class="btn sek" id="hr-skriv-en">Skriv ut</button>
     ${erInnlevert ? '' : '<button class="btn" id="hr-lever-knapp">Lever til lærer</button>'}<button class="btn fare" id="hr-slett">Slett</button>`) +
    `<div class="hr-oppsett">
      <nav class="hr-steg" aria-label="Steg i risikovurderingen">
        ${steg.map(([id, navn, ok], i) => `<a href="#${id}" data-hopp="${id}" class="${ok ? 'ok' : ''}"><span>${ok ? '✓' : i + 1}</span>${navn}</a>`).join('')}
        <div class="bar" style="margin:12px 12px 4px"><span style="width:${fremdrift}%;background:var(--green)"></span></div>
        <div class="smaa" style="margin:0 12px">${fremdrift} % ferdig</div>
      </nav>
      <div class="hr-hoved">
        <div class="hr-venstre">
          <section id="hr-om" class="kort s12 rosa">
            <div class="kh"><h3>1 · Om arbeidet</h3></div>
            <label class="felt"><span>Arbeidsoppdrag</span><input type="text" data-v="tittel" value="${esc(v.tittel)}" placeholder="F.eks. Montering av vindu i yttervegg"></label>
            <div class="rad">
              <div class="felt"><span>Navn</span>${personVelgerHtml('hr-elev')}</div>
              <label class="felt"><span>Klasse</span><input type="text" data-v="klasse" value="${esc(v.klasse)}"></label>
              <label class="felt"><span>Dato</span><input type="date" data-v="dato" value="${v.dato || ''}"></label>
              ${d.prosjekter.length ? `<label class="felt"><span>Prosjekt</span><select data-v="prosjektId"><option value="">Ikke knyttet til prosjekt</option>${d.prosjekter.map(p => `<option value="${p.id}" ${p.id === v.prosjektId ? 'selected' : ''}>${esc(p.navn)}</option>`).join('')}</select></label>` : ''}
            </div>
            <div class="felt"><span>Hovedsone (nye farer får denne faresonen)</span>
              <div class="hr-soner" role="group" aria-label="Velg sone">${SONER.map(s => `<button type="button" data-hovedsone="${s.id}" aria-pressed="${s.id === v.sone}" style="--kc:${s.farge}" class="${s.id === v.sone ? 'valgt' : ''}">${s.navn}</button>`).join('')}</div></div>
            <p class="smaa" style="margin:0">Typiske farer i ${sone.navn.toLowerCase()}: ${sone.hint}.</p>
          </section>

          <section id="hr-farer">
            <div class="hr-seksjonshode"><h3>2 · Farer og tiltak</h3><span class="smaa">Gi S og K fra 1 (svært lav) til 5 (svært høy). Risiko = S × K. Fra 10 og oppover må tiltak være på plass før arbeidet starter.</span></div>
            ${grupper.map(g => (oppg.length && g.o ? `<div class="hr-gruppe">Oppgave: ${esc(g.o.tittel)} <span class="smaa">${esc(personNavn(g.o.ansvarlig) || '')}${g.o.start || g.o.frist ? ' · ' + visDato(g.o.start) + ' – ' + visDato(g.o.frist) : ''}</span>
                <button class="lenkeknapp" data-ny-i="${g.o.id}">+ Fare i denne oppgaven</button></div>` : (oppg.length && g.rader.length ? '<div class="hr-gruppe">Uten oppgave</div>' : ''))
              + g.rader.map(r => radKort(r, v.rader.indexOf(r) + 1)).join('')).join('')}
            <div class="verktoylinje" style="margin-top:4px"><button type="button" class="btn sek" id="hr-ny-fare">+ Ny fare</button>
              ${(() => { const ledige = oppg.filter(o => !v.rader.some(r => r.oppgaveId === o.id)); return ledige.length ? `<select id="hr-legg-oppg" style="width:auto"><option value="">+ Vurder en oppgave fra prosjektet …</option>${ledige.map(o => `<option value="${o.id}">${esc(o.tittel)}</option>`).join('')}</select>` : ''; })()}</div>
          </section>

          <section id="hr-lever" class="kort s12 cyan">
            <div class="kh"><h3>4 · Signatur og levering</h3></div>
            ${erInnlevert || opplast ? `
              <div class="rad"><label class="felt auto" style="min-width:220px"><span>Status (lærer)</span><select data-v="status">${['Utkast', 'Levert', 'Til vurdering', 'Godkjent', 'Må forbedres'].map(s => `<option ${s === v.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
              <label class="felt"><span>Kommentar til eleven</span><textarea data-v="kommentar">${esc(v.kommentar)}</textarea></label>`
            : `<p class="smaa" style="margin-top:0">Når alt er fylt ut, trykker du «Lever til lærer» og leverer fila i oppgaven i Teams.</p>${v.kommentar ? `<p>Kommentar fra lærer: ${esc(v.kommentar)}</p>` : ''}`}
          </section>
        </div>

        <aside class="hr-hoyre" id="hr-oppsummering">
          <section class="kort s12 lilla">
            <div class="kh"><h3>Risikomatrise</h3><div class="hoyre"><div class="pv-faner" style="padding:0;border:0">
              <button type="button" data-mx="0" class="${hrMatriseEtter ? '' : 'aktiv'}">Før</button><button type="button" data-mx="1" class="${hrMatriseEtter ? 'aktiv' : ''}">Etter</button></div></div></div>
            ${matrise}<p class="smaa" style="margin:8px 0 0">Tallene viser hvor mange farer som ligger i hver rute.</p>
          </section>
          <section class="kort s12 gronn">
            <div class="kh"><h3>3 · Oppsummering</h3></div>
            <div class="hr-tall">
              <div><span class="smaa">Farer</span><b>${v.rader.length}</b></div>
              <div><span class="smaa">Tiltak gjennomført</span><b>${utfort} / ${v.rader.filter(r => r.tiltak.trim()).length}</b></div>
              <div style="grid-column:span 2"><span class="smaa">Høyeste risiko før → etter tiltak</span><div style="display:flex;gap:8px;align-items:center;margin-top:6px">${hrBoks(m.for)} → ${hrBoks(m.etter)}</div></div>
            </div>
            <div class="smaa" style="margin-top:14px;font-weight:700">Før du kan levere</div>
            ${mangler.length ? `<ul class="hr-mangler">${mangler.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p style="color:var(--green);font-weight:600;margin:8px 0 0">✓ Alt er fylt ut. Du kan levere.</p>'}
          </section>
        </aside>
      </div>
    </div>`;

  // ----- hendelser -----
  $('#hr-tilbake', el).onclick = () => { hrApne = null; visSide(); };
  $('#hr-slett', el).onclick = async () => { if (await bekreft('Slette denne risikovurderingen?', { ja: 'Slett', fare: true })) { d.risiko = d.risiko.filter(x => x !== v); hrApne = null; Lager.lagre(); visSide(); } };
  $('#hr-skriv-en', el).onclick = () => hrSkrivUt([v]);
  const lb = $('#hr-lever-knapp', el); if (lb) lb.onclick = async () => { if (await leverVurdering(v)) { hrApne = null; hrFane = 'vurderinger'; visSide(); $('#innhold').scrollTop = 0; } };
  $$('[data-hopp]', el).forEach(a => a.onclick = e => { e.preventDefault(); const mal = document.getElementById(a.dataset.hopp); if (mal) mal.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const tittelOppdater = () => { $('.sidehode h1', el).textContent = v.tittel || 'Ny risikovurdering'; };
  $$('[data-v]', el).forEach(i => {
    const lagre = () => { v[i.dataset.v] = i.value; if (v.status === 'Levert' && !['status', 'kommentar'].includes(i.dataset.v)) v.status = 'Utkast'; Lager.lagre(); };
    if (i.tagName === 'SELECT') i.onchange = () => { lagre(); visSide(); };
    else if (i.type === 'date') i.onchange = lagre;
    else i.oninput = () => { lagre(); if (i.dataset.v === 'tittel') tittelOppdater(); };
  });
  koblPersonVelger($('#hr-elev', el), { verdi: v.elev, lagreSom: 'navn', endret: navn => {
    v.elev = navn; const e = d.elever.find(x => x.navn === navn);
    if (e) { v.klasse = klasseNavn(e.klasseId); $('[data-v=klasse]', el).value = v.klasse; }
    Lager.lagre();
  } });
  $$('[data-hovedsone]', el).forEach(b => b.onclick = () => { v.sone = b.dataset.hovedsone; Lager.lagre(); visSide(); });
  $$('[data-mx]', el).forEach(b => b.onclick = () => { hrMatriseEtter = b.dataset.mx === '1'; visSide(); });
  $('#hr-ny-fare', el).onclick = () => { v.rader.push({ ...nyRad(), sone: v.sone }); Lager.lagre(); visSide(); };
  $$('[data-ny-i]', el).forEach(b => b.onclick = () => { v.rader.push({ ...nyRad(), sone: v.sone, oppgaveId: b.dataset.nyI }); Lager.lagre(); visSide(); });
  const lo = $('#hr-legg-oppg', el); if (lo) lo.onchange = () => { const o = finnOppgave(lo.value); if (o) { kobleRisiko(o, v); Lager.lagre(); visSide(); } };

  $$('.hr-fare', el).forEach(kort => {
    const r = v.rader.find(x => x.id === kort.dataset.rad);
    $$('[data-f]', kort).forEach(i => {
      if (i.tagName === 'SELECT') i.onchange = () => { r[i.dataset.f] = i.value; if (i.dataset.f === 'oppgaveId') { const o = finnOppgave(i.value); if (o) o.risikoId = v.id; } Lager.lagre(); visSide(); };
      else i.oninput = () => { r[i.dataset.f] = i.value; Lager.lagre(); };
    });
    $$('[data-sk]', kort).forEach(b => b.onclick = () => { const [, felt, n] = b.dataset.sk.split('|'); r[felt] = +r[felt] === +n && felt.endsWith('2') ? '' : +n; Lager.lagre(); visSide(); });
    $$('[data-forslag]', kort).forEach(b => b.onclick = () => { const t = b.dataset.forslag.toLowerCase(); r.tiltak = r.tiltak.trim() ? `${r.tiltak.trim()}, ${t}` : b.dataset.forslag; Lager.lagre(); visSide(); });
    $('[data-utfort]', kort).onchange = e => { r.utfort = e.target.checked; Lager.lagre(); visSide(); };
    $('[data-slett-rad]', kort).onclick = async () => { if (r.fare.trim() || r.tiltak.trim() ? await bekreft('Fjerne denne faren?', { ja: 'Fjern', fare: true }) : true) { v.rader = v.rader.filter(x => x !== r); Lager.lagre(); visSide(); } };
    koblPersonVelger($('#hr-ansv-' + r.id, kort), { flere: true, verdi: r.ansvar ? r.ansvar.split(/\s*,\s*/).filter(Boolean) : [], lagreSom: 'navn',
      endret: liste => { r.ansvar = liste.join(', '); Lager.lagre(); } });
  });
}

/* ---------- Utskrift ---------- */
function hrUtskriftEn(v) {
  const prosjekt = (D().prosjekter.find(p => p.id === v.prosjektId) || {}).navn;
  const { grupper, oppg } = radGrupper(v);
  const m = hrMaks(v);
  return `<div class="hr-utskrift">
    <h1>Risikovurdering: ${esc(v.tittel || 'Uten tittel')}</h1>
    <div class="meta">${esc(v.elev)}${v.klasse ? ' · ' + esc(v.klasse) : ''}${prosjekt ? ' · Prosjekt: ' + esc(prosjekt) : ''} · Hovedsone: ${soneNavn(v.sone)} · ${visDato(v.dato)} · Status: ${esc(v.status)} · Høyeste risiko før → etter: ${m.for || '–'} → ${m.etter || '–'}</div>
    <table><thead><tr><th colspan="3"></th><th colspan="3">Før tiltak</th><th></th><th colspan="3">Etter tiltak</th><th colspan="2"></th></tr>
      <tr><th>Faresone</th><th>Arbeidsoperasjon</th><th>Fare / uønsket hendelse</th><th>S</th><th>K</th><th>R</th><th>Tiltak</th><th>S</th><th>K</th><th>R</th><th>Ansvarlig</th><th>Utført</th></tr></thead><tbody>
    ${grupper.map(g => (oppg.length ? `<tr><td colspan="12" style="font-weight:700;background:#eee!important">${g.o ? 'Oppgave: ' + esc(g.o.tittel) : 'Uten oppgave'}</td></tr>` : '') +
      g.rader.map(r => `<tr><td>${soneNavn(hrRadSone(r, v))}</td><td>${esc(r.operasjon)}</td><td>${esc(r.fare)}</td><td>${r.s}</td><td>${r.k}</td><td>${rBoks(rVerdi(r))}</td>
        <td>${esc(r.tiltak)}</td><td>${r.s2 || '–'}</td><td>${r.k2 || '–'}</td><td>${rBoks(rEtter(r))}</td><td>${esc(r.ansvar)}</td><td>${r.utfort ? '✓' : ''}</td></tr>`).join('')).join('')}
    </tbody></table>
    ${v.kommentar ? `<p><b>Kommentar fra lærer:</b> ${esc(v.kommentar)}</p>` : ''}
    <p style="margin-top:28px">Signatur elev: ______________________ &nbsp;&nbsp;&nbsp; Signatur lærer: ______________________</p></div>`;
}
function hrSkrivUt(liste) {
  if (!liste.length) return;
  skrivUt(liste.map(hrUtskriftEn).join('<div class="sideskift"></div>'), liste.length === 1 ? `Risikovurdering - ${liste[0].tittel || 'uten tittel'}` : `Risikovurderinger (${liste.length})`);
}
function hrSkrivOversikt(rader) {
  skrivUt(`<h1>Oversikt over risikoer${hrSone ? ' – ' + soneNavn(hrSone) : ''}</h1><div class="meta">Skrevet ut ${visDato(idag())} · ${rader.length} risikoer</div>` +
    SONER.filter(s => !hrSone || s.id === hrSone).map(s => {
      const her = rader.filter(x => x.sone === s.id).sort((a, b) => rVerdi(b.r) - rVerdi(a.r));
      if (!her.length) return '';
      return `<h2 style="font-size:15px;margin:16px 0 6px">${s.navn}</h2><table><thead><tr><th>R før</th><th>R etter</th><th>Fare</th><th>Arbeidsoperasjon</th><th>Tiltak</th><th>Ansvarlig</th><th>Vurdering</th><th>Utført</th></tr></thead><tbody>
        ${her.map(({ r, v }) => `<tr><td>${rBoks(rVerdi(r))}</td><td>${rBoks(rEtter(r))}</td><td>${esc(r.fare)}</td><td>${esc(r.operasjon)}</td><td>${esc(r.tiltak)}</td><td>${esc(r.ansvar)}</td><td>${esc(v.tittel)}</td><td>${r.utfort ? '✓' : ''}</td></tr>`).join('')}</tbody></table>`;
    }).join(''));
}
