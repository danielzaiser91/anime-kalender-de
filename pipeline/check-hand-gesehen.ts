/**
 * Zusicherung: **`check:tote-adressen` kennt dieselbe Handprüfung wie der Bau** (`handSticht`, Fairy Tail, 22.09.2026).
 * Lauf von `handGesehenAm` (die Funktion, die `check-tote-adressen.ts` aufruft) — ersetzt die Quelltext-Zusicherung
 * `includes('handGesehen')` in `check-logic.ts`.
 */
import { adressKern } from './lib/dub-confirmed.ts'
import { handGesehenAm } from './lib/hand-gesehen.ts'

const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const am = (m: Map<string, string>, url: string) => m.get(adressKern(url))

const m = handGesehenAm(
  [
    { url: dp('A1'), checkedAt: '2026-09-18' },
    { url: dp('A1'), checkedAt: '2026-09-22' },
    { url: dp('A1'), checkedAt: '2026-09-10' },
    { url: dp('A2'), checkedAt: '2026-09-22', available: false },
    { checkedAt: '2026-09-22' },
    { url: dp('A5'), checkedAt: '2026-09-01' },
  ],
  [
    { url: dp('A5'), belegtAm: '2026-09-20' },
    { url: dp('A6'), belegtAm: '2026-09-21' },
    { url: dp('A7') },
    { belegtAm: '2026-09-21' },
  ],
)
erwarte('Beleg: der jüngste zählt, nicht der letzte', am(m, dp('A1')), '2026-09-22')
erwarte('Beleg mit Urteil „weg“ zählt nicht', am(m, dp('A2')), undefined)
erwarte('Beleg und Weg: der jüngere von beiden', am(m, dp('A5')), '2026-09-20')
erwarte('nur ein von Hand bestätigter Weg', am(m, dp('A6')), '2026-09-21')
erwarte('Weg ohne Datum zählt nicht', am(m, dp('A7')), undefined)
erwarte('nur diese Einträge', m.size, 3)
erwarte('leere Eingabe', handGesehenAm([], []).size, 0)

if (fehler.length) {
  console.error(`FEHL check-hand-gesehen:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-hand-gesehen: ${pruefungen} Prüfungen ok.`)
