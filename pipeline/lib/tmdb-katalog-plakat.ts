import { fetchJson, log, readJson, sleep, warn, writeJson } from './util.ts'
import { coverNachRegel, ladeCoverQuellen } from './cover-quelle.ts'
import { waehlePlakat, type TmdbBild } from './tmdb-plakat.ts'
import { besterTreffer, type TmdbTreffer } from './tmdb-suche.ts'
import type { Title } from '../../shared/types.ts'

export type PlakatEintrag = { p: string; w: number; h: number; l: string | null } | null
export type PlakatBestand = Record<string, PlakatEintrag>

const API = 'https://api.themoviedb.org/3'

/** Titel (Katalog und Hauptbestand), die nach der Cover-Regel (TMDB → aniSearch) kein Bild haben und bei TMDB noch nie gesucht wurden. */
export function titelOhneCover(bestand: PlakatBestand): Title[] {
  const q = ladeCoverQuellen()
  const alle = [...readJson<Title[]>('public/data/titles.json', []), ...readJson<Title[]>('public/data/ohne-synchro.json', [])]
  const gesehen = new Set<number>()
  return alle.filter((t) => {
    if (gesehen.has(t.id)) return false
    gesehen.add(t.id)
    return !(String(t.id) in bestand) && coverNachRegel(t.id, t.anisearchId, q) === undefined
  })
}

/**
 * Sucht das Plakat eines Titels bei TMDB: Filme unter `/search/movie`, alles andere unter `/search/tv`, nacheinander mit jedem unserer Namen
 * (der erste sichere Treffer gilt, `besterTreffer`). `null`: kein sicherer Treffer oder kein Hochformat.
 */
export async function suchePlakat(apiKey: string, t: Title): Promise<PlakatEintrag> {
  const art = t.format === 'MOVIE' ? 'movie' : 'tv'
  const namen = [t.titleEn, t.titleRomaji, t.titleDe, t.titleNative].filter((n): n is string => Boolean(n))
  for (const name of [...new Set(namen)]) {
    const such = await fetchJson<{ results?: TmdbTreffer[] }>(`${API}/search/${art}?query=${encodeURIComponent(name)}&api_key=${apiKey}`)
    await sleep(120)
    const treffer = besterTreffer(namen, t.jpYear, such.results ?? [])
    if (!treffer) continue
    const bilder = await fetchJson<{ posters?: TmdbBild[] }>(`${API}/${art}/${treffer.id}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`)
    const wahl = waehlePlakat(bilder.posters ?? [])
    return wahl ? { p: wahl.file_path, w: wahl.width, h: wahl.height, l: wahl.iso_639_1 } : null
  }
  return null
}

/**
 * Plakate für Titel ohne Cover, in einem Block von höchstens `limit` Titeln und `fristMs` Dauer; was darüber hinausgeht, kommt im nächsten Lauf
 * (die Pause ist der Stand in `bestand`). Ein Fehler lässt den Titel ungesucht, nach 20 Fehlern endet der Block.
 */
export async function katalogPlakate(apiKey: string, bestand: PlakatBestand, limit: number, fristMs: number): Promise<number> {
  const offen = titelOhneCover(bestand)
  const ende = Date.now() + fristMs
  let gesucht = 0
  let gefunden = 0
  let fehler = 0
  for (const t of offen.slice(0, limit)) {
    if (Date.now() > ende || fehler > 20) break
    try {
      const eintrag = await suchePlakat(apiKey, t)
      bestand[String(t.id)] = eintrag
      if (eintrag) gefunden++
    } catch (e) {
      fehler++
      warn(`TMDB-Katalogplakat ${t.id}: ${(e as Error).message.slice(0, 80)}`)
    }
    gesucht++
    if (gesucht % 100 === 0) writeJson('data/tmdb-poster.json', bestand)
    await sleep(120)
  }
  log(`TMDB-Plakate für Titel ohne Cover: ${offen.length} offen, ${gesucht} gesucht, ${gefunden} mit Plakat, ${fehler} Fehler`)
  return gefunden
}
