/* VEKTRA – modul: Elevlogg (loggbok med bilder, video, refleksjon og egenvurdering 1–6) */
'use strict';

const LG_VURDERING = ['Jeg fikk det ikke til ennå', 'Jeg fikk til litt, med mye hjelp', 'Jeg fikk det til med noe hjelp',
  'Jeg fikk det til selv', 'Jeg fikk det til selv, og resultatet ble godt', 'Jeg mestrer det og kan hjelpe andre'];
const LG_VURD_KL = ['hoy', 'hoy', 'pa', 'gul', 'ok', 'ok'];
/* Kompetansemål fra læreplanen BAT01-03 (udir.no/lk20/bat01-03), ordrett */
const LG_KOMPMAL = {
  'Praktisk yrkesutøvelse': ['forstå og arbeide etter tegninger og beskrivelser', 'tegne skisser og konstruksjoner i målestokk',
    'velge og bruke maskiner og verktøy til ulike arbeidsoppdrag og følge anvisning for bruk og håndtering',
    'montere og bruke arbeidsplattformer opp til 5 meter og gjennomføre risikotiltak ved arbeid i høyden',
    'velge ut og bruke personlig verneutstyr og vurdere konsekvenser av feilbruk', 'velge og bruke materialer med hensyn til bærekraft og ulike byggetradisjoner',
    'oppbevare, beregne og behandle materialer på en miljøvennlig, faglig og økonomisk måte', 'bruke digitale ressurser til å beregne, måle opp og merke etter beskrivelse og tegning',
    'bruke enkel tredimensjonal modellering i arbeidsoppdrag', 'utforske og presentere kjennetegn ved kulturarv og byggeskikk', 'planlegge og bygge en konstruksjon',
    'beskrive hvilke krav og forventninger samfunnet stiller til en profesjonell yrkesutøver, og reflektere over egen praksis'],
  'Arbeidsmiljø og dokumentasjon': ['vurdere risiko og utføre forebyggende tiltak',
    'gjennomføre og dokumentere arbeid i samsvar med gjeldende bestemmelser for helse, miljø og sikkerhet, og rapportere om uønskede hendelser',
    'utføre livreddende førstehjelp', 'gjøre rede for varme arbeider som brannårsak, gjennomføre sikkerhetstiltak og hindre brann',
    'anvende sikkerhetsdatablad og følge anvisninger ved bruk av kjemikalier', 'beskrive og bruke arbeidsteknikker og arbeidsstillinger som forebygger helseskader',
    'gjøre rede for betydningen av orden på bygge- og anleggsplasser og følge rutiner for dette',
    'vurdere risiko og følge rutiner for å stroppe, anhuke og gi signal ved lasting og lossing', 'planlegge, gjennomføre, vurdere og dokumentere eget arbeid',
    'vedlikeholde maskiner og verktøy', 'kildesortere avfall etter gitte retningslinjer og reflektere over konsekvenser av feilhåndtering av avfall',
    'kommunisere og formidle budskap tilpasset ulike målgrupper', 'forstå og bruke fagterminologi i samhandling med ulike målgrupper',
    'vurdere hvordan miljø- og klimaendringer påvirker bygg- og anleggsbransjen',
    'gjøre rede for og vurdere hvordan partene i arbeidslivet samarbeider for å utvikle et bedre arbeidsliv']
};
const LG_VERN_STD = ['Vernebriller', 'Hørselvern', 'Hjelm', 'Vernesko', 'Hansker', 'Støvmaske'];
const LG_MAKS_VIDEO = 120;           // sekunder
const LG_MAKS_VIDEO_MB = 600;
const storForbokstav = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
let lgElev = '';                     // hvilken elev loggboka viser (lærer på egen PC)
let lgKlasse = '';                   // klasse i lærerens oversikt

/* ============ Lagring av video (og bilder fra innlevering i nettleseren) ============
   I programmet: egne filer i «Logg-media» i datamappen.  I nettleseren (testmodus): IndexedDB. */
const Media = {
  _db: null, _url: {},
  iProgram: () => !!(api && api.lagreMedia),
  async db() {
    if (this._db) return this._db;
    this._db = await new Promise((res, rej) => {
      const r = indexedDB.open('klar-media', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('filer');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this._db;
  },
  async lagreSom(navn, blob) {
    if (this.iProgram()) { const r = await api.lagreMedia(navn, await blob.arrayBuffer()); if (!r.ok) throw new Error(r.feil); return navn; }
    const db = await this.db();
    await new Promise((res, rej) => { const t = db.transaction('filer', 'readwrite'); t.objectStore('filer').put(blob, navn); t.oncomplete = res; t.onerror = () => rej(t.error); });
    return navn;
  },
  lagre(fil) {
    const ext = ((fil.name || '').split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    return this.lagreSom(`video_${nyId()}.${ext}`, fil);
  },
  async blob(navn) {
    if (this.iProgram()) { try { const r = await fetch('klar-media://f/' + encodeURIComponent(navn)); return r.ok ? await r.blob() : null; } catch (e) { return null; } }
    const db = await this.db();
    return new Promise(res => { const r = db.transaction('filer').objectStore('filer').get(navn); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  },
  async url(navn) {
    if (this.iProgram()) return 'klar-media://f/' + encodeURIComponent(navn);
    if (this._url[navn]) return this._url[navn];
    const b = await this.blob(navn);
    return b ? (this._url[navn] = URL.createObjectURL(b)) : '';
  },
  async slett(navn) {
    if (this.iProgram()) { if (api.slettMedia) await api.slettMedia(navn); return; }
    try { const db = await this.db(); db.transaction('filer', 'readwrite').objectStore('filer').delete(navn); } catch (e) { /* ingenting å slette */ }
  }
};
/* Setter riktig adresse på video-elementer som er tegnet med data-video="filnavn" */
async function lgHydrer(root) {
  for (const v of $$('video[data-video]', root)) {
    const u = await Media.url(v.dataset.video);
    if (u) v.src = u + (v.hasAttribute('data-miniatyr') ? '#t=0.5' : '');
    else v.closest('.lg-media')?.classList.add('mangler');
  }
}
const lgVarighet = s => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function lgVideoLengde(fil) {
  return new Promise(res => {
    const v = document.createElement('video'); v.preload = 'metadata';
    const u = URL.createObjectURL(fil);
    v.onloadedmetadata = () => { URL.revokeObjectURL(u); res(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(u); res(NaN); };
    v.src = u;
  });
}
/* Miniatyr av ett bilde eller én video. stor = visning i loggkortet */
function lgMediaHtml(m, i, { slett = false, tekstfelt = false, klikk = true } = {}) {
  const innhold = m.type === 'video'
    ? `<video data-video="${esc(m.fil)}" data-miniatyr muted preload="metadata"></video><span class="lg-spill">▶</span><span class="lg-varighet">${lgVarighet(m.varighet)}</span>`
    : `<img src="${m.data}" alt="">`;
  return `<div class="lg-mediaboks" data-i="${i}"><div class="lg-media ${klikk ? 'klikk' : ''}" data-vis="${i}">${innhold}
      ${slett ? `<button type="button" class="lg-fjern" data-fjern="${i}" title="Fjern">×</button>` : ''}
      ${!tekstfelt && m.tekst ? `<span class="lg-tekst">${esc(m.tekst)}</span>` : ''}</div>
    ${tekstfelt ? `<input type="text" class="lg-mtekst" data-tekst="${i}" placeholder="Skriv en kort tekst …" value="${esc(m.tekst || '')}">` : ''}</div>`;
}
/* Fullskjerm: bilde eller video */
async function lgVisMedia(m) {
  const kilde = m.type === 'video' ? await Media.url(m.fil) : m.data;
  if (!kilde) { toast('Videoen finnes ikke på denne PC-en. Den må hentes inn sammen med loggen.', true); return; }
  const v = modal(`<div class="lg-stor">${m.type === 'video' ? `<video src="${kilde}" controls autoplay></video>` : `<img src="${kilde}" alt="">`}</div>
    ${m.tekst ? `<p style="margin:10px 0 0">${esc(m.tekst)}</p>` : ''}<div class="knapper"><button class="btn sek" data-lukk>Lukk</button></div>`, { bred: true });
  $('[data-lukk]', v.el).onclick = v.lukk;
}

/* ============ Hjelpere ============ */
const lgErElev = () => D().innst.rolle === 'elev';
/* Hvem loggboka gjelder: eleven selv, eller eleven læreren har valgt */
function lgAktivElev() {
  const d = D();
  if (lgErElev()) return d.innst.navn;
  if (lgElev && (finnPerson(lgElev) || d.logger.some(l => l.elev === lgElev))) return lgElev;
  return '';
}
const lgSammeElev = (a, b) => a && b && (a === b || String(personNavn(a)).toLowerCase() === String(personNavn(b)).toLowerCase());
const lgLoggerFor = elev => D().logger.filter(l => lgSammeElev(l.elev, elev)).sort((a, b) => (b.dato + (b.opprettet || '')).localeCompare(a.dato + (a.opprettet || '')));
const lgMandag = s => { const t = new Date(s + 'T12:00:00'); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const lgUke = s => ukenr(new Date(s + 'T12:00:00'));
const lgDagNavn = s => { const t = new Date(s + 'T12:00:00'); const n = t.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }); return storForbokstav(n); };
const lgProsjekt = id => D().prosjekter.find(p => p.id === id);
const lgOppgave = id => D().oppgaver.find(o => o.id === id);
function lgStatistikk(liste) {
  const ferdige = liste.filter(l => l.status !== 'utkast');
  const uke = lgMandag(idag());
  const vurd = ferdige.filter(l => l.vurdering);
  return {
    antall: ferdige.length,
    timer: ferdige.reduce((s, l) => s + (+l.timer || 0), 0),
    uke: ferdige.filter(l => l.dato >= uke).length,
    snitt: vurd.length ? vurd.reduce((s, l) => s + +l.vurdering, 0) / vurd.length : 0,
    siste: ferdige[0]?.dato || '',
    utenTilbake: ferdige.filter(l => !l.tilbakemelding?.tekst).length,
    utkast: liste.length - ferdige.length
  };
}
const lgTall = n => (Math.round(n * 10) / 10).toLocaleString('nb-NO');

/* ============ Skjemaet «Ny logg» ============ */
async function lgRediger(logg, { elev } = {}) {
  const d = D(); const ny = !logg;
  const forrige = ny ? lgLoggerFor(elev).find(l => l.status !== 'utkast') : null;
  const v = ny ? { elev, dato: idag(), okt: 'Verksted', timer: '', prosjektId: '', oppgaveId: '', gjort: '', media: [], verktoy: [], materialer: [], verneutstyr: [],
    bra: '', vanskelig: '', neste: '', vurdering: 0, kompmal: '' } : JSON.parse(JSON.stringify(logg));
  const verktoyValg = [...new Set([...(d.verktoy || []).map(u => u.navn), ...v.verktoy])].filter(Boolean).sort(sortNavn);
  const vernValg = [...new Set([...(d.verneutstyr.length ? d.verneutstyr.map(u => u.navn) : LG_VERN_STD), ...v.verneutstyr])].filter(Boolean);
  const delValg = (d.deler || []).map(u => ({ navn: [u.navn, u.dimensjon].filter(Boolean).join(' '), enhet: u.enhet || 'stk' }));
  const nyMedia = [];                    // videoer lagret i denne økta (slettes igjen ved Avbryt)

  return new Promise(res => {
    const m = modal(`<div class="av-hode"><h2>${ny ? 'Ny logg' : 'Rediger logg'}</h2>
        ${ny && forrige ? '<button type="button" class="btn sek" id="lg-fortsett" title="Henter prosjekt, oppgave, verktøy og verneutstyr fra forrige logg">Fortsett fra forrige gang</button>' : ''}</div>
      <form id="lgskjema" class="lg-skjema">
        ${lgErElev() ? '' : `<div class="felt"><span>Elev *</span>${personVelgerHtml('pv-lgelev')}</div>`}
        <div class="lg-r3">
          <label class="felt"><span>Dato</span><input type="date" name="dato" value="${v.dato}"></label>
          <div class="felt"><span>Økt</span><div class="lg-seg" id="lg-okt">${['Verksted', 'Teori'].map(o => `<button type="button" data-okt="${o}" class="${v.okt === o ? 'valgt' : ''}">${o}</button>`).join('')}</div></div>
          <label class="felt"><span>Timer</span><input type="number" name="timer" min="0" max="12" step="0.5" value="${v.timer}"></label>
        </div>
        <div class="lg-r2">
          <label class="felt"><span>Prosjekt</span><select name="prosjektId"><option value="">– Ikke valgt –</option>${d.prosjekter.map(p => `<option value="${p.id}" ${p.id === v.prosjektId ? 'selected' : ''}>${esc(p.navn)}</option>`).join('')}</select></label>
          <label class="felt"><span>Oppgave</span><select name="oppgaveId"></select></label>
        </div>
        <div id="lg-hint"></div>
        <label class="felt"><span>Hva gjorde jeg i dag? *</span><textarea name="gjort" placeholder="Skriv kort hva du gjorde, og hvordan">${esc(v.gjort)}</textarea></label>

        <div class="felt"><span>Bilder og video</span>
          <div class="av-slipp" id="lg-slipp">Dra bilder og video hit, lim inn bilde med Ctrl+V, eller
            <div class="lg-knapper"><button type="button" class="btn sek" id="lg-bilde">Velg bilde</button><button type="button" class="btn sek" id="lg-video">Velg video</button></div>
            <input type="file" id="lg-bildefil" accept="image/*" multiple hidden><input type="file" id="lg-videofil" accept="video/*" multiple hidden></div>
          <div class="lg-mediarad" id="lg-media"></div>
          <div class="smaa">Video kan være maks ${LG_MAKS_VIDEO / 60} minutter. Skriv gjerne en kort tekst under hvert bilde.</div>
        </div>

        <div class="felt"><span>Verktøy og maskiner</span><div class="lg-chips" id="lg-verktoy"></div></div>
        <div class="lg-r2">
          <div class="felt"><span>Materialer</span><div class="lg-chips" id="lg-mat"></div></div>
          <div class="felt"><span>Verneutstyr jeg brukte</span><div class="lg-chips" id="lg-vern"></div></div>
        </div>

        <div class="av-skille">Refleksjon</div>
        <label class="felt"><span>Hva gikk bra?</span><textarea name="bra">${esc(v.bra)}</textarea></label>
        <div class="lg-r2">
          <label class="felt"><span>Hva var vanskelig?</span><textarea name="vanskelig">${esc(v.vanskelig)}</textarea></label>
          <label class="felt"><span>Hva gjør jeg neste gang?</span><textarea name="neste">${esc(v.neste)}</textarea></label>
        </div>
        <div class="felt"><span>Hvordan synes du det gikk i dag? (1–6)</span>
          <div class="lg-seg lg-vurd" id="lg-vurd">${[1, 2, 3, 4, 5, 6].map(n => `<button type="button" data-v="${n}" class="${+v.vurdering === n ? 'valgt' : ''}">${n}</button>`).join('')}</div>
          <div class="smaa" id="lg-vurdtekst" style="margin-top:6px"></div></div>
        <label class="felt"><span>Kompetansemål jeg jobbet med (valgfritt)</span><select name="kompmal"><option value="">– Ikke valgt –</option>
          ${Object.entries(LG_KOMPMAL).map(([g, l]) => `<optgroup label="${g}">${l.map(k => `<option value="${esc(k)}" ${k === v.kompmal ? 'selected' : ''}>${esc(storForbokstav(k))}</option>`).join('')}</optgroup>`).join('')}</select></label>

        <datalist id="lg-verktoyliste">${verktoyValg.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <datalist id="lg-delliste">${delValg.map(x => `<option value="${esc(x.navn)}">`).join('')}</datalist>
        <div class="laasfeil" id="mfeil"></div>
        <div class="knapper">${ny ? '' : '<button type="button" class="btn fare" data-slett style="margin-right:auto">Slett</button>'}
          <button type="button" class="btn sek" data-avbryt>Avbryt</button>
          <button type="button" class="btn sek" data-utkast>Lagre utkast</button>
          <button class="btn" type="submit">Lagre logg</button></div>
      </form>`, { bred: true });
    const f = $('#lgskjema', m.el);
    const elevVelger = lgErElev() ? null : koblPersonVelger($('#pv-lgelev', m.el), { verdi: v.elev, bare: 'elever' });

    // økt og vurdering
    $$('#lg-okt button', m.el).forEach(b => b.onclick = () => { v.okt = b.dataset.okt; $$('#lg-okt button', m.el).forEach(x => x.classList.toggle('valgt', x === b)); });
    const visVurd = () => { $('#lg-vurdtekst', m.el).textContent = v.vurdering ? `${v.vurdering} – ${LG_VURDERING[v.vurdering - 1]}` : 'Velg et tall.';
      $$('#lg-vurd button', m.el).forEach(x => { x.classList.toggle('valgt', +x.dataset.v === +v.vurdering); x.className = x.className.replace(/ ?st-\w+/g, ''); if (+x.dataset.v === +v.vurdering) x.classList.add('st-' + LG_VURD_KL[v.vurdering - 1]); }); };
    $$('#lg-vurd button', m.el).forEach(b => b.onclick = () => { v.vurdering = +b.dataset.v; visVurd(); });
    visVurd();

    // prosjekt -> oppgaver
    const fyllOppgaver = () => {
      const pid = f.elements.prosjektId.value;
      const liste = d.oppgaver.filter(o => !pid || o.prosjektId === pid);
      f.elements.oppgaveId.innerHTML = `<option value="">– Ikke valgt –</option>` + liste.map(o => `<option value="${o.id}" ${o.id === v.oppgaveId ? 'selected' : ''}>${esc(o.tittel)}</option>`).join('');
    };
    f.elements.prosjektId.onchange = () => { v.oppgaveId = ''; fyllOppgaver(); };
    f.elements.oppgaveId.onchange = () => { v.oppgaveId = f.elements.oppgaveId.value; const o = lgOppgave(v.oppgaveId); if (o && o.prosjektId && !f.elements.prosjektId.value) { f.elements.prosjektId.value = o.prosjektId; fyllOppgaver(); } };
    fyllOppgaver();

    // chips: verktøy, materialer, verneutstyr
    const tegnVerktoy = () => {
      const alle = [...new Set([...verktoyValg, ...v.verktoy])];
      $('#lg-verktoy', m.el).innerHTML = alle.map(x => `<button type="button" class="lg-chip ${v.verktoy.includes(x) ? 'valgt' : ''}" data-x="${esc(x)}">${esc(x)}</button>`).join('') +
        `<input type="text" class="lg-ny" list="lg-verktoyliste" placeholder="+ Annet verktøy" autocomplete="off">`;
      $$('#lg-verktoy [data-x]', m.el).forEach(b => b.onclick = () => { const x = b.dataset.x; v.verktoy = v.verktoy.includes(x) ? v.verktoy.filter(y => y !== x) : [...v.verktoy, x]; tegnVerktoy(); });
      const inn = $('#lg-verktoy .lg-ny', m.el);
      inn.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const t = inn.value.trim(); if (t && !v.verktoy.includes(t)) { v.verktoy.push(t); if (!verktoyValg.includes(t)) verktoyValg.push(t); } tegnVerktoy(); $('#lg-verktoy .lg-ny', m.el).focus(); } };
    };
    const tegnVern = () => {
      $('#lg-vern', m.el).innerHTML = [...new Set([...vernValg, ...v.verneutstyr])].map(x => `<button type="button" class="lg-chip ${v.verneutstyr.includes(x) ? 'valgt' : ''}" data-x="${esc(x)}">${v.verneutstyr.includes(x) ? '✓ ' : ''}${esc(x)}</button>`).join('');
      $$('#lg-vern [data-x]', m.el).forEach(b => b.onclick = () => { const x = b.dataset.x; v.verneutstyr = v.verneutstyr.includes(x) ? v.verneutstyr.filter(y => y !== x) : [...v.verneutstyr, x]; tegnVern(); });
    };
    const tegnMat = () => {
      $('#lg-mat', m.el).innerHTML = v.materialer.map((x, i) => `<span class="navnchip">${esc(x.navn)}${x.antall ? ` · ${esc(x.antall)} ${esc(x.enhet || '')}` : ''}<button type="button" data-i="${i}" title="Fjern">×</button></span>`).join('') +
        `<span class="lg-matny"><input type="text" class="lg-ny" id="lg-matnavn" list="lg-delliste" placeholder="+ Materiale" autocomplete="off"><input type="number" id="lg-matant" min="0" step="any" placeholder="Antall"><button type="button" class="btn sek" id="lg-matleggtil">Legg til</button></span>`;
      $$('#lg-mat [data-i]', m.el).forEach(b => b.onclick = () => { v.materialer.splice(+b.dataset.i, 1); tegnMat(); });
      const leggTil = () => {
        const navn = $('#lg-matnavn', m.el).value.trim(); if (!navn) return;
        const del = delValg.find(x => x.navn.toLowerCase() === navn.toLowerCase());
        v.materialer.push({ navn, antall: $('#lg-matant', m.el).value, enhet: del ? del.enhet : 'stk' }); tegnMat(); $('#lg-matnavn', m.el).focus();
      };
      $('#lg-matleggtil', m.el).onclick = leggTil;
      [$('#lg-matnavn', m.el), $('#lg-matant', m.el)].forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); leggTil(); } });
    };
    tegnVerktoy(); tegnVern(); tegnMat();

    // bilder og video
    const tegnMedia = () => {
      $('#lg-media', m.el).innerHTML = v.media.map((x, i) => lgMediaHtml(x, i, { slett: true, tekstfelt: true })).join('');
      $$('#lg-media [data-fjern]', m.el).forEach(b => b.onclick = e => { e.stopPropagation(); v.media.splice(+b.dataset.fjern, 1); tegnMedia(); });
      $$('#lg-media [data-tekst]', m.el).forEach(i => i.oninput = () => { v.media[+i.dataset.tekst].tekst = i.value; });
      $$('#lg-media [data-vis]', m.el).forEach(b => b.onclick = () => lgVisMedia(v.media[+b.dataset.vis]));
      lgHydrer($('#lg-media', m.el));
    };
    const leggTilFiler = async filer => {
      for (const fil of [...filer]) {
        if (fil.type.startsWith('image/')) {
          try { const b = await lesVedlegg(fil); v.media.push({ type: 'bilde', data: b.data, navn: b.navn, tekst: '' }); } catch (e) { toast(`Kunne ikke lese ${fil.name}.`, true); }
        } else if (fil.type.startsWith('video/')) {
          if (fil.size > LG_MAKS_VIDEO_MB * 1024 * 1024) { toast(`${fil.name} er for stor (over ${LG_MAKS_VIDEO_MB} MB).`, true); continue; }
          const sek = await lgVideoLengde(fil);
          if (isNaN(sek)) { toast(`${fil.name} kan ikke spilles av her. Prøv en video i MP4-format.`, true); continue; }
          if (sek > LG_MAKS_VIDEO + 1) { toast(`${fil.name} er ${lgVarighet(sek)} lang. Maks er ${LG_MAKS_VIDEO / 60} minutter. Klipp den kortere og prøv igjen.`, true); continue; }
          toast(`Lagrer ${fil.name} …`);
          try { const navn = await Media.lagre(fil); nyMedia.push(navn); v.media.push({ type: 'video', fil: navn, navn: fil.name, varighet: Math.round(sek), tekst: '' }); }
          catch (e) { toast(`Kunne ikke lagre ${fil.name}.`, true); continue; }
        } else toast(`${fil.name} er verken bilde eller video.`, true);
        tegnMedia();
      }
    };
    tegnMedia();
    $('#lg-bilde', m.el).onclick = () => $('#lg-bildefil', m.el).click();
    $('#lg-video', m.el).onclick = () => $('#lg-videofil', m.el).click();
    $('#lg-bildefil', m.el).onchange = e => { leggTilFiler(e.target.files); e.target.value = ''; };
    $('#lg-videofil', m.el).onchange = e => { leggTilFiler(e.target.files); e.target.value = ''; };
    const slipp = $('#lg-slipp', m.el);
    slipp.ondragover = e => { e.preventDefault(); slipp.classList.add('over'); };
    slipp.ondragleave = () => slipp.classList.remove('over');
    slipp.ondrop = e => { e.preventDefault(); slipp.classList.remove('over'); leggTilFiler(e.dataTransfer.files); };
    m.el.addEventListener('paste', e => { const filer = [...(e.clipboardData?.files || [])]; if (filer.length) { e.preventDefault(); leggTilFiler(filer); } });

    // fortsett fra forrige gang
    const fb = $('#lg-fortsett', m.el);
    if (fb) fb.onclick = () => {
      v.prosjektId = forrige.prosjektId || ''; v.oppgaveId = forrige.oppgaveId || ''; v.okt = forrige.okt || v.okt;
      v.verktoy = [...(forrige.verktoy || [])]; v.verneutstyr = [...(forrige.verneutstyr || [])];
      f.elements.prosjektId.value = v.prosjektId; fyllOppgaver();
      $$('#lg-okt button', m.el).forEach(x => x.classList.toggle('valgt', x.dataset.okt === v.okt));
      tegnVerktoy(); tegnVern();
      $('#lg-hint', m.el).innerHTML = forrige.neste ? `<div class="av-info">Forrige gang (${visDato(forrige.dato)}) skrev du at du skulle: «${esc(forrige.neste)}»</div>` : '';
      toast('Hentet fra forrige logg.');
    };

    const lukk = (verdi) => { m.lukk(); res(verdi); };
    const lagre = (status) => {
      const el = f.elements;
      const ut = { ...v, dato: el.dato.value || idag(), timer: el.timer.value === '' ? '' : Math.max(0, +el.timer.value), prosjektId: el.prosjektId.value, oppgaveId: el.oppgaveId.value,
        gjort: el.gjort.value.trim(), bra: el.bra.value.trim(), vanskelig: el.vanskelig.value.trim(), neste: el.neste.value.trim(), kompmal: el.kompmal.value, status };
      if (!lgErElev()) ut.elev = elevVelger();
      if (!ut.elev) { $('#mfeil', m.el).textContent = 'Velg hvilken elev loggen gjelder.'; return; }
      if (status === 'ferdig') {
        if (!ut.gjort) { $('#mfeil', m.el).textContent = '«Hva gjorde jeg i dag?» må fylles ut.'; el.gjort.focus(); return; }
        if (!ut.vurdering) { $('#mfeil', m.el).textContent = 'Velg hvordan du synes det gikk (1–6).'; return; }
      }
      // videoer som ble fjernet, slettes fra disken
      if (!ny) (logg.media || []).filter(x => x.type === 'video' && !ut.media.some(y => y.fil === x.fil)).forEach(x => Media.slett(x.fil));
      if (ny) d.logger.push({ id: nyId(), opprettet: new Date().toISOString(), ...ut });
      else Object.assign(logg, ut, { endret: new Date().toISOString() });
      Lager.lagre(); toast(status === 'utkast' ? 'Utkastet er lagret.' : 'Loggen er lagret.'); lukk(true); visSide();
    };
    f.addEventListener('submit', e => { e.preventDefault(); lagre('ferdig'); });
    $('[data-utkast]', m.el).onclick = () => lagre('utkast');
    $('[data-avbryt]', m.el).onclick = () => { nyMedia.forEach(n => Media.slett(n)); lukk(false); };
    const sb = $('[data-slett]', m.el);
    if (sb) sb.onclick = async () => {
      m.lukk();
      if (await bekreft('Slette denne loggen? Bilder og video i loggen slettes også.', { ja: 'Slett', fare: true })) {
        (logg.media || []).filter(x => x.type === 'video').forEach(x => Media.slett(x.fil));
        d.logger = d.logger.filter(x => x !== logg); Lager.lagre(); visSide();
      }
      res(false);
    };
  });
}

/* ============ Ett loggkort ============ */
function lgKort(l, { visElev = false, kanGiTilbake = false } = {}) {
  const p = lgProsjekt(l.prosjektId), o = lgOppgave(l.oppgaveId);
  const tags = [p && p.navn, o && o.tittel, l.kompmal && storForbokstav(l.kompmal)].filter(Boolean);
  const video = l.media.filter(m => m.type === 'video'), bilder = l.media.filter(m => m.type !== 'video');
  const media = [...video, ...bilder];
  const rad = (ikon, kl, t) => t ? `<div class="lg-refl"><span class="${kl}">${ikon}</span>${esc(t)}</div>` : '';
  return `<div class="lg-kort ${l.status === 'utkast' ? 'utkast' : ''}" data-logg="${l.id}">
    <div class="lg-kortHode">
      <div><div class="lg-dato">${lgDagNavn(l.dato)}${l.status === 'utkast' ? ' <span class="status st-pa">Utkast</span>' : ''}${l.kilde === 'innlevert' ? ' <span class="status st-ok" title="Hentet inn fra eleven">Levert</span>' : ''}</div>
        <div class="smaa">${visElev ? esc(personNavn(l.elev)) + ' · ' : ''}${esc(l.okt || '')}${l.timer !== '' && l.timer !== undefined ? ` · ${lgTall(+l.timer)} timer` : ''}</div></div>
      <div class="lg-kortHoyre">${l.vurdering ? `<div class="lg-vurdering st-${LG_VURD_KL[l.vurdering - 1]}" title="${esc(LG_VURDERING[l.vurdering - 1])}"><b>${l.vurdering}</b><span>/6</span></div>` : ''}
        <button class="lenkeknapp" data-rediger="${l.id}">Rediger</button></div>
    </div>
    ${tags.length ? `<div class="lg-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    ${media.length ? `<div class="lg-galleri ${video.length ? 'med-video' : ''}">${media.map(m => lgMediaHtml(m, l.media.indexOf(m))).join('')}</div>` : ''}
    ${l.gjort ? `<p class="lg-gjort">${esc(l.gjort)}</p>` : ''}
    ${l.verktoy.length || l.materialer.length || l.verneutstyr.length ? `<div class="lg-fakta">
      ${l.verktoy.length ? `<div><div class="smaa">Verktøy</div>${esc(l.verktoy.join(', '))}</div>` : ''}
      ${l.materialer.length ? `<div><div class="smaa">Materialer</div>${l.materialer.map(x => esc(x.navn + (x.antall ? `, ${x.antall} ${x.enhet || ''}` : ''))).join('<br>')}</div>` : ''}
      ${l.verneutstyr.length ? `<div><div class="smaa">Verneutstyr</div>${esc(l.verneutstyr.join(', '))}</div>` : ''}</div>` : ''}
    ${l.bra || l.vanskelig || l.neste ? `<div class="lg-reflBoks">${rad('👍', 'lg-g', l.bra)}${rad('⚠', 'lg-o', l.vanskelig)}${rad('➜', 'lg-b', l.neste)}</div>` : ''}
    ${l.tilbakemelding?.tekst && !kanGiTilbake ? `<div class="lg-tilbake"><div class="smaa">Tilbakemelding fra ${esc(personNavn(l.tilbakemelding.av) || 'lærer')} · ${visDato(l.tilbakemelding.dato)}</div>${esc(l.tilbakemelding.tekst)}</div>` : ''}
    ${kanGiTilbake && l.status !== 'utkast' ? `<div class="lg-tilbake rediger"><div class="smaa">Tilbakemelding til eleven${l.tilbakemelding?.dato ? ` · sist endret ${visDato(l.tilbakemelding.dato)}` : ''}</div>
      <textarea data-tilbake="${l.id}" placeholder="Skriv en kort tilbakemelding …">${esc(l.tilbakemelding?.tekst || '')}</textarea></div>` : ''}
  </div>`;
}
function lgKoblKort(el, liste) {
  $$('[data-rediger]', el).forEach(b => b.onclick = () => lgRediger(liste.find(l => l.id === b.dataset.rediger)));
  $$('.lg-kort', el).forEach(k => {
    const l = liste.find(x => x.id === k.dataset.logg);
    $$('[data-vis]', k).forEach(b => b.onclick = () => lgVisMedia(l.media[+b.dataset.vis]));
  });
  $$('[data-tilbake]', el).forEach(t => t.onchange = () => {
    const l = liste.find(x => x.id === t.dataset.tilbake);
    l.tilbakemelding = t.value.trim() ? { tekst: t.value.trim(), av: meg(), dato: idag() } : null;
    Lager.lagre(); toast('Tilbakemeldingen er lagret.');
  });
  lgHydrer(el);
}

/* ============ Side: Loggbok ============ */
registrer('lg-loggbok', el => {
  const d = D();
  const elev = lgAktivElev();
  const kanVelge = !lgErElev() && harRegister();
  const elevValg = kanVelge ? `<select id="lg-elevvalg" style="width:auto;min-width:200px"><option value="">Velg elev …</option>
      ${sorterteKlasser().map(k => `<optgroup label="${esc(k.navn)}">${klassensElever(k.id).map(e => `<option value="${e.id}" ${e.id === elev ? 'selected' : ''}>${esc(e.navn)}</option>`).join('')}</optgroup>`).join('')}</select>` : '';
  if (!elev) {
    el.innerHTML = sidehode('Loggbok', 'Her fører elevene logg over det de gjør i verkstedet og i teorien.', elevValg) +
      `<div class="kort s12 gronn"><div class="tom">${lgErElev() ? 'Skriv inn navnet ditt under Innstillinger for å komme i gang.' : kanVelge ? 'Velg en elev øverst for å se eller føre loggboka til eleven.' : 'Lås opp lærertilgang for å velge elev.'}</div></div>`;
    const ev = $('#lg-elevvalg', el); if (ev) ev.onchange = () => { lgElev = ev.value; visSide(); };
    return;
  }
  const liste = lgLoggerFor(elev);
  const s = lgStatistikk(liste);
  const kanGiTilbake = !lgErElev() && opplast;
  // grupper per uke
  const uker = [];
  liste.forEach(l => { const k = lgMandag(l.dato); let u = uker.find(x => x.k === k); if (!u) uker.push(u = { k, liste: [] }); u.liste.push(l); });
  el.innerHTML = sidehode(lgErElev() ? 'Min loggbok' : `Loggbok – ${esc(personNavn(elev))}`, lgErElev() ? 'Før logg etter hver økt. Det tar bare et par minutter.' : 'Eleven fører loggen. Du kan skrive tilbakemelding under hver logg.',
    `${elevValg}<button class="btn sek" id="lg-skriv" ${s.antall ? '' : 'disabled'}>Skriv ut loggbok …</button>
     ${lgErElev() || !opplast ? `<button class="btn sek" id="lg-lever" ${s.antall ? '' : 'disabled'}>Lever logg …</button>` : ''}
     <button class="btn" id="lg-ny">+ Ny logg</button>`) +
    `<div class="grid">
      <div class="kort s3 gronn"><div class="smaa">Logger</div><div class="stor">${s.antall}</div><div class="smaa">${s.uke} denne uka${s.utkast ? ` · ${s.utkast} utkast` : ''}</div></div>
      <div class="kort s3 bla"><div class="smaa">Timer logget</div><div class="stor">${lgTall(s.timer)}</div><div class="smaa">${s.siste ? 'Siste logg ' + visDato(s.siste) : 'Ingen logger ennå'}</div></div>
      <div class="kort s3 lilla"><div class="smaa">Snitt egenvurdering</div><div class="stor">${s.snitt ? lgTall(s.snitt) : '–'}<span class="smaa"> / 6</span></div><div class="smaa">${s.snitt ? esc(LG_VURDERING[Math.round(s.snitt) - 1]) : ''}</div></div>
      <div class="kort s3 oransje"><div class="smaa">Med tilbakemelding</div><div class="stor">${s.antall - s.utenTilbake}</div><div class="smaa">av ${s.antall} logger</div></div>
    </div>
    <div class="lg-tidslinje">${uker.length ? uker.map(u => `<div class="lg-uke"><div class="lg-ukeHode">Uke ${lgUke(u.k)} <span class="smaa">${u.liste.length} ${u.liste.length === 1 ? 'logg' : 'logger'}</span></div>
      ${u.liste.map(l => lgKort(l, { kanGiTilbake })).join('')}</div>`).join('')
      : `<div class="kort s12 gronn"><div class="tom">Ingen logger ennå. Trykk «+ Ny logg» for å skrive den første.</div></div>`}</div>`;
  const ev = $('#lg-elevvalg', el); if (ev) ev.onchange = () => { lgElev = ev.value; visSide(); };
  $('#lg-ny', el).onclick = () => lgRediger(null, { elev });
  $('#lg-skriv', el).onclick = () => lgUtskriftValg(elev, liste);
  const lv = $('#lg-lever', el); if (lv) lv.onclick = () => lgLever(elev, liste);
  lgKoblKort(el, liste);
});

/* ============ Side: Lærerens oversikt ============ */
registrer('lg-oversikt', el => {
  const d = D();
  const klasser = sorterteKlasser();
  if (!lgKlasse || !klasser.some(k => k.id === lgKlasse)) lgKlasse = klasser[0]?.id || '';
  const elever = lgKlasse ? klassensElever(lgKlasse) : [];
  const iDag = idag();
  // logger fra elever som ikke finnes i registeret (f.eks. innlevert med et navn som ikke stemmer)
  const ukjente = [...new Set(d.logger.filter(l => !finnPerson(l.elev) && !d.elever.some(e => lgSammeElev(e.id, l.elev))).map(l => l.elev))];
  const rader = elever.map(e => ({ id: e.id, navn: e.navn, bilde: e.bilde, s: lgStatistikk(lgLoggerFor(e.id)) }));
  const status = s => !s.siste ? st('Ingen logger', 'hoy') : s.siste === iDag ? st('Logget i dag', 'ok') : dagerTil(s.siste) >= -7 ? st(`${-dagerTil(s.siste)} d siden`, 'gul') : st(`${-dagerTil(s.siste)} d siden`, 'hoy');
  el.innerHTML = sidehode('Lærerens oversikt', 'Hvem har logget, og hvem trenger en påminnelse? Klikk på en elev for å lese loggboka og gi tilbakemelding.',
    `<select id="lg-klasse" style="width:auto">${klasser.map(k => `<option value="${k.id}" ${k.id === lgKlasse ? 'selected' : ''}>${esc(k.navn)}</option>`).join('')}</select>
     <button class="btn" id="lg-hent">Hent innleveringer …</button>`) +
    `<div class="grid">${kort(`Elever i ${esc(klasseNavn(lgKlasse) || '–')}`, rader.length ? `<table><thead><tr><th>Elev</th><th>Status</th><th>Denne uka</th><th>Logger totalt</th><th>Timer</th><th>Snitt 1–6</th><th>Uten tilbakemelding</th></tr></thead><tbody>
      ${rader.map(r => `<tr class="klikk" data-elev="${r.id}"><td><b>${esc(r.navn)}</b></td><td data-sort="${r.s.siste || '0'}">${status(r.s)}</td><td>${r.s.uke}</td><td>${r.s.antall}</td><td>${lgTall(r.s.timer)}</td>
        <td data-sort="${r.s.snitt}">${r.s.snitt ? st(lgTall(r.s.snitt), LG_VURD_KL[Math.round(r.s.snitt) - 1]) : '–'}</td><td>${r.s.utenTilbake || '–'}</td></tr>`).join('')}
      </tbody></table>` : `<div class="tom">${klasser.length ? 'Ingen elever i klassen.' : 'Legg inn klasser og elever under Register først.'}</div>`, 's12 gronn')}
      ${ukjente.length ? kort('Logger fra elever som ikke finnes i registeret', `<p class="smaa" style="margin-top:0">Navnet i loggen stemmer ikke med noen elev i registeret. Sjekk stavemåten under Register.</p>
        ${ukjente.map(n => `<button class="btn sek" data-elev="${esc(n)}" style="margin:0 6px 6px 0">${esc(personNavn(n))} (${lgLoggerFor(n).length})</button>`).join('')}`, 's12 oransje') : ''}</div>`;
  $('#lg-klasse', el) && ($('#lg-klasse', el).onchange = e => { lgKlasse = e.target.value; visSide(); });
  $('#lg-hent', el).onclick = lgHentInnleveringer;
  $$('[data-elev]', el).forEach(r => r.onclick = () => { lgElev = r.dataset.elev; apneSide('lg-loggbok'); });
});

/* ============ Utskrift ============ */
function lgUtskriftValg(elev, liste) {
  const ferdige = liste.filter(l => l.status !== 'utkast');
  const fra = ferdige.at(-1)?.dato || idag(), til = ferdige[0]?.dato || idag();
  const m = modal(`<h2>Skriv ut loggbok</h2><p style="margin-top:0">Velg perioden som skal være med.</p>
    <div class="lg-r2"><label class="felt"><span>Fra</span><input type="date" id="lu-fra" value="${fra}"></label><label class="felt"><span>Til</span><input type="date" id="lu-til" value="${til}"></label></div>
    <div class="verktoylinje"><button type="button" class="lenkeknapp" id="lu-uke">Denne uka</button><button type="button" class="lenkeknapp" id="lu-alt">Hele loggboka</button></div>
    <label class="sjekk"><input type="checkbox" id="lu-bilder" checked>Ta med bilder</label>
    <label class="sjekk"><input type="checkbox" id="lu-tilbake" checked>Ta med lærerens tilbakemeldinger</label>
    <div class="knapper"><button class="btn sek" id="lu-avbryt">Avbryt</button><button class="btn" id="lu-ok">Forhåndsvis utskrift</button></div>`);
  $('#lu-uke', m.el).onclick = () => { $('#lu-fra', m.el).value = lgMandag(idag()); $('#lu-til', m.el).value = idag(); };
  $('#lu-alt', m.el).onclick = () => { $('#lu-fra', m.el).value = fra; $('#lu-til', m.el).value = til; };
  $('#lu-avbryt', m.el).onclick = m.lukk;
  $('#lu-ok', m.el).onclick = () => {
    const a = $('#lu-fra', m.el).value || '0000', b = $('#lu-til', m.el).value || '9999';
    const utvalg = ferdige.filter(l => l.dato >= a && l.dato <= b).sort((x, y) => x.dato.localeCompare(y.dato));
    if (!utvalg.length) { toast('Ingen logger i perioden.', true); return; }
    const medBilder = $('#lu-bilder', m.el).checked, medTilbake = $('#lu-tilbake', m.el).checked;
    m.lukk();
    const s = lgStatistikk(utvalg);
    skrivUt(`<h1>Loggbok – ${esc(personNavn(elev))}</h1>
      <div class="meta">${visDato(a)}–${visDato(b)} · ${utvalg.length} logger · ${lgTall(s.timer)} timer · snitt egenvurdering ${s.snitt ? lgTall(s.snitt) : '–'} av 6 · skrevet ut ${visDato(idag())}</div>
      ${utvalg.map(l => {
        const p = lgProsjekt(l.prosjektId), o = lgOppgave(l.oppgaveId);
        const bilder = l.media.filter(x => x.type !== 'video'), video = l.media.filter(x => x.type === 'video');
        return `<div class="lg-utskrift">
          <h2>${lgDagNavn(l.dato)} ${new Date(l.dato).getFullYear()} <span>${esc(l.okt || '')}${l.timer !== '' ? ` · ${lgTall(+l.timer)} timer` : ''} · egenvurdering ${l.vurdering || '–'}/6</span></h2>
          ${p || o ? `<div class="meta">${esc([p && p.navn, o && o.tittel].filter(Boolean).join(' › '))}</div>` : ''}
          <p>${esc(l.gjort)}</p>
          <table>
            ${l.verktoy.length ? `<tr><th>Verktøy</th><td>${esc(l.verktoy.join(', '))}</td></tr>` : ''}
            ${l.materialer.length ? `<tr><th>Materialer</th><td>${esc(l.materialer.map(x => x.navn + (x.antall ? ` (${x.antall} ${x.enhet || ''})` : '')).join(', '))}</td></tr>` : ''}
            ${l.verneutstyr.length ? `<tr><th>Verneutstyr</th><td>${esc(l.verneutstyr.join(', '))}</td></tr>` : ''}
            ${l.bra ? `<tr><th>Hva gikk bra</th><td>${esc(l.bra)}</td></tr>` : ''}
            ${l.vanskelig ? `<tr><th>Hva var vanskelig</th><td>${esc(l.vanskelig)}</td></tr>` : ''}
            ${l.neste ? `<tr><th>Neste gang</th><td>${esc(l.neste)}</td></tr>` : ''}
            ${l.kompmal ? `<tr><th>Kompetansemål</th><td>${esc(storForbokstav(l.kompmal))}</td></tr>` : ''}
            ${video.length ? `<tr><th>Video</th><td>${video.map(x => `▶ ${esc(x.tekst || x.navn || 'Video')} (${lgVarighet(x.varighet)})`).join('<br>')}</td></tr>` : ''}
            ${medTilbake && l.tilbakemelding?.tekst ? `<tr><th>Tilbakemelding</th><td>${esc(l.tilbakemelding.tekst)}</td></tr>` : ''}
          </table>
          ${medBilder && bilder.length ? `<div class="lg-utskriftBilder">${bilder.map(x => `<figure><img src="${x.data}" alt="">${x.tekst ? `<figcaption>${esc(x.tekst)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}`, `Loggbok ${personNavn(elev)}`);
  };
}

/* ============ Innlevering ============ */
async function lgLever(elev, liste) {
  const d = D();
  const ferdige = liste.filter(l => l.status !== 'utkast');
  const navn = personNavn(elev);
  const klasse = lgErElev() ? d.innst.klasse : klasseNavn(finnPerson(elev)?.klasseId);
  const video = ferdige.flatMap(l => l.media.filter(m => m.type === 'video').map(m => m.fil));
  const innhold = JSON.stringify({ type: 'klar-logg', versjon: 1, elev: navn, klasse, levert: new Date().toISOString(),
    logger: ferdige.map(l => ({ ...l, elev: navn, tilbakemelding: l.tilbakemelding || null })) });
  const filnavn = `Logg ${navn}${klasse ? ' ' + klasse : ''} ${idag()}.json`.replace(/[\\/:*?"<>|]/g, '');
  if (api && api.leverLogg) {
    const r = await api.leverLogg({ filnavn, innhold, media: video });
    if (!r) return;
    toast(`Loggen er levert (${ferdige.length} logger${video.length ? `, ${video.length} videoer` : ''}).${r.mangler ? ` ${r.mangler} videoer manglet.` : ''}`, !!r.mangler);
  } else {
    await lagreFil(filnavn, innhold);
    for (const f of video) { const b = await Media.blob(f); if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f; a.click(); } }
    toast(`Loggen er lastet ned${video.length ? ` med ${video.length} videoer` : ''}. Legg filene i innleveringsmappa.`);
  }
  ferdige.forEach(l => l.levert = idag()); Lager.lagre();
}
/* Finn eleven i registeret ut fra navnet i den innleverte fila */
function lgFinnElev(navn, klasse) {
  const d = D(); const n = String(navn || '').trim().toLowerCase();
  const treff = d.elever.filter(e => e.navn.toLowerCase() === n);
  if (treff.length > 1 && klasse) { const k = d.klasser.find(x => x.navn.toLowerCase() === String(klasse).toLowerCase()); const t = treff.find(e => k && e.klasseId === k.id); if (t) return t.id; }
  return treff[0]?.id || navn;
}
async function lgHentInnleveringer() {
  const d = D();
  let filer = [];
  if (api && api.hentLogger) filer = await api.hentLogger();
  else filer = await new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = '.json,video/*';
    i.onchange = async () => {
      const ut = [];
      for (const f of i.files) {
        if (f.type.startsWith('video/')) await Media.lagreSom(f.name, f);
        else ut.push({ navn: f.name, innhold: await f.text(), mangler: 0 });
      }
      res(ut);
    };
    i.click();
  });
  let nye = 0, oppdatert = 0, feil = 0, mangler = 0;
  for (const f of filer) {
    try {
      const o = JSON.parse(f.innhold);
      if (o.type !== 'klar-logg' || !Array.isArray(o.logger)) throw new Error();
      const elev = lgFinnElev(o.elev, o.klasse);
      mangler += f.mangler || 0;
      o.logger.forEach(inn => {
        const gammel = d.logger.find(l => l.id === inn.id);
        const ny = { ...inn, elev, kilde: 'innlevert', mottatt: new Date().toISOString() };
        if (gammel) { Object.assign(gammel, ny, { tilbakemelding: gammel.tilbakemelding || inn.tilbakemelding || null }); oppdatert++; }
        else { d.logger.push(ny); nye++; }
      });
    } catch (e) { feil++; }
  }
  Lager.lagre(); visSide();
  if (filer.length) toast(`${nye} nye logger${oppdatert ? `, ${oppdatert} oppdatert` : ''}${feil ? `, ${feil} filer kunne ikke leses` : ''}${mangler ? `, ${mangler} videoer manglet` : ''}.`, (feil || mangler) > 0 && !nye);
}

/* Logger som mangler felter (f.eks. fra eldre versjoner) får standardverdier */
function migrerLogger(d) {
  (d.logger || []).forEach(l => {
    ['media', 'verktoy', 'materialer', 'verneutstyr'].forEach(k => { if (!Array.isArray(l[k])) l[k] = []; });
    if (!l.status) l.status = 'ferdig';
  });
}
