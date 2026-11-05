/**
 * Bestandsteil von `check-staffelzaehlung.ts`: **`staffelDesTitels` (Widerlegung, Katalog) zählt jeden Titel des ausgelieferten Bestands wie die
 * Kachel-Marke** (`staffelMarken`, dieselbe Zählung wie das Panel) — Spin-offs (`eigenesWerk`) und Beiwerk zählen in beiden nicht mit. Liest
 * `titles.json` wie gebaut: trägt sie kein `beiwerk`/`eigenesWerk`, fehlt die Markierung im Bau (`markiereReihenteileAusQuellen`) und der Wächter
 * ist rot. Erklärte Abweichungen (Neuverfilmung, Teil einer Staffel) und ihre Gegenfälle: `bewerteAbweichung`, getestet in `check-staffelzaehlung.ts`.
 * Dazu die Warnzeile „Spin-off-Verdacht“ (`spinoffVerdacht`).
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { staffelMarken } from '../web/src/lib/db-staffel-marke.ts'
import { staffelDesTitels } from './bau/widerlegung-staffel.ts'
import { reihenIndex } from './lib/disc-verschiebungen-staffel.ts'
import { bewerteAbweichung, handlisteOhneMarkierung, type Abweichung } from './lib/staffelzaehlung-abweichung.ts'
import { ladeAlleEigenenWerke } from './bau/cartoon-reihen.ts'
import { spinoffVerdacht, spinoffVerdachtZeile } from './lib/spinoff-verdacht.ts'
import { melde } from './lib/quarantaene.ts'

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
  const handliste = new Set(ladeAlleEigenenWerke().flatMap((e) => e.ids))
  const cartoons = JSON.parse(readFileSync('public/data/cartoons.json', 'utf8')) as Title[]
  const ohneAnime = handlisteOhneMarkierung(titel, handliste)
  const ohneCartoon = handlisteOhneMarkierung(cartoons, handliste)
  pruefe(`Jede Kennung der Handlisten eigener Werke trägt in ihrer Reihe eigenesWerk (titles.json: ${ohneAnime.length} ohne, cartoons.json: ${ohneCartoon.length} ohne)`, !ohneAnime.length && !ohneCartoon.length, [...ohneAnime, ...ohneCartoon].slice(0, 5))
  const marken = new Map<number, string>()
  for (const mitglieder of reihen.values()) if (mitglieder.length > 1) for (const [id, marke] of staffelMarken(mitglieder)) marken.set(id, marke)
  const zaehler: Record<Abweichung, Title[]> = { gleich: [], neuverfilmung: [], teil: [], unerklaert: [] }
  for (const t of titel) {
    if (t.franchiseId === undefined) continue
    const nummer = /^Staffel (\d+)$/.exec(marken.get(t.id) ?? '')
    zaehler[bewerteAbweichung(t, reihen.get(t.franchiseId) ?? [], staffelDesTitels(t, titel), nummer ? Number(nummer[1]) : undefined)].push(t)
  }
  for (const t of zaehler.unerklaert) melde(t.id, 'staffelzaehlung-bestand', 'Staffelnummer der Pipeline weicht von der Marke ab')
  const geprueft = Object.values(zaehler).reduce((n, liste) => n + liste.length, 0)
  pruefe(
    `Keine unerklärte Abweichung (${geprueft} Titel geprüft, ${zaehler.neuverfilmung.length} in Reihen mit Neuverfilmung, ${zaehler.teil.length} Teil einer Staffel)`,
    zaehler.unerklaert.length === 0,
    zaehler.unerklaert.slice(0, 5).map((t) => t.id),
  )
  for (const zeile of spinoffVerdachtZeile(spinoffVerdacht(titel))) console.log(zeile)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
