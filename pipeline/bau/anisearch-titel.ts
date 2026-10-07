import { log, readJson } from '../lib/util.ts'
import type { DubConfidence, Title } from '../../shared/types.ts'
import { anisearchHand } from './grundlagen.ts'
import { slugify } from '../lib/util.ts'

/**
 * **Titel, die nur bei aniSearch stehen** (Daniel, 06.10.2026: „wir nehmen alle Kennungen von aniSearch und tragen alle Titel so ein, wie
 * aniSearch es tut"). AniList fasst manches zusammen, was aniSearch einzeln führt — Specials einer Serie, Teile einer Staffel — und führt
 * anderes gar nicht (westliche Serien, Filme, Web-Produktionen).
 *
 * Quelle ist `data/anisearch-eintraege.json` (Kennung → kompakter Eintrag aus `/v1/anime/<Kennung>`, ohne Hentai). Der Titel bekommt die
 * Kennung `ANISEARCH_ID_BASIS + aniSearch-Kennung`; AniList-Kennungen liegen weit darunter, die Cartoons nutzen negative. Er trägt **kein Cover**
 * (die Bilder bei aniSearch sind nicht zur Weitergabe freigegeben) und keine MAL-Kennung (sie gehört der Hauptfassung, sonst verwechselt der
 * Bau beide). Wo aniSearch Deutsch nicht kennt (`-`), bleibt er hinter dem Toggle (`anisearchNurKatalog`).
 */
export const ANISEARCH_ID_BASIS = 10_000_000

type Eintrag = {
  t: string
  n?: string
  de?: string
  en?: string
  ty: string
  y?: number
  f?: number
  min?: number
  von?: string
  bis?: string
  mal?: number
  st?: string[]
  /** Deutsch bei aniSearch: `d` vertont, `p` geplant, `c` abgebrochen, `-` nicht genannt. */
  dub: 'd' | 'p' | 'c' | '-'
  pub?: string[]
  dvon?: string
}

const FORMAT: Record<string, string> = { 'TV-Series': 'TV', Movie: 'MOVIE', OVA: 'OVA', 'TV-Special': 'SPECIAL', Web: 'ONA', Bonus: 'SPECIAL', Other: 'SPECIAL' }
const SICHERHEIT: Record<Eintrag['dub'], DubConfidence> = { d: 'high', p: 'normal', c: 'normal', '-': 'low' }

let eintraege: Record<string, Eintrag> | undefined
const alle = (): Record<string, Eintrag> => (eintraege ??= readJson<Record<string, Eintrag>>('data/anisearch-eintraege.json', {}))

/** Ausschließlich im Katalog: Einträge, bei denen aniSearch kein Deutsch nennt. */
export function anisearchNurKatalog(): Set<number> {
  return new Set(Object.entries(alle()).filter(([, e]) => e.dub === '-').map(([id]) => ANISEARCH_ID_BASIS + Number(id)))
}

/** Legt die Titel an, die bei uns noch keine eigene aniSearch-Kennung tragen. Gibt zurück, wie viele es sind. */
export function ergaenzeAnisearchTitel(titles: Map<number, Title>, jpStart: Map<number, string>, jpStartAnzeige: Map<number, string>): number {
  const vergeben = new Set<number>(Object.values(anisearchHand))
  for (const e of Object.values(readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {}))) if (e.anisearchId) vergeben.add(e.anisearchId)
  let neu = 0
  for (const [schluessel, e] of Object.entries(alle())) {
    const asId = Number(schluessel)
    if (vergeben.has(asId)) continue
    const id = ANISEARCH_ID_BASIS + asId
    const anzeige = e.de ?? e.en ?? e.t
    titles.set(id, {
      id,
      slug: `${slugify(anzeige)}-${id}`,
      titleRomaji: e.t,
      titleEn: e.en,
      /* Ein deutscher Name mit angehängter Staffel- oder Teilnummer bleibt weg (`check:logic`: kein Titel trägt die Nummer eines seiner Teile im Namen); es gilt der englische. */
      titleDe: e.de && !/[–—-]\s*(staffel|season|vol\.?|teil|part)\s*\d+\s*$/i.test(e.de) ? e.de : undefined,
      titleNative: e.n,
      format: FORMAT[e.ty] ?? 'SPECIAL',
      episodes: e.f,
      jpYear: e.y,
      jpEnd: e.bis ?? e.von,
      genres: [],
      keywords: [],
      studios: e.st ?? [],
      dubConfidence: SICHERHEIT[e.dub],
      streams: [],
      ...(e.dub !== '-' ? { deErstausgabe: { ...(e.dvon && /^\d{4}-\d{2}-\d{2}$/.test(e.dvon) ? { von: e.dvon } : {}), publisher: e.pub?.[0], synchro: e.dub === 'd' } } : {}),
    } as Title)
    if (e.von) {
      jpStart.set(id, e.von)
      jpStartAnzeige.set(id, e.von)
    }
    neu++
  }
  if (neu) log(`${neu} Titel nur bei aniSearch ergänzt (${anisearchNurKatalog().size} davon ohne Deutsch, nur im Katalog)`)
  return neu
}

/** Reihen-Kanten: Ein aniSearch-Titel gehört zur Reihe des Titels, der seine MAL-Kennung trägt. */
export function anisearchReihenKanten(titles: Map<number, Title>): { ids: number[] }[] {
  const nachMal = new Map<number, number>()
  for (const t of titles.values()) if (t.malId && t.id < ANISEARCH_ID_BASIS) nachMal.set(t.malId, t.id)
  const kanten: { ids: number[] }[] = []
  for (const [schluessel, e] of Object.entries(alle())) {
    const hauptId = e.mal ? nachMal.get(e.mal) : undefined
    const id = ANISEARCH_ID_BASIS + Number(schluessel)
    if (hauptId && titles.has(id)) kanten.push({ ids: [hauptId, id] })
  }
  return kanten
}
