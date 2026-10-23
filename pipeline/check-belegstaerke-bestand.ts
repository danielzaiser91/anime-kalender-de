/**
 * Bestandsteil von `check-belegstaerke.ts`: Jede Kennung der Forum-Treffer-Datei steht im Datensatz (`titles.json`, `ohne-synchro.json`), Listenjahr und AniList-Jahr liegen nah beieinander.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-belegstaerke.ts`.
 */
import type { Title } from '../shared/types.ts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './lib/util.ts'
import { zurueckgestellt } from './lib/quarantaene.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nBelegstärke: Treffer-Datei gegen den Datensatz')
{
  const liste = yaml.load(readFileSync(resolve(ROOT, 'data/synchron-forum-treffer.yaml'), 'utf8')) as { anilistId: number; liste: string }[]
  const dateien = ['titles.json', 'ohne-synchro.json'].map((n) => JSON.parse(readFileSync(resolve(ROOT, 'public/data', n), 'utf8')) as Title[])
  const jahr = new Map(dateien.flat().map((t) => [t.id, t.jpYear]))
  /* 2331: Odysseus 31 — deutsche Fassung 1988, AniList-Titel 1981 (von Hand zugeordnet). */
  const AUSNAHMEN = new Set([2331])
  const zurueck = zurueckgestellt().ids // zurückgestellt (Quarantäne), nicht verloren
  const fehlend = liste.filter((e) => !jahr.has(e.anilistId) && !zurueck.has(e.anilistId)).map((e) => e.anilistId)
  const weit = liste.filter((e) => {
    const j = jahr.get(e.anilistId)
    return j && !AUSNAHMEN.has(e.anilistId) && Math.abs(j - Number(e.liste.slice(-4))) > 2
  }).map((e) => e.liste)
  pruefe('jede Kennung der Treffer-Datei steht im Datensatz', fehlend.length === 0, fehlend)
  pruefe('Listenjahr liegt höchstens 2 Jahre neben dem AniList-Jahr', weit.length === 0, weit)
  pruefe('keine Kennung doppelt', new Set(liste.map((e) => e.anilistId)).size === liste.length)
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
