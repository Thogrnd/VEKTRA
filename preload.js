// Trygg bro mellom VEKTRA-vinduet og hovedprosessen
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('klarApi', {
  les: () => ipcRenderer.invoke('data:les'),
  skriv: (tekst) => ipcRenderer.invoke('data:skriv', tekst),
  info: () => ipcRenderer.invoke('data:info'),
  velgMappe: () => ipcRenderer.invoke('data:velgMappe'),
  byttMappe: (mappe, modus, tekst) => ipcRenderer.invoke('data:byttMappe', mappe, modus, tekst),
  apneMappe: () => ipcRenderer.invoke('data:apneMappe'),
  lagreFil: (o) => ipcRenderer.invoke('fil:lagre', o),
  apneFil: (o) => ipcRenderer.invoke('fil:apne', o),
  lagrePdf: (navn) => ipcRenderer.invoke('fil:pdf', navn),
  skrivUt: () => ipcRenderer.invoke('fil:skrivUt'),
  apneBildemappe: () => ipcRenderer.invoke('fil:bildemappe'),
  lagreMedia: (navn, data) => ipcRenderer.invoke('media:lagre', navn, data),
  slettMedia: (navn) => ipcRenderer.invoke('media:slett', navn),
  leverLogg: (o) => ipcRenderer.invoke('logg:lever', o),
  hentLogger: () => ipcRenderer.invoke('logg:hent'),
  sjekkOppdatering: () => ipcRenderer.invoke('oppd:sjekk'),
  lastOppdatering: () => ipcRenderer.invoke('oppd:last'),
  installerOppdatering: () => ipcRenderer.invoke('oppd:installer'),
  vedOppdatering: (fn) => ipcRenderer.on('oppd:status', (e, s) => fn(s))
});
