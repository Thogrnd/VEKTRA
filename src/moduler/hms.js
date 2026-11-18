/* VEKTRA – modul: HMS (HMS-mappe). Undermappene er opprettet, men innholdet fylles på senere. */
'use strict';

const HMS_MAPPER = {
  'hms-org': { tittel: 'Organisering og ansvar', tekst: 'Hvem som har ansvaret for hva i HMS-arbeidet.',
    innhold: ['HMS-ansvarlig og verneombud', 'Førstehjelpsansvarlige', 'Kontaktliste: nødnumre, bedriftshelsetjeneste, legevakt og ansvarlige', 'HMS-mål'] },
  'hms-regler': { tittel: 'Regler og rutiner', tekst: 'Felles regler og hva man gjør når noe skjer.',
    innhold: ['Ordensregler for verksted og byggeplass', 'Beredskapsplan: brann, skade, førstehjelp, rømningsveier og møteplass', 'Rutine for avviksmeldinger'] },
  'hms-utstyr': { tittel: 'Utstyr og stoffer', tekst: 'Verneutstyr, maskiner og kjemikalier.',
    innhold: ['Verneutstyr: hva brukes til hvilket arbeid, og kontrolldatoer', 'Stoffkartotek med sikkerhetsdatablad', 'Kontroll- og vedlikeholdslister for maskiner, stiger, stillas og elektroverktøy'] },
  'hms-oppfolging': { tittel: 'Oppfølging', tekst: 'Kontroller, avvik og årlig gjennomgang.',
    innhold: ['Logg over HMS-kontroller og vernerunder', 'Avvikslogg med status', 'Årlig gjennomgang og forbedringer'] }
};

Object.entries(HMS_MAPPER).forEach(([id, m]) => registrer(id, el => {
  el.innerHTML = sidehode(m.tittel, m.tekst) +
    `<div class="grid">${kort('Innhold i denne mappen', `
      <div class="tom" style="text-align:left;padding:0 0 6px">Mappen er tom foreløpig. Her skal dette inn:</div>
      ${m.innhold.map(t => `<div class="sjekk" style="cursor:default">📁 ${esc(t)}</div>`).join('')}`, 's8 gul')}
    </div>`;
}));
