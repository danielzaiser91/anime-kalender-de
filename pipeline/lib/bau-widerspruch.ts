/**
 * Ein Widerspruch im erzeugten Ergebnis bricht den Bau ab — lieber keine frischen Daten als falsche.
 * `schluss` ist der Satz hinter der Anzahl; ohne ihn fehlt die Schlusszeile.
 */
export function brichAbBeiWiderspruch(fehler: string[], schluss?: string): void {
  if (!fehler.length) return
  for (const f of fehler) console.error('  ✖', f)
  if (schluss) console.error(`\n${fehler.length} ${schluss}`)
  process.exit(1)
}
