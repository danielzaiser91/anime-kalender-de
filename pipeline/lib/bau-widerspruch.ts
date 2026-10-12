/** Nur `tools/bau-vergleich.mjs` setzt das, nie der echte Bestandsbau. */
const VERGLEICHSMODUS = process.env.BAU_VERGLEICH === '1'

/**
 * Ein Widerspruch im erzeugten Ergebnis bricht den Bau ab — lieber keine frischen Daten als falsche.
 * `schluss` ist der Satz hinter der Anzahl; ohne ihn fehlt die Schlusszeile.
 *
 * Im Vergleichsmodus läuft der Bau weiter: Der Ersatz-Cache ist nicht der echte, und eine Invariante,
 * die dort reißt, soll keine Seite des Vergleichs verhindern. Die Meldungen stehen im Protokoll, das
 * mitverglichen wird — eine neue Verletzung im Kandidaten fällt also auf.
 */
export function brichAbBeiWiderspruch(fehler: string[], schluss?: string): void {
  if (!fehler.length) return
  if (VERGLEICHSMODUS) {
    for (const f of fehler) console.error('  ⚠ Widerspruch (Vergleichsmodus):', f)
    return
  }
  for (const f of fehler) console.error('  ✖', f)
  if (schluss) console.error(`\n${fehler.length} ${schluss}`)
  process.exit(1)
}
