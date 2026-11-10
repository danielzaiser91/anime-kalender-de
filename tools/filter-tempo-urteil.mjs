/**
 * Urteil des Filter-Messtors als reine Funktion: Der größte Median der Reaktion darf die Grenze nicht überschreiten,
 * und kein einzelner Tipp die Spitzengrenze (der Fehler vom 05.11.2026 war ein einzelner Tipp mit 3,8 s, die Mediane lagen bei 100 ms).
 */
export function urteil(zeilen, grenze, spitze) {
  if (!zeilen.length) return { ok: false, zeile: 'filter-tempo: ✖ keine Messung (0 Chips getippt)' }
  const groesster = Math.max(...zeilen.map((z) => z.reaktion))
  const hoechster = Math.max(...zeilen.map((z) => z.maximum))
  if (grenze === undefined) return { ok: true, zeile: `filter-tempo: Reaktion größter Median ${groesster} ms, langsamster Tipp ${hoechster} ms (ohne Grenze)` }
  const ok = groesster <= grenze && (spitze === undefined || hoechster <= spitze)
  const spitzeText = spitze === undefined ? '' : `, langsamster Tipp ${hoechster} ms, Grenze ${spitze} ms`
  return { ok, zeile: `filter-tempo: ${ok ? '✓' : '✖'} Reaktion größter Median ${groesster} ms, Grenze ${grenze} ms${spitzeText}, ${zeilen.length} Chips` }
}
