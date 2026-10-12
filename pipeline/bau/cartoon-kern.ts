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

/** Meldungsarten, die ein Cartoon haben darf: nur Termine mit Quelle, keine Anime-Meldung (`check-cartoon-news.ts`; eine neue Termin-Art gehört hierher). */
export const CARTOON_NEWS_ARTEN: ReadonlySet<string> = new Set(['angekuendigt', 'nachgetragen', 'disc', 'kino', 'rhythmus'])

/** Die Cartoons, zu denen ein Termin vorliegt — ihre Quellen gehören in die Neuigkeiten des Titels (Avatar: Die sieben Häfen, 11.10.2026). */
export function cartoonsAusReleases(releases: { titleId: number }[]): Title[] {
  return cartoonsMitTermin(readJson<Title[]>(`${OUT}/cartoons.json`, []), new Set(releases.map((r) => r.titleId)))
}

/** Schreibt `titles-core.json`: die Anime-Titel mit Termin, mit Ankündigung (die Saison-Ansicht liest nur den Kern, Daniel 08.10.2026), dazu die Cartoons mit Termin. */
export function schreibeKern<T extends Title>(slim: T[], titelIds: Set<number>): void {
  const anime = slim.filter((t) => titelIds.has(t.id)).map(mitAnkuendigung)
  const cartoons = cartoonsMitTermin(readJson<Title[]>(`${OUT}/cartoons.json`, []), titelIds)
  writeJson(`${OUT}/titles-core.json`, [...anime, ...cartoons])
}
