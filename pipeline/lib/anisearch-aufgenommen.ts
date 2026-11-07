import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'

/**
 * **aniSearch-Seiten, die in einem AniList-Titel aufgehen** (`data/anisearch-seiten-aufgenommen.yaml`, Seite → AniList-Kennung): Der Titel führt das Werk
 * vollständig, aniSearch teilt es auf mehrere Seiten, und die Seite bekommt keine eigene Zeile. Anders als die Teilung (`bau/mal-teilung.ts`) bleibt der
 * AniList-Titel stehen; die Seiten stehen nicht allein für sich, weil die Handdatei ihre Summe nicht belegt (eine Seite fehlt in den Einträgen).
 */
export function leseAufgenommeneSeiten(wurzel: string = ROOT): Record<number, number> {
  const pfad = resolve(wurzel, 'data', 'anisearch-seiten-aufgenommen.yaml')
  /* Test-Kulissen (`AK_ROOT`) kennen die Datei nicht: ohne sie geht keine Seite auf. */
  if (!existsSync(pfad)) return {}
  const roh = yaml.load(readFileSync(pfad, 'utf8')) as Record<string, unknown> | null
  const raus: Record<number, number> = {}
  for (const [seite, titel] of Object.entries(roh ?? {})) {
    if (!Number.isInteger(Number(seite)) || !Number.isInteger(titel)) throw new Error(`data/anisearch-seiten-aufgenommen.yaml: „${seite}: ${String(titel)}“ ist keine Zuordnung Seite → AniList-Kennung`)
    raus[Number(seite)] = titel as number
  }
  return raus
}

export const aufgenommeneSeiten: Record<number, number> = leseAufgenommeneSeiten()
