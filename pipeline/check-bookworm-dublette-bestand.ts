/**
 * Zusicherung am gebauten Bestand (`public/data`): Bookworm Staffel 5 steht als AniList-Titel 217712 mit aniSearch-Kennung 22017 da, die
 * aniSearch-Zeile 10022017 daneben nicht mehr (Daniel 11.10.2026, PR 856/861). Quellen und Umleitung: `check-bookworm-dublette.ts`.
 * Läuft in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück).
 */
import { readFileSync } from 'node:fs'
import { pruefeBookwormKennung } from './lib/bookworm-pruefung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nBookworm Staffel 5: Kennungen und Handdatei (echte Dateien):')
pruefeBookwormKennung(pruefe, 'data/kennungen.json', 'data/anisearch-ids-hand.yaml')

console.log('\nBookworm Staffel 5 im Bestand:')
{
  const lies = (datei: string) => JSON.parse(readFileSync(new URL(`../public/data/${datei}`, import.meta.url), 'utf8')) as { id: number; anisearchId?: number }[]
  const alle = [...lies('titles.json'), ...lies('ohne-synchro.json')]
  pruefe('die aniSearch-Zeile 10022017 steht in keiner Titeldatei', !alle.some((t) => t.id === 10_022_017))
  const traeger = alle.filter((t) => t.anisearchId === 22017)
  pruefe('genau ein Titel trägt die aniSearch-Kennung 22017: der AniList-Titel 217712', traeger.length === 1 && traeger[0]!.id === 217_712, traeger.map((t) => t.id))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('\nOK')
console.log('VERSTÖSSE: 0')
