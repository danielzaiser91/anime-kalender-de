/**
 * Die einzeilige Hinweis-Zeile der Bestandsprüfungen: nur Zeilen mit „⚠ WARNUNG“ zeigt `tools/commit-data.sh` (`bestand_warnungen`)
 * bei Exit 0 im Lauf-Log, ein `::warning::` aus `check:bestand` bliebe in `bestand-pruefung.txt` unsichtbar.
 */
export function bestandWarnzeile(was: string, grund: string, ids: number[]): string {
  return `⚠ WARNUNG ${was}: ${ids.length} ${grund}: ${ids.join(', ')}`
}

/** Marke einer Warnzeile, die früher rot war; `tools/bestand-warnung-melden.mjs` trägt nur diese in den Posteingang ein. */
export const HERABGESTUFT = '[vorher rot]'

/**
 * Eine Prüfung, die den Bau nicht mehr sperrt, weil ihr Verstoß keine falsche Aussage live bringt (26.10.2026): dieselbe Zeile wie
 * `bestandWarnzeile`, dazu die Marke `HERABGESTUFT`. So bleibt der Verstoß im Lauf-Log und im Posteingang sichtbar.
 */
export function herabgestufteWarnzeile(was: string, grund: string, ids: number[]): string {
  return bestandWarnzeile(`${HERABGESTUFT} ${was}`, grund, ids)
}
