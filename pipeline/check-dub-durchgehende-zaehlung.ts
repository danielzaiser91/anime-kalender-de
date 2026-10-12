/**
 * Zusicherung: Zählt ein Anbieter durchgehend über mehrere Cours (Netflix: „Mushoku Tensei Cour 2" = Folgen 12–23 bei 12 Folgen,
 * „Kengan Ashura Season 2" = 13–28), meldet das Panel keine „nicht im Angebot"-Folgen — die Zählung des Titels (1–12) und die
 * des Anbieters sind nicht dieselbe (12.10.2026). Läuft in `check:logic`.
 */
import { dubBild, folgenOhneAnbieter, zaehltDurchgehend } from '../shared/dub-grenze.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const cour2 = [{ from: 12, to: 23, dub: true }]
const ganz = [{ from: 1, to: 12, dub: true }]

console.log('\nDurchgehende Zählung des Anbieters:')
pruefe('Bereich 12–23 bei 12 Folgen zählt durchgehend', zaehltDurchgehend(cour2, 12))
pruefe('Bereich 1–12 bei 12 Folgen nicht', !zaehltDurchgehend(ganz, 12))
pruefe('ohne Folgenzahl oder ohne Bereiche nie', !zaehltDurchgehend(cour2, undefined) && !zaehltDurchgehend(undefined, 12))
pruefe('dubBild: Cour 2 meldet nichts als „nicht im Angebot"', dubBild(cour2, 12)!.nichtImAngebot.length === 0, dubBild(cour2, 12))
pruefe('dubBild: die deutschen Folgen bleiben 12', dubBild(cour2, 12)!.deutscheFolgen === 12)
pruefe('dubBild: eine echte Lücke (1–4 von 12) bleibt gemeldet', JSON.stringify(dubBild([{ from: 1, to: 4, dub: true }], 12)!.nichtImAngebot) === '[{"from":5,"to":12}]')
pruefe('folgenOhneAnbieter: Cour 2 allein sagt nichts über fehlende Folgen', folgenOhneAnbieter([cour2], 12) === null)
pruefe('folgenOhneAnbieter: eine echte Lücke bleibt gemeldet', folgenOhneAnbieter([[{ from: 1, to: 75, dub: true }]], 100) === '76–100')

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
