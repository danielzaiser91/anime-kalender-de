/*
  **Welche Prime-Einträge der Durchgang öffnen kann** — eigene Datei, weil `amazon.js` über der
  Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `amazon.js`.

  Zwei Adressformen tragen eine Titelseite: `…/gp/video/detail/<ASIN>` und JustWatchs
  `watch.amazon.de/detail?gti=<gti>`. Letztere führen 116 der 124 Einträge der Prüfliste
  (gemessen 11.10.2026); bis 4.25.0 erkannte der Durchgang nur die erste Form und ließ sie liegen.
*/
globalThis.akPrimeHatTitelseite = (eintrag) => /\/detail(?:\/|\?gti=)/.test(String(eintrag?.url ?? ''))

/*
  Reihenfolge des Durchgangs: Einträge mit `vorrang` (1 vor 2) zuerst, danach nach Titel. Die Liste setzt es für die Kanal-Nachmessung
  (`data/erneut-melden.yaml`, 12.10.2026), damit die Titel mit zweifelhaftem Kanal-Ja vor den übrigen drankommen.
*/
globalThis.akPrimeVergleich = (liste) => (a, b) =>
  (liste[a].vorrang ?? 9) - (liste[b].vorrang ?? 9) || String(liste[a].titel).localeCompare(String(liste[b].titel), 'de')

/* Der Vermerk der Prime-Liste, wie der letzte Durchgang endete. */
globalThis.akPrimeEndeText = (ende) =>
  (ende.grund === 'nichts mehr offen' ? 'Durchgang fertig' : `Durchgang beendet · ${ende.grund}`) +
  (ende.uebersprungen?.length ? ` · offen (Fehler beim Melden): ${ende.uebersprungen.join('; ')}` : '') +
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

/*
  Der Frame hat die Frist erreicht. Zeigt der Knopf da „gemeldet“, kam die Marke erst in der letzten Sekunde
  (langsame Seite): die Staffel ist gemeldet, nicht gescheitert (Fushigi Yûgi Staffel 1, 31.10.2026).
*/
globalThis.akPrimeFristErgebnis = (text) =>
  /gemeldet/.test(String(text ?? ''))
    ? { ok: true, grund: `schon gemeldet (${text})` }
    : { ok: false, grund: `Knopf blieb bei: ${text || '(leer)'}` }

/* „73–97, 99“: die Folgennummern von 1 bis `gesamt`, die nicht gelesen wurden. */
globalThis.akPrimeFehlende = (gesamt, nummern) => {
  const da = new Set(nummern ?? [])
  const teile = []
  let von = null
  for (let n = 1; n <= (gesamt || 0) + 1; n++) {
    const fehlt = n <= gesamt && !da.has(n)
    if (fehlt && von === null) von = n
    if (!fehlt && von !== null) {
      teile.push(von === n - 1 ? String(von) : `${von}–${n - 1}`)
      von = null
    }
  }
  return teile.join(', ')
}

/* Was der Durchgang zu einer gescheiterten Seite sagt: der Grund, bei fehlenden Folgen mit den Nummern. */
globalThis.akPrimeGrundMitLuecke = (grund, gesamt, nummern) => {
  const fehlt = globalThis.akPrimeFehlende(gesamt, nummern)
  return fehlt ? `${grund} (von ${gesamt} fehlen Folge ${fehlt})` : grund
}

/* Eintrag der Endanzeige für eine gescheiterte Seite: Titel, Staffel (oder nichts bei einer einzelnen Seite), Grund. */
globalThis.akPrimeUebersprungen = (titel, staffelNr, grund) =>
  `${titel}${staffelNr ? ` · Staffel ${staffelNr}` : ''} – ${grund || 'ohne Angabe'}`

/* Frist-Ergebnis als [ok, grund] für `frameFertig`; Gelesenes aus dem Stand (`gesehen`) benennt, was fehlt. */
globalThis.akPrimeFrist = (text, gesehen) => {
  const a = globalThis.akPrimeFristErgebnis(text)
  return [a.ok, a.ok ? a.grund : globalThis.akPrimeGrundMitLuecke(a.grund, gesehen?.gesamt, gesehen?.nummern)]
}

/* Je Abschnitt eine kurze Zeile für die Spur: HTTP-Status, gelesen/roh, Nummernbereich, Kollisionen. */
globalThis.akPrimeAbschnittSpur = (abschnitte) =>
  (abschnitte?.log ?? []).map(
    (a) =>
      `${a.von ?? '?'}–${a.bis ?? '?'}: ${a.gelesen ?? 0}/${a.roh ?? 0}, HTTP ${a.status ?? '?'}` +
      (a.kollisionen ? `, ${a.kollisionen} Kollision` : '') +
      (a.ohneNummer ? `, ${a.ohneNummer} ohne Nummer` : ''),
  )
