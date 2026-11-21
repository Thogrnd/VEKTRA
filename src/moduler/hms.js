/* VEKTRA – modul: HMS (HMS-mappe).
   Sidene viser dokumentene i HMS-mappen på OneDrive (VEKTRA/HMS/<undermappe>).
   Læreren legger filene inn i mappen. Elevene kan bare lese (mappen deles med «Kan vise»). */
'use strict';

const HMS_MAPPER = {
  'hms-org': { tittel: 'Organisering og ansvar', tekst: 'Hvem som har ansvaret for hva i HMS-arbeidet.', mapper: ['Organisering og ansvar'],
    innhold: ['HMS-ansvarlig og verneombud', 'Førstehjelpsansvarlige', 'Kontaktliste: nødnumre, bedriftshelsetjeneste, legevakt og ansvarlige', 'HMS-mål'] },
  'hms-regler': { tittel: 'Regler og rutiner', tekst: 'Felles regler og hva man gjør når noe skjer.', mapper: ['Regler og rutiner'],
    innhold: ['Ordensregler for verksted og byggeplass', 'Beredskapsplan: brann, skade, førstehjelp, rømningsveier og møteplass', 'Rutine for avviksmeldinger'] },
  'hms-utstyr': { tittel: 'Utstyr og stoffer', tekst: 'Verneutstyr, maskiner og kjemikalier.', mapper: ['Utstyr og stoffer', 'Sikkerhetsdatablader'],
    innhold: ['Verneutstyr: hva brukes til hvilket arbeid, og kontrolldatoer', 'Stoffkartotek med sikkerhetsdatablad', 'Kontroll- og vedlikeholdslister for maskiner, stiger, stillas og elektroverktøy'] },
  'hms-oppfolging': { tittel: 'Oppfølging', tekst: 'Kontroller, avvik og årlig gjennomgang.', mapper: ['Oppfølging'],
    innhold: ['Logg over HMS-kontroller og vernerunder', 'Avvikslogg med status', 'Årlig gjennomgang og forbedringer'] }
};

const HMS_TYPER = { pdf: ['PDF', '📕'], doc: ['Word', '📘'], docx: ['Word', '📘'], xls: ['Excel', '📗'], xlsx: ['Excel', '📗'], ppt: ['PowerPoint', '📙'], pptx: ['PowerPoint', '📙'],
  jpg: ['Bilde', '🖼️'], jpeg: ['Bilde', '🖼️'], png: ['Bilde', '🖼️'], mp4: ['Video', '🎬'], mov: ['Video', '🎬'], txt: ['Tekst', '📄'], url: ['Lenke', '🔗'] };
const hmsType = navn => HMS_TYPER[(navn.split('.').pop() || '').toLowerCase()] || ['Fil', '📄'];
const hmsStr = b => !b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
const hmsErElev = () => D().innst.rolle === 'elev';

/* Hvor HMS-mappen ligger: læreren bruker VEKTRA-mappen på OneDrive, eleven bruker HMS-snarveien sin */
async function hmsKilde() {
  if (!api || !api.odListFiler) return null;
  const d = D();
  if (!hmsErElev()) {
    const o = d.onedrive;
    return o?.rot && typeof odErJobbkonto === 'function' && odErJobbkonto(o.rot) ? { base: o.rot, pre: 'HMS/' } : null;
  }
  if (!d.innst.hmsMappe && d.innst.elevmappe && api.odFinnHms) {
    const funnet = await api.odFinnHms(d.innst.elevmappe);
    if (funnet) { d.innst.hmsMappe = funnet; Lager.lagre(); }
  }
  return d.innst.hmsMappe ? { base: d.innst.hmsMappe, pre: '' } : null;
}

function hmsForslag(m) {
  return kort('Forslag til innhold', `<div class="smaa" style="margin-bottom:6px">Dette passer å legge inn her:</div>
    ${m.innhold.map(t => `<div class="sjekk" style="cursor:default">📁 ${esc(t)}</div>`).join('')}`, 's4 gul');
}

Object.entries(HMS_MAPPER).forEach(([id, m]) => registrer(id, async el => {
  const elev = hmsErElev();
  const kilde = await hmsKilde();
  if (aktiv !== id) return;   // brukeren har gått videre mens mappen ble lest

  if (!kilde) {
    const hjelp = !api ? 'HMS-dokumentene fra OneDrive vises bare i det installerte programmet.'
      : elev ? 'Koble VEKTRA til elevmappen din under Innstillinger, eller velg HMS-mappen som læreren har delt med deg.'
      : 'Velg VEKTRA-mappen på OneDrive under Innstillinger → OneDrive og trykk «Lag OneDrive-mapper». Da vises dokumentene du legger i HMS-mappene her.';
    el.innerHTML = sidehode(m.tittel, m.tekst, elev && api && api.odVelgMappe ? '<button class="btn" id="hms-velg">Velg HMS-mappen …</button>' : '') +
      `<div class="grid">${kort('Dokumenter', `<div class="tom" style="text-align:left">${esc(hjelp)}</div>`, 's8 gul')}${elev ? '' : hmsForslag(m)}</div>`;
    hmsKoblVelg(el);
    return;
  }

  const lister = await Promise.all(m.mapper.map(mappe => api.odListFiler(kilde.base, kilde.pre + mappe)));
  if (aktiv !== id) return;
  const kortene = m.mapper.map((mappe, i) => {
    const r = lister[i];
    const filer = (r.ok ? r.filer : []).sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
    const innhold = !r.ok ? `<div class="tom" style="text-align:left">Kunne ikke lese mappen: ${esc(r.feil)}</div>`
      : !r.finnes ? `<div class="tom" style="text-align:left">${elev ? 'Finner ikke mappen. Si fra til læreren.' : 'Mappen finnes ikke ennå. Trykk «Lag OneDrive-mapper» under Innstillinger → OneDrive.'}</div>`
      : !filer.length ? `<div class="tom" style="text-align:left">${elev ? 'Læreren har ikke lagt inn noe her ennå.' : 'Mappen er tom. Trykk «Åpne mappen» og legg dokumentene der.'}</div>`
      : `<table><thead><tr><th>Dokument</th><th style="width:110px">Type</th><th style="width:110px">Endret</th><th style="width:90px">Størrelse</th></tr></thead><tbody>
        ${filer.map(f => { const [t, ik] = hmsType(f.navn); return `<tr class="klikk" data-mappe="${esc(mappe)}" data-fil="${esc(f.navn)}" title="Klikk for å åpne">
          <td><b>${ik} ${esc(f.navn.replace(/\.[^.]+$/, ''))}</b></td><td>${t}</td><td>${f.endret ? visDato(f.endret.slice(0, 10)) : ''}</td><td>${hmsStr(f.str)}</td></tr>`; }).join('')}
        </tbody></table>`;
    return kort(m.mapper.length > 1 ? mappe : 'Dokumenter', innhold + (elev ? '' : `<div class="verktoylinje" style="margin-top:10px"><button class="btn sek" data-apne="${esc(mappe)}">Åpne mappen</button></div>`), `${elev ? 's12' : 's8'} gul`);
  });
  el.innerHTML = sidehode(m.tittel, m.tekst + (elev ? ' Klikk på et dokument for å åpne det.' : ' Klikk på et dokument for å åpne det. Elevene ser de samme dokumentene.'),
    `<button class="btn sek" id="hms-oppdater">Oppdater</button>`) +
    `<div class="grid">${kortene.join('')}${elev ? '' : hmsForslag(m)}</div>`;
  $$('[data-fil]', el).forEach(r => r.onclick = async () => {
    const feil = await api.odApneFil(kilde.base, kilde.pre + r.dataset.mappe, r.dataset.fil);
    if (feil) toast('Kunne ikke åpne fila: ' + feil, true);
  });
  $$('[data-apne]', el).forEach(b => b.onclick = () => api.odApneFil(kilde.base, kilde.pre + b.dataset.apne, ''));
  $('#hms-oppdater', el).onclick = () => visSide();
}));

function hmsKoblVelg(el) {
  const b = $('#hms-velg', el); if (!b) return;
  b.onclick = async () => {
    const m = await api.odVelgMappe('Velg HMS-mappen som læreren har delt med deg');
    if (!m) return;
    D().innst.hmsMappe = m; Lager.lagre(); visSide();
  };
}
