/* VEKTRA – Oversikt (forsiden) */
'use strict';

registrer('hjem', el => {
  const d = D();
  const elever = d.elever.length;
  const aktive = d.prosjekter.filter(p => p.status !== 'Ferdig');
  const forsinket = aktive.filter(p => p.frist && dagerTil(p.frist) < 0).length;
  const apneAvvik = d.avvik.filter(a => a.status !== 'Lukket');
  const vurd = synligeVurderinger();
  const tiltak = vurd.flatMap(v => v.rader.filter(r => r.tiltak.trim()).map(r => ({ r, v })));
  const apneTiltak = tiltak.filter(x => !x.r.utfort);
  const utstyrForfalt = [...d.verneutstyr, ...(d.verktoy || [])].filter(u => u.neste && dagerTil(u.neste) < 0).length;

  // siste 8 uker
  const uker = [];
  for (let i = 7; i >= 0; i--) { const t = new Date(); t.setDate(t.getDate() - i * 7); uker.push(t); }
  const iUke = (dato, t) => { if (!dato) return false; const x = new Date(dato + 'T12:00:00'); return ukenr(x) === ukenr(t) && Math.abs(x - t) < 8 * 86400000; };
  const avvikUke = uker.map(t => d.avvik.filter(a => iUke(a.dato, t)).length);
  const kontrollUke = uker.map(t => d.hmsLogg.filter(l => iUke(l.dato, t)).length);

  // kommende frister (prosjekter, oppgaver, verneutstyr) de neste 21 dagene + forfalte
  const frister = [
    ...aktive.filter(p => p.frist).map(p => ({ dato: p.frist, t: p.navn, type: 'Prosjekt', side: 'lp-prosjekter' })),
    ...d.oppgaver.filter(o => o.frist && o.kolonne !== 'ferdig').map(o => ({ dato: o.frist, t: o.tittel, type: 'Oppgave', side: 'lp-oppgaver' })),
    ...d.verneutstyr.filter(u => u.neste).map(u => ({ dato: u.neste, t: 'Kontroll: ' + u.navn, type: 'Verneutstyr', side: 'am-verneutstyr' })),
    ...(d.verktoy || []).filter(u => u.neste).map(u => ({ dato: u.neste, t: 'Kontroll: ' + u.navn, type: 'Verktøy', side: 'am-verktoy' })),
    ...d.avvik.filter(a => a.frist && a.status !== 'Lukket').map(a => ({ dato: a.frist, t: 'Avvik: ' + a.tittel, type: 'Avvik', side: 'am-avvik' }))
  ].filter(f => dagerTil(f.dato) <= 21).sort((a, b) => a.dato.localeCompare(b.dato)).slice(0, 7);

  const nokkel = (tittel, tall, tekst, ikon, kl, side) => `<div class="kort s3 ${kl}"><div class="nokkel" data-g="${side}"><div class="ik">${svg(I[ikon])}</div><div><div class="smaa">${tittel}</div><div class="stor">${tall}</div><div class="smaa">${tekst}</div></div></div></div>`;
  const hilsen = (() => { const h = new Date().getHours(); return h < 10 ? 'God morgen' : h < 17 ? 'God dag' : 'God kveld'; })();

  el.innerHTML = sidehode(`${hilsen}${d.innst.navn ? ', ' + d.innst.navn.split(' ')[0] : ''}!`, 'Status for klassene, prosjektene, arbeidsmiljøet og risikoarbeidet.') +
    `<div class="grid">
      ${d.innst.rolle !== 'elev' ? nokkel('Elever', elever, `${d.klasser.length} klasser · ${d.laerere.length} lærere`, 'elev', 'gronn', 'reg-klasser') : ''}
      ${nokkel('Aktive prosjekter', aktive.length, forsinket ? `${forsinket} forsinket` : 'Ingen forsinket', 'prosjekt', 'lilla', 'lp-prosjekter')}
      ${nokkel('Åpne avvik', apneAvvik.length, utstyrForfalt ? `${utstyrForfalt} utstyr må kontrolleres` : 'Arbeidsmiljø', 'arbeid', 'oransje', 'am-avvik')}
      ${nokkel('Åpne risikotiltak', apneTiltak.length, `${tiltak.length - apneTiltak.length} av ${tiltak.length} gjennomført`, 'risiko', 'rosa', 'hms-risiko')}
      ${kort('Åpne tiltak per sone', smultring(SONER.map(s => ({ n: s.navn, v: apneTiltak.filter(x => x.v.sone === s.id).length, f: s.farge })), apneTiltak.length, 'åpne tiltak'), 's4 rosa')}
      ${kort('Arbeidsmiljø siste 8 uker', `
        <div class="punkt"><i style="background:var(--pink);box-shadow:0 0 8px var(--pink)"></i><b>${avvikUke.reduce((a, b) => a + b, 0)}</b>&nbsp;avvik meldt</div>
        <div class="punkt"><i style="background:var(--blue2);box-shadow:0 0 8px var(--blue2)"></i><b>${kontrollUke.reduce((a, b) => a + b, 0)}</b>&nbsp;HMS-kontroller</div>
        ${linje([{ d: kontrollUke, f: '#5b8cff' }, { d: avvikUke, f: '#ff3d7f' }], uker.map((t, i) => (i === 0 ? 'Uke ' : '') + ukenr(t)))}`, 's8 lilla')}
      ${kort('Kommende frister', frister.length ? `<table><thead><tr><th>Frist</th><th>Hva</th><th>Type</th></tr></thead><tbody>
        ${frister.map(f => `<tr class="klikk" data-g="${f.side}"><td>${fristTekst(f.dato, false)}</td><td><b>${esc(f.t)}</b></td><td>${f.type}</td></tr>`).join('')}</tbody></table>`
        : '<div class="tom">Ingen frister de neste tre ukene.</div>', 'bla', '<button class="btn liten" data-g="lp-tidsplan">Tidsplan</button>')}
      ${kort('Siste risikovurderinger', vurd.length ? `<table><thead><tr><th>Arbeidsoppdrag</th><th>Sone</th><th>Risiko</th><th>Status</th></tr></thead><tbody>
        ${[...vurd].sort((a, b) => (b.dato || '').localeCompare(a.dato || '')).slice(0, 5).map(v => { const m = maksRisiko(v); return `<tr class="klikk" data-v="${v.id}"><td><b>${esc(v.tittel || 'Uten tittel')}</b><div class="smaa">${esc(v.elev)}</div></td><td>${soneNavn(v.sone)}</td>
          <td><span class="rverdi ${rKlasse(m)}">${m}</span></td><td>${st(v.status, R_STATUS_KL[v.status] || 'ny')}</td></tr>`; }).join('')}</tbody></table>`
        : '<div class="tom">Ingen risikovurderinger ennå.</div>', 'lilla', '<button class="btn liten" data-g="hms-risiko">Se alle</button>')}
    </div>`;
  $$('[data-g]', el).forEach(b => b.onclick = () => b.dataset.g === 'hms-risiko' ? apneRisikoOversikt(b.closest('.nokkel') ? 'risikoer' : 'vurderinger') : apneSide(b.dataset.g));
  $$('[data-v]', el).forEach(tr => tr.onclick = () => apneVurdering(tr.dataset.v));
});
