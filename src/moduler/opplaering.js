/* VEKTRA – modul: Verktøyopplæring (Elevmappe → Kompetanse og opplæring) */
'use strict';

const VO_STEG = [['teori', 'Teori', 'Bruksanvisning og farer'], ['demo', 'Demonstrasjon', 'Lærer viser'], ['ovelse', 'Øving under tilsyn', 'Eleven prøver'], ['godkjent', 'Godkjent', 'For selvstendig bruk']];
const VO_KOMPMAL = 'Velge og bruke maskiner og verktøy til ulike arbeidsoppdrag og følge anvisning for bruk og håndtering';   // BAT01-03, Udir
const VO_STATUS = { g: ['Godkjent', 'ok'], u: ['Under opplæring', 'gul'], x: ['Må fornyes', 'hoy'], i: ['Ikke startet', ''] };
/* Forslag til sjekkpunkter. Kan endres under «Sjekkpunkter …» */
/* Verktøyene står i samme rekkefølge som på skolens skjema «Gjennomført instruks og opplæring» */
const VO_STD_MALER = {
  'Spikerpistol': ['Velge og bruke riktig verneutstyr (briller, hørselvern)', 'Kjenne forskjell på enkeltskudd og kontaktutløser', 'Laste og bytte spiker riktig',
    'Holde pistolen vinkelrett mot emnet og hånden unna skuddretningen', 'Aldri peke pistolen mot noen', 'Koble fra luft/batteri ved feilretting og pause'],
  'Batteridrill': ['Velge og bruke riktig verneutstyr (briller)', 'Velge riktig bits eller bor', 'Stille inn riktig moment og hastighet', 'Holde godt og stå stødig når boret kan låse seg', 'Ta ut batteriet ved bytte av bits'],
  'Stikksag': ['Velge og bruke riktig verneutstyr (briller, hørselvern)', 'Velge riktig sagblad til materialet og feste det riktig', 'Sjekke at det ikke ligger ledninger eller rør bak der det skal sages',
    'Holde foten (sålen) flatt mot emnet hele tiden', 'Holde den andre hånden unna bladet og under emnet', 'Vente til bladet har stoppet før saga løftes ut', 'Ta ut batteriet / støpselet ved bladskift'],
  'Sirkelsag': ['Velge og bruke riktig verneutstyr (briller, hørselvern)', 'Sjekke at pendelvernet går fritt tilbake', 'Stille riktig skjæredybde', 'Sikre at emnet ligger støtt og at kappet del faller fritt',
    'Holde i begge håndtakene og stå til siden for sagsporet', 'Vente til bladet har stoppet før saga legges ned', 'Trekke ut støpselet / ta ut batteriet ved bladskift'],
  'Multikutter/feinsag': ['Velge og bruke riktig verneutstyr (briller, hørselvern, støvmaske ved sliping)', 'Velge riktig blad eller slipeplate og feste det riktig', 'Sjekke at det ikke ligger ledninger eller rør bak der det skal skjæres',
    'Starte på lav hastighet og la verktøyet gjøre jobben', 'Holde den andre hånden unna bladet', 'Være forsiktig med varme blader etter bruk', 'Ta ut batteriet / støpselet ved bladskift'],
  'Elektrisk høvel': ['Velge og bruke riktig verneutstyr (briller, hørselvern, støvmaske)', 'Sjekke at knivene er hele og godt festet', 'Stille inn riktig spåndybde',
    'Feste emnet godt og høvle med fibrene', 'Holde i begge håndtakene og legge trykk på framre sko ved start', 'Vente til knivene har stoppet før høvelen legges ned', 'Sjekke at emnet er fritt for spiker og skruer'],
  'Vinkelsliper': ['Velge og bruke riktig verneutstyr (briller/visir, hørselvern, hansker, støvmaske)', 'Velge riktig skive og sjekke at den er hel og passer maskinens turtall', 'Sjekke at vernet sitter riktig og vender mot deg',
    'Bruke sidehåndtaket og holde med begge hender', 'Passe på gnistretningen (brannfare og andre personer)', 'Aldri bruke kappeskive til sliping fra siden', 'Vente til skiva har stoppet før maskinen legges ned', 'Trekke ut støpselet / ta ut batteriet ved skivebytte'],
  'Kapp- og gjersag/listesager': ['Velge og bruke riktig verneutstyr (briller, hørselvern)', 'Sjekke at vern og bladbeskyttelse fungerer', 'Velge riktig sagblad og sjekke at det er helt',
    'Bruke nødstopp og vite hvor den er', 'Feste emnet riktig og holde hendene unna bladet', 'Stille inn og låse vinkel og gjæring før start', 'Vente til bladet har stoppet før emnet løftes', 'Stå i riktig arbeidsstilling', 'Rydde og rengjøre maskinen etter bruk'],
  'Bajonettsag': ['Velge og bruke riktig verneutstyr (briller, hørselvern, hansker)', 'Velge riktig blad til materialet og feste det riktig', 'Sjekke at det ikke ligger ledninger eller rør der det skal sages',
    'Holde foten (anlegget) mot emnet så saga ikke slår', 'Holde med begge hender og stå stødig', 'Passe på at deler som kappes ikke faller på noen', 'Ta ut batteriet / støpselet ved bladskift'],
  'Smergel/slipemaskin': ['Velge og bruke riktig verneutstyr (briller/visir, hørselvern)', 'Sjekke at slipeskiva er hel (klangprøve) og at vernet er på', 'Stille verktøyanlegget 1–3 mm fra skiva',
    'Stå til siden for skiva ved oppstart', 'Holde emnet godt og bruke anlegget', 'Kjøle emnet og passe på varme deler', 'Ikke slipe på siden av skiva', 'Slå av maskinen og vente til skiva har stoppet'],
  'Overfres': ['Velge og bruke riktig verneutstyr (briller, hørselvern, støvmaske)', 'Velge riktig fres, feste den godt og trekke ut støpselet ved fresbytte', 'Stille inn riktig fresedybde og turtall',
    'Feste emnet godt og fjerne spiker og skruer', 'Frese i riktig retning (mot rotasjonen)', 'Holde i begge håndtakene', 'Vente til fresen har stoppet før maskinen løftes'],
  'Fallsele': ['Vite når fallsikring skal brukes (fallhøyde over 2 meter)', 'Kontrollere selen, stroppen og karabinene før bruk', 'Ta på og stramme selen riktig',
    'Feste i godkjent forankringspunkt over deg', 'Kjenne til fritt fall og pendelfare', 'Vite at en sele som har tatt et fall skal kasseres', 'Henge selen tørt og luftig etter bruk'],
  'Stillas, stiger og arbeidsbukker': ['Kontrollere stillaset før bruk (grønt skilt / kontrollkort)', 'Aldri endre på stillaset uten opplæring', 'Holde stillaset ryddig og ikke overbelaste det',
    'Velge riktig stige og sette den med riktig vinkel (ca. 1:4)', 'Sikre stigen mot å skli og stå minst tre trinn under toppen', 'Holde tre-punkts kontakt i stigen', 'Sjekke at arbeidsbukkene står støtt og er hele', 'Bruke rekkverk eller fallsikring der det kreves'],
  'Bygningssag (gjerdesag)': ['Velge og bruke riktig verneutstyr (briller, hørselvern)', 'Stille inn kløyvkniv og bladvern', 'Bruke anlegg og skyvepinne', 'Aldri stå rett bak bladet (tilbakeslag)',
    'Bruke nødstopp og vite hvor den er', 'Vente til bladet har stoppet før avkapp fjernes', 'Rydde og rengjøre maskinen etter bruk'],
  'Gjengemaskin': ['Velge og bruke riktig verneutstyr (briller, hansker uten løse deler)', 'Feste røret godt i chucken / skruestikka', 'Velge riktig gjengebakke og montere den riktig',
    'Bruke nok skjæreolje', 'Bruke fotbryteren og holde hendene unna roterende deler', 'Ikke ha løse klær, smykker eller langt hår som kan sette seg fast', 'Rydde spon og olje etter bruk'],
  'Betongblander': ['Velge og bruke riktig verneutstyr (briller, hansker, støvmaske)', 'Sjekke at blanderen står stødig og at kabel og jordfeilbryter er i orden', 'Kjenne til faren ved sement (etsende for hud og øyne)',
    'Aldri stikke hender eller verktøy inn i trommelen mens den går', 'Fylle i riktig rekkefølge og ikke overfylle', 'Slå av og trekke ut støpselet før rengjøring', 'Rengjøre trommelen rett etter bruk']
};
/* Gamle navn fra før skjemaet ble lagt inn → nye navn */
const VO_GAMLE_NAVN = { 'Kappsag': 'Kapp- og gjersag/listesager', 'Drill/skrutrekker': 'Batteridrill', 'Bordsag': 'Bygningssag (gjerdesag)' };
const voNyttNavn = n => VO_GAMLE_NAVN[n] || n;
const VO_FELLES = ['Velge og bruke riktig verneutstyr', 'Lese og forstå bruksanvisningen', 'Sjekke at maskinen og vernet er helt før bruk', 'Vite hvor strømbryter eller nødstopp er',
  'Bruke maskinen i riktig arbeidsstilling', 'Rydde og rengjøre etter bruk'];
let voKlasse = '';

const voMaler = () => { const d = D(); if (!d.opplMaler || !Object.keys(d.opplMaler).length) d.opplMaler = JSON.parse(JSON.stringify(VO_STD_MALER)); return d.opplMaler; };
const voPunkterFor = maskin => voMaler()[maskin] || VO_FELLES;
/* Maskinene som vises: maler + elektroverktøy og maskiner i verktøy-lista + det som er brukt i opplæringer */
function voMaskiner() {
  const d = D();
  /* Verktøyene med sjekkpunkter står først i skjemaets rekkefølge, resten alfabetisk etter */
  const maler = Object.keys(voMaler());
  const andre = [...new Set([...(d.verktoy || []).filter(v => ['Elektroverktøy', 'Maskin'].includes(v.type)).map(v => voNyttNavn(v.navn)), ...d.opplaering.map(o => o.maskin)])]
    .filter(x => x && !maler.includes(x)).sort(sortNavn);
  return [...maler, ...andre];
}
function voStatus(o) {
  if (!o) return 'i';
  if (o.steg.godkjent) return o.fornyes && o.fornyes < idag() ? 'x' : 'g';
  if (VO_STEG.some(([k]) => o.steg[k]) || o.punkter.some(p => p.forklart || p.utfort)) return 'u';
  return 'i';
}
const voFinn = (elev, maskin) => D().opplaering.filter(o => o.elev === elev && o.maskin === maskin).sort((a, b) => (b.opprettet || '').localeCompare(a.opprettet || ''))[0];
function voNesteKode(d) {
  const aar = idag().slice(0, 4);
  const max = d.opplaering.reduce((m, o) => { const x = /^VO-(\d{4})-(\d+)$/.exec(o.kode || ''); return x && x[1] === aar ? Math.max(m, +x[2]) : m; }, 0);
  return `VO-${aar}-${String(max + 1).padStart(3, '0')}`;
}
const voOmEttAar = () => { const t = new Date(); t.setFullYear(t.getFullYear() + 1); return t.toISOString().slice(0, 10); };

/* ============ Opplæringsskjemaet ============ */
async function voRediger(o, { elev = '', maskin = '' } = {}) {
  const d = D(); const ny = !o;
  const v = ny ? { elev, maskin: maskin || voMaskiner()[0] || '', instruktor: meg(), steg: {}, punkter: voPunkterFor(maskin || voMaskiner()[0]).map(t => ({ tekst: t, forklart: false, utfort: false })),
    antall: 0, fornyes: voOmEttAar(), kommentar: '', elevBekreftet: false } : JSON.parse(JSON.stringify(o));
  const kode = ny ? voNesteKode(d) : o.kode;
  const maskiner = [...new Set([...voMaskiner(), v.maskin])].filter(Boolean);
  return new Promise(res => {
    const m = modal(`<div class="av-hode"><h2>Verktøyopplæring</h2><span class="smaa">ID: ${esc(kode)}</span></div>
      <form id="voskjema">
        <div class="lg-r3">
          <div class="felt"><span>Elev *</span>${personVelgerHtml('pv-voelev')}</div>
          <label class="felt"><span>Verktøy / maskin *</span><select name="maskin">${maskiner.map(x => `<option ${x === v.maskin ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
          <div class="felt"><span>Instruktør</span>${personVelgerHtml('pv-voinstr')}</div>
        </div>
        <div class="av-info vo-mal">Kompetansemål: ${VO_KOMPMAL}</div>
        <div class="felt"><span>Opplæringen går i fire steg. Kryss av når steget er gjort.</span>
          <div class="vo-steg">${VO_STEG.map(([k, t, u], i) => `<label class="vo-stegboks ${v.steg[k] ? 'ferdig' : ''}" data-steg="${k}">
            <span class="vo-stegtopp"><input type="checkbox" data-sk="${k}" ${v.steg[k] ? 'checked' : ''}><b>${i + 1}. ${t}</b></span><span class="smaa">${u}</span>
            <input type="date" data-sd="${k}" value="${v.steg[k] || ''}"></label>`).join('')}</div></div>
        <div class="felt"><span>Sjekkpunkter</span>
          <table class="vo-pkt"><thead><tr><th style="width:28px"></th><th>Eleven kan …</th><th style="width:80px;text-align:center">Forklart</th><th style="width:80px;text-align:center">Utført</th><th style="width:30px"></th></tr></thead><tbody id="vo-pkter"></tbody></table>
          <div class="verktoylinje" style="margin-top:8px"><input type="text" id="vo-nytt" placeholder="+ Legg til sjekkpunkt" style="max-width:340px"><button type="button" class="btn sek" id="vo-leggtil">Legg til</button>
            <button type="button" class="lenkeknapp" id="vo-alle" style="margin-left:auto">Kryss av alle</button></div></div>
        <div class="lg-r2">
          <label class="felt"><span>Antall øvingsganger</span><input type="number" name="antall" min="0" value="${+v.antall || 0}"></label>
          <label class="felt"><span>Ny kontroll / oppfriskning</span><input type="date" name="fornyes" value="${v.fornyes || ''}"></label>
        </div>
        <label class="felt"><span>Kommentar fra instruktør</span><textarea name="kommentar">${esc(v.kommentar)}</textarea></label>
        <div class="lg-r2">
          <label class="sjekk vo-bekreft"><input type="checkbox" name="elevBekreftet" ${v.elevBekreftet ? 'checked' : ''}>Eleven bekrefter: «Jeg har fått opplæring og forstår farene»</label>
          <label class="sjekk vo-bekreft"><input type="checkbox" name="godkjent" ${v.steg.godkjent ? 'checked' : ''}>Lærer godkjenner eleven for selvstendig bruk</label>
        </div>
        <div class="laasfeil" id="mfeil"></div>
        <div class="knapper">${ny ? '' : '<button type="button" class="btn fare" data-slett style="margin-right:auto">Slett</button>'}
          <button type="button" class="btn sek" data-egen title="Skolens egenerklæringsskjema for eleven, med alle verktøy">Skriv ut egenerklæring</button>
          <button type="button" class="btn sek" data-bevis>Skriv ut bevis</button>
          <button type="button" class="btn sek" data-avbryt>Avbryt</button><button class="btn" type="submit">Lagre</button></div>
      </form>`, { bred: true });
    const f = $('#voskjema', m.el);
    const elevV = koblPersonVelger($('#pv-voelev', m.el), { verdi: v.elev, bare: 'elever' });
    const instrV = koblPersonVelger($('#pv-voinstr', m.el), { verdi: v.instruktor });

    const tegnPunkter = () => {
      $('#vo-pkter', m.el).innerHTML = v.punkter.map((p, i) => `<tr><td class="smaa">${i + 1}</td><td><input type="text" data-pt="${i}" value="${esc(p.tekst)}" class="vo-pinn"></td>
        <td style="text-align:center"><input type="checkbox" data-pf="${i}" ${p.forklart ? 'checked' : ''}></td><td style="text-align:center"><input type="checkbox" data-pu="${i}" ${p.utfort ? 'checked' : ''}></td>
        <td><button type="button" class="lenkeknapp fare" data-px="${i}" title="Fjern punktet">×</button></td></tr>`).join('') || '<tr><td colspan="5" class="smaa">Ingen sjekkpunkter.</td></tr>';
      $$('[data-pt]', m.el).forEach(i => i.oninput = () => v.punkter[+i.dataset.pt].tekst = i.value);
      $$('[data-pf]', m.el).forEach(i => i.onchange = () => v.punkter[+i.dataset.pf].forklart = i.checked);
      $$('[data-pu]', m.el).forEach(i => i.onchange = () => { v.punkter[+i.dataset.pu].utfort = i.checked; if (i.checked) { v.punkter[+i.dataset.pu].forklart = true; tegnPunkter(); } });
      $$('[data-px]', m.el).forEach(b => b.onclick = () => { v.punkter.splice(+b.dataset.px, 1); tegnPunkter(); });
    };
    tegnPunkter();
    const leggTil = () => { const t = $('#vo-nytt', m.el).value.trim(); if (!t) return; v.punkter.push({ tekst: t, forklart: false, utfort: false }); $('#vo-nytt', m.el).value = ''; tegnPunkter(); };
    $('#vo-leggtil', m.el).onclick = leggTil;
    $('#vo-nytt', m.el).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); leggTil(); } };
    $('#vo-alle', m.el).onclick = () => { v.punkter.forEach(p => { p.forklart = true; p.utfort = true; }); tegnPunkter(); };
    f.elements.maskin.onchange = async () => {
      const brukt = v.punkter.some(p => p.forklart || p.utfort);
      if (brukt && !await bekreft('Sjekkpunktene byttes til punktene for den nye maskinen. Avkryssingene forsvinner.', { ja: 'Bytt', tittel: 'Bytte maskin?' })) { f.elements.maskin.value = v.maskin; return; }
      v.maskin = f.elements.maskin.value; v.punkter = voPunkterFor(v.maskin).map(t => ({ tekst: t, forklart: false, utfort: false })); tegnPunkter();
    };
    // steg: avkryssing setter dagens dato
    const settSteg = (k, dato) => { v.steg[k] = dato; const b = $(`[data-steg="${k}"]`, m.el); b.classList.toggle('ferdig', !!dato); $(`[data-sk="${k}"]`, b).checked = !!dato; $(`[data-sd="${k}"]`, b).value = dato || '';
      if (k === 'godkjent') f.elements.godkjent.checked = !!dato; };
    $$('[data-sk]', m.el).forEach(c => c.onchange = () => settSteg(c.dataset.sk, c.checked ? idag() : ''));
    $$('[data-sd]', m.el).forEach(i => i.onchange = () => settSteg(i.dataset.sd, i.value));
    f.elements.godkjent.onchange = () => settSteg('godkjent', f.elements.godkjent.checked ? (v.steg.godkjent || idag()) : '');

    const samle = () => ({ ...v, elev: elevV(), instruktor: instrV(), maskin: f.elements.maskin.value, antall: Math.max(0, +f.elements.antall.value || 0),
      fornyes: f.elements.fornyes.value, kommentar: f.elements.kommentar.value.trim(), elevBekreftet: f.elements.elevBekreftet.checked });
    $('[data-egen]', m.el).onclick = () => { const u = samle(); if (!u.elev) { $('#mfeil', m.el).textContent = 'Velg elev først.'; return; } voSkrivEgenerklaering([u.elev]); };
    $('[data-bevis]', m.el).onclick = () => { const u = samle(); if (!u.elev) { $('#mfeil', m.el).textContent = 'Velg elev først.'; return; } voSkrivBevis([{ ...u, kode }]); };
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const u = samle();
      if (!u.elev) { $('#mfeil', m.el).textContent = 'Velg hvilken elev opplæringen gjelder.'; return; }
      if (!u.maskin) { $('#mfeil', m.el).textContent = 'Velg verktøy eller maskin.'; return; }
      if (u.steg.godkjent) {
        const mangler = u.punkter.filter(p => !p.utfort).length;
        if (mangler && !await bekreft(`${mangler} sjekkpunkt${mangler > 1 ? 'er' : ''} er ikke krysset av som utført. Vil du godkjenne likevel?`, { ja: 'Godkjenn likevel', tittel: 'Ikke alt er utført' })) return;
        if (!u.elevBekreftet && !await bekreft('Eleven har ikke bekreftet opplæringen. Vil du godkjenne likevel?', { ja: 'Godkjenn likevel', tittel: 'Mangler elevens bekreftelse' })) return;
        u.godkjentAv = u.godkjentAv || meg();
      } else u.godkjentAv = '';
      if (ny) d.opplaering.push({ id: nyId(), kode, opprettet: new Date().toISOString(), ...u });
      else Object.assign(o, u);
      m.lukk(); Lager.lagre(); visSide(); toast(u.steg.godkjent ? `${personNavn(u.elev)} er godkjent på ${u.maskin}.` : 'Opplæringen er lagret.'); res(true);
    });
    $('[data-avbryt]', m.el).onclick = () => { m.lukk(); res(false); };
    const sb = $('[data-slett]', m.el);
    if (sb) sb.onclick = async () => { m.lukk(); if (await bekreft(`Slette opplæring ${esc(kode)}?`, { ja: 'Slett', fare: true })) { d.opplaering = d.opplaering.filter(x => x !== o); Lager.lagre(); visSide(); } res(false); };
  });
}

/* ============ Sjekkpunkter per maskin ============ */
function voRedigerMaler(start = '') {
  const maler = voMaler();
  const maskiner = voMaskiner();
  let valgt = start || maskiner[0] || '';
  const m = modal(`<h2>Sjekkpunkter per maskin</h2>
    <p style="margin-top:0">Sjekkpunktene brukes når du starter en ny opplæring. Ett punkt per linje. Maskiner uten egne punkter får de felles punktene.</p>
    <div class="lg-r2"><label class="felt"><span>Maskin</span><select id="vm-maskin">${maskiner.map(x => `<option ${x === valgt ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__ny">+ Ny maskin …</option></select></label>
      <label class="felt"><span>&nbsp;</span><input type="text" id="vm-nynavn" placeholder="Navn på ny maskin" class="skjult"></label></div>
    <label class="felt"><span>Sjekkpunkter</span><textarea id="vm-punkter" style="min-height:210px"></textarea></label>
    <div class="smaa" id="vm-info"></div>
    <div class="knapper"><button class="btn sek" id="vm-std">Bruk felles punkter</button><button class="btn sek" id="vm-lukk" style="margin-left:auto">Lukk</button><button class="btn" id="vm-lagre">Lagre punktene</button></div>`, { bred: true });
  const vis = () => {
    const egne = maler[valgt];
    $('#vm-punkter', m.el).value = (egne || VO_FELLES).join('\n');
    $('#vm-info', m.el).textContent = egne ? '' : 'Maskinen har ingen egne punkter ennå. Det som står nå, er de felles punktene.';
  };
  vis();
  $('#vm-maskin', m.el).onchange = e => {
    const ny = e.target.value === '__ny';
    $('#vm-nynavn', m.el).classList.toggle('skjult', !ny);
    if (ny) { $('#vm-nynavn', m.el).focus(); valgt = ''; $('#vm-punkter', m.el).value = VO_FELLES.join('\n'); } else { valgt = e.target.value; vis(); }
  };
  $('#vm-std', m.el).onclick = () => { $('#vm-punkter', m.el).value = VO_FELLES.join('\n'); };
  $('#vm-lukk', m.el).onclick = () => { m.lukk(); visSide(); };
  $('#vm-lagre', m.el).onclick = () => {
    const navn = valgt || $('#vm-nynavn', m.el).value.trim();
    if (!navn) { toast('Skriv navnet på maskinen.', true); return; }
    const punkter = $('#vm-punkter', m.el).value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!punkter.length) { toast('Legg inn minst ett sjekkpunkt.', true); return; }
    maler[navn] = punkter; Lager.lagre(); toast(`Sjekkpunktene for ${navn} er lagret.`);
    m.lukk(); voRedigerMaler(navn);
  };
}

/* ============ Utskrift ============ */
/* Egenerklæringsskjema HMS: samme oppsett som skolens papirskjema, ett ark per elev.
   VEKTRA fyller ut navn, dato for godkjent, kommentarer og instruktører. Signaturene skrives for hånd. */
const VO_SKJEMA_TOPP = 'Malakoff VGS, Vg1 byggfag:';
function voSkrivEgenerklaering(elevIder) {
  const maskiner = voMaskiner();
  const rader = Math.max(20, maskiner.length);
  const ark = elevIder.map(id => {
    const p = finnPerson(id); const navn = p ? p.navn : personNavn(id);
    const klasse = p && p.klasseId ? klasseNavn(p.klasseId) : '';
    const mine = D().opplaering.filter(o => o.elev === id);
    const kommentarer = mine.filter(o => (o.kommentar || '').trim()).map(o => `${o.maskin}: ${o.kommentar.trim()}`);
    const instr = [...new Set(mine.map(o => personNavn(o.instruktor)).filter(Boolean))];
    const linjer = Array.from({ length: rader }, (_, i) => {
      const mk = maskiner[i]; if (!mk) return '<tr><td></td><td></td><td></td><td></td></tr>';
      const o = voFinn(id, mk); const dato = o && o.steg.godkjent ? visDato(o.steg.godkjent) : '';
      return `<tr><td>${esc(mk)}</td><td>${dato}</td><td></td><td></td></tr>`;
    }).join('');
    const komm = [...kommentarer, '', ''].slice(0, Math.max(2, kommentarer.length)).map(k => `<div class="ek-linje">${esc(k) || '&nbsp;'}</div>`).join('');
    return `<div class="ek">
      <div class="ek-topp">${esc(VO_SKJEMA_TOPP)}</div>
      <div class="ek-tittel">EGENERKLÆRINGSSKJEMA HMS</div>
      <div class="ek-under">Bruk av maskiner og utstyr for byggteknikk. Sikkerhetsopplæring.</div>
      <div class="ek-linje">Jeg, <b>${esc(navn)}</b>${klasse ? ` (${esc(klasse)})` : ''},</div>
      <div class="ek-linje">erklærer herved å ha fått opplæring og brukerkurs i følgende verktøy, basert på beskrevne instrukser.</div>
      <table class="ek-tabell"><thead><tr><th style="width:44%">Gjennomført instruks og opplæring:</th><th style="width:14%">Dato:</th><th>Signatur elev:</th><th>Signatur lærer:</th></tr></thead><tbody>${linjer}</tbody></table>
      <div class="ek-overskrift">Kommentarer fra faglærere / instruktører:</div>${komm}
      <div class="ek-overskrift">Gjennomgått og underskrevet:</div>
      <div class="ek-linje">Sted og dato:</div>
      <div class="ek-linje">Elevens navn: ${esc(navn)}</div>
      <div class="ek-linje">Faglærere / instruktører: ${esc(instr.join(', '))}</div>
    </div>`;
  });
  skrivUt(ark.join('<div class="sideskift"></div>'), elevIder.length === 1 ? `Egenerklæring HMS ${personNavn(elevIder[0])}` : 'Egenerklæring HMS', { staende: true });
}

function voSkrivBevis(liste) {
  skrivUt(liste.map(o => `<h1>Opplæringsbevis – ${esc(o.maskin)}</h1>
    <div class="meta">${esc(o.kode || '')} · skrevet ut ${visDato(idag())}</div>
    <table>
      <tr><th style="width:190px;text-align:left">Elev</th><td>${esc(personNavn(o.elev))}${finnPerson(o.elev)?.klasseId ? ' (' + esc(klasseNavn(finnPerson(o.elev).klasseId)) + ')' : ''}</td></tr>
      <tr><th style="text-align:left">Verktøy / maskin</th><td>${esc(o.maskin)}</td></tr>
      <tr><th style="text-align:left">Instruktør</th><td>${esc(personNavn(o.instruktor))}</td></tr>
      <tr><th style="text-align:left">Kompetansemål</th><td>${VO_KOMPMAL}</td></tr>
      ${VO_STEG.map(([k, t]) => `<tr><th style="text-align:left">${t}</th><td>${o.steg[k] ? visDato(o.steg[k]) : '–'}</td></tr>`).join('')}
      <tr><th style="text-align:left">Antall øvingsganger</th><td>${+o.antall || '–'}</td></tr>
      <tr><th style="text-align:left">Ny kontroll</th><td>${o.fornyes ? visDato(o.fornyes) : '–'}</td></tr>
    </table>
    <h2 style="font-size:15px;margin:16px 0 6px">Sjekkpunkter</h2>
    <table><thead><tr><th style="width:30px">#</th><th style="text-align:left">Eleven kan …</th><th style="width:80px">Forklart</th><th style="width:80px">Utført</th></tr></thead><tbody>
      ${o.punkter.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.tekst)}</td><td style="text-align:center">${p.forklart ? '✓' : ''}</td><td style="text-align:center">${p.utfort ? '✓' : ''}</td></tr>`).join('')}
    </tbody></table>
    ${o.kommentar ? `<p><b>Kommentar:</b> ${esc(o.kommentar)}</p>` : ''}
    <p style="margin-top:14px">${o.elevBekreftet ? '☑' : '☐'} Eleven bekrefter at opplæringen er gitt og at farene er forstått.<br>${o.steg.godkjent ? '☑' : '☐'} Eleven er godkjent for selvstendig bruk${o.steg.godkjent ? ' ' + visDato(o.steg.godkjent) : ''}.</p>
    <p style="margin-top:34px">Signatur elev: ______________________ &nbsp;&nbsp;&nbsp; Signatur instruktør: ______________________ &nbsp;&nbsp;&nbsp; Dato: ____________</p>`).join('<div class="sideskift"></div>'),
    liste.length === 1 ? `Opplæringsbevis ${personNavn(liste[0].elev)} ${liste[0].maskin}` : 'Opplæringsbevis');
}

/* ============ Side: Kompetanse og opplæring ============ */
registrer('hms-kompetanse', el => {
  const d = D();
  const klasser = sorterteKlasser();
  if (!voKlasse || !klasser.some(k => k.id === voKlasse)) voKlasse = klasser[0]?.id || '';
  const elever = voKlasse ? klassensElever(voKlasse) : [];
  const maskiner = voMaskiner();
  const celler = elever.map(e => maskiner.map(mk => { const o = voFinn(e.id, mk); return { o, s: voStatus(o) }; }));
  const tell = s => celler.flat().filter(c => c.s === s).length;
  const fornyesSnart = d.opplaering.filter(o => o.steg.godkjent && o.fornyes && dagerTil(o.fornyes) <= 30).sort((a, b) => a.fornyes.localeCompare(b.fornyes));
  el.innerHTML = sidehode('Kompetanse og opplæring', 'Hvem har fått opplæring i hvilke maskiner og verktøy? Klikk på en rute for å åpne eller starte opplæringen.',
    `<select id="vo-klasse" style="width:auto">${klasser.map(k => `<option value="${k.id}" ${k.id === voKlasse ? 'selected' : ''}>${esc(k.navn)}</option>`).join('')}</select>
     <button class="btn sek" id="vo-maler">Sjekkpunkter …</button>
     <button class="btn sek" id="vo-skriv" ${elever.length ? '' : 'disabled'}>Skriv ut oversikt</button>
     <button class="btn sek" id="vo-egen" ${elever.length ? '' : 'disabled'} title="Skolens egenerklæringsskjema, ett ark per elev">Egenerklæring for klassen</button>
     <button class="btn" id="vo-ny">+ Ny opplæring</button>`) +
    `<div class="grid">
      <div class="kort s3 gronn"><div class="smaa">Godkjent</div><div class="stor">${tell('g')}</div><div class="smaa">elev-maskin-kombinasjoner</div></div>
      <div class="kort s3 gul"><div class="smaa">Under opplæring</div><div class="stor">${tell('u')}</div><div class="smaa">påbegynt, ikke godkjent</div></div>
      <div class="kort s3 rosa"><div class="smaa">Må fornyes</div><div class="stor">${tell('x')}</div><div class="smaa">${fornyesSnart.length ? fornyesSnart.length + ' utløper innen 30 dager' : 'ingen utløper snart'}</div></div>
      <div class="kort s3 bla"><div class="smaa">Maskiner</div><div class="stor">${maskiner.length}</div><div class="smaa">med sjekkpunkter eller i verktøy-lista</div></div>
      ${kort(`Oversikt ${esc(klasseNavn(voKlasse) || '')}`, elever.length && maskiner.length ? `
        <div class="vo-legende">${Object.entries(VO_STATUS).map(([k, [t, kl]]) => `<span>${kl ? st(t, kl) : `<span class="status vo-tom">${t}</span>`}</span>`).join('')}</div>
        <div style="overflow-x:auto"><table class="vo-matrise"><thead><tr><th>Elev</th>${maskiner.map(mk => `<th>${esc(mk)}</th>`).join('')}</tr></thead><tbody>
        ${elever.map((e, i) => `<tr><td><b>${esc(e.navn)}</b></td>${celler[i].map((c, j) => `<td data-sort="${'xgui'.indexOf(c.s)}"><button class="vo-celle" data-e="${e.id}" data-m="${esc(maskiner[j])}" title="${esc(VO_STATUS[c.s][0])}${c.o && c.o.fornyes && c.s === 'g' ? ' · ny kontroll ' + visDato(c.o.fornyes) : ''}">
          ${c.s === 'i' ? '<span class="status vo-tom">–</span>' : st(c.s === 'u' ? `${VO_STEG.filter(([k]) => c.o.steg[k]).length}/4` : VO_STATUS[c.s][0], VO_STATUS[c.s][1])}</button></td>`).join('')}</tr>`).join('')}
        </tbody></table></div>` : `<div class="tom">${!klasser.length ? 'Legg inn klasser og elever under Register først.' : !maskiner.length ? 'Legg inn maskiner under «Sjekkpunkter …» eller i verktøy-lista.' : 'Ingen elever i klassen.'}</div>`, 's12 gronn')}
      ${fornyesSnart.length ? kort('Må fornyes snart', `<table><thead><tr><th>Elev</th><th>Maskin</th><th>Ny kontroll</th></tr></thead><tbody>
        ${fornyesSnart.map(o => `<tr class="klikk" data-o="${o.id}"><td>${esc(personNavn(o.elev))}</td><td>${esc(o.maskin)}</td><td ${o.fornyes < idag() ? 'style="color:var(--pink);font-weight:700"' : ''}>${visDato(o.fornyes)}</td></tr>`).join('')}</tbody></table>`, 's6 rosa') : ''}
      ${kort('Kommer senere i denne mappen', `<div class="sjekk" style="cursor:default">📁 Kurs og sertifikater (stillas, førstehjelp, varme arbeider)</div><div class="sjekk" style="cursor:default">📁 HMS-kort</div>`, `${fornyesSnart.length ? 's6' : 's12'} gul`)}
    </div>`;
  $('#vo-klasse', el) && ($('#vo-klasse', el).onchange = e => { voKlasse = e.target.value; visSide(); });
  $('#vo-maler', el).onclick = () => voRedigerMaler();
  $('#vo-egen', el).onclick = () => voSkrivEgenerklaering(elever.map(e => e.id));
  $('#vo-ny', el).onclick = () => voRediger(null);
  $('#vo-skriv', el).onclick = () => skrivUt(`<h1>Verktøyopplæring – ${esc(klasseNavn(voKlasse))}</h1><div class="meta">Skrevet ut ${visDato(idag())} · G = godkjent, U = under opplæring, F = må fornyes</div>
    <table><thead><tr><th>Elev</th>${maskiner.map(mk => `<th>${esc(mk)}</th>`).join('')}</tr></thead><tbody>
    ${elever.map((e, i) => `<tr><td>${esc(e.navn)}</td>${celler[i].map(c => `<td style="text-align:center">${{ g: 'G', u: 'U', x: 'F', i: '' }[c.s]}${c.s === 'g' && c.o.fornyes ? `<div style="font-size:9px">${visDato(c.o.fornyes)}</div>` : ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`, `Verktøyopplæring ${klasseNavn(voKlasse)}`);
  $$('.vo-celle', el).forEach(b => b.onclick = () => { const o = voFinn(b.dataset.e, b.dataset.m); voRediger(o || null, { elev: b.dataset.e, maskin: b.dataset.m }); });
  $$('tr[data-o]', el).forEach(r => r.onclick = () => voRediger(d.opplaering.find(o => o.id === r.dataset.o)));
});

function migrerOpplaering(d) {
  if (!Array.isArray(d.opplaering)) d.opplaering = [];
  d.opplaering.forEach(o => { if (!o.steg) o.steg = {}; if (!Array.isArray(o.punkter)) o.punkter = []; o.maskin = voNyttNavn(o.maskin); });
  /* Én gang: legg inn skolens verktøyliste og behold egne endringer og egne maskiner */
  if ((d.opplMalerVer || 1) < 2) {
    const gamle = d.opplMaler || {};
    if (Object.keys(gamle).length) {
      const nye = {};
      for (const [navn, punkter] of Object.entries(VO_STD_MALER)) {
        const gammeltNavn = Object.keys(VO_GAMLE_NAVN).find(k => VO_GAMLE_NAVN[k] === navn);
        nye[navn] = gamle[navn] || (gammeltNavn && gamle[gammeltNavn]) || punkter;
      }
      for (const [navn, punkter] of Object.entries(gamle)) if (!VO_GAMLE_NAVN[navn] && !nye[navn]) nye[navn] = punkter;
      d.opplMaler = nye;
    }
    d.opplMalerVer = 2;
  }
}
