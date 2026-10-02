/*
  **Der Maßstab für „schon gemeldet" ist der Prüfstand, nicht das Eintragsdatum** (01.10.2026).

  Auf Disney+ blendete der Kasten „Bleach: Thousand-Year Blood War" aus („1 gemeldet ausblenden"),
  weil seit seinem Eintragsdatum (27.09.) Meldungen vorlagen. Der Prüfstand vom 30.09. führt den
  Titel aber weiter als offen — zu Recht: Die Meldungen vom 27.09. tragen Folgentitel statt Nummern
  und beantworten die Wiedervorlage („Folgen einzeln melden", Stufe 4) nicht. Die Statusanzeige zählte
  deshalb 2 Titel, der Kasten 1.

  Der Worker rechnet mit dem Prüfstand-Zeitpunkt und liefert ihn in `?stand=1` als `pruefstandAm`;
  in `erzeugtAm` steht dagegen, wann die Antwort gerechnet wurde. Dieses Skript holt ihn **einmal je
  Seite** und stellt ihn den Anzeigen bereit — eigene Datei, weil `disney.js` über der Zeilengrenze
  liegt (check:umfang).
*/
globalThis.akGemeldetSeit = (() => {
  const STAND_URL = 'https://newsletter.animekalender.workers.dev/pruefung?stand=1'
  let geholt = null
  const stand = () => {
    if (!geholt) {
      geholt = fetch(STAND_URL, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.pruefstandAm ?? null)
        .catch(() => null)
    }
    return geholt
  }
  /* Ohne Prüfstand-Zeit bleibt es beim alten, großzügigeren Maßstab des Eintrags. */
  return async (eintragSeit) => (await stand()) ?? eintragSeit ?? null
})()
