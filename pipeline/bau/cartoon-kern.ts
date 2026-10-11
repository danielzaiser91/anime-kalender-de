import type { Title } from '../../shared/types.ts'
import { readJson, writeJson } from '../lib/util.ts'
import { mitAnkuendigung, OUT } from './grundlagen.ts'

/**
 * Cartoons mit Termin gehören in den Kern (`titles-core.json`): Der Kalender und die Wochen-Datei lesen nur ihn, und `cartoons.json`
 * lädt die Seite erst für die Datenbank. Ohne den Titel hätte ein Cartoon-Termin (Avatar: Die sieben Häfen, 09.10.2026) kein Cover und keinen Namen.
 */
export function cartoonsMitTermin(cartoons: Title[], titelIds: Set<number>): Title[] {
  return cartoons.filter((t) => titelIds.has(t.id))
}

/** Schreibt `titles-core.json`: die Anime-Titel mit Termin, mit Ankündigung (die Saison-Ansicht liest nur den Kern, Daniel 08.10.2026), dazu die Cartoons mit Termin. */
export function schreibeKern<T extends Title>(slim: T[], titelIds: Set<number>): void {
  const anime = slim.filter((t) => titelIds.has(t.id)).map(mitAnkuendigung)
  const cartoons = cartoonsMitTermin(readJson<Title[]>(`${OUT}/cartoons.json`, []), titelIds)
  writeJson(`${OUT}/titles-core.json`, [...anime, ...cartoons])
}
