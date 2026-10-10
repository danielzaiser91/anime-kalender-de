import type { Title } from '../../shared/types.ts'
import type { AniListMedia } from '../lib/anilist.ts'
import type { AnisearchEintrag } from './01-quellen.ts'
import { FORMAT } from './anisearch-titel.ts'

/**
 * **aniSearch als zweite Spalte neben AniList** (Stufe B der AniList-Ablösung, 10.10.2026): dieselben Felder aus beiden Quellen, Feld für Feld
 * verglichen. Nur Messung — ausgeliefert wird weiter der AniList-Wert. Reine Funktionen; geschrieben wird in `anisearch-abweichungen.ts`.
 */
export type Spalte = {
  titleRomaji?: string
  titleEn?: string
  titleNative?: string
  format?: string
  episodes?: number
  jpYear?: number
  jpSeason?: string
  jpEnd?: string
  status?: string
  studios?: string[]
  synopsis?: boolean
  malId?: number[]
}
export type FeldName = keyof Spalte
export type Urteil = 'gleich' | 'abweichend' | 'nurAnilist' | 'nurAnisearch' | 'beideLeer'

/** aniSearchs Sprachzeile: `titleNative` steht in den Daten, fehlte aber im Typ. */
type Sprache = NonNullable<NonNullable<AnisearchEintrag['info']>['languages']>[number] & { titleNative?: string }
/** Felder der Eintragsdatei, die der Typ `AnisearchEintrag` bisher nicht nennt. */
type Info = NonNullable<AnisearchEintrag['info']> & { format?: string; season?: string; studios?: string[] }

const SAISON: Record<string, string> = { Winter: 'WINTER', Frühling: 'SPRING', Sommer: 'SUMMER', Herbst: 'FALL' }
const STATUS: Record<string, string> = { Abgeschlossen: 'FINISHED', Laufend: 'RELEASING', Zukünftig: 'NOT_YET_RELEASED', Abgebrochen: 'CANCELLED', Pausiert: 'HIATUS' }
/** Länder, unter denen aniSearch die Ursprungsfassung führt, wenn sie nicht japanisch ist. */
const URSPRUNGSLAENDER = new Set(['China', 'Südkorea', 'Hong Kong', 'Taiwan', 'Nordkorea', 'Indonesien'])

/** `04.10.2003`, `10.2003`, `2003` → ISO so genau wie die Angabe; `?` und Leeres → undefined. */
export function aniSearchDatum(s: string | undefined): string | undefined {
  const m = s?.trim().match(/^(?:(?:(\d{2})\.)?(\d{2})\.)?(\d{4})$/)
  return m ? [m[3], m[2], m[1]].filter(Boolean).join('-') : undefined
}

/** „04.10.2003 - 02.10.2004": Beginn und Ende; ein einzelnes Datum ist nur der Beginn. */
export function aniSearchZeitraum(released: string | undefined): { von?: string; bis?: string } {
  const [von, bis] = (released ?? '').split(' - ')
  return { von: aniSearchDatum(von), bis: aniSearchDatum(bis) }
}

/**
 * aniSearchs Winter über den Jahreswechsel („1997/98") nach AniList-Art, abgeleitet aus dem Beginn: Januar/Februar sind WINTER des Startjahres,
 * ein Dezember-Start FALL des Startjahres (gemessen 10.10.2026 an 2.910 AniList-Titeln: Dezember 113 FALL gegen 48 WINTER; Rurouni-Kenshin-Film
 * 20.12.1997 = FALL 1997). Ohne Beginn oder bei anderem Monat bleibt der Schluss auf das spätere Jahr der Angabe.
 */
export function winterAnilistArt(jahresangabe: string, von: string | undefined): { jahr: number; saison: string } | undefined {
  const m = jahresangabe.match(/^(\d{4})\/(\d{2})$/)
  if (!m) return undefined
  const monat = Number(von?.slice(5, 7))
  const startJahr = Number(von?.slice(0, 4))
  if (monat === 12) return { jahr: startJahr, saison: 'FALL' }
  if (monat === 1 || monat === 2) return { jahr: startJahr, saison: 'WINTER' }
  const jahr = Number(m[1])
  const spaet = Math.floor(jahr / 100) * 100 + Number(m[2])
  return { jahr: spaet < jahr ? spaet + 100 : spaet, saison: 'WINTER' }
}

/** Die Zeile der Ursprungsfassung (Japanisch, sonst das Herkunftsland). */
const ursprung = (sprachen: Sprache[]): Sprache | undefined => sprachen.find((l) => l.language === 'Japanisch') ?? sprachen.find((l) => URSPRUNGSLAENDER.has(l.language ?? ''))

/** Die aniSearch-Spalte eines Eintrags; `mal` sind die Kennungen, die aniSearchs eigene Brücke diesem Eintrag zuordnet. */
export function anisearchSpalte(e: AnisearchEintrag, mal: number[] = []): Spalte {
  const info = e.info as Info | undefined
  const sprachen = (info?.languages ?? []) as Sprache[]
  const jp = ursprung(sprachen)
  const { von, bis } = aniSearchZeitraum(jp?.released)
  const [saison, saisonJahr] = (info?.season ?? '').split(' ')
  const winter = saison === 'Winter' && saisonJahr ? winterAnilistArt(saisonJahr, von) : undefined
  const jahr = winter?.jahr ?? (saisonJahr ? Number(saisonJahr.slice(0, 4)) : von ? Number(von.slice(0, 4)) : undefined)
  return {
    titleRomaji: jp?.title,
    titleEn: sprachen.find((l) => l.language === 'Englisch')?.title,
    titleNative: jp?.titleNative,
    format: info?.format ? FORMAT[info.format] : undefined,
    episodes: info?.episodes && info.episodes > 0 ? info.episodes : undefined,
    jpYear: jahr && Number.isFinite(jahr) ? jahr : undefined,
    jpSeason: winter?.saison ?? (saison ? SAISON[saison] : undefined),
    jpEnd: bis ?? von,
    status: jp?.status ? STATUS[jp.status] : undefined,
    studios: info?.studios,
    synopsis: !!e.descriptionDe,
    malId: mal,
  }
}

const genau = (d: { year: number | null; month: number | null; day: number | null } | undefined): string | undefined =>
  !d?.year ? undefined : [d.year, d.month, d.day].filter(Boolean).map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-')

/** Die AniList-Spalte: Titel-Felder aus dem fertigen `Title` (was die Seite zeigt), Status und genaue Daten aus dem Rohwert. */
export function anilistSpalte(t: Title, media: AniListMedia | undefined): Spalte {
  return {
    titleRomaji: t.titleRomaji,
    titleEn: t.titleEn,
    titleNative: t.titleNative,
    format: t.format,
    episodes: t.episodes,
    jpYear: t.jpYear,
    jpSeason: t.jpSeason,
    jpEnd: genau(media?.endDate) ?? genau(media?.startDate),
    status: media?.status ?? undefined,
    studios: t.studios,
    synopsis: !!t.synopsis,
    malId: t.malId ? [t.malId] : undefined,
  }
}

const klein = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()
const studioName = (s: string): string => s.toLowerCase().replace(/\./g, '').replace(/\b(inc|co|ltd|kk|corp|llc|studios?|productions?)\b/g, '').replace(/[^\p{L}\p{N}]/gu, '')

/** Daten gelten als gleich, wenn sie bis zur gröberen Genauigkeit übereinstimmen („2003-10" gegen „2003-10-04"). */
const datumGleich = (a: string, b: string): boolean => {
  const n = Math.min(a.length, b.length)
  return a.slice(0, n) === b.slice(0, n)
}

/** AniList nennt bis zu drei Studios, aniSearch oft nur das federführende: gleich, wenn die eine Menge die andere enthält. */
function studiosGleich(a: string[], s: string[]): boolean {
  const [x, y] = [new Set(a.map(studioName)), new Set(s.map(studioName))]
  return [...x].every((n) => y.has(n)) || [...y].every((n) => x.has(n))
}

const GLEICH: { [K in FeldName]: (a: NonNullable<Spalte[K]>, s: NonNullable<Spalte[K]>) => boolean } = {
  titleRomaji: (a, s) => klein(a) === klein(s),
  titleEn: (a, s) => klein(a) === klein(s),
  titleNative: (a, s) => a.trim() === s.trim(),
  format: (a, s) => a === s,
  episodes: (a, s) => a === s,
  jpYear: (a, s) => a === s,
  jpSeason: (a, s) => a === s,
  jpEnd: datumGleich,
  status: (a, s) => a === s,
  studios: studiosGleich,
  // Deutsch gegen Englisch: verglichen wird nur, ob es einen Text gibt.
  synopsis: () => true,
  malId: (a, s) => a.some((m) => s.includes(m)),
}

export const FELDER = Object.keys(GLEICH) as FeldName[]

const leer = (v: unknown): boolean => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length)

export function urteil(feld: FeldName, anilist: Spalte, anisearch: Spalte): Urteil {
  const [a, s] = [anilist[feld], anisearch[feld]]
  if (leer(a) && leer(s)) return 'beideLeer'
  if (leer(s)) return 'nurAnilist'
  if (leer(a)) return 'nurAnisearch'
  return (GLEICH[feld] as (x: unknown, y: unknown) => boolean)(a, s) ? 'gleich' : 'abweichend'
}
