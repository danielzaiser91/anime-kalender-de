/**
 * Anbieter-Listen bei JustWatch („Joyn + Animation“): Ein Titel, den die Liste eines Anbieters führt, unser JustWatch-Befund aber ohne dessen Angebot
 * kennt, kommt vor der 28-Tage-Frist wieder dran (One Piece, Clannad, Hyouka, 04.11.2026: Befund vom 19.10., Joyn-Angebot seither).
 * Die Liste kostet `ceil(Titel / 100)` Abrufe je Lauf, gefragt wird nur nach der TMDB-Kennung; die Angebote holt der übliche Abruf je Titel.
 * Eine weitere Liste ist eine Zeile in `ANBIETERLISTEN`; aktiv ist nur Joyn. Bei den Anbietern selbst wird nie abgerufen (Joyn: TDM-Vorbehalt).
 */
import type { Title } from '../../shared/types.ts'
import { warn } from './util.ts'

export interface AnbieterListe {
  /** Name des Anbieters am Angebot im Befund (Anfang, ohne Groß-/Kleinschreibung: „Joyn“ und „Joyn Plus“). */
  anbieter: string
  /** JustWatch-Kürzel des Anbieters (`packages`) und der Gattung (`genres`). */
  paket: string
  genre: string
  aktiv: boolean
}

export const ANBIETERLISTEN: AnbieterListe[] = [{ anbieter: 'Joyn', paket: 'jyn', genre: 'ani', aktiv: true }]

/** Harter Riegel je Liste: 5 Seiten à 100 Titel (Joyn hat 198, 04.11.2026). */
export const LISTE_SEITEN_MAX = 5
/** Ein Titel, der nach einem Abruf trotz Listeneintrag kein Angebot des Anbieters zeigt, wird frühestens nach so vielen Tagen erneut gefragt. */
export const LISTE_ALTER_TAGE = 7

const TAG = 86_400_000

export interface ListenSeite {
  tmdbIds: string[]
  /** Fortsetzungsmarke; fehlt sie, war es die letzte Seite. */
  weiter?: string
}

/** Holt eine Seite der Liste (`nach` = Marke der Vorseite); im Betrieb ein GraphQL-Abruf, im Test eine Attrappe. */
export type SeiteHolen = (liste: AnbieterListe, nach?: string) => Promise<ListenSeite>

/** TMDB-Kennungen (Zeichenketten) der Liste, höchstens `LISTE_SEITEN_MAX` Seiten. Gibt `abrufe` zurück, damit der Lauf sie zählen kann. */
export async function holeListe(liste: AnbieterListe, seite: SeiteHolen, pause: () => Promise<void>): Promise<{ tmdbIds: Set<string>; abrufe: number }> {
  const tmdbIds = new Set<string>()
  let nach: string | undefined
  let abrufe = 0
  do {
    if (abrufe) await pause()
    const s = await seite(liste, nach)
    abrufe++
    for (const id of s.tmdbIds) tmdbIds.add(String(id))
    nach = s.weiter
  } while (nach && abrufe < LISTE_SEITEN_MAX)
  return { tmdbIds, abrufe }
}

interface BefundKurz {
  geprueftAm: string
  angebote?: { anbieter: string }[]
}

/**
 * Titel, die die Liste führt, deren Befund den Anbieter nicht kennt und mindestens `LISTE_ALTER_TAGE` alt ist.
 * Ohne Befund: nicht hier (die übliche Schlange fragt sie ohnehin zuerst).
 */
export function listenVorrang(
  liste: AnbieterListe,
  tmdbIds: ReadonlySet<string>,
  titles: Title[],
  bestand: Record<string, BefundKurz>,
  tmdbVon: (t: Title) => number | undefined,
  heute: string,
): Set<number> {
  const vor = new Set<number>()
  const name = liste.anbieter.toLowerCase()
  for (const t of titles) {
    const tmdb = tmdbVon(t)
    const e = bestand[String(t.id)]
    if (!tmdb || !e || !tmdbIds.has(String(tmdb))) continue
    if ((e.angebote ?? []).some((a) => a.anbieter.toLowerCase().startsWith(name))) continue
    if ((Date.parse(heute) - Date.parse(e.geprueftAm)) / TAG >= LISTE_ALTER_TAGE) vor.add(t.id)
  }
  return vor
}

const LISTE_ABFRAGE = `
query Liste($country: Country!, $language: Language!, $after: String, $f: TitleFilter) {
  popularTitles(country: $country, first: 100, after: $after, filter: $f, sortBy: POPULAR) {
    pageInfo { hasNextPage endCursor }
    edges { node { content(country: $country, language: $language) { externalIds { tmdbId } } } }
  }
}`

interface ListeAntwort {
  errors?: { message: string }[]
  data?: {
    popularTitles?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
      edges?: { node: { content?: { externalIds?: { tmdbId?: string | number | null } | null } | null } }[]
    }
  }
}

/** Der echte Abruf einer Listenseite beim JustWatch-Endpunkt (derselbe wie im Titel-Abruf). */
export function seiteVonJustWatch(endpunkt: string, userAgent: string, abrufen: <T>(url: string, init: RequestInit) => Promise<T>): SeiteHolen {
  return async (liste, nach) => {
    const body = { query: LISTE_ABFRAGE, variables: { country: 'DE', language: 'de', after: nach ?? null, f: { packages: [liste.paket], genres: [liste.genre] } } }
    const j = await abrufen<ListeAntwort>(endpunkt, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': userAgent },
      body: JSON.stringify(body),
    })
    if (j.errors?.length) throw new Error(j.errors[0].message)
    const p = j.data?.popularTitles
    const tmdbIds = (p?.edges ?? []).map((e) => e.node.content?.externalIds?.tmdbId).filter((x): x is string | number => x != null).map(String)
    return { tmdbIds, weiter: p?.pageInfo?.hasNextPage ? (p.pageInfo.endCursor ?? undefined) : undefined }
  }
}

/**
 * Alle aktiven Listen holen und den Vorrang bilden. Ein Fehler beim Abruf (Sperre, Netz) lässt die Liste aus: der Lauf fragt dann wie bisher
 * nach Alter, nichts geht verloren. `abrufe` ist die Zahl der Listenabrufe dieses Laufs (für die Logzeile).
 */
export async function listenVorrangAbrufen(
  listen: AnbieterListe[],
  seite: SeiteHolen,
  pause: () => Promise<void>,
  titles: Title[],
  bestand: Record<string, BefundKurz>,
  tmdbVon: (t: Title) => number | undefined,
  heute: string,
): Promise<{ vorrang: Set<number>; abrufe: number }> {
  const vorrang = new Set<number>()
  let abrufe = 0
  for (const liste of listen.filter((l) => l.aktiv)) {
    try {
      if (abrufe) await pause()
      const r = await holeListe(liste, seite, pause)
      abrufe += r.abrufe
      for (const id of listenVorrang(liste, r.tmdbIds, titles, bestand, tmdbVon, heute)) vorrang.add(id)
    } catch (e) {
      abrufe++
      warn(`JustWatch-Liste ${liste.anbieter}: ${(e as Error).message} — ausgelassen.`)
    }
  }
  return { vorrang, abrufe }
}
