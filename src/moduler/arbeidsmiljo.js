/* VEKTRA – modul: Arbeidsmiljø (HMS-sjekkliste, verneutstyr, avvik) */
'use strict';

const A_STATUS = ['Åpen', 'Under arbeid', 'Lukket'];
const A_STATUS_KL = { 'Åpen': 'hoy', 'Under arbeid': 'pa', 'Lukket': 'ok' };
const A_ALVOR = ['Lav', 'Middels', 'Høy'];
const A_ALVOR_KL = { 'Lav': 'gul', 'Middels': 'pa', 'Høy': 'hoy' };
let amSkjema = { sted: '', dato: null, krysset: new Set(), kommentar: '' };
let amAvvikFilter = 'apne';
let amAvvikValgt = new Set();   // avvik som er krysset av for utskrift

const A_TYPER = ['HMS-avvik', 'Nestenulykke', 'Personskade', 'Materiell skade', 'Orden og renhold', 'Kvalitetsavvik'];

/* ---------- Avvik: datamodell ----------
   {id, kode 'AV-2026-001', tittel, type, sted, alvor, dato, tid, meldtAv, beskrivelse, merkelapper[],
    forslag (forslag til tiltak), ansvarlig, frist, status, utfort (utført tiltak), lukket, vedlegg[{navn, data}]} */
function nesteAvvikKode(d, dato) {
  const aar = (dato || idag()).slice(0, 4);
  const max = d.avvik.reduce((m, a) => { const x = /^AV-(\d{4})-(\d+)$/.exec(a.kode || ''); return x && x[1] === aar ? Math.max(m, +x[2]) : m; }, 0);
  return `AV-${aar}-${String(max + 1).padStart(3, '0')}`;
}
function nyttAvvik(d, felt) {
  const a = { id: nyId(), tittel: '', type: 'HMS-avvik', sted: '', alvor: 'Middels', dato: idag(), tid: '', meldtAv: meg(), beskrivelse: '',
    merkelapper: [], forslag: '', ansvarlig: '', frist: '', status: 'Åpen', utfort: '', lukket: '', vedlegg: [], ...felt };
  a.kode = nesteAvvikKode(d, a.dato);
  d.avvik.push(a); return a;
}
/* Gamle avvik (før skjemaet fikk tittel, type og vedlegg) gjøres om. Kan kjøres flere ganger. */
function migrerAvvik(d) {
  const liste = d.avvik || [];
  [...liste].sort((a, b) => (a.dato || '').localeCompare(b.dato || '')).forEach(a => {
    if (a.tittel === undefined) {
      const b = (a.beskrivelse || '').trim(); const forste = b.split('\n')[0];
      a.tittel = forste.length > 70 ? forste.slice(0, 67) + ' …' : forste || 'Avvik';
      a.forslag = a.tiltak || ''; a.utfort = a.status === 'Lukket' ? (a.tiltak || '') : '';
      delete a.tiltak;
    }
    if (!a.type) a.type = 'HMS-avvik';
    if (!Array.isArray(a.merkelapper)) a.merkelapper = [];
    if (!Array.isArray(a.vedlegg)) a.vedlegg = [];
    ['tid', 'frist', 'forslag', 'utfort', 'lukket'].forEach(k => { if (a[k] === undefined) a[k] = ''; });
    if (!a.kode) a.kode = nesteAvvikKode(d, a.dato);
  });
}
const avvikKode = a => a.kode || '';
const avvikSok = a => [a.kode, a.tittel, a.beskrivelse, a.sted, a.type, ...(a.merkelapper || [])].join(' ').toLowerCase();

/* Bilde til vedlegg: skaleres ned til maks 1200 px, uten å beskjæres */
function lesVedlegg(fil, maks = 1200) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const f = Math.min(1, maks / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res({ navn: fil.name || 'bilde.jpg', data: c.toDataURL('image/jpeg', 0.8) });
      };
      img.onerror = rej; img.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(fil);
  });
}
function stedForslag(d) {
  return [...new Set([...(d.verktoy || []), ...(d.deler || []), ...(d.verneutstyr || []), ...d.avvik.map(a => ({ plassering: a.sted }))]
    .map(u => (u.plassering || '').trim()).filter(Boolean))].sort(sortNavn);
}

/* ---------- Skjemaet «Meld nytt avvik» ---------- */
async function redigerAvvik(a, forslag = {}) {
  const d = D(); const ny = !a;
  const v = ny ? { tittel: '', type: 'HMS-avvik', sted: '', alvor: 'Middels', dato: idag(), tid: new Date().toTimeString().slice(0, 5), meldtAv: meg(),
    beskrivelse: '', merkelapper: [], forslag: '', ansvarlig: '', frist: '', status: 'Åpen', utfort: '', vedlegg: [], ...forslag }
    : JSON.parse(JSON.stringify(a));
  const kode = ny ? nesteAvvikKode(d, v.dato) : a.kode;
  const alleLapper = [...new Set(d.avvik.flatMap(x => x.merkelapper || []))].sort(sortNavn);
  const tekst = (n, ett = false) => ett ? `<input name="${n}" value="${esc(v[n])}">` : `<textarea name="${n}">${esc(v[n])}</textarea>`;

  return new Promise(res => {
    const m = modal(`<div class="av-hode"><h2>${ny ? 'Meld nytt avvik' : 'Avvik'}</h2><span class="smaa">ID: ${esc(kode)}</span></div>
      <div class="av-info">Avviket blir synlig for lærerne. Fyll inn så mye du vet, resten kan fylles inn senere.</div>
      <form id="avskjema" class="av-oppsett">
        <div class="av-faner"><button type="button" class="av-fane valgt" data-fane="reg">Registrering</button>
          <button type="button" class="av-fane" data-fane="vedl">Vedlegg <span id="av-ant"></span></button></div>
        <div class="av-innhold">
          <div data-panel="reg">
            <label class="felt"><span>Tittel *</span>${tekst('tittel', true)}</label>
            <div class="av-rad">
              <label class="felt"><span>Type</span><select name="type">${A_TYPER.map(t => `<option ${t === v.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <label class="felt"><span>Sted</span><input name="sted" list="av-steder" autocomplete="off" value="${esc(v.sted)}"></label>
            </div>
            <div class="felt"><span>Alvorlighetsgrad</span><div class="av-alvor">${A_ALVOR.map(x => `<button type="button" class="av-alv av-${A_ALVOR_KL[x]} ${x === v.alvor ? 'valgt' : ''}" data-alv="${x}">${x}</button>`).join('')}</div></div>
            <div class="av-rad">
              <div class="felt"><span>Inntraff</span><div class="av-rad tett"><input type="date" name="dato" value="${v.dato || ''}"><input type="time" name="tid" value="${v.tid || ''}"></div></div>
              <div class="felt"><span>Meldt av</span>${personVelgerHtml('pv-meldt')}</div>
            </div>
            <label class="felt"><span>Beskrivelse</span>${tekst('beskrivelse')}</label>
            <div class="felt"><span>Merkelapper</span><div class="av-lapper" id="av-lapper"></div></div>
            <label class="felt"><span>Forslag til tiltak</span>${tekst('forslag')}</label>
            <div class="av-rad">
              <div class="felt"><span>Ansvarlig for tiltak</span>${personVelgerHtml('pv-ansv')}</div>
              <label class="felt"><span>Frist</span><input type="date" name="frist" value="${v.frist || ''}"></label>
            </div>
            ${ny ? '' : `<div class="av-skille">Oppfølging</div>
            <div class="av-rad">
              <label class="felt"><span>Status</span><select name="status">${A_STATUS.map(x => `<option ${x === v.status ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
              <div class="felt"><span>Lukket</span><div class="smaa" style="padding-top:9px">${v.lukket ? visDato(v.lukket) : 'Settes når status blir «Lukket»'}</div></div>
            </div>
            <label class="felt"><span>Utført tiltak</span>${tekst('utfort')}</label>`}
          </div>
          <div data-panel="vedl" class="skjult">
            <div class="av-slipp" id="av-slipp">Dra bilder hit, lim inn med Ctrl+V, eller <button type="button" class="lenkeknapp" id="av-velg">velg bilder</button>
              <input type="file" id="av-fil" accept="image/*" multiple hidden></div>
            <div class="av-bilder" id="av-bilder"></div>
          </div>
        </div>
        <datalist id="av-steder">${stedForslag(d).map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <datalist id="av-lapperliste">${alleLapper.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="laasfeil" id="mfeil"></div>
        <div class="knapper">${ny ? '' : '<button type="button" class="btn fare" data-slett style="margin-right:auto">Slett</button>'}
          <button type="button" class="btn sek" data-avbryt>Avbryt</button><button class="btn" type="submit">${ny ? 'Meld avvik' : 'Lagre'}</button></div>
      </form>`, { bred: true });
    const f = $('#avskjema', m.el);
    const meldt = koblPersonVelger($('#pv-meldt', m.el), { verdi: v.meldtAv });
    const ansv = koblPersonVelger($('#pv-ansv', m.el), { verdi: v.ansvarlig });

    // faner
    $$('.av-fane', m.el).forEach(b => b.onclick = () => {
      $$('.av-fane', m.el).forEach(x => x.classList.toggle('valgt', x === b));
      $$('[data-panel]', m.el).forEach(p => p.classList.toggle('skjult', p.dataset.panel !== b.dataset.fane));
    });
    // alvorlighetsgrad
    $$('.av-alv', m.el).forEach(b => b.onclick = () => { v.alvor = b.dataset.alv; $$('.av-alv', m.el).forEach(x => x.classList.toggle('valgt', x === b)); });
    // merkelapper
    const tegnLapper = () => {
      $('#av-lapper', m.el).innerHTML = v.merkelapper.map((t, i) => `<span class="navnchip">${esc(t)}<button type="button" data-i="${i}" title="Fjern">×</button></span>`).join('') +
        `<input class="av-nylapp" list="av-lapperliste" placeholder="+ Legg til" autocomplete="off">`;
      $$('#av-lapper [data-i]', m.el).forEach(b => b.onclick = () => { v.merkelapper.splice(+b.dataset.i, 1); tegnLapper(); });
      const inn = $('.av-nylapp', m.el);
      const leggTil = () => { const t = inn.value.trim(); if (t && !v.merkelapper.some(x => x.toLowerCase() === t.toLowerCase())) v.merkelapper.push(t); tegnLapper(); $('.av-nylapp', m.el).focus(); };
      inn.onkeydown = e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (inn.value.trim()) leggTil(); } };
      inn.onchange = () => { if (alleLapper.includes(inn.value.trim())) leggTil(); };
    };
    tegnLapper();
    // vedlegg
    const tegnBilder = () => {
      $('#av-ant', m.el).textContent = v.vedlegg.length ? `(${v.vedlegg.length})` : '';
      $('#av-bilder', m.el).innerHTML = v.vedlegg.length ? v.vedlegg.map((b, i) => `<figure><img src="${b.data}" alt=""><figcaption>${esc(b.navn)}</figcaption><button type="button" data-fjern="${i}" title="Fjern">×</button></figure>`).join('')
        : '<div class="smaa">Ingen vedlegg ennå. Et bilde av det som er feil gjør avviket lettere å følge opp.</div>';
      $$('[data-fjern]', m.el).forEach(b => b.onclick = () => { v.vedlegg.splice(+b.dataset.fjern, 1); tegnBilder(); });
    };
    const leggTilFiler = async filer => {
      const bilder = [...filer].filter(x => x.type.startsWith('image/'));
      if (!bilder.length) { toast('Bare bilder kan legges ved.', true); return; }
      for (const fil of bilder) { try { v.vedlegg.push(await lesVedlegg(fil)); } catch (e) { toast(`Kunne ikke lese ${fil.name}.`, true); } }
      tegnBilder();
    };
    tegnBilder();
    $('#av-velg', m.el).onclick = () => $('#av-fil', m.el).click();
    $('#av-fil', m.el).onchange = e => leggTilFiler(e.target.files);
    const slipp = $('#av-slipp', m.el);
    slipp.ondragover = e => { e.preventDefault(); slipp.classList.add('over'); };
    slipp.ondragleave = () => slipp.classList.remove('over');
    slipp.ondrop = e => { e.preventDefault(); slipp.classList.remove('over'); leggTilFiler(e.dataTransfer.files); };
    m.el.addEventListener('paste', e => { const filer = [...(e.clipboardData?.files || [])]; if (filer.length) { e.preventDefault(); leggTilFiler(filer); } });

    f.addEventListener('submit', e => {
      e.preventDefault();
      const el = f.elements;
      const ut = { tittel: el.tittel.value.trim(), type: el.type.value, sted: el.sted.value.trim(), alvor: v.alvor, dato: el.dato.value || idag(), tid: el.tid.value,
        meldtAv: meldt(), beskrivelse: el.beskrivelse.value.trim(), merkelapper: v.merkelapper, forslag: el.forslag.value.trim(),
        ansvarlig: ansv(), frist: el.frist.value, vedlegg: v.vedlegg };
      const rest = $('.av-nylapp', m.el).value.trim(); if (rest && !ut.merkelapper.includes(rest)) ut.merkelapper.push(rest);
      if (!ut.tittel) { $('#mfeil', m.el).textContent = '«Tittel» må fylles ut.'; $$('.av-fane', m.el)[0].click(); el.tittel.focus(); return; }
      if (!ny) {
        ut.status = el.status.value; ut.utfort = el.utfort.value.trim();
        if (ut.status === 'Lukket' && a.status !== 'Lukket') ut.lukket = idag();
        if (ut.status !== 'Lukket') ut.lukket = '';
        Object.assign(a, ut);
      } else nyttAvvik(d, { ...ut, kode });
      m.lukk(); Lager.lagre(); visSide(); if (ny) toast(`Avvik ${kode} er meldt.`); res(true);
    });
    $('[data-avbryt]', m.el).onclick = () => { m.lukk(); res(false); };
    const sb = $('[data-slett]', m.el);
    if (sb) sb.onclick = async () => { m.lukk(); if (await bekreft(`Slette avvik ${esc(kode)}? Dette kan ikke angres.`, { ja: 'Slett', fare: true })) { d.avvik = d.avvik.filter(x => x !== a); Lager.lagre(); visSide(); } res(false); };
  });
}

/* ================= HMS-sjekkliste ================= */
registrer('am-sjekk', el => {
  const d = D();
  if (!amSkjema.dato) amSkjema.dato = idag();
  const logg = [...d.hmsLogg].sort((a, b) => (b.dato + (b.tid || '')).localeCompare(a.dato + (a.tid || '')));
  el.innerHTML = sidehode('HMS-sjekkliste', 'Gå gjennom lista før økta i verkstedet. Punkter som ikke er i orden, kan meldes som avvik med én gang.') +
    `<div class="grid">
      ${kort('Ny kontroll', `
        <div class="rad"><label class="felt"><span>Sted</span><input type="text" id="hs-sted" value="${esc(amSkjema.sted)}" placeholder="F.eks. Verksted 1"></label>
        <label class="felt"><span>Dato</span><input type="date" id="hs-dato" value="${amSkjema.dato}"></label></div>
        ${d.hmsMal.map(p => `<label class="sjekk"><input type="checkbox" data-p="${p.id}" ${amSkjema.krysset.has(p.id) ? 'checked' : ''}>${esc(p.tekst)}</label>`).join('') || '<p class="smaa">Sjekklista er tom. Legg til punkter til høyre.</p>'}
        <label class="felt" style="margin-top:12px"><span>Kommentar</span><textarea id="hs-kommentar">${esc(amSkjema.kommentar)}</textarea></label>
        <div class="rad"><span class="smaa">${amSkjema.krysset.size} av ${d.hmsMal.length} punkter i orden</span><button class="btn auto" id="hs-lagre" ${d.hmsMal.length ? '' : 'disabled'}>Lagre kontroll</button></div>`, 's7 oransje')}
      ${kort('Punkter i sjekklista', `
        ${d.hmsMal.map(p => `<div class="sjekk" style="cursor:default">${esc(p.tekst)}<button class="lenkeknapp fare slett" data-slett="${p.id}">Fjern</button></div>`).join('')}
        <div class="rad" style="margin-top:12px"><input type="text" id="hs-nytt" placeholder="Nytt punkt …"><button class="btn auto" id="hs-legg">Legg til</button></div>`, 's5 bla')}
      ${kort('Tidligere kontroller', logg.length ? `<table><thead><tr><th>Dato</th><th>Sted</th><th>Resultat</th><th>Kommentar</th><th>Utført av</th><th></th></tr></thead><tbody>
        ${logg.map(l => `<tr><td>${visDato(l.dato)}</td><td><b>${esc(l.sted || '–')}</b></td>
          <td>${l.ok === l.totalt ? st('Alt i orden', 'ok') : st(`${l.totalt - l.ok} avvik`, 'hoy')} <span class="smaa">${l.ok}/${l.totalt}</span>${l.mangler && l.mangler.length ? `<div class="smaa">Ikke i orden: ${esc(l.mangler.join(', '))}</div>` : ''}</td>
          <td>${esc(l.kommentar || '')}</td><td>${esc(l.av || '')}</td><td><button class="lenkeknapp fare" data-slogg="${l.id}">Slett</button></td></tr>`).join('')}
      </tbody></table>` : '<div class="tom">Ingen kontroller er lagret ennå.</div>', 's12 oransje')}
    </div>`;

  $('#hs-sted', el).oninput = e => amSkjema.sted = e.target.value;
  $('#hs-dato', el).onchange = e => amSkjema.dato = e.target.value || idag();
  $('#hs-kommentar', el).oninput = e => amSkjema.kommentar = e.target.value;
  $$('[data-p]', el).forEach(c => c.onchange = () => { c.checked ? amSkjema.krysset.add(c.dataset.p) : amSkjema.krysset.delete(c.dataset.p); visSide(); });
  const leggTil = () => { const v = $('#hs-nytt', el).value.trim(); if (!v) return; d.hmsMal.push({ id: nyId(), tekst: v }); Lager.lagre(); visSide(); setTimeout(() => $('#hs-nytt') && $('#hs-nytt').focus(), 0); };
  $('#hs-legg', el).onclick = leggTil;
  $('#hs-nytt', el).onkeydown = e => { if (e.key === 'Enter') leggTil(); };
  $$('[data-slett]', el).forEach(b => b.onclick = () => { d.hmsMal = d.hmsMal.filter(p => p.id !== b.dataset.slett); amSkjema.krysset.delete(b.dataset.slett); Lager.lagre(); visSide(); });
  $$('[data-slogg]', el).forEach(b => b.onclick = async () => { if (await bekreft('Slette denne kontrollen fra loggen?', { ja: 'Slett', fare: true })) { d.hmsLogg = d.hmsLogg.filter(l => l.id !== b.dataset.slogg); Lager.lagre(); visSide(); } });
  $('#hs-lagre', el).onclick = async () => {
    const mangler = d.hmsMal.filter(p => !amSkjema.krysset.has(p.id)).map(p => p.tekst);
    d.hmsLogg.push({ id: nyId(), dato: amSkjema.dato, sted: amSkjema.sted.trim(), ok: d.hmsMal.length - mangler.length, totalt: d.hmsMal.length, mangler, kommentar: amSkjema.kommentar.trim(), av: d.innst.navn });
    const sted = amSkjema.sted.trim();
    amSkjema = { sted, dato: idag(), krysset: new Set(), kommentar: '' };
    Lager.lagre();
    if (mangler.length && await bekreft(`${mangler.length} punkt${mangler.length > 1 ? 'er' : ''} var ikke i orden. Vil du opprette avvik for ${mangler.length > 1 ? 'dem' : 'det'}?`, { ja: 'Opprett avvik', nei: 'Nei takk', tittel: 'Kontrollen er lagret' })) {
      mangler.forEach(m => nyttAvvik(d, { tittel: 'Ikke i orden: ' + m, beskrivelse: 'Funnet ved HMS-kontroll.', type: 'HMS-avvik', sted, merkelapper: ['HMS-kontroll'] }));
      Lager.lagre(); toast(`${mangler.length} avvik er opprettet.`);
    } else toast('Kontrollen er lagret.');
    visSide();
  };
});

/* ================= Verneutstyr og verktøy ================= */
/* Begge sidene bygges av samme funksjon. Kolonnene beskrives i UTSTYR_SIDER. */
const VERKTOY_TYPER = ['Elektroverktøy', 'Håndverktøy', 'Maskin', 'Måleverktøy', 'Annet'];
const DEL_TYPER = ['Trelast', 'Plater', 'Festemidler', 'Isolasjon', 'Beslag', 'Folie og tape', 'Annet'];
const DEL_ENHETER = ['stk', 'm', 'm²', 'pakke', 'eske', 'rull'];
const UTSTYR_SIDER = {
  'am-verneutstyr': {
    nokkel: 'verneutstyr', tittel: 'Verneutstyr', ent: 'verneutstyr', nyTittel: 'Nytt verneutstyr', farge: 'oransje',
    tekst: 'Oversikt over verneutstyr, antall og når det skal kontrolleres. Endringer lagres med en gang.',
    tom: 'Ingen utstyr registrert. Legg til hjelmer, vernebriller, hørselvern, fallsikring og annet.',
    feil: ['mangler', 'Mangler', 'mangler'],
    kol: [
      { f: 'navn', e: 'Utstyr', type: 'text', kreves: true },
      { f: 'antall', e: 'Antall', type: 'number', b: 90, std: 1 },
      { f: 'plassering', e: 'Plassering', type: 'text', b: 150 },
      { f: 'mangler', e: 'Mangler', type: 'number', b: 90, std: 0 },
      { f: 'kontrollert', e: 'Sist kontrollert', type: 'date', b: 150, std: () => idag() },
      { f: 'neste', e: 'Neste kontroll', type: 'date', b: 150 },
      { f: 'merknad', e: 'Merknad', type: 'text' }]
  },
  'am-verktoy': {
    nokkel: 'verktoy', tittel: 'Verktøy', ent: 'verktøy', nyTittel: 'Nytt verktøy', farge: 'bla',
    tekst: 'Oversikt over verktøy og maskiner, hvor de står, og når de skal kontrolleres. Endringer lagres med en gang.',
    tom: 'Ingen verktøy registrert. Legg til drill, sirkelsag, kappsag, vater, tommestokk og annet.',
    feil: ['defekt', 'Defekt', 'defekt'],
    kol: [
      { f: 'navn', e: 'Verktøy', type: 'text', kreves: true },
      { f: 'type', e: 'Type', type: 'select', valg: VERKTOY_TYPER, b: 160, std: 'Elektroverktøy' },
      { f: 'plassering', e: 'Plassering', type: 'text', b: 150 },
      { f: 'antall', e: 'Antall', type: 'number', b: 80, std: 1 },
      { f: 'defekt', e: 'Defekt', type: 'number', b: 80, std: 0 },
      { f: 'kontrollert', e: 'Sist kontrollert', type: 'date', b: 150, std: () => idag() },
      { f: 'neste', e: 'Neste kontroll', type: 'date', b: 150 },
      { f: 'merknad', e: 'Merknad', type: 'text' }]
  },
  'am-deler': {
    nokkel: 'deler', tittel: 'Deler', ent: 'deler', nyTittel: 'Ny del', farge: 'gronn', knapp: 'Del',
    tekst: 'Oversikt over deler og materialer, hvor de ligger og hvor mye som er igjen. Felles for alle grupper. Endringer lagres med en gang.',
    tom: 'Ingen deler registrert. Legg til reisverk, plater, skruer, spiker, isolasjon og annet.',
    feil: ['', '', ''],
    status: u => { const n = +u.antall || 0, m = +u.minimum || 0;
      if (n === 0) return ['Tomt', 'hoy'];
      if (m > 0 && n <= m) return ['Lite igjen', 'gul'];
      return ['OK', 'ok']; },
    kol: [
      { f: 'navn', e: 'Del', type: 'text', kreves: true, b: 180 },
      { f: 'type', e: 'Type', type: 'select', valg: DEL_TYPER, b: 150, std: 'Trelast' },
      { f: 'dimensjon', e: 'Dimensjon', type: 'text', b: 110, halv: true },
      { f: 'plassering', e: 'Plassering', type: 'text', b: 150 },
      { f: 'antall', e: 'Antall', type: 'number', b: 80, std: 0 },
      { f: 'enhet', e: 'Enhet', type: 'select', valg: DEL_ENHETER, b: 90, std: 'stk' },
      { f: 'minimum', e: 'Bestill ved', type: 'number', b: 90, std: 0 },
      { f: 'merknad', e: 'Merknad', type: 'text', b: 140 }]
  }
};
function utstyrStatus(u, cfg = UTSTYR_SIDER['am-verneutstyr']) {
  if (cfg.status) return cfg.status(u);
  if (u.neste && dagerTil(u.neste) < 0) return ['Kontroll forfalt', 'hoy'];
  if (u.neste && dagerTil(u.neste) <= 14) return ['Kontroll snart', 'pa'];
  const n = +u[cfg.feil[0]] || 0;
  if (n > 0) return [`${n} ${cfg.feil[2]}`, 'gul'];
  return ['OK', 'ok'];
}
let amGruppering = { 'am-verneutstyr': '', 'am-verktoy': 'plassering', 'am-deler': 'plassering' };
const utenVerdi = (f) => f === 'plassering' ? 'Uten plassering' : 'Uten type';
function grupperUtstyr(liste, felt) {     // gir [{navn, rader}] sortert etter gruppenavn
  if (!felt) return [{ navn: '', rader: liste }];
  const m = new Map();
  liste.forEach(u => { const n = (u[felt] || '').trim() || utenVerdi(felt); if (!m.has(n)) m.set(n, []); m.get(n).push(u); });
  return [...m.entries()].sort((a, b) => (a[0] === utenVerdi(felt)) - (b[0] === utenVerdi(felt)) || a[0].localeCompare(b[0], 'nb', { numeric: true })).map(([navn, rader]) => ({ navn, rader }));
}
const utstyrVerdi = (u, k) => k.type === 'date' ? visDato(u[k.f]) : esc(u[k.f] ?? '');

Object.entries(UTSTYR_SIDER).forEach(([sideId, cfg]) => registrer(sideId, el => {
  const d = D();
  if (!d[cfg.nokkel]) d[cfg.nokkel] = [];
  const liste = d[cfg.nokkel];
  const felt = (u, k) => {
    if (k.type === 'select') return `<select data-f="${k.f}">${k.valg.map(v => `<option ${v === u[k.f] ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    if (k.type === 'number') return `<input type="number" min="0" data-f="${k.f}" value="${+u[k.f] || 0}">`;
    return `<input type="${k.type}" data-f="${k.f}" ${k.f === 'plassering' ? 'list="pl-forslag" autocomplete="off"' : ''} value="${k.type === 'date' ? (u[k.f] || '') : esc(u[k.f] || '')}">`;
  };
  const grFelt = amGruppering[sideId] || '';
  const grValg = [['', 'Ingen gruppering'], ['plassering', 'Grupper etter plassering'], ...(cfg.kol.some(k => k.f === 'type') ? [['type', 'Grupper etter type']] : [])];
  const grupper = grupperUtstyr(liste, grFelt);
  const antKol = cfg.kol.length + 2;
  el.innerHTML = sidehode(cfg.tittel, cfg.tekst,
    `<button class="btn sek" id="skriv" ${liste.length ? '' : 'disabled'}>Skriv ut liste …</button><button class="btn" id="nytt">+ ${cfg.knapp || (cfg.tittel === 'Verktøy' ? 'Verktøy' : 'Utstyr')}</button>`) +
    `<div class="kort s12 ${cfg.farge}">
      ${liste.length ? `<div class="verktoylinje"><select id="grupper" style="width:auto">${grValg.map(([v, t]) => `<option value="${v}" ${v === grFelt ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <span class="smaa">Klikk på en kolonneoverskrift for å sortere.</span></div>` : ''}
      ${liste.length ? `<div style="overflow-x:auto"><table><thead><tr>${cfg.kol.map(k => `<th style="min-width:${k.b || (k.f === 'navn' ? 210 : 170)}px">${k.e}</th>`).join('')}<th>Status</th><th></th></tr></thead><tbody>
      ${grupper.map(g => (grFelt ? `<tr class="grp"><td colspan="${antKol}">${esc(g.navn)}<span class="smaa">${g.rader.length} stk.</span></td></tr>` : '') +
        g.rader.map(u => `<tr data-u="${u.id}">${cfg.kol.map(k => `<td>${felt(u, k)}</td>`).join('')}
        <td class="stat">${st(...utstyrStatus(u, cfg))}</td><td><button class="lenkeknapp fare" data-slett>Slett</button></td></tr>`).join('')).join('')}
    </tbody></table></div>` : `<div class="tom">${cfg.tom}</div>`}</div>
    <datalist id="pl-forslag">${[...new Set([...(d.verktoy || []), ...(d.deler || []), ...d.verneutstyr].map(u => (u.plassering || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nb')).map(p => `<option value="${esc(p)}">`).join('')}</datalist>`;
  const gs = $('#grupper', el); if (gs) gs.onchange = () => { amGruppering[sideId] = gs.value; visSide(); };

  $('#nytt', el).onclick = async () => {
    const r = await skjema({ tittel: cfg.nyTittel, felt: cfg.kol.map(k => ({
      navn: k.f, etikett: k.e, kreves: k.kreves, halv: k.halv || k.type !== 'text' || k.f === 'plassering',
      type: k.type === 'text' ? 'text' : k.type, valg: k.valg ? k.valg.map(v => [v, v]) : undefined,
      verdi: typeof k.std === 'function' ? k.std() : k.std })) });
    if (r) { liste.push({ id: nyId(), ...r }); Lager.lagre(); visSide(); }
  };
  $('#skriv', el).onclick = () => utstyrUtskriftValg(cfg, liste, grFelt);
  $$('tr[data-u]', el).forEach(tr => {
    const u = liste.find(x => x.id === tr.dataset.u);
    $$('[data-f]', tr).forEach(i => i.onchange = () => {
      u[i.dataset.f] = i.type === 'number' ? Math.max(0, +i.value || 0) : i.value.trim(); Lager.lagre();
      if (i.dataset.f === grFelt) { visSide(); return; }          // flyttet til en annen gruppe
      $('td.stat', tr).innerHTML = st(...utstyrStatus(u, cfg));   // oppdater bare statusen, så markøren ikke hopper
    });
    $('[data-slett]', tr).onclick = async () => { if (await bekreft(`Slette «${esc(u.navn)}»?`, { ja: 'Slett', fare: true })) { d[cfg.nokkel] = d[cfg.nokkel].filter(x => x !== u); Lager.lagre(); visSide(); } };
  });
}));

/* Utskrift av verktøy/verneutstyr: velg hvilke plasseringer som skal med, og om lista skal grupperes */
function utstyrUtskriftValg(cfg, liste, grFelt) {
  const plasseringer = grupperUtstyr(liste, 'plassering');
  const m = modal(`<h2>Skriv ut ${cfg.tittel.toLowerCase()}</h2>
    <p style="margin-top:0">Velg hvilke plasseringer som skal være med.</p>
    <div class="verktoylinje"><button type="button" class="lenkeknapp" id="u-alle">Velg alle</button><button type="button" class="lenkeknapp" id="u-ingen">Fjern alle</button></div>
    ${plasseringer.map(p => `<label class="sjekk"><input type="checkbox" data-pl="${esc(p.navn)}" checked>${esc(p.navn)} <span class="smaa">(${p.rader.length})</span></label>`).join('')}
    <label class="felt" style="margin-top:14px"><span>Rekkefølge i utskriften</span><select id="u-grupper">
      <option value="plassering" ${grFelt !== 'type' ? 'selected' : ''}>Gruppert etter plassering</option>
      ${cfg.kol.some(k => k.f === 'type') ? `<option value="type" ${grFelt === 'type' ? 'selected' : ''}>Gruppert etter type</option>` : ''}
      <option value="">Én samlet liste</option></select></label>
    <div class="knapper"><button class="btn sek" id="u-avbryt">Avbryt</button><button class="btn" id="u-ok">Forhåndsvis utskrift</button></div>`);
  $('#u-alle', m.el).onclick = () => $$('[data-pl]', m.el).forEach(c => c.checked = true);
  $('#u-ingen', m.el).onclick = () => $$('[data-pl]', m.el).forEach(c => c.checked = false);
  $('#u-avbryt', m.el).onclick = m.lukk;
  $('#u-ok', m.el).onclick = () => {
    const valgt = new Set($$('[data-pl]', m.el).filter(c => c.checked).map(c => c.dataset.pl));
    if (!valgt.size) { toast('Velg minst én plassering.', true); return; }
    const felt = $('#u-grupper', m.el).value;
    m.lukk();
    const utvalg = liste.filter(u => valgt.has((u.plassering || '').trim() || utenVerdi('plassering')));
    const kolonner = cfg.kol.filter(k => !(felt && k.f === felt));       // gruppefeltet står i overskriften
    const antKol = kolonner.length + 2;
    const tekst = valgt.size === plasseringer.length ? 'Alle plasseringer' : [...valgt].join(', ');
    skrivUt(`<h1>${cfg.tittel}</h1><div class="meta">${esc(tekst)} · ${utvalg.length} registrert · skrevet ut ${visDato(idag())}</div>
      <table><thead><tr>${kolonner.map(k => `<th>${k.e}</th>`).join('')}<th>Status</th><th>${cfg.nokkel === 'deler' ? 'Telt av' : 'Kontrollert av'}</th></tr></thead><tbody>
      ${grupperUtstyr(utvalg, felt).map(g => (felt ? `<tr class="grp"><td colspan="${antKol}">${esc(g.navn)} (${g.rader.length})</td></tr>` : '') +
        g.rader.map(u => `<tr>${kolonner.map(k => `<td>${utstyrVerdi(u, k) || '–'}</td>`).join('')}<td>${utstyrStatus(u, cfg)[0]}</td><td></td></tr>`).join('')).join('')}
      </tbody></table>`, `${cfg.tittel} ${idag()}`);
  };
}

/* ================= Avvik ================= */
registrer('am-avvik', el => {
  const d = D();
  const filtre = { apne: a => a.status !== 'Lukket', lukket: a => a.status === 'Lukket', alle: () => true };
  const liste = d.avvik.filter(filtre[amAvvikFilter]).sort((a, b) => b.dato.localeCompare(a.dato));
  const tell = s => d.avvik.filter(a => a.status === s).length;
  amAvvikValgt = new Set([...amAvvikValgt].filter(id => liste.some(a => a.id === id)));
  el.innerHTML = sidehode('Avvik', `${tell('Åpen')} åpne · ${tell('Under arbeid')} under arbeid · ${tell('Lukket')} lukket`,
    `<button class="btn sek" id="skriv-liste" ${liste.length ? '' : 'disabled'} title="Skriv ut lista slik den vises nå">Skriv ut liste</button>
     <button class="btn sek" id="skriv-valgte" ${amAvvikValgt.size ? '' : 'disabled'} title="Hvert avvik på egen side">Skriv ut valgte (${amAvvikValgt.size})</button>
     ${TESTKNAPPER ? `<button class="btn fare" id="slett-valgte" title="Bare for testing" ${amAvvikValgt.size ? '' : 'disabled'}>Slett valgte (${amAvvikValgt.size})</button>` : ''}
     <button class="btn" id="nytt">+ Meld avvik</button>`) +
    `<div class="grid">${kort('Avviksmeldinger', `
      <div class="verktoylinje"><select id="filter" style="min-width:0;width:auto"><option value="apne" ${amAvvikFilter === 'apne' ? 'selected' : ''}>Åpne og under arbeid</option><option value="lukket" ${amAvvikFilter === 'lukket' ? 'selected' : ''}>Lukket</option><option value="alle" ${amAvvikFilter === 'alle' ? 'selected' : ''}>Alle</option></select></div>
      ${liste.length ? `<table><thead><tr><th style="width:36px"><input type="checkbox" id="velg-alle" title="Velg alle" ${amAvvikValgt.size && amAvvikValgt.size === liste.length ? 'checked' : ''}></th><th>ID</th><th>Inntraff</th><th>Sted</th><th>Avvik</th><th>Alvor</th><th>Ansvarlig</th><th>Frist</th><th>Status</th></tr></thead><tbody>
        ${liste.map(a => { const forfalt = a.frist && a.status !== 'Lukket' && dagerTil(a.frist) < 0;
          return `<tr class="klikk" data-a="${a.id}"><td><input type="checkbox" data-velg="${a.id}" ${amAvvikValgt.has(a.id) ? 'checked' : ''}></td>
          <td class="smaa" style="white-space:nowrap">${esc(avvikKode(a))}</td><td data-sort="${a.dato}${a.tid || ''}">${visDato(a.dato)}</td><td style="white-space:nowrap">${esc(a.sted || '–')}</td>
          <td><b>${esc(a.tittel)}</b>${a.vedlegg && a.vedlegg.length ? ` <span class="smaa">· ${a.vedlegg.length} ${a.vedlegg.length === 1 ? 'bilde' : 'bilder'}</span>` : ''}<div class="smaa">${esc(a.type)}${a.merkelapper && a.merkelapper.length ? ' · ' + a.merkelapper.map(esc).join(', ') : ''}</div></td>
          <td data-sort="${A_ALVOR.indexOf(a.alvor) + 1}">${st(a.alvor, A_ALVOR_KL[a.alvor])}</td>
          <td>${esc(personNavn(a.ansvarlig) || '–')}</td><td data-sort="${a.frist || '9999'}" ${forfalt ? 'style="color:var(--pink);font-weight:700" title="Fristen er passert"' : ''}>${a.frist ? visDato(a.frist) : '–'}</td>
          <td>${st(a.status, A_STATUS_KL[a.status])}${a.lukket ? `<div class="smaa">${visDato(a.lukket)}</div>` : ''}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="tom">Ingen avvik i denne lista.</div>'}`, 's9 oransje')}
      ${kort('Fordeling', smultring(A_STATUS.map((s, i) => ({ n: s, v: tell(s), f: ['#ff3d7f', '#ff8a3d', '#3ee08f'][i] })), d.avvik.length, 'avvik totalt'), 's3 rosa')}
    </div>`;
  $('#nytt', el).onclick = () => redigerAvvik(null);
  $('#filter', el).onchange = e => { amAvvikFilter = e.target.value; visSide(); };
  $$('tr[data-a]', el).forEach(tr => tr.onclick = () => redigerAvvik(d.avvik.find(a => a.id === tr.dataset.a)));
  $$('[data-velg]', el).forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = () => { c.checked ? amAvvikValgt.add(c.dataset.velg) : amAvvikValgt.delete(c.dataset.velg); visSide(); }; });
  const va = $('#velg-alle', el); if (va) va.onchange = () => { amAvvikValgt = va.checked ? new Set(liste.map(a => a.id)) : new Set(); visSide(); };
  $('#skriv-valgte', el).onclick = () => skrivUtAvvik(liste.filter(a => amAvvikValgt.has(a.id)));
  const sv = $('#slett-valgte', el);   // TESTKNAPPER – fjernes i endelig versjon
  if (sv) sv.onclick = async () => {
    if (!await bekreft(`Slette <b>${amAvvikValgt.size}</b> avvik? Dette kan ikke angres.`, { ja: 'Slett', fare: true })) return;
    d.avvik = d.avvik.filter(a => !amAvvikValgt.has(a.id));
    toast(`${amAvvikValgt.size} avvik slettet.`); amAvvikValgt = new Set(); Lager.lagre(); visSide();
  };
  $('#skriv-liste', el).onclick = () => skrivUtAvviksliste(liste, { apne: 'Åpne og under arbeid', lukket: 'Lukket', alle: 'Alle' }[amAvvikFilter]);
});

/* ---------- Utskrift av avvik ---------- */
function avvikSide(a) {
  const felt = (navn, verdi) => `<tr><th style="width:190px;text-align:left">${navn}</th><td>${verdi || '–'}</td></tr>`;
  const blokk = t => `<div style="white-space:pre-wrap;min-height:48px">${esc(t)}</div>`;
  return `<h1>Avviksmelding ${esc(avvikKode(a))}</h1>
    <div class="meta">Skrevet ut ${visDato(idag())}</div>
    <table>
      ${felt('Tittel', `<span style="font-weight:700">${esc(a.tittel)}</span>`)}
      ${felt('Type', esc(a.type))}
      ${felt('Alvorlighetsgrad', esc(a.alvor))}
      ${felt('Sted', esc(a.sted))}
      ${felt('Inntraff', visDato(a.dato) + (a.tid ? ' kl. ' + esc(a.tid) : ''))}
      ${felt('Meldt av', esc(personNavn(a.meldtAv)))}
      ${a.merkelapper && a.merkelapper.length ? felt('Merkelapper', a.merkelapper.map(esc).join(', ')) : ''}
      ${felt('Beskrivelse', blokk(a.beskrivelse))}
      ${felt('Forslag til tiltak', blokk(a.forslag))}
      ${felt('Ansvarlig for tiltak', esc(personNavn(a.ansvarlig)))}
      ${felt('Frist', a.frist ? visDato(a.frist) : '')}
      ${felt('Status', esc(a.status) + (a.lukket ? ' (lukket ' + visDato(a.lukket) + ')' : ''))}
      ${felt('Utført tiltak', blokk(a.utfort))}
    </table>
    <p style="margin-top:30px">Signatur melder: ______________________ &nbsp;&nbsp;&nbsp; Signatur ansvarlig: ______________________ &nbsp;&nbsp;&nbsp; Dato lukket: ____________</p>
    ${a.vedlegg && a.vedlegg.length ? `<h2 style="margin-top:24px">Vedlegg (${a.vedlegg.length})</h2><div class="av-utskrift-bilder">${a.vedlegg.map(b => `<figure><img src="${b.data}" alt=""><figcaption>${esc(b.navn)}</figcaption></figure>`).join('')}</div>` : ''}`;
}
function skrivUtAvvik(liste) {
  if (!liste.length) return;
  skrivUt(liste.map(avvikSide).join('<div class="sideskift"></div>'), liste.length === 1 ? `Avvik ${avvikKode(liste[0])}` : `Avvik (${liste.length})`);
}
function skrivUtAvviksliste(liste, filterNavn) {
  skrivUt(`<h1>Avviksliste</h1><div class="meta">${esc(filterNavn)} · ${liste.length} avvik · skrevet ut ${visDato(idag())}</div>
    <table><thead><tr><th>ID</th><th>Inntraff</th><th>Sted</th><th>Tittel</th><th>Type</th><th>Alvor</th><th>Ansvarlig</th><th>Frist</th><th>Status</th></tr></thead><tbody>
    ${liste.map(a => `<tr><td>${esc(avvikKode(a))}</td><td>${visDato(a.dato)}</td><td>${esc(a.sted || '–')}</td><td>${esc(a.tittel)}</td><td>${esc(a.type)}</td><td>${esc(a.alvor)}</td>
      <td>${esc(personNavn(a.ansvarlig) || '–')}</td><td>${a.frist ? visDato(a.frist) : '–'}</td><td>${esc(a.status)}${a.lukket ? ' ' + visDato(a.lukket) : ''}</td></tr>`).join('')}
    </tbody></table>`, 'Avviksliste');
}
