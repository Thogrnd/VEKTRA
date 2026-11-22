/* VEKTRA – Innstillinger, oppdateringer og hjelp */
'use strict';

let oppdStatus = null;
let oppdFraMeny = false;           // sjekken ble startet fra knappen nederst i menyen
function sjekkOppdateringFraMeny() {
  if (!api) { toast('Oppdatering virker bare i det installerte programmet.', true); return; }
  oppdFraMeny = true;
  toast('Ser etter oppdateringer …');
  vedOppdateringStatus({ type: 'sjekker' });
  api.sjekkOppdatering();
}
function vedOppdateringStatus(s) {
  oppdStatus = s;
  if (oppdFraMeny && s.type === 'ingen') { oppdFraMeny = false; toast('Du har nyeste versjon av VEKTRA.'); }
  if (oppdFraMeny && s.type === 'feil') { oppdFraMeny = false; toast('Kunne ikke se etter oppdateringer: ' + s.melding, true); }
  if (oppdFraMeny && s.type === 'tilgjengelig') { oppdFraMeny = false; apneSide('innstillinger'); }
  if (s.type === 'tilgjengelig') toast(`Ny versjon av VEKTRA (${s.versjon}) er klar til nedlasting under Innstillinger.`);
  if (s.type === 'klar') toast('Oppdateringen er lastet ned. Start VEKTRA på nytt for å installere.');
  if (aktiv === 'innstillinger') tegnOppdatering();
}
function tegnOppdatering() {
  const el = $('#oppd-status'); if (!el) return;
  const s = oppdStatus;
  const tekst = !s ? 'Trykk for å se om det finnes en nyere versjon.'
    : s.type === 'sjekker' ? 'Ser etter oppdateringer …'
    : s.type === 'ingen' ? '✓ Du har nyeste versjon.'
    : s.type === 'tilgjengelig' ? `Versjon ${esc(s.versjon)} er tilgjengelig.`
    : s.type === 'laster' ? `Laster ned … ${s.prosent}%`
    : s.type === 'klar' ? `Versjon ${esc(s.versjon)} er lastet ned og klar.`
    : `Kunne ikke sjekke: ${esc(s.melding)}`;
  el.innerHTML = `<p class="smaa" style="margin:0 0 10px">${tekst}</p>` +
    (s && s.type === 'laster' ? `<div class="bar" style="margin-bottom:10px"><span style="width:${s.prosent}%;background:var(--blue2)"></span></div>` : '') +
    (s && s.type === 'tilgjengelig' ? '<button class="btn" id="oppd-last">Last ned oppdatering</button>'
      : s && s.type === 'klar' ? '<button class="btn" id="oppd-inst">Start på nytt og installer</button>'
      : `<button class="btn" id="oppd-sjekk" ${s && (s.type === 'sjekker' || s.type === 'laster') ? 'disabled' : ''}>Se etter oppdateringer</button>`);
  const b1 = $('#oppd-sjekk'); if (b1) b1.onclick = () => { if (!api) { vedOppdateringStatus({ type: 'feil', melding: 'oppdatering virker bare i det installerte programmet.' }); return; } vedOppdateringStatus({ type: 'sjekker' }); api.sjekkOppdatering(); };
  const b2 = $('#oppd-last'); if (b2) b2.onclick = () => { vedOppdateringStatus({ type: 'laster', prosent: 0 }); api.lastOppdatering(); };
  const b3 = $('#oppd-inst'); if (b3) b3.onclick = async () => { await Lager.skrivNa(); api.installerOppdatering(); };
}

registrer('innstillinger', async el => {
  const d = D(), i = d.innst;
  el.innerHTML = sidehode('Innstillinger') + `<div class="grid">
    ${kort('Profil', `
      <label class="felt"><span>Navn</span><input type="text" id="in-navn" value="${esc(i.navn)}"></label>
      <div class="rad"><label class="felt"><span>Rolle</span><select id="in-rolle" ${i.elevmappe ? 'disabled title="Koblet til elevmappe på OneDrive"' : ''}><option value="laerer" ${i.rolle === 'laerer' ? 'selected' : ''}>Lærer</option><option value="elev" ${i.rolle === 'elev' ? 'selected' : ''}>Elev</option></select></label>
      <label class="felt"><span>Klasse</span><input type="text" id="in-klasse" value="${esc(i.klasse)}" placeholder="F.eks. 1BA"></label></div>`, 's6 bla')}
    ${kort('Oppdateringer', `<p class="smaa" style="margin-top:0">Installert versjon: <b id="in-versjon">–</b>. VEKTRA henter nye versjoner fra GitHub.</p><div id="oppd-status"></div>`, 's6 lilla')}
    ${kort('Datalagring', `
      <p class="smaa" style="margin-top:0">Alle data lagres bare på denne PC-en. Ingenting sendes på nett. Velger du en mappe i OneDrive, blir fila tatt vare på der, og du kan bruke den samme mappa på en annen PC.</p>
      <label class="felt"><span>Datamappe</span><input type="text" id="in-mappe" readonly value="${api ? 'Henter …' : 'Testmodus: dataene ligger i nettleseren'}"></label>
      <div class="verktoylinje">${api ? '<button class="btn" id="in-bytt">Bytt mappe …</button><button class="btn sek" id="in-apne">Åpne mappen</button>' : ''}</div>
      <p class="smaa">Bruk bare VEKTRA på én PC om gangen hvis to PC-er deler samme mappe. Ellers kan endringer bli overskrevet.</p>`, 's6 gronn')}
    ${i.rolle === 'elev' ? odElevKortHtml() : odLaererKortHtml()}
    ${kort('Sikkerhetskopi', `
      <p class="smaa" style="margin-top:0">VEKTRA tar en automatisk kopi hver dag i undermappen «Sikkerhetskopier» (de siste 14 dagene). Her kan du også lagre en kopi selv, eller hente tilbake en kopi.</p>
      <div class="verktoylinje"><button class="btn" id="in-eksport">Lagre sikkerhetskopi …</button><button class="btn sek" id="in-import">Gjenopprett fra fil …</button></div>`, 's6 oransje')}
    ${kort('Prøv VEKTRA', `
      <p class="smaa" style="margin-top:0">Fyll VEKTRA med eksempeldata for å se hvordan alt fungerer. Du kan slette alt etterpå.</p>
      <div class="verktoylinje"><button class="btn sek" id="in-demo">Fyll inn eksempeldata</button><button class="btn fare" id="in-slett">Slett alle data …</button></div>`, 's6 cyan')}
  </div>`;

  $('#in-navn', el).onchange = e => { i.navn = e.target.value.trim(); Lager.lagre(); oppdaterProfil(); };
  $('#in-rolle', el).onchange = e => { i.rolle = e.target.value; Lager.lagre(); oppdaterProfil(); tegnMeny(); };
  $('#in-klasse', el).onchange = e => { i.klasse = e.target.value.trim(); Lager.lagre(); oppdaterProfil(); };
  tegnOppdatering();
  if (i.rolle === 'elev') odKoblElevKort(el); else odKoblLaererKort(el);
  if (api) api.info().then(inf => { const m = $('#in-mappe'); if (m) m.value = inf.mappe; const v = $('#in-versjon'); if (v) v.textContent = inf.versjon; });
  else $('#in-versjon', el).textContent = 'testversjon';

  const bytt = $('#in-bytt', el);
  if (bytt) bytt.onclick = async () => {
    const valg = await api.velgMappe(); if (!valg) return;
    let modus = 'kopier';
    if (valg.finnes) {
      modus = await velg('Mappen har allerede VEKTRA-data', `Det ligger en VEKTRA-datafil i <b>${esc(valg.mappe)}</b>. Vil du bruke dataene som ligger der, eller erstatte dem med dataene på denne PC-en?`,
        [{ v: 'avbryt', t: 'Avbryt', sek: true }, { v: 'kopier', t: 'Erstatt med mine data', sek: true }, { v: 'bruk', t: 'Bruk dataene i mappen' }]);
      if (modus === 'avbryt') return;
    }
    await Lager.skrivNa();
    const r = await api.byttMappe(valg.mappe, modus, JSON.stringify(D()));
    if (!r.ok) { toast('Kunne ikke bytte mappe: ' + r.feil, true); return; }
    if (modus === 'bruk' && r.tekst) { Lager.d = migrer(JSON.parse(r.tekst)); settTema(D().innst.tema); oppdaterProfil(); }
    toast('VEKTRA bruker nå mappen ' + valg.mappe);
    visSide();
  };
  const apneM = $('#in-apne', el); if (apneM) apneM.onclick = () => api.apneMappe();

  $('#in-eksport', el).onclick = async () => {
    const r = await lagreFil(`VEKTRA sikkerhetskopi ${idag()}.json`, JSON.stringify(D(), null, 1));
    if (r) toast('Sikkerhetskopien er lagret.');
  };
  $('#in-import', el).onclick = async () => {
    const [f] = await apneFiler([{ name: 'VEKTRA-data', extensions: ['json'] }]);
    if (!f) return;
    let ny; try { ny = JSON.parse(f.innhold); if (!ny.innst || !Array.isArray(ny.klasser)) throw 0; } catch (e) { toast('Fila er ikke en VEKTRA-sikkerhetskopi.', true); return; }
    if (!await bekreft(`Alle data i VEKTRA blir erstattet med innholdet i <b>${esc(f.navn)}</b>.`, { ja: 'Gjenopprett', fare: true })) return;
    Lager.d = migrer(ny); Lager.lagre(); settTema(D().innst.tema); oppdaterProfil(); visSide(); toast('Dataene er gjenopprettet.');
  };
  $('#in-demo', el).onclick = async () => {
    if (!await bekreft('Eksempeldata legges til i tillegg til det som ligger i VEKTRA fra før.', { ja: 'Fyll inn', tittel: 'Fylle inn eksempeldata?' })) return;
    leggTilEksempeldata(); Lager.lagre(); toast('Eksempeldata er lagt inn.'); apneSide('hjem');
  };
  $('#in-slett', el).onclick = async () => {
    if (!await bekreft('<b>Alle</b> klasser, elever, klassekart, prosjekter, avvik og risikovurderinger blir slettet. Ta gjerne en sikkerhetskopi først.', { ja: 'Slett alt', fare: true })) return;
    const inn = { ...D().innst }; Lager.d = standardData(); Lager.d.innst = inn; Lager.lagre(); toast('Alle data er slettet.'); visSide();
  };
});

function leggTilEksempeldata() {
  const d = D();
  const dato = n => { const t = new Date(); t.setDate(t.getDate() + n); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); };
  const navn = ['Ali', 'Emil', 'Fatima', 'Henrik', 'Isak', 'Jonas', 'Karl', 'Lars', 'Mats', 'Nora', 'Ola', 'Per', 'Sara', 'Tor'];
  const k = { id: nyId(), navn: '1BA (eksempel)', regler: [] };
  const elever = navn.map(n => ({ id: nyId(), navn: n, klasseId: k.id, bilde: '' }));
  k.regler.push({ id: nyId(), a: elever[0].id, b: elever[1].id });
  d.klasser.push(k); d.elever.push(...elever);
  if (d.innst.navn && !d.laerere.some(l => l.navn === d.innst.navn)) d.laerere.push({ id: nyId(), navn: d.innst.navn, epost: '' });
  ['Per Espen', 'Dag Olav'].forEach(n => { if (!d.laerere.some(l => l.navn === n)) d.laerere.push({ id: nyId(), navn: n, epost: '' }); });
  const p = [['Bod i bindingsverk', 'Gruppe 1', -20, 10, 'Pågår'], ['Forskaling trapp', 'Gruppe 2', -14, -2, 'Pågår'], ['Flislegging våtrom', 'Gruppe 3', -7, 24, 'Planlagt'], ['Vindusmontering', 'Gruppe 4', 3, 35, 'Planlagt']]
    .map(([n, g, s, f, st]) => ({ id: nyId(), navn: n, gruppe: g, ansvarlig: meg(), start: dato(s), frist: dato(f), status: st, beskrivelse: '' }));
  p.forEach((x, i) => x.elever = elever.slice(i * 3, i * 3 + 3).map(e => e.id));
  d.prosjekter.push(...p);
  const op = [['Tegne snitt og materialliste', 0, 'ferdig', -20, -17, 0], ['Bestille materialer', 0, 'ferdig', -16, -14, 1], ['Reise stenderverk', 0, 'pagar', -10, 2, 2], ['Kle med vindsperre', 0, 'gjore', 3, 8, 0],
    ['Rive gammel forskaling', 1, 'pagar', -12, -4, 3], ['Membran i dusjsone', 2, 'gjore', -5, 6, 6], ['Flislegging vegg', 2, 'gjore', 7, 20, 7], ['Måle opp vindusåpning', 3, 'gjore', 3, 8, 9], ['Montere vindu', 3, 'gjore', 9, 30, 10]]
    .map(([t, i, k2, s0, s1, e]) => ({ id: nyId(), tittel: t, prosjektId: p[i].id, ansvarlig: elever[e].id, start: dato(s0), frist: dato(s1), kolonne: k2, fremdrift: k2 === 'ferdig' ? 100 : k2 === 'pagar' ? 60 : 0 }));
  d.oppgaver.push(...op);
  [['Skadet skjøteledning', 'Verksted 1', -3, 'Høy', 'Åpen', 'HMS-avvik', 'Isolasjonen er kuttet ca. 1 m fra støpselet.', 'Ta ledningen ut av bruk og merk den. Bytt til ny.', ['Elektrisk', 'Verktøy']],
   ['Rot ved materialstativet', 'Lager', -9, 'Lav', 'Under arbeid', 'Orden og renhold', 'Kapp og emballasje ligger på gulvet foran stativet.', 'Rydd etter hver økt.', []],
   ['Nesten truffet av fallende plate', 'Verksted 2', -12, 'Middels', 'Åpen', 'Nestenulykke', 'En OSB-plate som sto løst mot veggen veltet.', 'Plater skal ligge flatt eller sikres med stropp.', ['Lagring']],
   ['Manglende skilting ved sag', 'Verksted 2', -20, 'Middels', 'Lukket', 'HMS-avvik', 'Skilt om vernebriller mangler ved kappsagen.', 'Sett opp skilt.', []]]
    .forEach(([t, s2, n, al, st, ty, b2, f2, ml]) => nyttAvvik(d, { tittel: t, sted: s2, dato: dato(n), tid: '09:40', alvor: al, status: st, type: ty, beskrivelse: b2, forslag: f2, merkelapper: ml,
      frist: st === 'Lukket' ? '' : dato(n + 7), utfort: st === 'Lukket' ? 'Skilt satt opp.' : '', lukket: st === 'Lukket' ? dato(n + 2) : '' }));
  [['Hjelm', 30, 0, -40, 140], ['Vernebriller', 30, 0, -40, 140], ['Hørselvern', 25, 5, -40, 140], ['Fallsikringsutstyr', 6, 0, -380, -15]]
    .forEach(([n, a, m, k1, k2], i) => d.verneutstyr.push({ id: nyId(), navn: n, plassering: i < 3 ? 'Garderobe' : 'Verksted 1', antall: a, mangler: m, kontrollert: dato(k1), neste: dato(k2), merknad: '' }));
  [['Drill/skrutrekker', 'Elektroverktøy', 'Verksted 1', 12, 1, -60, 120], ['Sirkelsag', 'Elektroverktøy', 'Verksted 1', 4, 0, -200, -10], ['Kappsag', 'Maskin', 'Verksted 2', 2, 0, -30, 300],
    ['Vater 120 cm', 'Måleverktøy', 'Verktøyskap', 10, 0, '', ''], ['Hammer', 'Håndverktøy', 'Verktøyskap', 20, 2, '', '']]
    .forEach(([n, t, p, a, f, k1, k2]) => d.verktoy.push({ id: nyId(), navn: n, type: t, plassering: p, antall: a, defekt: f, kontrollert: k1 === '' ? '' : dato(k1), neste: k2 === '' ? '' : dato(k2), merknad: '' }));
  if (!d.deler) d.deler = [];
  [['Konstruksjonsvirke', 'Trelast', '48x98', 'Verksted 1', 40, 'stk', 10], ['Konstruksjonsvirke', 'Trelast', '48x198', 'Verksted 1', 6, 'stk', 8],
   ['OSB-plate', 'Plater', '12 mm', 'Verksted 2', 14, 'stk', 4], ['Gipsplate', 'Plater', '12,5 mm', 'Verksted 2', 0, 'stk', 5],
   ['Treskrue', 'Festemidler', '5x60', 'Lager', 3, 'eske', 2], ['Glassull', 'Isolasjon', '100 mm', 'Lager', 9, 'pakke', 3]]
    .forEach(([n, t, dim, p, a2, e, m]) => d.deler.push({ id: nyId(), navn: n, type: t, dimensjon: dim, plassering: p, antall: a2, enhet: e, minimum: m, merknad: '' }));
  // elevlogg: noen ferdige logger for de første elevene
  const lgElever = d.elever.slice(0, 3);
  const lgOpp = op.find(o => /stender|vegg/i.test(o.tittel)) || op[0];
  lgElever.forEach((e, i) => [-6, -5, -1].forEach((n, j) => d.logger.push({ id: nyId(), opprettet: new Date().toISOString(), elev: e.id, dato: dato(n - i), okt: j === 1 ? 'Teori' : 'Verksted', timer: j === 1 ? 1.5 : 3,
    prosjektId: lgOpp ? lgOpp.prosjektId : '', oppgaveId: lgOpp ? lgOpp.id : '', status: 'ferdig', media: [],
    gjort: j === 1 ? 'Gikk gjennom tegningen av veggen og regnet ut hvor mange stendere vi trenger.' : j === 0 ? 'Kappet svill og topptre, og merket opp stenderplassering med c/c 600.' : 'Kappet 8 stendere og spikret dem fast. Satte opp og avstivet veggen.',
    verktoy: j === 1 ? [] : ['Kappsag', 'Spikerpistol', 'Vater 120 cm'], materialer: j === 1 ? [] : [{ navn: 'Konstruksjonsvirke 48x98', antall: 4 + j * 3, enhet: 'stk' }],
    verneutstyr: j === 1 ? [] : ['Vernebriller', 'Hørselvern', 'Vernesko'],
    bra: ['Oppmerkingen ble nøyaktig.', 'Jeg forsto tegningen godt.', 'Alle stenderne sto i lodd.'][j], vanskelig: ['Å kappe helt rett.', 'Å regne ut c/c ved hjørnet.', 'Å holde spikerpistolen rett.'][j],
    neste: ['Kappe stendere.', 'Begynne å kappe.', 'Spikre ferdig avstivningen.'][j], vurdering: Math.min(6, 3 + ((i + j) % 3)),
    kompmal: j === 1 ? 'forstå og arbeide etter tegninger og beskrivelser' : 'planlegge, gjennomføre, vurdere og dokumentere eget arbeid',
    tilbakemelding: j === 0 ? { tekst: 'Fin og presis oppmerking. Husk å sjekke vinkelen før du kapper.', av: meg(), dato: dato(n - i + 1) } : null })));
  // verktøyopplæring: noen eksempler
  if (!d.opplaering) d.opplaering = [];
  const voSt = (n, g) => ({ teori: dato(n), demo: dato(n), ovelse: g >= 1 ? dato(n + 2) : '', godkjent: g >= 2 ? dato(n + 4) : '' });
  d.elever.slice(0, 5).forEach((e, i) => [['Kapp- og gjersag/listesager', 2], ['Spikerpistol', i === 3 ? 1 : 2], ['Sirkelsag', i % 2 ? 1 : 2], ['Batteridrill', 2]].forEach(([mk, g], j) => {
    if ((i + j) % 4 === 3) return;
    const pk = (VO_STD_MALER[mk] || VO_FELLES).map(t => ({ tekst: t, forklart: true, utfort: g >= 2 }));
    d.opplaering.push({ id: nyId(), kode: `VO-${dato(0).slice(0, 4)}-${String(d.opplaering.length + 1).padStart(3, '0')}`, opprettet: new Date().toISOString(), elev: e.id, maskin: mk, instruktor: meg(),
      steg: voSt(-40 + j * 5, g), punkter: pk, antall: g >= 2 ? 3 : 1, fornyes: i === 4 && j === 1 ? dato(-3) : dato(320), kommentar: '', elevBekreftet: g >= 2, godkjentAv: g >= 2 ? meg() : '' });
  }));
  [-2, -9, -16, -23].forEach(n => d.hmsLogg.push({ id: nyId(), dato: dato(n), sted: 'Verksted 1', ok: 6, totalt: 6, mangler: [], kommentar: '', av: d.innst.navn }));
  const rad = (o, f, s, k2, t, u) => ({ id: nyId(), operasjon: o, fare: f, s, k: k2, tiltak: t, s2: Math.max(1, s - 2), k2: k2 > 3 ? k2 - 1 : k2, ansvar: d.innst.navn || 'Lærer', utfort: u });
  d.risiko.push(
    { id: 'rv' + nyId(), tittel: 'Bod i bindingsverk', elev: 'Ali', klasse: '1BA', dato: dato(-5), sone: 'rabygg', prosjektId: p[0].id, status: 'Godkjent', kommentar: 'Godt jobbet!', kilde: 'egen',
      rader: [{ ...rad('Arbeid på stillas', 'Fall fra høyde', 3, 5, 'Rekkverk og fotlist på stillaset', true), oppgaveId: op[2].id }, { ...rad('Kapping med kappsag', 'Kuttskade', 2, 4, 'Vernebriller, hold hendene unna bladet', true), oppgaveId: op[2].id },
        { ...rad('Bære materialer', 'Belastningsskade', 3, 2, 'Bær to og to', false), oppgaveId: op[1].id }, { ...rad('Stifte vindsperre', 'Stiftepistol i hånd', 2, 3, 'Hold hånden bak stiftepunktet', false), oppgaveId: op[3].id }] },
    { id: nyId(), tittel: 'Membran i våtrom', elev: 'Nora', klasse: '1BA', dato: dato(-1), sone: 'vatrom', status: 'Utkast', kommentar: '', kilde: 'egen',
      rader: [rad('Påføre membran', 'Innånding av løsemidler', 3, 4, 'God ventilasjon og maske', false), rad('Arbeid på gulv', 'Kneskader', 4, 2, 'Knebeskyttere', false)] }
  );
  const rv = d.risiko[d.risiko.length - 2];
  [op[1], op[2], op[3]].forEach(o => o.risikoId = rv.id);
}

/* ================= Hjelp ================= */
registrer('hjelp', el => {
  el.innerHTML = sidehode('Hjelp') + `<div class="grid">
    ${kort('Slik bruker du VEKTRA', `<div class="tom" style="text-align:left;padding:0"><ul style="margin:0;padding-left:18px">
      <li>Velg en modul i sidemenyen. Moduler med pil har undermenyer.</li>
      <li>Hver side du åpner, får en egen fane øverst. Lukk den med ×, midtklikk eller Ctrl+W. Bytt fane med Ctrl+Tab.</li>
      <li>Søkefeltet (Ctrl+K) finner sider, elever, prosjekter, oppgaver, avvik og risikovurderinger.</li>
      <li>Alt lagres automatisk. Nederst i sidemenyen ser du når det sist ble lagret.</li>
      <li>Knappen øverst til venstre gjør menyen smal, slik at du får mer plass.</li></ul></div>`, 's6 bla')}
    ${kort('Register og lærersider', `<div class="tom" style="text-align:left;padding:0"><ul style="margin:0;padding-left:18px">
      <li>Klasser, elever og lærere legges inn én gang under Register, og kan så velges i alle modulene.</li>
      <li>Alle sider er åpne. Senere skal en lisenskode bestemme hvilke moduler hver bruker ser.</li>
      <li>Dataene dine ligger på din PC og i din OneDrive. En elev som åpner lærersidene, ser bare sin egen VEKTRA.</li></ul></div>`, 's6 gronn')}
    ${kort('Risikovurdering for elever', `<div class="tom" style="text-align:left;padding:0"><ol style="margin:0;padding-left:18px">
      <li>Gå til HMS → Risikovurderinger og trykk «+ Ny risikovurdering».</li>
      <li>Fyll inn arbeidsoppdraget, velg sone og legg inn farene. Gi sannsynlighet (S) og konsekvens (K) fra 1 til 5.</li>
      <li>Alle farer med risiko 10 eller høyere må ha tiltak.</li>
      <li>Trykk «Lever til lærer» og lagre fila. Lever fila i oppgaven i Teams.</li>
      <li>Læreren laster ned filene fra Teams og henter dem inn med «Hent innleveringer» under HMS → Risikovurderinger.</li></ol></div>`, 's6 rosa')}
    ${kort('Data og personvern', `<div class="tom" style="text-align:left;padding:0"><ul style="margin:0;padding-left:18px">
      <li>Alle data ligger bare i en fil på PC-en (eller i OneDrive-mappen du har valgt). Ingenting sendes til nettet.</li>
      <li>Oppdateringer hentes fra GitHub, men bare selve programmet, aldri dataene dine.</li>
      <li>VEKTRA tar automatisk sikkerhetskopi hver dag. Se Innstillinger.</li></ul></div>`, 's6 oransje')}
  </div>`;
});
