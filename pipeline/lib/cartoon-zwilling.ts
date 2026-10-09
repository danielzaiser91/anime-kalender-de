/**
 * **Ein Werk, das auch als Anime geführt wird, ist kein Cartoon** (Daniel, 08.10.2026: „Wenn es auch als Anime von aniSearch, AniList
 * oder MAL kommt, dann ist es ein Anime und kein Cartoon.", Anlass: Rooster Fighter stand als Anime und als Cartoon im Bestand).
 *
 * Die Cartoon-Pipeline legt TMDB-Titel an, ohne den Anime-Bestand zu kennen. Dieses Modul vergleicht rein (keine Dateizugriffe) die
 * Cartoons mit den ausgelieferten Anime-Titeln (AniList-Titel und aniSearch-Titel `10_000_000+id`; MAL hängt an beiden als `malId`).
 * Ein Cartoon hat keine MAL-Kennung; die MAL-Kennung des Zwillings ist Teil des Ergebnisses, nicht des Vergleichs.
 *
 * Belegt ist ein Zwilling nur, wenn **Jahr (±1) und Folgenzahl** zum Anime passen und dazu entweder die TMDB-Kennung aus
 * `data/tmdb-titles.json` (Vorrang) oder der volle, normalisierte Name gleich ist. Ein Name allein genügt nie. Passt die Folgenzahl nicht,
 * bleibt der Cartoon stehen und steht in `unsicher` (im Zweifel nicht zusammenlegen).
 */
import type { Title } from '../../shared/types.ts'
import { titelSchluessel } from './zuordnung.ts'

export type Zwilling = { cartoonId: number; zwilling: number; beleg: 'tmdb-kennung' | 'name-jahr-folgen'; mal?: number }
export type Unsicher = { cartoonId: number; kandidaten: number[]; grund: string }

/** Ab hier beginnen die aniSearch-Titel; darunter stehen AniList-Kennungen. */
const ANISEARCH_AB = 10_000_000

/**
 * Cartoons, die trotz gleichnamigem Anime-Eintrag Cartoons bleiben oder noch ungeklärt sind — mit Grund. Ein Eintrag hier ist eine Aussage,
 * die jemand an der Quelle nachgesehen hat; ein neuer `unsicher`-Fall ohne Eintrag macht `check:cartoon-zwilling` rot.
 */
export const ZWILLING_AUSNAHMEN: Record<number, string> = {
  /* Stand 09.10.2026, je am Datensatz abgelesen (Jahr, Folgenzahl, Kandidat): gleicher Name, anderes Werk. */
  [-114466]: 'Baymax! (2022, 6 Folgen) ist die Serie, AniList-Kandidat 10009974 „Baymax“ (2014, 1 Folge) ein anderes Werk',
  [-63090]: 'Transformers: Robots in Disguise 2015 (71 Folgen) ist nicht die Serie von 2000 (AniList 2284, 39 Folgen)',
  [-62475]: 'Heidi (2015, 91 Folgen, CGI) ist nicht Heidi, Girl of the Alps (1974, AniList 2225)',
  [-44931]: 'Superbook (2011, 68 Folgen) ist nicht die Serie von 1981 (AniList 2882)',
  [-35335]: 'The Jungle Book (2010, 156 Folgen) ist nicht die Serie von 1989 (AniList 2569)',
  [-13247]: 'Sylvanian Families (2018, 62 Folgen) ist nicht die Kurzreihe Calico Critters: Mini Episodes (2017, 12 Folgen, AniList 187052); die TMDB-Zuordnung in tmdb-titles.json trifft hier daneben',
  [-87247]: 'ungeklärt: TMDB „Bakugan“ (2018, 338 Folgen) könnte Bakugan: Battle Planet (2019, 50 Folgen, AniList 108852) enthalten; die Folgenzahlen belegen es nicht, deshalb nicht zusammengelegt',
}

const jahrPasst = (a?: number, b?: number): boolean => a !== undefined && b !== undefined && Math.abs(a - b) <= 1

/** Gleich oder ein ganzes Vielfaches (TMDB zählt Staffeln, AniList Teile einzeln: Devil May Cry 16 gegen 8); fehlt eine Angabe, entscheidet sie nichts. */
export const folgenPassen = (cartoon?: number, anime?: number): boolean =>
  !cartoon || !anime || cartoon === anime || (cartoon > anime && cartoon % anime === 0)

const schluessel = (namen: (string | undefined)[]): Set<string> => new Set(namen.map((n) => titelSchluessel(n ?? '')).filter((s) => s.length >= 4))

/**
 * @param tmdbJeAnime TMDB-Kennung (Serie) → Anime-Kennungen, die `data/tmdb-titles.json` ihr zuordnet
 */
export function findeZwillinge(cartoons: Title[], anime: Title[], tmdbJeAnime: Map<number, number[]>): { zwillinge: Zwilling[]; unsicher: Unsicher[] } {
  const nachId = new Map(anime.map((t) => [t.id, t]))
  const nachName = new Map<string, Title[]>()
  for (const t of anime) for (const s of schluessel([t.titleRomaji, t.titleEn, t.titleDe])) nachName.set(s, [...(nachName.get(s) ?? []), t])
  const zwillinge: Zwilling[] = []
  const unsicher: Unsicher[] = []
  for (const c of cartoons) {
    const ueberKennung = (tmdbJeAnime.get(c.tmdbId ?? -1) ?? []).flatMap((id) => nachId.get(id) ?? [])
    const kandidaten = ueberKennung.length
      ? ueberKennung
      : [...new Set([...schluessel([c.titleEn, c.titleDe])].flatMap((s) => nachName.get(s) ?? []))]
    if (!kandidaten.length) continue
    const jahrOk = (t: Title) => jahrPasst(c.jpYear, t.jpYear) || (ueberKennung.length > 0 && (c.jpYear === undefined || t.jpYear === undefined))
    const passend = kandidaten.filter((t) => jahrOk(t) && folgenPassen(c.episodes, t.episodes))
    const ids = kandidaten.map((t) => t.id)
    /* Mehrere Treffer: ein AniList-Titel schlägt aniSearch-Titel; bleiben mehrere gleichrangige, ist es unklar. */
    const anilist = passend.filter((t) => t.id < ANISEARCH_AB)
    const rang = anilist.length ? anilist : passend
    if (rang.length === 1) {
      const t = rang[0]!
      zwillinge.push({ cartoonId: c.id, zwilling: t.id, beleg: ueberKennung.length ? 'tmdb-kennung' : 'name-jahr-folgen', ...(t.malId ? { mal: t.malId } : {}) })
    } else {
      unsicher.push({ cartoonId: c.id, kandidaten: ids, grund: rang.length ? 'mehrere gleichrangige Treffer' : 'Jahr oder Folgenzahl passen nicht' })
    }
  }
  return { zwillinge, unsicher }
}

/** TMDB-Kennung → Anime-Kennungen aus `data/tmdb-titles.json` (nur Serien). */
export function tmdbJeAnimeAus(roh: Record<string, { tmdbId?: number; kind?: string }>): Map<number, number[]> {
  const karte = new Map<number, number[]>()
  for (const [id, e] of Object.entries(roh)) {
    if (e.kind !== 'tv' || !e.tmdbId) continue
    karte.set(e.tmdbId, [...(karte.get(e.tmdbId) ?? []), Number(id)])
  }
  return karte
}
