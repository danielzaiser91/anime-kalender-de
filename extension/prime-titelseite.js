/*
  **Welche Prime-Einträge der Durchgang öffnen kann** — eigene Datei, weil `amazon.js` über der
  Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `amazon.js`.

  Zwei Adressformen tragen eine Titelseite: `…/gp/video/detail/<ASIN>` und JustWatchs
  `watch.amazon.de/detail?gti=<gti>`. Letztere führen 116 der 124 Einträge der Prüfliste
  (gemessen 11.10.2026); bis 4.25.0 erkannte der Durchgang nur die erste Form und ließ sie liegen.
*/
globalThis.akPrimeHatTitelseite = (eintrag) => /\/detail(?:\/|\?gti=)/.test(String(eintrag?.url ?? ''))

/* Der Vermerk der Prime-Liste, wie der letzte Durchgang endete. */
globalThis.akPrimeEndeText = (ende) =>
  (ende.grund === 'nichts mehr offen' ? 'Durchgang fertig' : `Durchgang beendet · ${ende.grund}`) +
  (ende.uebersprungen?.length ? ` · übersprungen: ${ende.uebersprungen.join(', ')}` : '') +
  (ende.suchen ? ` · ${ende.suchen} Suchaufträge von Hand` : '')

/* Startkennung eines Titels: die gti aus JustWatchs Adresse, sonst die Kennung der Titelseite. */
globalThis.akPrimeStartKennung = (url, kennungAus) =>
  /[?&]gti=(amzn1\.dv\.gti\.[a-z0-9-]+)/.exec(String(url ?? ''))?.[1] ?? kennungAus(url)

/*
  Die Adresse des unsichtbaren Frames. Eine gti geht über `watch.amazon.de/detail?gti=…` (302 auf
  `www.amazon.de/gp/video/detail/<ASIN>?ref_=atv_dl_rdr`, ohne X-Frame-Options; gemessen am
  11.10.2026) und merkt sich vorher den Auftrag — derselbe Weg wie der Klick in der Prüfliste,
  denn die gti im Kopf der Zielseite ist eine andere als JustWatchs.
*/
globalThis.akPrimeFrameAdresse = (kennung, gtiMerken) => {
  if (!/^amzn1\.dv\.gti\./.test(kennung)) return `https://www.amazon.de/gp/video/detail/${kennung}`
  gtiMerken(kennung)
  return `https://watch.amazon.de/detail?gti=${kennung}`
}
