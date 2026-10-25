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

/* Zuletzt gelesene Prüfstand-Zeit für Aufrufer ohne `await` (null bis zum ersten Abruf oder ohne Netz). */
globalThis.akPruefstandAm = null

/* Ohne Prüfstand-Zeit bleibt es beim alten, großzügigeren Maßstab des Eintrags. */
globalThis.akGemeldetSeit = async (eintragSeit) => {
  globalThis.akPruefstandAm = (await globalThis.akPruefstand())?.pruefstandAm ?? null
  return globalThis.akPruefstandAm ?? eintragSeit ?? null
}

/**
 * **Die eine Regel „Maßstab = Prüfstandzeit“ für lokale Vermerke** (24.10.2026).
 *
 * Ein lokaler Vermerk (Prime „abgehakt“, Disney+ „nichts da“) belegt eine Meldung nur, wenn er jünger
 * ist als der Prüfstand: Was davor gemeldet wurde, hat der Bau eingearbeitet; führt er den Titel
 * trotzdem als offen, ist die alte Meldung kein Beleg mehr. Genauso rechnet der Worker
 * (`pruefung-stand-anbieter.ts`: Meldung seit `pruefstandAm`). Ohne Prüfstand-Zeit gilt `eintragSeit`,
 * ohne beides jeder Vermerk; ein Vermerk ohne Zeit nie. Ein reiner Tag (ältere Fassungen) wird als Tag verglichen:
 * am Tag des Prüfstands gilt er (`>=`), den Tag davor nicht.
 *
 * `akPruefstandAm` füllt nur `akGemeldetSeit`. Wer Vermerke bewertet, ruft es vorher selbst auf: Der Abruf je
 * Adresse (`frischGemeldet`) überspringt, was er sich gemerkt hat, und ließ die Zeit leer (Disney+, 24.10.2026).
 */
globalThis.akVermerkGilt = (zeit, eintragSeit) => {
  const z = String(zeit ?? '')
  if (!z) return false
  const g = String(globalThis.akPruefstandAm ?? eintragSeit ?? '')
  if (!g) return true
  return z.length <= 10 || g.length <= 10 ? z.slice(0, 10) >= g.slice(0, 10) : z >= g
}

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
