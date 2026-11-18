# VEKTRA

**K**lassekart · **L**edelse av prosjekter · **A**rbeidsmiljø · **R**isiko

Et Windows-program for Vg1 bygg- og anleggsteknikk ved Malakoff videregående skole.

- Alle data lagres **bare lokalt** på PC-en, i en mappe du velger selv (for eksempel i OneDrive). Ingenting sendes på nett.
- VEKTRA tar en automatisk sikkerhetskopi hver dag.
- Klassekart og innleveringer er bare for lærer og er beskyttet med passord.
- Oppdateringer hentes fra dette GitHub-repoet. Det er bare selve programmet som hentes, aldri data.

## Slik lager du en ny versjon

1. Åpne `package.json` her på GitHub og trykk på blyanten.
2. Øk versjonsnummeret, for eksempel fra `"version": "1.0.0"` til `"version": "1.0.1"`.
3. Trykk **Commit changes**.
4. Gå til **Actions** → **Bygg og publiser VEKTRA** → **Run workflow**.

Etter noen minutter ligger den nye versjonen under **Releases**. Alle som har VEKTRA installert, får beskjed om oppdateringen ved neste oppstart, eller når de trykker **Se etter oppdateringer** under Innstillinger.

## Mappestruktur

| Fil / mappe | Innhold |
|---|---|
| `main.js` | Selve programmet: vindu, lagring til fil, oppdateringer |
| `preload.js` | Trygg kobling mellom vinduet og programmet |
| `src/` | Det du ser: sider, meny, stil |
| `src/moduler/` | Én fil per modul |
| `.github/workflows/release.yml` | Bygger installasjonsfila på GitHub |
