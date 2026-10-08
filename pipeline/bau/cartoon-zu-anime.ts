import type { Title } from '../../shared/types.ts'
import { readJson, writeJson, log, warn } from '../lib/util.ts'
import { findeZwillinge, tmdbJeAnimeAus, ZWILLING_AUSNAHMEN } from '../lib/cartoon-zwilling.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { OUT } from './grundlagen.ts'

/** Gedächtnis der umgezogenen Cartoons als `[Cartoon-Kennung, Anime-Kennung]`; es wächst nur, damit gemerkte Titel auch nach einem Abruf ohne den Cartoon umziehen. */
export const UMZUG_DATEI = 'data/cartoon-umzug.json'

/**
 * **Cartoons, die auch als Anime geführt werden, aus `cartoons.json` nehmen** (Regel und Anlass: `lib/cartoon-zwilling.ts`).
 *
 * Läuft nach `ohne-synchro.json`, denn nur ein Zwilling, der tatsächlich ausgeliefert wird (Hauptbestand oder hinter dem Toggle), darf den
 * Cartoon ersetzen: Ein Vorfilter verschiebt, er löscht nicht. Die Kennung des Cartoons wandert nach `UMZUG_DATEI`; `ausgabe-kennung.ts`
 * macht daraus Einträge in `ak-umleitung.json`.
 */
export function ordneCartoonsZuAnime(): void {
  const cartoons = readJson<Title[]>(`${OUT}/cartoons.json`, [])
  if (!cartoons.length) return
  const anime = [...readJson<Title[]>(`${OUT}/titles.json`, []), ...readJson<Title[]>(`${OUT}/ohne-synchro.json`, [])]
  const { zwillinge, unsicher } = findeZwillinge(cartoons, anime, tmdbJeAnimeAus(readJson('data/tmdb-titles.json', {})))
  for (const u of unsicher) {
    if (!(u.cartoonId in ZWILLING_AUSNAHMEN)) warn(`Cartoon ${u.cartoonId} hat Anime-Kandidaten ${u.kandidaten.join(', ')}, aber ${u.grund} — in ZWILLING_AUSNAHMEN begründen`)
  }
  if (!zwillinge.length) return
  const weg = new Set(zwillinge.map((z) => z.cartoonId))
  const mitBeleg = loadDubChecks().filter((b) => weg.has(b.anilistId))
  if (mitBeleg.length) warn(`Handbeleg(e) für umgezogene Cartoons ${[...new Set(mitBeleg.map((b) => b.anilistId))].join(', ')} — auf den Anime-Titel umhängen`)
  writeJson(`${OUT}/cartoons.json`, cartoons.filter((c) => !weg.has(c.id)))
  const bisher = readJson<[number, number][]>(UMZUG_DATEI, [])
  const bekannt = new Set(bisher.map(([c]) => c))
  writeJson(UMZUG_DATEI, [...bisher, ...zwillinge.filter((z) => !bekannt.has(z.cartoonId)).map((z) => [z.cartoonId, z.zwilling] as [number, number])])
  log(`${zwillinge.length} Cartoons sind auch Anime und stehen dort: ${zwillinge.map((z) => `${z.cartoonId}→${z.zwilling}`).join(', ')}`)
}
