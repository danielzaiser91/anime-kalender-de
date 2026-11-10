/**
 * Ersetzt-Wächter für `pr-nachrechnen.mjs` (10.11.2026, Anlass PR 3239: gemergt, obwohl der offene PR 3318 ihn ersetzte und
 * „3239 schließen“ verlangte; Folge: 3318 CONFLICTING). Ein offener PR, der in Titel oder Beschreibung „ersetzt PR <n>“
 * oder „ersetzt #<n>“ trägt, sperrt den Merge von <n>.
 */

/** Zahl hinter „ersetzt PR“ / „ersetzt #“, nicht Teil einer längeren Zahl (3239 trifft nicht 32391). */
export const ersetztMuster = (nummer) => new RegExp(`\\bersetzt\\s+(?:PR\\s*#?|#)\\s*${nummer}(?!\\d)`, 'i')

/** Erster offener PR (außer `nummer` selbst), der `nummer` ersetzt, sonst null. `offene`: [{ number, title, body }]. */
export function findeErsetzer(nummer, offene) {
  const muster = ersetztMuster(nummer)
  return offene.find((p) => p.number !== nummer && muster.test(`${p.title ?? ''}\n${p.body ?? ''}`)) ?? null
}

/** `gh(args)` ist eingespeist; ein Fehler des Aufrufs bricht ab (kein stilles Grün). */
export function ersetzer(nummer, gh) {
  const offene = JSON.parse(gh(['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,body']))
  return findeErsetzer(nummer, offene)
}

export const ersetztMeldung = (nummer, ersatz) => `PR ${nummer}: ERSETZT durch PR ${ersatz.number} — nicht mergen, schließen`
