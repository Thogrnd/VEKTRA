/* VEKTRA – Register: klasser, elever og lærere. Grunnlaget for alle modulene. Bare for lærer. */
'use strict';

let regValgtKlasse = null;

const regKlasse = () => { const d = D(); let k = d.klasser.find(x => x.id === regValgtKlasse); if (!k && d.klasser.length) { k = sorterteKlasser()[0]; regValgtKlasse = k.id; } return k || null; };
/* Navn fra filnavn: «ola_h.jpg» -> «Ola h» */
const navnFraFil = (f) => { const n = f.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim(); return n.charAt(0).toUpperCase() + n.slice(1); };
/* Navn sammenlignes uten store/små bokstaver, punktum og doble mellomrom («Per H.» = «per h») */
const normNavn = (n) => String(n || '').toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
const likNavn = (a, b) => normNavn(a) === normNavn(b);

/* ================= Klasser og elever ================= */
registrer('reg-klasser', el => {
  const d = D();
  const k = regKlasse();
  const elever = k ? klassensElever(k.id) : [];
  const dupl = new Set(elever.filter((e, i) => elever.some((x, j) => j !== i && likNavn(x.navn, e.navn))).map(e => e.id));
  el.innerHTML = sidehode('Klasser og elever', 'Grunnlaget for hele VEKTRA. Elevene du legger inn her, kan velges i alle modulene.',
    `<button class="btn" id="ny-klasse">+ Ny klasse</button>`) +
    `<div class="grid">
      ${kort('Klasser', d.klasser.length ? `<table><tbody>${sorterteKlasser().map(x => `
        <tr class="klikk" data-k="${x.id}" style="${x.id === regValgtKlasse ? 'outline:1px solid var(--cyan)' : ''}"><td><b>${esc(x.navn)}</b></td><td>${klassensElever(x.id).length} elever</td></tr>`).join('')}</tbody></table>`
      : '<div class="tom">Ingen klasser ennå. Trykk «+ Ny klasse».</div>', 's3 cyan')}
      ${k ? kort(`Elever i ${esc(k.navn)} (${elever.length})`, `
        <div class="verktoylinje">
          <button class="btn" id="ny-elev">+ Elev</button>
          <button class="btn sek" id="imp-tekst">Importer fra tekstfil</button>
          <button class="btn sek" id="imp-mappe">Importer fra bildemappe</button>
          <label class="btn sek" style="cursor:pointer">Legg til bilder<input type="file" id="imp-bilder" accept="image/*" multiple hidden></label>
          <span class="spacer"></span>
          <button class="lenkeknapp" id="gi-navn">Gi klassen nytt navn</button>
          <button class="lenkeknapp fare" id="slett-klasse">Slett klasse</button>
        </div>
        ${dupl.size ? `<p class="smaa" style="color:var(--pink)">To eller flere elever har samme navn. Skriv dem forskjellig, for eksempel «Ola H.» og «Ola B.», så det blir tydelig hvem som er hvem.</p>` : ''}
        ${elever.length ? `<table><thead><tr><th style="width:60px">Bilde</th><th>Navn</th><th>E-post</th><th style="width:150px">Klasse</th><th style="width:150px"></th></tr></thead><tbody>
          ${elever.map(e => `<tr data-e="${e.id}" class="${dupl.has(e.id) ? 'dupl' : ''}">
            <td><label style="cursor:pointer" title="Klikk for å velge bilde">${bildeHtml(e, 'elevbilde')}<input type="file" accept="image/*" class="ett-bilde" hidden></label></td>
            <td><input type="text" class="navn" value="${esc(e.navn)}"></td>
            <td><input type="text" class="epost" value="${esc(e.epost || '')}" placeholder="elev@skole.no"></td>
            <td><select class="flytt">${sorterteKlasser().map(x => `<option value="${x.id}" ${x.id === e.klasseId ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></td>
            <td style="text-align:right;white-space:nowrap">${e.bilde ? '<button class="lenkeknapp fjern-bilde">Fjern bilde</button> · ' : ''}<button class="lenkeknapp fare slett-elev">Slett</button></td></tr>`).join('')}
        </tbody></table>`
        : `<div class="tom">Ingen elever i ${esc(k.navn)} ennå.<br>Den raskeste måten er å importere en tekstfil med ett navn per linje, eller en mappe med elevbilder der filnavnet er elevens navn (for eksempel «Ola.jpg»).</div>`}`, 's9 cyan')
      : ''}
    </div>`;

  $('#ny-klasse', el).onclick = async () => {
    const r = await skjema({ tittel: 'Ny klasse', felt: [{ navn: 'navn', etikett: 'Klassenavn (f.eks. 1BA)', kreves: true }] });
    if (!r) return;
    if (d.klasser.some(x => likNavn(x.navn, r.navn))) { toast('Det finnes allerede en klasse med det navnet.', true); return; }
    const ny = { id: nyId(), navn: r.navn, regler: [] };
    d.klasser.push(ny); regValgtKlasse = ny.id; Lager.lagre(); visSide();
  };
  $$('tr[data-k]', el).forEach(tr => tr.onclick = () => { regValgtKlasse = tr.dataset.k; visSide(); });
  if (!k) return;

  $('#ny-elev', el).onclick = async () => {
    const r = await skjema({ tittel: 'Ny elev i ' + k.navn, felt: [{ navn: 'navn', etikett: 'Navn', kreves: true }] });
    if (!r) return;
    if (elever.some(e => likNavn(e.navn, r.navn)) && !await bekreft(`Det finnes allerede en elev som heter «${esc(r.navn)}» i ${esc(k.navn)}. Vil du legge til en til med samme navn?`, { ja: 'Legg til', tittel: 'Samme navn' })) return;
    d.elever.push({ id: nyId(), navn: r.navn, klasseId: k.id, bilde: '' }); Lager.lagre(); visSide(); odLagManglende();
  };
  $('#gi-navn', el).onclick = async () => {
    const r = await skjema({ tittel: 'Gi klassen nytt navn', felt: [{ navn: 'navn', etikett: 'Klassenavn', verdi: k.navn, kreves: true }] });
    if (r) { k.navn = r.navn; Lager.lagre(); visSide(); }
  };
  $('#slett-klasse', el).onclick = async () => {
    if (!await bekreft(`Klassen <b>${esc(k.navn)}</b> med ${elever.length} elever og alle klassekartene for klassen blir slettet. Der elevene er brukt i prosjekter og annet, står det «(slettet person)».`, { ja: 'Slett klassen', fare: true })) return;
    d.klasser = d.klasser.filter(x => x !== k);
    d.elever = d.elever.filter(e => e.klasseId !== k.id);
    d.oppsett = d.oppsett.filter(o => o.klasseId !== k.id);
    regValgtKlasse = null; Lager.lagre(); visSide();
  };
  $('#imp-tekst', el).onclick = () => importerTekst(k);
  $('#imp-mappe', el).onclick = async () => importerBilder(k, await apneBildemappe());
  $('#imp-bilder', el).onchange = e => importerBilder(k, [...e.target.files].map(f => ({ navn: f.name, kilde: f })));

  $$('tr[data-e]', el).forEach(tr => {
    const e = d.elever.find(x => x.id === tr.dataset.e);
    $('.epost', tr).onchange = ev => { e.epost = ev.target.value.trim(); Lager.lagre(); };
    $('.navn', tr).onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = e.navn; return; } e.navn = v; Lager.lagre(); visSide(); };
    $('.flytt', tr).onchange = ev => {
      const ny = ev.target.value; const gammel = e.klasseId;
      e.klasseId = ny;
      d.oppsett.filter(o => o.klasseId === gammel).forEach(o => { for (const c in o.plasser) if (o.plasser[c] === e.id) delete o.plasser[c]; });
      Lager.lagre(); toast(`${e.navn} er flyttet til ${klasseNavn(ny)}.`); visSide();
    };
    $('.ett-bilde', tr).onchange = async ev => { if (ev.target.files[0]) { e.bilde = await lesBilde(ev.target.files[0]); Lager.lagre(); visSide(); } };
    const fb = $('.fjern-bilde', tr); if (fb) fb.onclick = () => { e.bilde = ''; Lager.lagre(); visSide(); };
    $('.slett-elev', tr).onclick = async () => {
      if (!await bekreft(`Slette <b>${esc(e.navn)}</b>? Eleven fjernes også fra klassekart og regler.`, { ja: 'Slett', fare: true })) return;
      d.elever = d.elever.filter(x => x !== e);
      d.klasser.forEach(x => x.regler = (x.regler || []).filter(r => r.a !== e.id && r.b !== e.id));
      d.oppsett.forEach(o => { for (const p in o.plasser) if (o.plasser[p] === e.id) delete o.plasser[p]; });
      Lager.lagre(); visSide();
    };
  });
});

/* ---------- Import fra tekst ---------- */
/* Hver linje: navn i første kolonne, og en e-postadresse hvor som helst på linja (valgfritt) */
const EPOST_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
function tolkLinjer(tekst) {
  return tekst.split(/\r?\n/).map(l => {
    const epost = (l.match(EPOST_RE) || [''])[0].toLowerCase();
    const navn = l.replace(EPOST_RE, '').split(/[\t;,]/).map(x => x.trim()).filter(Boolean)[0] || '';
    return { navn: navn.replace(/^\s*\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim(), epost };
  }).filter(x => x.navn && !/^(navn|elev|elever|fornavn)$/i.test(x.navn));
}
function tolkNavneliste(tekst) { return tolkLinjer(tekst).map(x => x.navn); }
/* mal: 'elev' (til klasse k) eller 'laerer' */
function importerTekst(k, mal = 'elev') {
  const m = modal(`<h2>Importer ${mal === 'elev' ? 'elever til ' + esc(k.navn) : 'lærere'}</h2>
    <p>Velg en tekstfil med <b>ett navn per linje</b>, eller lim inn navnene her. Lister kopiert fra Excel fungerer også: navnet tas fra første kolonne, og står det en e-postadresse på linja, blir den med.</p>
    <div class="rad" style="margin-bottom:10px"><label class="btn sek auto" style="cursor:pointer">Velg tekstfil …<input type="file" id="imp-fil" accept=".txt,.csv,text/plain" hidden></label>
      <label class="smaa auto" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="imp-forste">Ta bare med første ord (fornavnet)</label></div>
    <textarea id="imp-tekst" style="min-height:180px" placeholder="Ola&#10;Kari&#10;Per H.&#10;Per B."></textarea>
    <div id="imp-info" class="smaa" style="margin-top:8px;line-height:1.5"></div>
    <div class="knapper"><button class="btn sek" id="imp-avbryt">Avbryt</button><button class="btn" id="imp-ok" disabled>Importer</button></div>`);
  const ta = $('#imp-tekst', m.el), forste = $('#imp-forste', m.el);
  const personer = () => mal === 'elev' ? klassensElever(k.id) : D().laerere;
  const analyser = () => {
    let linjer = tolkLinjer(ta.value);
    if (forste.checked) linjer = linjer.map(x => ({ ...x, navn: x.navn.split(' ')[0] }));
    const nye = [], fraFor = [], dobbel = [], epostTil = [];
    const epost = {};
    linjer.forEach(({ navn: n, epost: ep }) => {
      const finnes = personer().find(x => likNavn(x.navn, n));
      if (finnes) { if (!fraFor.some(x => likNavn(x, n))) { fraFor.push(n); if (ep && !finnes.epost) epostTil.push([finnes, ep]); } }
      else if (nye.some(x => likNavn(x, n))) { if (!dobbel.some(x => likNavn(x, n))) dobbel.push(n); }
      else { nye.push(n); if (ep) epost[n] = ep; }
    });
    return { nye, fraFor, dobbel, epost, epostTil };
  };
  const vis = () => {
    const a = analyser();
    const antEpost = Object.keys(a.epost).length + a.epostTil.length;
    $('#imp-info', m.el).innerHTML = ta.value.trim() ? `<b style="color:var(--green)">${a.nye.length} nye</b> blir lagt til.` +
      (antEpost ? `<br>${antEpost} e-postadresser blir lagt inn${a.epostTil.length ? ` (${a.epostTil.length} hos elever som finnes fra før)` : ''}.` : '') +
      (a.fraFor.length ? `<br>${a.fraFor.length} finnes fra før og hoppes over: ${esc(a.fraFor.slice(0, 6).join(', '))}${a.fraFor.length > 6 ? ' …' : ''}` : '') +
      (a.dobbel.length ? `<br><span style="color:var(--pink)">Står flere ganger i lista: ${esc(a.dobbel.join(', '))}. Bare den første blir lagt til. Skriv dem forskjellig, for eksempel «Ola H.» og «Ola B.».</span>` : '') : '';
    $('#imp-ok', m.el).disabled = !a.nye.length && !a.epostTil.length;
  };
  ta.oninput = vis; forste.onchange = vis;
  $('#imp-fil', m.el).onchange = async e => { if (e.target.files[0]) { ta.value = await e.target.files[0].text(); vis(); } };
  $('#imp-avbryt', m.el).onclick = m.lukk;
  $('#imp-ok', m.el).onclick = () => {
    const { nye, epost, epostTil } = analyser();
    if (mal === 'elev') nye.forEach(n => D().elever.push({ id: nyId(), navn: n, klasseId: k.id, bilde: '', epost: epost[n] || '' }));
    else nye.forEach(n => D().laerere.push({ id: nyId(), navn: n, epost: epost[n] || '' }));
    epostTil.forEach(([p, ep]) => { p.epost = ep; });
    m.lukk(); Lager.lagre(); visSide(); if (mal === 'elev' && nye.length) setTimeout(odLagManglende, 1500); toast(`${nye.length} ${mal === 'elev' ? 'elever' : 'lærere'} er importert${epostTil.length ? `, ${epostTil.length} fikk e-post` : ''}.`);
  };
}

/* ---------- Import fra bilder: filnavnet er elevens navn ---------- */
async function importerBilder(k, filer) {
  if (!filer || !filer.length) return;
  const eks = klassensElever(k.id);
  const navn = filer.map(f => navnFraFil(f.navn));
  const nyeNavn = [...new Set(navn.filter(n => !eks.some(e => likNavn(e.navn, n))).map(normNavn))];
  if (nyeNavn.length && !await bekreft(`Fant ${filer.length} bilder. ${filer.length - nyeNavn.length > 0 ? `${filer.length - nyeNavn.length} passer med elever som finnes i ${esc(k.navn)}, og får nytt bilde. ` : ''}<b>${nyeNavn.length} nye elever</b> blir opprettet ut fra filnavnene.`, { ja: 'Importer', tittel: 'Importer fra bilder' })) return;
  toast('Leser bildene …');
  let nye = 0, oppdatert = 0; const feil = [];
  for (let i = 0; i < filer.length; i++) {
    const n = navn[i];
    let bilde;
    try { bilde = await lesBilde(filer[i].kilde); } catch (e) { feil.push(filer[i].navn); continue; }
    const e = D().elever.find(x => x.klasseId === k.id && likNavn(x.navn, n));
    if (e) { e.bilde = bilde; oppdatert++; }
    else { D().elever.push({ id: nyId(), navn: n, klasseId: k.id, bilde }); nye++; }
  }
  Lager.lagre(); visSide(); if (nye) setTimeout(odLagManglende, 1500);
  toast(`${nye} nye elever, ${oppdatert} fikk nytt bilde.` + (feil.length ? ` Kunne ikke lese: ${feil.slice(0, 3).join(', ')}` : ''), feil.length > 0);
}

/* ================= Lærere ================= */
registrer('reg-laerere', el => {
  const d = D();
  const liste = sorterteLaerere();
  el.innerHTML = sidehode('Lærere', 'Lærerne kan velges som ansvarlig i prosjekter, oppgaver, avvik og risikovurderinger. Klikk på bildet for å legge inn et bilde.',
    '<button class="btn sek" id="imp">Importer fra tekstfil</button><button class="btn" id="ny">+ Lærer</button>') +
    `<div class="kort s12 cyan">${liste.length ? `<table><thead><tr><th style="width:60px">Bilde</th><th>Navn</th><th>E-post / Teams</th><th style="width:150px"></th></tr></thead><tbody>
      ${liste.map(l => `<tr data-l="${l.id}"><td><label style="cursor:pointer" title="Klikk for å velge bilde">${bildeHtml(l, 'elevbilde')}<input type="file" accept="image/*" class="ett-bilde" hidden></label></td>
        <td><input type="text" data-f="navn" value="${esc(l.navn)}"></td><td><input type="text" data-f="epost" value="${esc(l.epost || '')}" placeholder="navn@ofk.no"></td>
        <td style="text-align:right;white-space:nowrap">${l.bilde ? '<button class="lenkeknapp fjern-bilde">Fjern bilde</button> · ' : ''}<button class="lenkeknapp fare" data-slett>Slett</button></td></tr>`).join('')}
    </tbody></table>` : '<div class="tom">Ingen lærere registrert ennå.</div>'}</div>`;
  $('#ny', el).onclick = async () => {
    const r = await skjema({ tittel: 'Ny lærer', felt: [{ navn: 'navn', etikett: 'Navn', kreves: true }, { navn: 'epost', etikett: 'E-post / Teams' }] });
    if (r) { d.laerere.push({ id: nyId(), ...r }); Lager.lagre(); visSide(); }
  };
  $('#imp', el).onclick = () => importerTekst(null, 'laerer');
  $$('tr[data-l]', el).forEach(tr => {
    const l = d.laerere.find(x => x.id === tr.dataset.l);
    $$('[data-f]', tr).forEach(i => i.onchange = () => { const v = i.value.trim(); if (i.dataset.f === 'navn' && !v) { i.value = l.navn; return; } l[i.dataset.f] = v; Lager.lagre(); if (i.dataset.f === 'navn' && l.navn === d.innst.navn) oppdaterProfil(); });
    $('.ett-bilde', tr).onchange = async ev => { if (ev.target.files[0]) { l.bilde = await lesBilde(ev.target.files[0]); Lager.lagre(); oppdaterProfil(); visSide(); } };
    const fb = $('.fjern-bilde', tr); if (fb) fb.onclick = () => { l.bilde = ''; Lager.lagre(); oppdaterProfil(); visSide(); };
    $('[data-slett]', tr).onclick = async () => { if (await bekreft(`Slette <b>${esc(l.navn)}</b>? Der læreren er brukt som ansvarlig, står det «(slettet person)».`, { ja: 'Slett', fare: true })) { d.laerere = d.laerere.filter(x => x !== l); Lager.lagre(); visSide(); } };
  });
});
