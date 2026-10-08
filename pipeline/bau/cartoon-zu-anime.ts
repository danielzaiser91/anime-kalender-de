import type { StreamLink, Title } from '../../shared/types.ts'
import { readJson, writeJson, log, warn } from '../lib/util.ts'
import { findeZwillinge, tmdbJeAnimeAus, ZWILLING_AUSNAHMEN } from '../lib/cartoon-zwilling.ts'
import { alsTitel, type CartoonEintrag } from '../lib/cartoons.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { OUT } from './grundlagen.ts'

/** Gedächtnis der umgezogenen Cartoons als `[Cartoon-Kennung, Anime-Kennung]`; es wächst nur, damit gemerkte Titel auch nach einem Abruf ohne den Cartoon umziehen. */
export const UMZUG_DATEI = 'data/cartoon-umzug.json'

/** Die Dateien, in denen ein Anime-Titel steht (`titles-core.json` ist ein Ausschnitt von `titles.json`, `woche.json` wird danach aus ihm geschnitten). */
const ANIME_DATEIEN = ['titles.json', 'ohne-synchro.json', 'titles-core.json']

/**
 * Die Anbieter des Cartoons (TMDB, Deutschland), die dem Anime-Zwilling fehlen, als Weg ohne Sprachangabe: Der Cartoon nannte nur den Dienst,
 * ob dort Deutsch läuft, sagt allein der Dub-Stand des Anime-Titels. Hat der Anime den Anbieter schon (auch als „nicht mehr im Katalog"), bleibt er unberührt.
 */
export function fehlendeAnbieter(cartoon: Pick<Title, 'streams'>, anime: Partial<Pick<Title, 'streams'>>): StreamLink[] {
  const hat = new Set((anime.streams ?? []).map((s) => s.platform))
  return cartoon.streams.filter((s) => !hat.has(s.platform)).map((s) => ({ platform: s.platform, url: s.url, herkunft: 'tmdb' as const, zugang: 'unbekannt' as const }))
}

function uebernehmeAnbieter(umzug: [number, number][], cartoons: Map<number, Title>): number {
  const ergaenzt = new Set<number>()
  for (const datei of ANIME_DATEIEN) {
    const titel = readJson<Title[]>(`${OUT}/${datei}`, [])
    let geaendert = false
    for (const [cartoonId, animeId] of umzug) {
      const cartoon = cartoons.get(cartoonId)
      const anime = titel.find((t) => t.id === animeId)
      if (!cartoon || !anime) continue
      const neu = fehlendeAnbieter(cartoon, anime)
      if (!neu.length) continue
      anime.streams = [...(anime.streams ?? []), ...neu]
      ergaenzt.add(animeId)
      geaendert = true
    }
    if (geaendert) writeJson(`${OUT}/${datei}`, titel)
  }
  return ergaenzt.size
}

/**
 * **Cartoons, die auch als Anime geführt werden, aus `cartoons.json` nehmen** (Regel und Anlass: `lib/cartoon-zwilling.ts`).
 *
 * Läuft nach `ohne-synchro.json`, denn nur ein Zwilling, der tatsächlich ausgeliefert wird (Hauptbestand oder hinter dem Toggle), darf den
 * Cartoon ersetzen: Ein Vorfilter verschiebt, er löscht nicht. Die Kennung des Cartoons wandert nach `UMZUG_DATEI`; `ausgabe-kennung.ts`
 * macht daraus Einträge in `ak-umleitung.json`. Seine Anbieter gehen nicht verloren (Projektziel 4): `uebernehmeAnbieter`.
 */
export function ordneCartoonsZuAnime(): void {
  const cartoons = readJson<Title[]>(`${OUT}/cartoons.json`, [])
  if (!cartoons.length) return
  const anime = [...readJson<Title[]>(`${OUT}/titles.json`, []), ...readJson<Title[]>(`${OUT}/ohne-synchro.json`, [])]
  const { zwillinge, unsicher } = findeZwillinge(cartoons, anime, tmdbJeAnimeAus(readJson('data/tmdb-titles.json', {})))
  for (const u of unsicher) {
    if (!(u.cartoonId in ZWILLING_AUSNAHMEN)) warn(`Cartoon ${u.cartoonId} hat Anime-Kandidaten ${u.kandidaten.join(', ')}, aber ${u.grund} — in ZWILLING_AUSNAHMEN begründen`)
  }
  const weg = new Set(zwillinge.map((z) => z.cartoonId))
  const mitBeleg = loadDubChecks().filter((b) => weg.has(b.anilistId))
  if (mitBeleg.length) warn(`Handbeleg(e) für umgezogene Cartoons ${[...new Set(mitBeleg.map((b) => b.anilistId))].join(', ')} — auf den Anime-Titel umhängen`)
  if (weg.size) writeJson(`${OUT}/cartoons.json`, cartoons.filter((c) => !weg.has(c.id)))
  const bisher = readJson<[number, number][]>(UMZUG_DATEI, [])
  const bekannt = new Set(bisher.map(([c]) => c))
  const umzug = [...bisher, ...zwillinge.filter((z) => !bekannt.has(z.cartoonId)).map((z) => [z.cartoonId, z.zwilling] as [number, number])]
  if (umzug.length !== bisher.length) writeJson(UMZUG_DATEI, umzug)
  /* Die Anbieter kommen aus dem Cartoon (mit JustWatch-Adresse); ist er schon aus `cartoons.json`, aus dem rohen TMDB-Eintrag. */
  const roh = readJson<Record<string, CartoonEintrag>>('data/cartoons.json', {})
  const quellen = new Map<number, Title>(Object.values(roh).map((e) => [e.id, alsTitel(e)]))
  for (const c of cartoons) quellen.set(c.id, c)
  const mitAnbieter = uebernehmeAnbieter(umzug, quellen)
  if (weg.size) log(`${weg.size} Cartoons sind auch Anime und stehen dort: ${zwillinge.map((z) => `${z.cartoonId}→${z.zwilling}`).join(', ')}; ${mitAnbieter} Anime-Titel bekamen Anbieter des Cartoons dazu`)
}
