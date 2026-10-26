/**
 * Bestandsteil von `check-remake-zaehlung.ts` (Daniel, 26.10.2026: Yaiba 2025 stand als „Staffel 2", ist aber die Neuverfilmung von
 * Staffel 1): Eine Neuverfilmung (aniSearch `Remake`, `data/remake-von-hand.yaml`) liegt nie mit ihrem Original in einer Zählgruppe, und in
 * einer Reihe mit Neuverfilmung kommt keine Staffelnummer doppelt vor. Rechnet auf `public/data` mit derselben Markierung wie der Bau
 * (`markiereRemakes`), damit der Wächter auch vor dem nächsten Bestandsbau etwas aussagt. Liest `public/data` und gehört deshalb in `check:bestand`.
 */
import { readFileSync } from 'node:fs'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { alleRemakePaare, markiereRemakes } from './bau/remake-von.ts'
import { doppelteNummern, remakeMitOriginalInGruppe } from './lib/remake-zaehlung-pruefung.ts'

/** Doppelte Nummern in Reihen ohne Neuverfilmung (Spin-offs mit Staffelzahl im Namen); gemessen 26.10.2026, darf nur sinken. */
export const BEKANNT_DOPPELT_OHNE_REMAKE = 34
/** Der Anlassfall: Yaiba (2025) ist die Neuverfilmung von Legendary Brave Swordsman Yaiba (1993) — laut Handliste. */
const YAIBA = { remake: 177476, original: 2335 }

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const lies = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T

console.log('\nNeuverfilmungen und Zählgruppen im ausgelieferten Datensatz:')
{
  const roh = lies<Record<string, FranchiseMember[]>>('public/data/franchises.json')
  const titel = [...lies<Title[]>('public/data/titles.json'), ...lies<Title[]>('public/data/ohne-synchro.json')]
  const paare = alleRemakePaare(titel)
  const markiert = markiereRemakes(JSON.parse(JSON.stringify(roh)) as Record<string, FranchiseMember[]>, titel)
  const alle = Object.values(markiert).flat()
  const neuverfilmungen = alle.filter((m) => m.remakeVon !== undefined)

  pruefe(`Anlassfall: Yaiba 2025 ist die Neuverfilmung von Yaiba 1993 (${neuverfilmungen.length} Neuverfilmungen insgesamt)`, alle.some((m) => m.id === YAIBA.remake && m.remakeVon === YAIBA.original))
  const zusammen = remakeMitOriginalInGruppe(markiert, paare)
  pruefe(`Keine Neuverfilmung steht mit ihrem Original in einer Zählgruppe (${paare.size} Paare geprüft)`, zusammen.length === 0, zusammen.slice(0, 5))
  const doppelt = doppelteNummern(markiert)
  const mitRemake = doppelt.filter((d) => d.mitRemake)
  pruefe('In Reihen mit Neuverfilmung kommt keine Staffelnummer doppelt vor', mitRemake.length === 0, mitRemake.slice(0, 5))
  const ohneRemake = doppelt.length - mitRemake.length
  if (ohneRemake > BEKANNT_DOPPELT_OHNE_REMAKE) console.log(`  ⚠ WARNUNG Zählung: ${ohneRemake} doppelte Staffelnummern in Reihen ohne Neuverfilmung, bekannt waren ${BEKANNT_DOPPELT_OHNE_REMAKE} (neue Fälle: Remake in aniSearch prüfen oder data/remake-von-hand.yaml)`)
  if (ohneRemake < BEKANNT_DOPPELT_OHNE_REMAKE) console.log(`  ⚠ WARNUNG Zählung: nur noch ${ohneRemake} doppelte Staffelnummern, BEKANNT_DOPPELT_OHNE_REMAKE in pipeline/check-remake-zaehlung-bestand.ts senken`)

  const imBestand = Object.values(roh).flat().filter((m) => m.remakeVon !== undefined).length
  if (imBestand !== neuverfilmungen.length) console.log(`  ⚠ WARNUNG Zählung: franchises.json trägt remakeVon an ${imBestand} statt ${neuverfilmungen.length} Teilen — der nächste Bestandsbau schreibt sie, sonst fehlt die Verdrahtung in 13-4-zusatzdateien.ts`)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
