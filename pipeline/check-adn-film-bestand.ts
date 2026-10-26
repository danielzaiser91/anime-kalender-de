/**
 * Bestandsteil von `check-adn-film.ts`: Kollisionsliste über alle Filme in `public/data/titles.json` („<Name> Movie N", N ab 2, trifft nie genau diesen Film).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-adn-film.ts`.
 */
import { filmZurShow } from './bau/adn-show-titel.ts'
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const folgen = (type: string) => [{ type, date: '2026-10-12', time: '09:00', url: 'x' }]

console.log('\nHöhere Filmnummern treffen nie den ersten Film (Prüfer-Befund PR 910), am Bestand:')
{
  /* Kollisionsliste über alle Filme in public/data: „<Name> Movie N" (N ab 2) darf nie genau diesen Film treffen. */
  const alle = JSON.parse(readFileSync(new URL('../public/data/titles.json', import.meta.url), 'utf8')) as Title[]
  const filme = alle.filter((t) => t.format === 'MOVIE')
  const kollisionen: string[] = []
  for (const t of filme) {
    for (const name of [t.titleRomaji, t.titleEn]) {
      if (!name) continue
      for (const n of [2, 3, 4, 5]) if (filmZurShow({ title: `${name} Movie ${n}`, episodes: folgen('MOV') }, filme)?.id === t.id) kollisionen.push(`${name} Movie ${n} → ${t.id}`)
    }
  }
  pruefe(`${filme.length} Filme: kein „Movie N" (N ≥ 2) landet beim Film ohne Nummer`, kollisionen.length === 0, kollisionen.slice(0, 5))
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
console.log(`VERSTÖSSE: ${verletzt}`)
process.exit(verletzt ? 1 : 0)
