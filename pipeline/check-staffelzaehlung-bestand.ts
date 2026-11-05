/**
 * Bestandsteil von `check-staffelzaehlung.ts`: **`staffelDesTitels` (Widerlegung, Katalog) zählt jeden Titel des ausgelieferten Bestands wie die
 * Kachel-Marke** (`staffelMarken`, dieselbe Zählung wie das Panel) — Spin-offs (`eigenesWerk`) und Beiwerk zählen in beiden nicht mit. Liest
 * `titles.json` wie gebaut: trägt sie kein `beiwerk`/`eigenesWerk`, fehlt die Markierung im Bau (`03-reihen.ts`) und der Wächter ist rot.
 * Abweichungen, die er erklärt: in einer Reihe mit Neuverfilmung kennt die Marke `remakeVon` nicht (die Pipeline schon); `BEKANNT` führt die übrigen
 * einzeln. Dazu die Warnzeile „Spin-off-Verdacht“ (`spinoffVerdacht`).
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { staffelMarken } from '../web/src/lib/db-staffel-marke.ts'
import { remakeVonDerReihe } from './bau/remake-von.ts'
import { staffelDesTitels } from './bau/widerlegung-staffel.ts'
import { reihenIndex } from './lib/disc-verschiebungen-staffel.ts'
import { spinoffVerdacht, spinoffVerdachtZeile } from './lib/spinoff-verdacht.ts'
import { melde } from './lib/quarantaene.ts'

/** Titel, bei denen Marke und Pipeline aus einem anderen Grund als der Neuverfilmung auseinanderliegen (Stand 05.11.2026). */
const BEKANNT = new Map<number, string>([
  [13203, 'Lupin III: Fujiko Mine ist Teil 1 von Staffel 2 (Name „Part 6“ der Nachfolgerin): die Pipeline liefert dann keine Nummer, die Marke fällt auf „Staffel 2“ zurück'],
])

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[]
const reihen = reihenIndex(titel)

console.log('\nStaffelzählung: Pipeline gegen Kachel-Marke über den ganzen Bestand')
{
  const markiert = titel.filter((t) => t.beiwerk || t.eigenesWerk).length
  pruefe(`titles.json trägt die Markierung für Beiwerk und eigene Werke (${markiert} Titel)`, markiert > 0)
  const marken = new Map<number, string>()
  for (const mitglieder of reihen.values()) if (mitglieder.length > 1) for (const [id, marke] of staffelMarken(mitglieder)) marken.set(id, marke)
  const abweichend: Title[] = []
  let ausNeuverfilmung = 0
  let geprueft = 0
  for (const t of titel) {
    if (t.franchiseId === undefined) continue
    geprueft++
    const nummer = /^Staffel (\d+)$/.exec(marken.get(t.id) ?? '')
    if (staffelDesTitels(t, titel) === (nummer ? Number(nummer[1]) : undefined)) continue
    if (remakeVonDerReihe(reihen.get(t.franchiseId) ?? []).size) ausNeuverfilmung++
    else if (!BEKANNT.has(t.id)) abweichend.push(t)
  }
  for (const t of abweichend) melde(t.id, 'staffelzaehlung-bestand', 'Staffelnummer der Pipeline weicht von der Marke ab')
  pruefe(`Keine unerklärte Abweichung (${geprueft} Titel geprüft, ${ausNeuverfilmung} in Reihen mit Neuverfilmung, ${BEKANNT.size} bekannt)`, abweichend.length === 0, abweichend.slice(0, 5).map((t) => t.id))
  for (const zeile of spinoffVerdachtZeile(spinoffVerdacht(titel))) console.log(zeile)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
