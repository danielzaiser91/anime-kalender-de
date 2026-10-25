/**
 * Die einzeilige Hinweis-Zeile der Bestandsprüfungen: nur Zeilen mit „⚠ WARNUNG“ zeigt `tools/commit-data.sh` (`bestand_warnungen`)
 * bei Exit 0 im Lauf-Log, ein `::warning::` aus `check:bestand` bliebe in `bestand-pruefung.txt` unsichtbar.
 */
export function bestandWarnzeile(was: string, grund: string, ids: number[]): string {
  return `⚠ WARNUNG ${was}: ${ids.length} ${grund}: ${ids.join(', ')}`
}
