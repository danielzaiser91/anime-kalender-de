/**
 * Bestandsteil von `check-remake-zaehlung.ts` (Daniel, 26.10.2026: Yaiba 2025 stand als „Staffel 2", ist aber die Neuverfilmung von
 * Staffel 1): Eine Neuverfilmung (aniSearch `Remake`, `data/remake-von-hand.yaml`) liegt nie mit ihrem Original in einer Zählgruppe, und in
 * einer Reihe mit Neuverfilmung kommt keine Staffelnummer doppelt vor. Rechnet auf `public/data` mit derselben Markierung wie der Bau
 * (`markiereRemakes`), damit der Wächter auch vor dem nächsten Bestandsbau etwas aussagt. Liest `public/data` und gehört deshalb in `check:bestand`.
 */
import { readFileSync } from 'node:fs'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { alleRemakePaare, markiereRemakes } from './bau/remake-von.ts'
import { abweichungVomBekannten, doppelteNummern, remakeMitOriginalInGruppe, warnzeilenZaehlung } from './lib/remake-zaehlung-pruefung.ts'
import { BEKANNT_DOPPELT_OHNE_REMAKE } from './lib/remake-zaehlung-bekannt.ts'
import { melde } from './lib/quarantaene.ts'

/** Der Anlassfall: Yaiba (2025) ist die Neuverfilmung von Legendary Brave Swordsman Yaiba (1993) — laut Handliste. */
const YAIBA = { remake: 177476, original: 2335 }
/** Die am 01.11.2026 per Handliste nachgezogenen Neuverfilmungen (aniSearch führt sie nur als „Alternative Version"). */
const NACHGEZOGEN = [
  { remake: 11061, original: 136, name: 'Hunter × Hunter (2011)', originalName: 'Hunter x Hunter (1999)' },
  { remake: 3312, original: 2222, name: 'Dr. Slump (1997)', originalName: 'Dr. Slump (1981)' },
  { remake: 184639, original: 283, name: 'Anne Shirley (2025)', originalName: 'Anne mit den roten Haaren (1979)' },
]

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
  for (const f of NACHGEZOGEN) {
    pruefe(`Anlassfall: ${f.name} ist die Neuverfilmung von ${f.originalName}`, alle.some((m) => m.id === f.remake && m.remakeVon === f.original))
  }
  const zusammen = remakeMitOriginalInGruppe(markiert, paare)
  for (const m of zusammen) melde(m.id, 'remake-zaehlung-bestand', 'Neuverfilmung steht mit ihrem Original in einer Zählgruppe')
  pruefe(`Keine Neuverfilmung steht mit ihrem Original in einer Zählgruppe (${paare.size} Paare geprüft)`, zusammen.length === 0, zusammen.slice(0, 5).map((m) => m.name))
  const doppelt = doppelteNummern(markiert)
  const mitRemake = doppelt.filter((d) => d.mitRemake)
  for (const d of mitRemake) for (const id of d.ids) melde(id, 'remake-zaehlung-bestand', `Staffelnummer ${d.nummer} doppelt in einer Reihe mit Neuverfilmung`)
  pruefe('In Reihen mit Neuverfilmung kommt keine Staffelnummer doppelt vor', mitRemake.length === 0, mitRemake.slice(0, 5))
  for (const zeile of warnzeilenZaehlung(abweichungVomBekannten(doppelt, BEKANNT_DOPPELT_OHNE_REMAKE))) console.log(zeile)

  const imBestand = Object.values(roh).flat().filter((m) => m.remakeVon !== undefined).length
  if (imBestand !== neuverfilmungen.length) console.log(`  ⚠ WARNUNG Zählung: franchises.json trägt remakeVon an ${imBestand} statt ${neuverfilmungen.length} Teilen — der nächste Bestandsbau schreibt sie, sonst fehlt die Verdrahtung in 13-4-zusatzdateien.ts`)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
