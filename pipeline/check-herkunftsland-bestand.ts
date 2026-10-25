/**
 * Bestandsteil von `check-herkunftsland.ts`: Herkunftsland (`land`) in `titles.json`: gültige Kürzel, kein JP, Untergrenze der gemessenen Verteilung.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-herkunftsland.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { landFehler } from './lib/pruefung.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

/* Echter Bestand: sobald ein Datenlauf `land` geliefert hat, gilt die Verteilung der Messung (KR 33, CN 28; 09.10.2026) als Untergrenze. */
const datei = 'public/data/titles.json'
if (existsSync(datei)) {
  const titel = JSON.parse(readFileSync(datei, 'utf8')) as Title[]
  const mitLand = titel.filter((t) => t.land !== undefined)
  pruefe('Land (Bestand): kein JP, kein ungültiges Kürzel, keine synthetische Kennung', landFehler(new Map(mitLand.map((t) => [t.id, t]))).length === 0)
  if (mitLand.length > 0) {
    const zahl = (c: string) => mitLand.filter((t) => t.land === c).length
    pruefe('Land (Bestand): Korea und China erreichen die gemessene Untergrenze', zahl('KR') >= 25 && zahl('CN') >= 20, `KR ${zahl('KR')}, CN ${zahl('CN')}`)
  }
}

console.log(fehler ? `\nHerkunftsland (Bestand): ${fehler} Zusicherung(en) verletzt.` : 'Herkunftsland (Bestand): alle Zusicherungen halten.')
console.log(`VERSTÖSSE: ${fehler}`)
process.exit(fehler ? 1 : 0)
