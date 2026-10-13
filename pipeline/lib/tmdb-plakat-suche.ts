import { fetchJson, log, readJson, sleep, warn, writeJson } from './util.ts'
import { waehlePlakat, type TmdbBild } from './tmdb-plakat.ts'
import { abrufTag } from './tmdb-ablauf.ts'
import { urteilTreffer, type KeinTreffer, type TmdbTreffer } from './tmdb-suche.ts'
import type { Title } from '../../shared/types.ts'

/** `inhaltAm`: Tag des Abrufs bei TMDB (`lib/tmdb-ablauf.ts`, Erneuerung nach 150 Tagen). */
export type PlakatEintrag = { p: string; w: number; h: number; l: string | null; inhaltAm?: string } | null
export type PlakatBestand = Record<string, PlakatEintrag>

/** Der Bestandseintrag zu einem gewählten Plakat, mit dem Tag des Abrufs. */
export const plakatEintrag = (wahl: TmdbBild): NonNullable<PlakatEintrag> => ({ p: wahl.file_path, w: wahl.width, h: wahl.height, l: wahl.iso_639_1, inhaltAm: abrufTag() })
/** Warum ein Titel kein TMDB-Plakat hat (`data/tmdb-poster-grund.json`); `kandidaten` als `tv/<Kennung>` oder `movie/<Kennung>`. */
export type PlakatGrund = { grund: KeinTreffer | 'kein Plakat'; kandidaten?: string[] }
export type GrundBestand = Record<string, PlakatGrund>

const API = 'https://api.themoviedb.org/3'
export const GRUND_DATEI = 'data/tmdb-poster-grund.json'
/** Gleichzeitige Suchen: etwa 10 Abfragen je Sekunde, weit unter TMDBs Obergrenze (laut Doku rund 50 je Sekunde); ein Titel braucht bis zu vier Suchen nacheinander. */
const ARBEITER = 5
/** Bei mehreren Namen zählt der Grund, der am meisten über den Titel sagt. */
const GRUND_RANG: Record<KeinTreffer, number> = { 'kein Treffer': 0, unsicher: 1, 'mehrere Kandidaten': 2 }

/**
 * Titel, die bei TMDB noch gesucht werden müssen: ohne Plakat im Bestand und ohne vermerkten Grund. Wer schon eine frühere Suche mit
 * leerem Ergebnis hat und ein Cover besitzt, bleibt dabei. Reihenfolge: erst Titel **ohne jedes Cover**, dann Hauptbestand, dann Katalog.
 */
export function titelOhneTmdb(bestand: PlakatBestand, gruende: GrundBestand): Title[] {
  const haupt = readJson<Title[]>('public/data/titles.json', [])
  const katalog = readJson<Title[]>('public/data/ohne-synchro.json', [])
  const gesehen = new Set<number>()
  const offen = [...haupt, ...katalog].filter((t) => {
    if (gesehen.has(t.id)) return false
    gesehen.add(t.id)
    const id = String(t.id)
    return !bestand[id]?.p && !(id in gruende) && !(id in bestand && t.coverImage)
  })
  return [...offen.filter((t) => !t.coverImage), ...offen.filter((t) => t.coverImage)]
}

type SuchErgebnis = { eintrag: PlakatEintrag; grund?: PlakatGrund }

/**
 * Sucht das Plakat eines Titels bei TMDB: Filme unter `/search/movie`, alles andere unter `/search/tv`, nacheinander mit jedem unserer Namen
 * (der erste sichere Treffer gilt, `urteilTreffer`). Ohne sicheren Treffer steht der Grund im Ergebnis.
 */
export async function suchePlakat(apiKey: string, t: Title): Promise<SuchErgebnis> {
  const art = t.format === 'MOVIE' ? 'movie' : 'tv'
  const namen = [t.titleEn, t.titleRomaji, t.titleDe, t.titleNative].filter((n): n is string => Boolean(n))
  let grund: PlakatGrund = { grund: 'kein Treffer' }
  for (const name of [...new Set(namen)]) {
    const such = await fetchJson<{ results?: TmdbTreffer[] }>(`${API}/search/${art}?query=${encodeURIComponent(name)}&api_key=${apiKey}`)
    await sleep(120)
    const urteil = urteilTreffer(namen, t.jpYear, such.results ?? [])
    if (!urteil.treffer) {
      if (GRUND_RANG[urteil.grund!] > GRUND_RANG[grund.grund as KeinTreffer]) grund = { grund: urteil.grund!, kandidaten: urteil.kandidaten.map((k) => `${art}/${k.id}`) }
      continue
    }
    const bilder = await fetchJson<{ posters?: TmdbBild[] }>(`${API}/${art}/${urteil.treffer.id}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`)
    const wahl = waehlePlakat(bilder.posters ?? [])
    if (wahl) return { eintrag: plakatEintrag(wahl) }
    return { eintrag: null, grund: { grund: 'kein Plakat', kandidaten: [`${art}/${urteil.treffer.id}`] } }
  }
  return { eintrag: null, grund }
}

/**
 * Plakate für Titel ohne TMDB-Plakat, in einem Block von höchstens `limit` Titeln und `fristMs` Dauer; was darüber hinausgeht, kommt im nächsten
 * Lauf (der Stand in `bestand` und `gruende` ist die Pause). Ein Fehler lässt den Titel ungesucht, nach 20 Fehlern endet der Block.
 */
export async function plakatSuche(apiKey: string, bestand: PlakatBestand, limit: number, fristMs: number): Promise<number> {
  const gruende = readJson<GrundBestand>(GRUND_DATEI, {})
  const offen = titelOhneTmdb(bestand, gruende)
  const ende = Date.now() + fristMs
  let gesucht = 0
  let gefunden = 0
  let fehler = 0
  const sichern = (): void => {
    writeJson('data/tmdb-poster.json', bestand)
    writeJson(GRUND_DATEI, gruende)
  }
  const schlange = offen.slice(0, limit)
  let naechster = 0
  const arbeiter = async (): Promise<void> => {
    while (naechster < schlange.length && Date.now() < ende && fehler <= 20) {
      const t = schlange[naechster++]!
      try {
        const { eintrag, grund } = await suchePlakat(apiKey, t)
        bestand[String(t.id)] = eintrag
        if (grund) gruende[String(t.id)] = grund
        else delete gruende[String(t.id)]
        if (eintrag) gefunden++
      } catch (e) {
        fehler++
        warn(`TMDB-Plakatsuche ${t.id}: ${(e as Error).message.slice(0, 80)}`)
      }
      gesucht++
      if (gesucht % 100 === 0) sichern()
      await sleep(120)
    }
  }
  await Promise.all(Array.from({ length: ARBEITER }, arbeiter))
  sichern()
  log(`TMDB-Plakatsuche: ${offen.length} offen, ${gesucht} gesucht, ${gefunden} mit Plakat, ${fehler} Fehler`)
  return gefunden
}
