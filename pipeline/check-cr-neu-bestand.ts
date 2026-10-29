/**
 * Bestandswache: Jede neue deutsche Crunchyroll-Folge der letzten 1–10 Tage (`data/crunchyroll-neu.json`) steht als Termin im
 * Kalender (`public/data/events.json`). Fehlt eine, steht eine Zeile „⚠ WARNUNG“ (Exit 0, blockiert keine anderen Daten);
 * hat der Anbieter den Tag selbst verneint (`data/widerlegte-termine.json`), steht nur eine Info-Zeile „widerlegt“ samt Grund (kein „⚠ WARNUNG“).
 * Rot nur bei unlesbarer Eingabe. Bewertung in `lib/cr-neu-wache.ts`, Test `check-cr-neu-wache.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { ReleaseEvent, Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { bestandWarnzeile } from './lib/bestand-warnzeile.ts'
import {
  fehlendeCrFolgen,
  kennungMitGedaechtnis,
  kennzeichneWiderlegte,
  serienWarnzeile,
  unbekannteCrSerien,
  type FehlendeFolge,
  type NeueFolge,
  type WiderlegterTermin,
} from './lib/cr-neu-wache.ts'

const lies = (pfad: string): unknown => JSON.parse(readFileSync(pfad, 'utf8'))
const liesOder = <T>(pfad: string, leer: T): T => (existsSync(pfad) ? (lies(pfad) as T) : leer)

function meldeFehlende(fehlt: FehlendeFolge[]): void {
  const zeile = (f: FehlendeFolge) => `    ${f.titel}, ${f.folge}, ${f.tag}${f.widerlegt ? ` — ${f.widerlegt}` : ''}`
  const echt = fehlt.filter((f) => !f.widerlegt)
  const widerlegt = fehlt.filter((f) => f.widerlegt)
  if (echt.length) {
    console.log(bestandWarnzeile('Crunchyroll-Folgen ohne Termin', 'Titel', [...new Set(echt.flatMap((f) => f.ids))]))
    echt.forEach((f) => console.log(zeile(f)))
  }
  if (widerlegt.length) {
    const titel = [...new Set(widerlegt.flatMap((f) => f.ids))]
    console.log(`  ℹ Crunchyroll-Folgen widerlegt (kein Bau-Fehler): ${titel.length} Titel: ${titel.join(', ')}`)
    widerlegt.forEach((f) => console.log(zeile(f)))
  }
}

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
    const gedaechtnis = liesOder<{ adressen?: Record<string, { seriesId?: string }> }>(`${wurzel}/data/crunchyroll-series-ids.json`, {})
    const kennungVon = kennungMitGedaechtnis(gedaechtnis.adressen ?? {})
    const widerlegt = liesOder<Record<string, WiderlegterTermin>>(`${wurzel}/data/widerlegte-termine.json`, {})
    const releases = liesOder<{ slug: string; titleId: number }[]>(`${wurzel}/public/data/releases.json`, [])
    const fehlt = kennzeichneWiderlegte(fehlendeCrFolgen(neu.folgen, titles, events, heute, kennungVon), widerlegt, releases)
    const fremd = unbekannteCrSerien(neu.folgen, titles, heute, kennungVon)
    if (!fehlt.length && !fremd.length) {
      console.log('  ✓ Crunchyroll-Neuheiten: jede deutsche Folge der letzten 10 Tage hat ihren Termin, jede Serie einen Titel')
      return 0
    }
    if (fremd.length) console.log(serienWarnzeile(fremd))
    meldeFehlende(fehlt)
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
