/**
 * **JustWatch für Titel ohne TMDB-Kennung: Zuordnung über Namen, Jahr und Art** (Daniel, 06.11.2026: „Miraculous World: New York,
 * United Heroez“ zeigte keinen der vier Dienste, die JustWatch nennt). Der Abruf `fetch-justwatch-audio.ts` ordnet sonst nur über die
 * TMDB-Kennung zu; 859 Titel haben keine (Fehlschlag oder reiner aniSearch-Titel) und wurden nie gefragt.
 *
 * Streng, weil ein Namensabgleich am 29.08.2026 fünfzehn von sechzehn Zuordnungen falsch machte: genau **ein** Treffer muss
 * (1) denselben Namen tragen (gleiche Wortfolge, kein Teilwort wie bei `bewerteTreffer`), (2) im Jahr höchstens um eins abweichen und
 * (3) zur Art passen (Film gegen Serie). Mehrdeutig, fremd (Kennung gehört schon einem anderen unserer Titel) oder kein Treffer:
 * nichts übernehmen, aber zählen.
 */
import type { Title } from '../../shared/types.ts'

export interface NamensKnoten {
  id: string
  objectType: string
  content: { title: string; originalReleaseYear?: number | null; externalIds?: { tmdbId?: number | string | null } | null }
}

export type NamensUrteil<K extends NamensKnoten = NamensKnoten> =
  | { art: 'treffer'; knoten: K }
  | { art: 'keiner' }
  | { art: 'mehrdeutig'; anzahl: number }
  | { art: 'fremd'; tmdbId: number }

type TitelKurz = Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji' | 'titleNative' | 'format' | 'episodes' | 'jpYear' | 'deErstausgabe'>

/** Wortfolge ohne Akzente und Satzzeichen; Ziffern bleiben (anders als `woerterVon`), sonst wäre „Baki 2“ gleich „Baki“. */
export function namensSchluessel(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(' ')
}

/** Staffelzusatz am Ende („: Staffel 2“, „(Teil 3)“, „Season 2“, „2nd Season“); Ziffer Pflicht, „Final Season“ und „Baki 2“ bleiben unberührt. */
const STAFFEL_ZUSATZ = /\s*[:\-–]?\s*\(?\s*(?:(?:Staffel|Season|Teil|Part)\s+\d+|\d+(?:st|nd|rd|th)\s+Season)\s*\)?\s*$/i

/** Der Name ohne Staffelzusatz; `undefined`, wenn keiner dran hängt oder nichts übrig bliebe. */
export function ohneStaffelzusatz(name: string): string | undefined {
  const kurz = name.replace(STAFFEL_ZUSATZ, '').trim()
  return kurz && kurz !== name.trim() ? kurz : undefined
}

/** Die Namen des Titels ohne Staffelzusatz (JustWatch DE führt nur das Franchise, 19.11.2026). */
function franchiseNamen(t: Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji' | 'titleNative'>): string[] {
  return [t.titleDe, t.titleRomaji, t.titleEn, t.titleNative].filter((n): n is string => Boolean(n)).flatMap((n) => ohneStaffelzusatz(n) ?? [])
}

/** Die Suchbegriffe: alle verschiedenen Namen des Titels (deutsch, romaji, englisch), danach die ohne Staffelzusatz. */
export function suchNamen(t: Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji'>): string[] {
  const roh = [t.titleDe, t.titleRomaji, t.titleEn].filter((n): n is string => Boolean(n))
  const alle = [...roh, ...roh.flatMap((n) => ohneStaffelzusatz(n) ?? [])]
  return alle.filter((n, i) => alle.findIndex((m) => namensSchluessel(m) === namensSchluessel(n)) === i)
}

function jahre(t: TitelKurz): number[] {
  const de = Number(t.deErstausgabe?.von?.slice(0, 4))
  return [t.jpYear, de].filter((j): j is number => Number.isFinite(j) && Number(j) > 0)
}

/** Film gegen Serie: ein Film bleibt ein Film, eine Serie mit mehreren Folgen bleibt eine Serie; Sonderfälle (OVA, Special, Musik) lassen beides zu. */
function artPasst(t: TitelKurz, objectType: string): boolean {
  if (t.format === 'MOVIE') return objectType === 'MOVIE'
  if ((t.format === 'TV' || t.format === 'ONA' || t.format === 'TV_SHORT') && (t.episodes ?? 0) > 1) return objectType === 'SHOW'
  return true
}

/** Ein Knoten passt, wenn Name, Jahr (±1) und Art stimmen. */
export function passtZumTitel(t: TitelKurz, k: NamensKnoten): boolean {
  const unsere = new Set([t.titleDe, t.titleRomaji, t.titleEn, t.titleNative].filter((n): n is string => Boolean(n)).map(namensSchluessel))
  const jahr = k.content.originalReleaseYear
  return (
    unsere.has(namensSchluessel(k.content.title)) &&
    typeof jahr === 'number' &&
    jahre(t).some((j) => Math.abs(j - jahr) <= 1) &&
    artPasst(t, k.objectType)
  )
}

/**
 * Ein Staffeltitel passt zum Franchise-Eintrag: Serie (nie Film), Name ohne Staffelzusatz gleich, Start des Franchise höchstens ein Jahr nach
 * unserem frühesten Jahr (eine Fortsetzung kommt nie vor dem Start der Reihe; Moonlight Mile 1st Season gegen den Film 2002 passt nicht).
 */
export function passtZumFranchise(t: TitelKurz, k: NamensKnoten): boolean {
  const unsere = new Set(franchiseNamen(t).map(namensSchluessel))
  const jahr = k.content.originalReleaseYear
  const eigene = jahre(t)
  return (
    t.format !== 'MOVIE' &&
    k.objectType === 'SHOW' &&
    unsere.has(namensSchluessel(k.content.title)) &&
    typeof jahr === 'number' &&
    eigene.length > 0 &&
    jahr <= Math.min(...eigene) + 1
  )
}

/** Kennungen unserer anderen Titel, deren Name (mit oder ohne Staffelzusatz) dem Franchise-Namen von `t` gleicht: dieselbe Reihe, kein fremder Halter. */
export function geschwisterKennungen(t: Title, andere: Iterable<Title>, tmdbVon: (x: Title) => number | undefined): Set<number> {
  const unsere = new Set(franchiseNamen(t).map(namensSchluessel))
  const aus = new Set<number>()
  for (const x of andere) {
    const id = tmdbVon(x)
    const namen = [x.titleDe, x.titleRomaji, x.titleEn, x.titleNative].filter((n): n is string => Boolean(n))
    if (id && x !== t && namen.some((n) => unsere.has(namensSchluessel(ohneStaffelzusatz(n) ?? n)))) aus.add(id)
  }
  return aus
}

/**
 * Das Urteil über alle Treffer aller Suchen zu einem Titel; `bekannteTmdb` = Kennungen, die schon einer unserer Titel führt.
 * Ohne strengen Treffer gilt der Franchise-Eintrag (`passtZumFranchise`), und eine Kennung, die nur Geschwister derselben Reihe führen (`geschwister`), ist dann nicht fremd.
 */
export function waehleKnoten<K extends NamensKnoten>(t: TitelKurz, knoten: K[], bekannteTmdb: ReadonlySet<number>, geschwister: ReadonlySet<number> = new Set()): NamensUrteil<K> {
  const einmal = (liste: K[]) => liste.filter((k, i, alle) => alle.findIndex((m) => m.id === k.id) === i)
  const streng = einmal(knoten.filter((k) => passtZumTitel(t, k)))
  const ueberFranchise = !streng.length
  const passend = ueberFranchise ? einmal(knoten.filter((k) => passtZumFranchise(t, k))) : streng
  if (!passend.length) return { art: 'keiner' }
  if (passend.length > 1) return { art: 'mehrdeutig', anzahl: passend.length }
  const tmdbId = Number(passend[0].content.externalIds?.tmdbId)
  if (Number.isFinite(tmdbId) && bekannteTmdb.has(tmdbId) && !(ueberFranchise && geschwister.has(tmdbId))) return { art: 'fremd', tmdbId }
  return { art: 'treffer', knoten: passend[0] }
}

export interface NamensSchlangeEingabe {
  titles: Title[]
  bestand: Record<string, { geprueftAm: string }>
  tmdbVon: (t: Title) => number | undefined
  /** Befunde mit `geprueftAm` vor diesem Tag (ISO) sind fällig; nie gefragte zuerst. */
  grenze: string
}

/** Titel ohne TMDB-Kennung, die fällig sind: nie gefragt zuerst, dann der älteste Befund. */
export function namensSchlange({ titles, bestand, tmdbVon, grenze }: NamensSchlangeEingabe): Title[] {
  const stand = (t: Title) => bestand[String(t.id)]?.geprueftAm ?? ''
  return titles
    .filter((t) => !tmdbVon(t) && suchNamen(t).length && stand(t) < grenze)
    .sort((a, b) => stand(a).localeCompare(stand(b)) || a.id - b.id)
}

/** Alle TMDB-Kennungen, die einer unserer Titel führt. */
export function bekannteTmdbKennungen(titles: Title[], tmdbVon: (t: Title) => number | undefined): Set<number> {
  return new Set(titles.map(tmdbVon).filter((id): id is number => typeof id === 'number' && id > 0))
}

/** Wie viele Titel ein Lauf über den Namen fragt: der Wert hinter `--namen` in der Skriptzeile aus `package.json` (0 = aus). */
export function namenProLauf(skriptzeile: string | undefined): number {
  const wert = /--namen\s+(\d+)/.exec(skriptzeile ?? '')?.[1]
  return wert ? Number(wert) : 0
}

/** Läufe in 21 Tagen (`NAMEN_ALTER_TAGE`): täglich außer montags (da fragt der Wochenlauf), also 6 je Woche. */
export const TAGESLAEUFE_IN_21_TAGEN = 18

export interface NamensLage {
  ohneTmdb: number
  nieGefragt: number
  /** Befund älter als `verfallGrenze`: der Bau liest ihn nicht mehr, der Titel hat wieder keinen Weg aus JustWatch. */
  verfallen: number
  /** Titel, die in 21 Tagen gefragt werden können. */
  kapazitaet: number
}

export function namensLage(
  titles: Title[],
  bestand: Record<string, { geprueftAm: string }>,
  tmdbVon: (t: Title) => number | undefined,
  verfallGrenze: string,
  proLauf: number,
): NamensLage {
  const ohne = titles.filter((t) => !tmdbVon(t) && suchNamen(t).length)
  const stand = (t: Title) => bestand[String(t.id)]?.geprueftAm
  return {
    ohneTmdb: ohne.length,
    nieGefragt: ohne.filter((t) => !stand(t)).length,
    verfallen: ohne.filter((t) => (stand(t) ?? '9999') < verfallGrenze).length,
    kapazitaet: TAGESLAEUFE_IN_21_TAGEN * proLauf,
  }
}
