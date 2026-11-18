/* VEKTRA – risikovurderinger: felles hjelpefunksjoner (soner, risikoberegning, levering, innhenting).
   Selve sidene ligger nå under HMS › Risikovurderinger (hms-risiko.js). De gamle Risiko-sidene er ikke lenger i menyen. */
'use strict';

const SONER = [
  { id: 'rabygg', navn: 'Råbygg', farge: '#5b8cff', hint: 'Fall fra høyde, klemskader, sagstøv, tunge løft' },
  { id: 'teknisk', navn: 'Teknisk', farge: '#a35cff', hint: 'Strøm, støy, boring i vegg, skjulte rør og kabler' },
  { id: 'vatrom', navn: 'Våtrom', farge: '#3ee08f', hint: 'Kjemikalier, membran og lim, ventilasjon, glatte flater' },
  { id: 'vindu', navn: 'Vindu/fasade', farge: '#ff3d7f', hint: 'Tunge løft, arbeid i høyden, glass, vær og vind' }
];
const R_STATUS_KL = { 'Utkast': 'ny', 'Levert': 'pa', 'Til vurdering': 'pa', 'Godkjent': 'ok', 'Må forbedres': 'hoy' };
let riApne = null, riSoneFilter = '', riVisUtfort = false;

const soneNavn = id => (SONER.find(s => s.id === id) || {}).navn || '–';
const rVerdi = r => (+r.s || 0) * (+r.k || 0);
const rKlasse = v => v >= 15 ? 'r-krit' : v >= 10 ? 'r-hoy' : v >= 5 ? 'r-mid' : 'r-lav';
const rTekst = v => v >= 15 ? 'Kritisk' : v >= 10 ? 'Høy' : v >= 5 ? 'Middels' : 'Lav';
const maksRisiko = v => Math.max(0, ...v.rader.map(rVerdi));
const synligeVurderinger = () => D().risiko.filter(r => r.kilde !== 'innlevert' || opplast);
/* Risiko etter tiltak (restrisiko): s2 og k2. Tom = ikke vurdert ennå */
const rEtter = r => (+r.s2 && +r.k2) ? r.s2 * r.k2 : null;
const rBoks = (v, tittel = '') => v === null ? '<span class="rverdi r-ingen" title="Ikke vurdert ennå">–</span>' : `<span class="rverdi ${rKlasse(v)}" title="${tittel || rTekst(v)}">${v}</span>`;
const nyRad = () => ({ id: nyId(), operasjon: '', fare: '', s: 2, k: 2, tiltak: '', s2: '', k2: '', ansvar: '', utfort: false });
let riMatriseEtter = false;
const finnOppgave = id => id ? D().oppgaver.find(o => o.id === id) : null;
/* Deler radene inn etter oppgavene i prosjektet. Gir [{o, rader}] der o = null betyr «uten oppgave» */
function radGrupper(v) {
  const oppg = v.prosjektId ? D().oppgaver.filter(o => o.prosjektId === v.prosjektId).sort((a, b) => (oppgStart(a) || '9').localeCompare(oppgStart(b) || '9')) : [];
  const gyldig = new Set(oppg.map(o => o.id));
  const gr = oppg.map(o => ({ o, rader: v.rader.filter(r => r.oppgaveId === o.id) })).filter(g => g.rader.length);
  const uten = v.rader.filter(r => !gyldig.has(r.oppgaveId));
  if (uten.length || !gr.length) gr.push({ o: null, rader: uten });
  return { grupper: gr, oppg };
}

function matrise(rader, etter = false) {
  const tell = {}; rader.forEach(r => { const s = etter ? r.s2 : r.s, k2 = etter ? r.k2 : r.k; if (!+s || !+k2) return; const k = `${s}-${k2}`; tell[k] = (tell[k] || 0) + 1; });
  let h = '<div class="matrise"><div class="akse"></div>' + [1, 2, 3, 4, 5].map(k => `<div class="akse">K${k}</div>`).join('');
  for (let s = 5; s >= 1; s--) {
    h += `<div class="akse">S${s}</div>`;
    for (let k = 1; k <= 5; k++) h += `<div class="${rKlasse(s * k)}" title="Sannsynlighet ${s} × konsekvens ${k} = ${s * k}">${tell[`${s}-${k}`] || ''}</div>`;
  }
  return h + '</div><p class="smaa" style="margin-top:8px">S = sannsynlighet, K = konsekvens. Tallene viser hvor mange farer som ligger i hver rute.</p>';
}

/* ================= Risikovurderinger ================= */
registrer('ri-mine', el => {
  const v = riApne ? D().risiko.find(x => x.id === riApne) : null;
  if (v && v.kilde !== 'innlevert') return vurderingsEditor(el, v);
  riApne = null;
  const liste = D().risiko.filter(r => r.kilde !== 'innlevert').sort((a, b) => (b.dato || '').localeCompare(a.dato || ''));
  el.innerHTML = sidehode('Risikovurderinger', 'Vurder farene før du starter et arbeid. Når vurderingen er ferdig, leverer du fila i Teams.', '<button class="btn" id="ny">+ Ny risikovurdering</button>') +
    `<div class="kort s12 rosa">${liste.length ? `<table><thead><tr><th>Arbeidsoppdrag</th><th>Prosjekt</th><th>Sone</th><th>Dato</th><th>Farer</th><th>Høyeste risiko</th><th>Status</th></tr></thead><tbody>
      ${liste.map(r => { const m = maksRisiko(r); return `<tr class="klikk" data-r="${r.id}"><td><b>${esc(r.tittel || 'Uten tittel')}</b><div class="smaa">${esc(r.elev)}</div></td><td>${esc((D().prosjekter.find(p => p.id === r.prosjektId) || {}).navn || '–')}</td><td>${soneNavn(r.sone)}</td><td>${visDato(r.dato)}</td><td>${r.rader.length}</td>
        <td>${r.rader.length ? `<span class="rverdi ${rKlasse(m)}">${m}</span> <span class="smaa">${rTekst(m)}</span>` : '–'}</td><td>${st(r.status, R_STATUS_KL[r.status] || 'ny')}</td></tr>`; }).join('')}
    </tbody></table>` : '<div class="tom">Du har ingen risikovurderinger ennå.</div>'}</div>`;
  $('#ny', el).onclick = () => {
    const i = D().innst;
    const n = { id: nyId(), tittel: '', elev: i.navn, klasse: i.klasse || '', dato: idag(), sone: 'rabygg', rader: [nyRad()], status: 'Utkast', kommentar: '', kilde: 'egen' };
    D().risiko.push(n); riApne = n.id; Lager.lagre(); visSide();
  };
  $$('tr[data-r]', el).forEach(tr => tr.onclick = () => { riApne = tr.dataset.r; visSide(); });
});

function vurderingsEditor(el, v) {
  const erInnlevert = v.kilde === 'innlevert';
  const sone = SONER.find(s => s.id === v.sone) || SONER[0];
  el.innerHTML = sidehode(v.tittel || 'Ny risikovurdering', erInnlevert ? `Innlevert av ${esc(v.elev)}${v.klasse ? ' (' + esc(v.klasse) + ')' : ''}` : 'Endringer lagres automatisk.',
    `<button class="btn sek" id="tilbake">← Tilbake</button><button class="btn sek" id="skriv">Skriv ut</button>
     ${erInnlevert ? '' : '<button class="btn" id="lever">Lever til lærer</button>'}<button class="btn fare" id="slett">Slett</button>`) +
    `<div class="grid">
      ${kort('Om arbeidet', `
        <label class="felt"><span>Arbeidsoppdrag</span><input type="text" data-v="tittel" value="${esc(v.tittel)}" placeholder="F.eks. Montering av vindu i yttervegg"></label>
        <div class="rad"><div class="felt"><span style="display:block;margin-bottom:5px;font-weight:600">Navn</span>${personVelgerHtml('ri-elev')}</div>
        <label class="felt"><span>Klasse</span><input type="text" data-v="klasse" value="${esc(v.klasse)}"></label>
        <label class="felt"><span>Dato</span><input type="date" data-v="dato" value="${v.dato || ''}"></label>
        <label class="felt"><span>Sone</span><select data-v="sone">${SONER.map(s => `<option value="${s.id}" ${s.id === v.sone ? 'selected' : ''}>${s.navn}</option>`).join('')}</select></label></div>
        ${D().prosjekter.length ? `<label class="felt"><span>Prosjekt (radene kan da deles inn etter oppgavene i prosjektet)</span><select data-v="prosjektId"><option value="">Ikke knyttet til prosjekt</option>${D().prosjekter.map(p => `<option value="${p.id}" ${p.id === v.prosjektId ? 'selected' : ''}>${esc(p.navn)}</option>`).join('')}</select></label>` : ''}
        <p class="smaa" style="margin:0">Typiske farer i ${sone.navn.toLowerCase()}: ${sone.hint}.</p>`, 's8 rosa')}
      ${kort('Risikomatrise', matrise(v.rader, riMatriseEtter), 's4 lilla', `<div class="pv-faner" style="padding:0;border:0"><button type="button" data-mx="0" class="${riMatriseEtter ? '' : 'aktiv'}">Før tiltak</button><button type="button" data-mx="1" class="${riMatriseEtter ? 'aktiv' : ''}">Etter tiltak</button></div>`)}
      ${kort('Farer og tiltak', `
        <table class="rtab"><thead>
          <tr class="gruppehode"><th colspan="2"></th><th colspan="3" class="fh">Før tiltak</th><th></th><th colspan="3" class="eh">Etter tiltak</th><th colspan="2"></th></tr>
          <tr><th>Arbeidsoperasjon</th><th>Fare / uønsket hendelse</th><th title="Sannsynlighet 1–5" class="fh">S</th><th title="Konsekvens 1–5" class="fh">K</th><th class="fh">Risiko</th><th>Tiltak</th><th title="Sannsynlighet etter tiltak" class="eh">S</th><th title="Konsekvens etter tiltak" class="eh">K</th><th class="eh">Risiko</th><th>Ansvarlig</th><th></th></tr></thead><tbody>
        ${(() => { const { grupper, oppg } = radGrupper(v); const visHode = !!oppg.length;
          return grupper.map(g => (visHode ? `<tr class="rgruppe"><td colspan="11">${g.o ? `Oppgave: ${esc(g.o.tittel)}<span class="smaa">${esc(personNavn(g.o.ansvarlig) || '')}${g.o.start || g.o.frist ? ' · ' + visDato(g.o.start) + ' – ' + visDato(g.o.frist) : ''}</span>
              <button class="lenkeknapp" data-ny-rad-oppg="${g.o.id}" style="margin-left:12px">+ Rad</button> <button class="lenkeknapp" data-apne-oppg="${g.o.id}" style="margin-left:8px">Åpne oppgaven</button>` : 'Uten oppgave'}</td></tr>` : '')
            + g.rader.map(r => `<tr data-rad="${r.id}">
          <td>${oppg.length ? `<select class="radoppg" data-f="oppgaveId" title="Hvilken oppgave raden hører til"><option value="">Uten oppgave</option>${oppg.map(o => `<option value="${o.id}" ${o.id === r.oppgaveId ? 'selected' : ''}>${esc(o.tittel)}</option>`).join('')}</select>` : ''}<textarea data-f="operasjon" placeholder="Hva skal gjøres?">${esc(r.operasjon)}</textarea></td>
          <td><textarea data-f="fare" placeholder="Hva kan gå galt?">${esc(r.fare)}</textarea></td>
          <td><select data-f="s">${[1, 2, 3, 4, 5].map(n => `<option ${n == r.s ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
          <td><select data-f="k">${[1, 2, 3, 4, 5].map(n => `<option ${n == r.k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
          <td>${rBoks(rVerdi(r))}</td>
          <td><textarea data-f="tiltak" placeholder="Hvordan hindrer vi det?">${esc(r.tiltak)}</textarea></td>
          <td><select data-f="s2"><option value="">–</option>${[1, 2, 3, 4, 5].map(n => `<option ${n == r.s2 ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
          <td><select data-f="k2"><option value="">–</option>${[1, 2, 3, 4, 5].map(n => `<option ${n == r.k2 ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
          <td>${rBoks(rEtter(r))}${rEtter(r) !== null && rEtter(r) >= rVerdi(r) && r.tiltak.trim() ? '<div class="smaa" style="color:var(--orange);white-space:nowrap">Ikke lavere</div>' : ''}</td>
          <td style="min-width:150px">${personVelgerHtml('ri-ansvar-' + r.id)}</td>
          <td><button class="lenkeknapp fare" data-slett-rad title="Fjern rad">✕</button></td></tr>`).join('')).join(''); })()}
        </tbody></table>
        <div class="rad" style="margin-top:12px"><button class="btn sek auto" id="ny-rad">+ Ny rad</button>
          ${(() => { const { oppg } = radGrupper(v); const ledige = oppg.filter(o => !v.rader.some(r => r.oppgaveId === o.id)); return ledige.length ? `<select class="auto" id="legg-oppg" style="width:auto"><option value="">+ Vurder en oppgave fra prosjektet …</option>${ledige.map(o => `<option value="${o.id}">${esc(o.tittel)}</option>`).join('')}</select>` : ''; })()}
          <span class="smaa">Sannsynlighet og konsekvens: 1 = svært lav, 5 = svært høy. Risiko = S × K. Fra 10 og oppover må tiltakene være på plass før arbeidet starter. Vurder S og K på nytt <b>etter tiltak</b>. Risikoen etter tiltak bør være under 10.</span></div>`, 's12 rosa')}
      ${kort('Vurdering fra lærer', erInnlevert || opplast ? `
        <div class="rad"><label class="felt auto" style="min-width:200px"><span>Status</span><select data-v="status">${['Til vurdering', 'Godkjent', 'Må forbedres', ...(erInnlevert ? [] : ['Utkast', 'Levert'])].map(s => `<option ${s === v.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
        <label class="felt"><span>Kommentar til eleven</span><textarea data-v="kommentar">${esc(v.kommentar)}</textarea></label>`
      : `<p>Status: ${st(v.status, R_STATUS_KL[v.status] || 'ny')}</p>${v.kommentar ? `<p class="smaa">Kommentar: ${esc(v.kommentar)}</p>` : '<p class="smaa">Læreren legger inn kommentar når vurderingen er levert.</p>'}`, 's12 cyan')}
    </div>`;

  $('#tilbake', el).onclick = () => { riApne = null; visSide(); };
  $('#slett', el).onclick = async () => { if (await bekreft('Slette denne risikovurderingen?', { ja: 'Slett', fare: true })) { D().risiko = D().risiko.filter(x => x !== v); riApne = null; Lager.lagre(); visSide(); } };
  $('#skriv', el).onclick = () => skrivUtVurdering(v);
  const lb = $('#lever', el); if (lb) lb.onclick = () => leverVurdering(v);
  $$('[data-v]', el).forEach(i => {
    const lagre = () => { v[i.dataset.v] = i.value; if (v.status === 'Levert' && !['status', 'kommentar'].includes(i.dataset.v)) v.status = 'Utkast'; Lager.lagre(); };
    if (i.tagName === 'SELECT') i.onchange = () => { lagre(); visSide(); };
    else if (i.type === 'date') i.onchange = lagre;
    else { i.oninput = lagre; if (i.dataset.v === 'tittel') i.oninput = () => { lagre(); $('.sidehode h1', el).textContent = v.tittel || 'Ny risikovurdering'; }; }
  });
  // navn velges fra registeret; klassen fylles inn automatisk
  const klasseFelt = $('[data-v=klasse]', el);
  koblPersonVelger($('#ri-elev', el), { verdi: v.elev, lagreSom: 'navn', endret: navn => {
    v.elev = navn; if (v.status === 'Levert') v.status = 'Utkast';
    const e = D().elever.find(x => x.navn === navn);
    if (e) { klasseFelt.value = klasseNavn(e.klasseId); v.klasse = klasseFelt.value; }
    Lager.lagre();
  } });
  $$('tr[data-rad]', el).forEach(tr => {
    const r = v.rader.find(x => x.id === tr.dataset.rad);
    $$('[data-f]', tr).forEach(i => {
      if (i.dataset.f === 'oppgaveId') i.onchange = () => { r.oppgaveId = i.value; const o = finnOppgave(i.value); if (o) o.risikoId = v.id; Lager.lagre(); visSide(); };
      else if (i.tagName === 'SELECT') i.onchange = () => { r[i.dataset.f] = i.value === '' ? '' : +i.value; Lager.lagre(); visSide(); };
      else i.oninput = () => { r[i.dataset.f] = i.value; Lager.lagre(); };
    });
    koblPersonVelger($('#ri-ansvar-' + r.id, tr), { verdi: r.ansvar, lagreSom: 'navn', endret: navn => { r.ansvar = navn; Lager.lagre(); } });
    $('[data-slett-rad]', tr).onclick = () => { v.rader = v.rader.filter(x => x !== r); Lager.lagre(); visSide(); };
  });
  $$('[data-ny-rad-oppg]', el).forEach(b => b.onclick = () => { const o = finnOppgave(b.dataset.nyRadOppg); v.rader.push({ ...nyRad(), oppgaveId: o.id, operasjon: '' }); Lager.lagre(); visSide(); });
  $$('[data-apne-oppg]', el).forEach(b => b.onclick = () => redigerOppgave(finnOppgave(b.dataset.apneOppg)));
  const lo = $('#legg-oppg', el); if (lo) lo.onchange = () => { const o = finnOppgave(lo.value); if (!o) return; kobleRisiko(o, v); Lager.lagre(); visSide(); };
  $$('[data-mx]', el).forEach(b => b.onclick = () => { riMatriseEtter = b.dataset.mx === '1'; visSide(); });
  $('#ny-rad', el).onclick = () => { v.rader.push(nyRad()); Lager.lagre(); visSide(); setTimeout(() => { const t = $$('tr[data-rad] textarea'); if (t.length) t[t.length - 3].focus(); }, 0); };
}

async function leverVurdering(v) {
  const mangler = [];
  if (!v.tittel.trim()) mangler.push('arbeidsoppdrag');
  if (!v.elev.trim()) mangler.push('navn');
  if (!v.rader.some(r => r.fare.trim())) mangler.push('minst én fare');
  if (v.rader.some(r => rVerdi(r) >= 10 && !r.tiltak.trim())) mangler.push('tiltak for alle farer med risiko 10 eller mer');
  if (v.rader.some(r => r.tiltak.trim() && rEtter(r) === null)) mangler.push('S og K etter tiltak på alle rader med tiltak');
  if (mangler.length) { toast('Før du leverer, mangler: ' + mangler.join(', ') + '.', true); return false; }
  const fil = { type: 'klar-risikovurdering', versjon: 1, levert: new Date().toISOString(), vurdering: { ...v, status: 'Levert' } };
  const navn = `Risikovurdering - ${v.elev} - ${v.tittel}`.replace(/[\\/:*?"<>|]/g, '').slice(0, 120) + '.json';
  const r = await lagreFil(navn, JSON.stringify(fil, null, 2), [{ name: 'VEKTRA risikovurdering', extensions: ['json'] }]);
  if (r) { v.status = 'Levert'; Lager.lagre(); visSide(); toast('Fila er lagret. Lever den i oppgaven i Teams.'); return true; }
  return false;
}
function skrivUtVurdering(v) {
  skrivUt(`<h1>Risikovurdering: ${esc(v.tittel || '')}</h1>
    <div class="meta">${esc(v.elev)}${v.klasse ? ' · ' + esc(v.klasse) : ''}${v.prosjektId && D().prosjekter.find(p => p.id === v.prosjektId) ? ' · Prosjekt: ' + esc(D().prosjekter.find(p => p.id === v.prosjektId).navn) : ''} · ${soneNavn(v.sone)} · ${visDato(v.dato)} · Status: ${esc(v.status)}</div>
    <table><thead><tr><th colspan="2"></th><th colspan="3">Før tiltak</th><th></th><th colspan="3">Etter tiltak</th><th></th></tr>
    <tr><th>Arbeidsoperasjon</th><th>Fare / uønsket hendelse</th><th>S</th><th>K</th><th>R</th><th>Tiltak</th><th>S</th><th>K</th><th>R</th><th>Ansvarlig</th></tr></thead><tbody>
    ${radGrupper(v).grupper.map(g => (radGrupper(v).oppg.length ? `<tr><td colspan="10" style="font-weight:700;background:#eee!important">${g.o ? 'Oppgave: ' + esc(g.o.tittel) + (g.o.ansvarlig ? ' – ' + esc(personNavn(g.o.ansvarlig)) : '') : 'Uten oppgave'}</td></tr>` : '') + g.rader.map(r => `<tr><td>${esc(r.operasjon)}</td><td>${esc(r.fare)}</td><td>${r.s}</td><td>${r.k}</td><td>${rBoks(rVerdi(r))}</td><td>${esc(r.tiltak)}</td><td>${r.s2 || '–'}</td><td>${r.k2 || '–'}</td><td>${rBoks(rEtter(r))}</td><td>${esc(r.ansvar)}</td></tr>`).join('')).join('')}
    </tbody></table>${v.kommentar ? `<p><b>Kommentar fra lærer:</b> ${esc(v.kommentar)}</p>` : ''}
    <p style="margin-top:30px">Signatur elev: ______________________ &nbsp;&nbsp; Signatur lærer: ______________________</p>`);
}

/* ================= Fire soner ================= */
registrer('ri-soner', el => {
  const alle = synligeVurderinger();
  el.innerHTML = sidehode('Fire soner', 'Klikk på en sone for å se tiltakene der.') +
    `<div class="kort s12 rosa"><div class="soner">${SONER.map(s => {
      const v = alle.filter(r => r.sone === s.id), rader = v.flatMap(r => r.rader), medT = rader.filter(r => r.tiltak.trim());
      const utf = medT.filter(r => r.utfort).length, p = medT.length ? Math.round(utf / medT.length * 100) : 0;
      const hoy = rader.filter(r => rVerdi(r) >= 10).length;
      return `<div class="sone" data-s="${s.id}" style="--kc:${s.farge}"><b style="color:${s.farge}">${s.navn}</b><span class="smaa">${s.hint}</span>
        <div style="display:flex;gap:18px;margin:12px 0 4px"><div><div class="stor" style="font-size:22px">${v.length}</div><span class="smaa">vurderinger</span></div>
        <div><div class="stor" style="font-size:22px">${rader.length}</div><span class="smaa">farer</span></div>
        <div><div class="stor" style="font-size:22px;color:${hoy ? 'var(--pink)' : 'inherit'}">${hoy}</div><span class="smaa">høy risiko</span></div></div>
        <div class="bar" style="margin-top:8px"><span style="width:${p}%;background:${s.farge};box-shadow:0 0 8px ${s.farge}"></span></div>
        <span class="smaa">${medT.length ? `${utf} av ${medT.length} tiltak gjennomført` : 'Ingen tiltak ennå'}</span></div>`;
    }).join('')}</div></div>`;
  $$('[data-s]', el).forEach(s => s.onclick = () => { riSoneFilter = s.dataset.s; apneSide('ri-tiltak'); visSide(); });
});

/* ================= Tiltak ================= */
registrer('ri-tiltak', el => {
  const rader = synligeVurderinger().flatMap(v => v.rader.filter(r => r.tiltak.trim()).map(r => ({ r, v })))
    .filter(x => !riSoneFilter || x.v.sone === riSoneFilter).filter(x => riVisUtfort || !x.r.utfort)
    .sort((a, b) => rVerdi(b.r) - rVerdi(a.r));
  el.innerHTML = sidehode('Tiltak', 'Alle tiltak fra risikovurderingene, med høyest risiko øverst. Huk av når tiltaket er gjennomført.') +
    `<div class="kort s12 rosa"><div class="verktoylinje"><span class="smaa">Sone</span><select id="sone" style="min-width:0;width:auto"><option value="">Alle soner</option>${SONER.map(s => `<option value="${s.id}" ${s.id === riSoneFilter ? 'selected' : ''}>${s.navn}</option>`).join('')}</select>
      <label class="smaa" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="vis-utf" ${riVisUtfort ? 'checked' : ''}>Vis gjennomførte</label></div>
    ${rader.length ? `<table><thead><tr><th style="width:40px">Utført</th><th>Risiko før → etter</th><th>Tiltak</th><th>Fare</th><th>Sone</th><th>Ansvarlig</th><th>Fra vurdering</th></tr></thead><tbody>
      ${rader.map(({ r, v }) => `<tr><td><input type="checkbox" data-v="${v.id}" data-r="${r.id}" ${r.utfort ? 'checked' : ''}></td><td style="white-space:nowrap">${rBoks(rVerdi(r))} → ${rBoks(rEtter(r))}</td>
        <td><b>${esc(r.tiltak)}</b></td><td>${esc(r.fare)}</td><td>${soneNavn(v.sone)}</td><td>${esc(r.ansvar || '–')}</td>
        <td><button class="lenkeknapp" data-apne="${v.id}">${esc(v.tittel || 'Uten tittel')}</button><div class="smaa">${esc(v.elev)}${finnOppgave(r.oppgaveId) ? ' · ' + esc(finnOppgave(r.oppgaveId).tittel) : ''}</div></td></tr>`).join('')}
    </tbody></table>` : '<div class="tom">Ingen tiltak å vise.</div>'}</div>`;
  $('#sone', el).onchange = e => { riSoneFilter = e.target.value; visSide(); };
  $('#vis-utf', el).onchange = e => { riVisUtfort = e.target.checked; visSide(); };
  $$('input[data-r]', el).forEach(c => c.onchange = () => {
    const v = D().risiko.find(x => x.id === c.dataset.v); const r = v.rader.find(x => x.id === c.dataset.r);
    r.utfort = c.checked; Lager.lagre(); visSide();
  });
  $$('[data-apne]', el).forEach(b => b.onclick = () => { const v = D().risiko.find(x => x.id === b.dataset.apne); riApne = v.id; apneSide(v.kilde === 'innlevert' ? 'ri-innlevert' : 'ri-mine'); });
});

/* ================= Innleveringer (lærer) ================= */
registrer('ri-innlevert', el => {
  const d = D();
  const v = riApne ? d.risiko.find(x => x.id === riApne && x.kilde === 'innlevert') : null;
  if (v) return vurderingsEditor(el, v);
  const liste = d.risiko.filter(r => r.kilde === 'innlevert').sort((a, b) => (b.mottatt || '').localeCompare(a.mottatt || ''));
  el.innerHTML = sidehode('Innleveringer', 'Hent inn risikovurderinger elevene har levert i Teams. Last ned filene fra Teams først, og velg dem her.', '<button class="btn" id="hent">Hent innleverte filer</button>') +
    `<div class="kort s12 rosa">${liste.length ? `<table><thead><tr><th>Elev</th><th>Klasse</th><th>Arbeidsoppdrag</th><th>Sone</th><th>Høyeste risiko</th><th>Mottatt</th><th>Status</th></tr></thead><tbody>
      ${liste.map(r => { const m = maksRisiko(r); return `<tr class="klikk" data-r="${r.id}"><td><b>${esc(r.elev)}</b></td><td>${esc(r.klasse || '–')}</td><td>${esc(r.tittel)}</td><td>${soneNavn(r.sone)}</td>
        <td><span class="rverdi ${rKlasse(m)}">${m}</span></td><td>${visDato((r.mottatt || '').slice(0, 10))}</td><td>${st(r.status, R_STATUS_KL[r.status] || 'ny')}</td></tr>`; }).join('')}
    </tbody></table>` : '<div class="tom">Ingen innleveringer er hentet inn ennå.</div>'}</div>`;
  $('#hent', el).onclick = hentInnleveringer;
  $$('tr[data-r]', el).forEach(tr => tr.onclick = () => { riApne = tr.dataset.r; visSide(); });
});

/* Henter inn risikovurderinger elevene har levert (filer lastet ned fra Teams) */
async function hentInnleveringer() {
    const d = D();
    const filer = await apneFiler([{ name: 'VEKTRA risikovurdering', extensions: ['json'] }], true);
    let ok = 0, feil = 0, oppdatert = 0;
    for (const f of filer) {
      try {
        const o = JSON.parse(f.innhold);
        if (o.type !== 'klar-risikovurdering' || !o.vurdering) throw new Error();
        const inn = { ...o.vurdering, kilde: 'innlevert', status: 'Til vurdering', mottatt: new Date().toISOString(), originalId: o.vurdering.id };
        const gammel = d.risiko.find(x => x.kilde === 'innlevert' && x.originalId === inn.originalId);
        if (gammel) { Object.assign(gammel, inn, { id: gammel.id, kommentar: gammel.kommentar }); oppdatert++; }
        else { inn.id = nyId(); d.risiko.push(inn); ok++; }
      } catch (e) { feil++; }
    }
    Lager.lagre(); visSide();
    if (filer.length) toast(`${ok} nye${oppdatert ? `, ${oppdatert} oppdatert` : ''}${feil ? `, ${feil} filer kunne ikke leses` : ''}.`, feil > 0 && !ok);
}
