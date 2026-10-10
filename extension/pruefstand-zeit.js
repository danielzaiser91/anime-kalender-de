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
/* Die ganze Antwort, einmal je Seite; `null` bei Netzfehler. */
globalThis.akPruefstand = (() => {
  const STAND_URL = 'https://newsletter.animekalender.workers.dev/pruefung?stand=1'
  let geholt = null
  return () => {
    if (!geholt) {
      geholt = fetch(STAND_URL, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    }
    return geholt
  }
})()

/* Ohne Prüfstand-Zeit bleibt es beim alten, großzügigeren Maßstab des Eintrags. */
globalThis.akGemeldetSeit = async (eintragSeit) =>
  (await globalThis.akPruefstand())?.pruefstandAm ?? eintragSeit ?? null

/*
  **Hat die Plattform mehr Folgen, als der Datensatz kennt?** (4.24.21, 10.10.2026)

  `bekannt` aus `?stand=1` ist je Kennung die höchste Folge, die der Datensatz belegt
  (`tools/pruefstand.mjs`); fehlt sie, ist nichts zu vergleichen. Ein Titel mit Folgen dahinter gilt
  nicht als beantwortet — die Erweiterung meldet dann alles erneut (Daniel: „lieber alles erneut
  melden als nur die neuen Folgen"), bestätigt also die alten Folgen und ergänzt die neuen.
*/
globalThis.akBekannt = (stand, plattform, kennung) => {
  const n = (stand?.anbieter ?? []).find((a) => a.plattform === plattform)?.bekannt?.[kennung]
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Von den noch nicht gemeldeten Folgennummern die hinter `bekannt`: `{ von, bis }` oder `null`. */
globalThis.akNeueFolgen = (bekannt, offeneNummern) => {
  const neu = bekannt > 0 ? offeneNummern.filter((n) => n > bekannt) : []
  return neu.length ? { von: Math.min(...neu), bis: Math.max(...neu) } : null
}

/** „Neue Folgen 12–15 · prüfen und melden“ bzw. „Neue Folge 16 · …“ — ein Text für Netflix und Disney+. */
globalThis.akNeueText = ({ von, bis }) => `${von === bis ? `Neue Folge ${von}` : `Neue Folgen ${von}–${bis}`} · prüfen und melden`
