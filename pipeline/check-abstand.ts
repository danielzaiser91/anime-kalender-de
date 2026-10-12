/**
 * Zusicherungen zum groben Abstand (11.10.2026, Daniel): Tage, ab 7 Tagen Wochen, ab 4,5 Wochen
 * Monate, ab 365 Tagen Jahre, jeweils abgerundet. Läuft in `check:logic`.
 */
import { abstandGrob } from '../shared/time.ts'

let fehler = 0
const faelle: [number, string][] = [
  [-3, 'heute 0'], [0, 'heute 0'], [1, 'morgen 1'], [2, 'tage 2'], [6, 'tage 6'],
  [7, 'wochen 1'], [13, 'wochen 1'], [14, 'wochen 2'], [31, 'wochen 4'],
  [32, 'monate 1'], [60, 'monate 1'], [61, 'monate 2'], [364, 'monate 11'],
  [365, 'jahre 1'], [729, 'jahre 1'], [730, 'jahre 2'],
]
for (const [tage, soll] of faelle) {
  const { einheit, anzahl } = abstandGrob(tage)
  if (`${einheit} ${anzahl}` !== soll) {
    fehler++
    console.error(`FEHLER: ${tage} Tage → ${einheit} ${anzahl}, erwartet ${soll}`)
  }
}

if (fehler) process.exit(1)
console.log('check-abstand: ok')
