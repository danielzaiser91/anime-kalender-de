/**
 * Bestandsteil von `check-katalog-eingefroren.ts`: der Bau lässt keinen eingefrorenen Titel stillschweigend fallen.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic`.
 */
import { ladeEingefrorene } from './lib/katalog-eingefroren.ts'
import { readJson } from './lib/util.ts'

/* Jeder eingefrorene Titel steht in der Ausgabe (ohne Synchro oder Hauptbestand); 1 % Spiel für Zusammenführungen. */
const eingefroren = ladeEingefrorene()
const ausgabe = new Set<number>([...readJson<{ id: number }[]>('public/data/ohne-synchro.json', []), ...readJson<{ id: number }[]>('public/data/titles.json', [])].map((t) => t.id))
if (ausgabe.size && eingefroren.length) {
  const fehlen = eingefroren.filter((e) => !ausgabe.has(e.id)).map((e) => e.id)
  if (fehlen.length > eingefroren.length * 0.01) {
    console.error(`  ✖ Ausgabe: höchstens 1 % der eingefrorenen Titel fehlen in ohne-synchro.json und titles.json — gefunden: ${JSON.stringify({ anzahl: fehlen.length, beispiele: fehlen.slice(0, 5) })}`)
    process.exit(1)
  }
  console.log(`  ✓ Ausgabe: ${fehlen.length} von ${eingefroren.length} eingefrorenen Titeln fehlen (Grenze 1 %)`)
}
console.log('check-katalog-eingefroren-bestand: ok')
