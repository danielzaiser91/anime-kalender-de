/**
 * Bestandswache: Jede neue deutsche Crunchyroll-Folge der letzten 1–10 Tage (`data/crunchyroll-neu.json`) steht als Termin im
 * Kalender (`public/data/events.json`). Fehlt eine, steht eine Zeile „⚠ WARNUNG“ (Exit 0, blockiert keine anderen Daten);
 * rot nur bei unlesbarer Eingabe. Bewertung in `lib/cr-neu-wache.ts`, Test `check-cr-neu-wache.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { ReleaseEvent, Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { bestandWarnzeile } from './lib/bestand-warnzeile.ts'
import { fehlendeCrFolgen, serienWarnzeile, unbekannteCrSerien, type NeueFolge } from './lib/cr-neu-wache.ts'

const lies = (pfad: string): unknown => JSON.parse(readFileSync(pfad, 'utf8'))

export function main(wurzel: string, heute: string): number {
  const neuPfad = `${wurzel}/data/crunchyroll-neu.json`
  if (!existsSync(neuPfad)) {
    console.log('  ✓ Crunchyroll-Neuheiten: keine Datei, nichts zu prüfen')
    return 0
  }
  try {
    const neu = lies(neuPfad) as { folgen: NeueFolge[] }
    const titles = lies(`${wurzel}/public/data/titles.json`) as Title[]
    const events = lies(`${wurzel}/public/data/events.json`) as ReleaseEvent[]
    if (!Array.isArray(neu.folgen) || !Array.isArray(titles) || !Array.isArray(events)) throw new Error('Form unerwartet')
    const fehlt = fehlendeCrFolgen(neu.folgen, titles, events, heute)
    const fremd = unbekannteCrSerien(neu.folgen, titles, heute)
    if (!fehlt.length && !fremd.length) {
      console.log('  ✓ Crunchyroll-Neuheiten: jede deutsche Folge der letzten 10 Tage hat ihren Termin, jede Serie einen Titel')
      return 0
    }
    if (fremd.length) console.log(serienWarnzeile(fremd))
    if (!fehlt.length) return 0
    console.log(bestandWarnzeile('Crunchyroll-Folgen ohne Termin', 'Titel', [...new Set(fehlt.flatMap((f) => f.ids))]))
    for (const f of fehlt) console.log(`    ${f.titel}, ${f.folge}, ${f.tag}`)
    return 0
  } catch (e) {
    console.error(`  ✖ Crunchyroll-Neuheiten: nicht lesbar (${(e as Error).message})`)
    return 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
  process.exit(main(process.argv[2] ?? wurzel, process.argv[3] ?? todayIso()))
}
