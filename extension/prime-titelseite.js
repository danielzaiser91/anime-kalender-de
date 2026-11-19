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

/*
  Der Knopf der Zielseite bietet das Melden an: „… · melden“, bei einem Suchauftrag „… · melden als „Titel““
  (`zielTeil` in amazon-knopf-zeichnen.js). Mit `/melden$/` klickte der Frame bei Suchaufträgen nie (15.11.2026:
  vier Kauf/Leihe-Filme blieben 25 s auf dem Knopf stehen und galten als „Fehler beim Melden“).
*/
globalThis.akPrimeBietetMelden = (text) => /melden(?: als „.*")?$/.test(String(text ?? ''))

/*
  Ein gescheiterter Eintrag kommt je Eintragskennung (Plan-Eintrag samt Query: ASIN, ASIN?ref_=…_sN, gti) nur
  einmal in die Handliste. Ein erneuter Lauf desselben Eintrags (Frame verwaist, Tageslimit) fügt keine zweite Zeile
  an; zwei verschiedene Einträge mit gleichem Grund bleiben zwei Zeilen. Nicht an Textgleichheit gebunden: Die Ursache
  der Doppelung bei Captain Tsubasa S2 (15.11.2026) ist aus der gekürzten Diagnose-Spur nicht belegbar.
*/
globalThis.akPrimeUebersprungenDazu = (lauf, eintragKennung, text) => {
  lauf.uebersprungenKennungen ??= []
  if (lauf.uebersprungenKennungen.includes(eintragKennung)) return
  lauf.uebersprungenKennungen.push(eintragKennung)
  lauf.uebersprungen.push(text)
}

/*
  Fortschritt am Knopf: Nenner = Titel + Suchaufträge, beim Start gezählt (`titelGesamt`) und danach fest. Treffer einer
  Suche zählen nicht mit — ihre Zahl steht erst fest, wenn die Suche gelesen ist; vorher wuchs „13/13“ auf „16/16“
  (Daniel, 18.11.2026). Während der Treffer steht der Zähler bei ihrer Suche.
*/
globalThis.akPrimeFortschritt = (lauf) => {
  const gesamt = Math.max(lauf.titelGesamt ?? 0, 1)
  return { gesamt, nr: Math.min(lauf.fertig.length + (lauf.suche ? 0 : 1), gesamt) }
}

/* Ergebnisbericht der Prime-Liste, Aufbau wie Disney+ (`akDisneyEndeText`): Kopf mit Zahlen, dann je Auffälligem eine Zeile. */
globalThis.akPrimeEndeText = (ende) => {
  const zahlen = [ende.erledigt != null && `${ende.erledigt} Titel`, ende.seiten != null && `${ende.seiten} Seiten gemeldet`].filter(Boolean)
  const kopf = [ende.grund === 'nichts mehr offen' ? 'Durchgang fertig' : `Durchgang beendet · ${ende.grund}`, ...zahlen].join(' · ')
  const hand = ende.uebersprungen?.length ? `\n${ende.uebersprungen.length} selbst prüfen:\n${ende.uebersprungen.map((u) => `• ${u}`).join('\n')}` : ''
  return kopf + hand + (ende.suchen ? `\n${ende.suchen} Suchaufträge von Hand` : '')
}

/*
  Ein Titel gilt als frisch gemeldet, wenn **seine eigene Seite** gemeldet hat — nicht, wenn irgendeine Staffel
  gelang: Eine gelungene Staffel unter anderer Kennung nahm sonst den Titel aus der Liste, obwohl seine Seite
  scheiterte und der Worker ihn weiter offen führt (Captain Tsubasa, 15.11.2026: „Alles geprüft“).
  Ein Fehlschlag **löscht keine Marke**: Hat die sichtbare Seite den Titel kurz zuvor selbst gemeldet
  (`frischGemeldet.add` nach „gemeldet ✓“), bleibt das wahr, auch wenn der Frame danach scheitert; die Marke
  überbrückt ohnehin nur bis zum nächsten Worker-Stand.
*/
globalThis.akPrimeTitelErgebnis = (lauf, frameKennung, ok, url, frischGemeldet) => {
  if (ok && url && frameKennung === lauf.titel) frischGemeldet.add(url)
}

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
  /(?<!nicht )gemeldet/.test(String(text ?? ''))
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
