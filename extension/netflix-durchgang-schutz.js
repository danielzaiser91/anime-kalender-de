/*
  **Wann der Netflix-Durchgang sich selbst anhält** — eigene Datei, weil `melder.js` über der
  Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.

  Bis 4.26.0 endete „▶ alle durchgehen" nach 20 Titeln mit „Durchgang fertig" (245 offen,
  11.10.2026). Die Titelzahl traf nie den Fehler, vor dem sie schützen sollte (One-Piece-Lauf vom
  26.08.2026, 42 falsche Meldungen): den fängt je Titel der Reihen-Riegel im Durchlauf
  (`stand.reihe` muss zur Seite passen), dazu Störung, zwei Anläufe je Titel und sechs Runden
  je Seite. Hier bleiben zwei Netze für einen Lauf, der sich in der Liste verrennt.

  Gibt den Grund zum Abbruch oder `null`. Jeder Sprung führt zu einem anderen Titel
  (`selbstUebersprungen`), also sind es höchstens so viele wie bei Laufbeginn offene Titel —
  ein Sprung mehr ist ein Fehler. Dazu die Zeit seit Laufbeginn (sessionStorage, übersteht das
  Neuladen der Seite).
*/
globalThis.akDurchgangSchutz = (gezaehlt, grenze, schluessel, hoechstensMs) => {
  if (gezaehlt > grenze) return `Schutz: mehr Sprünge als offene Titel (${grenze})`
  let seit = 0
  try {
    seit = Number(sessionStorage.getItem(schluessel))
  } catch {
    /* Ohne Speicher gibt es keine Zeitgrenze — der Lauf endet dann mit dem Tab. */
  }
  const dauer = Date.now() - seit
  if (seit > 0 && dauer >= hoechstensMs) return `Zeitgrenze ${Math.round(hoechstensMs / 3600000)} Stunden erreicht`
  return null
}

/*
  Bestätigt der Worker von einer Randprobe keine einzige Meldung (Luna Petunia und 80049903,
  11.10.2026: jeder Stapel `bestaetigt 0`, nichts im Briefkasten), läuft der
  Durchgang nicht Titel für Titel leer weiter, sondern endet mit diesem Grund im Kasten.
*/
globalThis.akRandAusfall = (durchlauf, angekommen) => {
  if (angekommen || !durchlauf.selbst) return
  durchlauf.abbruch = true
  durchlauf.abbruchGrund = 'Worker bestätigt keine Meldung'
}
