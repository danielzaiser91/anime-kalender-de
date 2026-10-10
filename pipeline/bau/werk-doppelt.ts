import { ANISEARCH_ID_BASIS, FORMAT } from './anisearch-titel.ts'
import { MAL_AUSNAHMEN } from '../lib/mal-dubletten.ts'

/**
 * **Dasselbe Werk unter zwei Kennungen, auch wenn keine MAL-Kennung es verbindet** (Daniel, 10.10.2026: „Fokus auf keine doppelten Einträge mehr"). Der Anlass:
 * „Yomi no Tsugai Dai 2 Ki" (aniSearch 21973, keine MAL) neben „Yomi no Tsugai 2nd Season" (AniList 217013). `gleichesWerk` (`anisearch-dubletten.ts`) braucht die MAL.
 *
 * Eine aniSearch-Zeile ohne Deutsch (`dub: '-'`) und ein AniList-Titel sind **sicher** dasselbe Werk, wenn Format, Jahr (±1), Folgen und Staffelzählung nicht
 * widersprechen **und** aniSearch selbst es bestätigt: ein Synonym der Zeile ist ein Name des Titels (oder der Reihenname mit seiner Staffelnummer: „Das Band der Unterwelt:
 * Staffel 2"), oder die Zeile hängt als Prequel/Sequel an einem Teil derselben Reihe und trägt dieselbe Staffelnummer. **Wahrscheinlich** ist ein Paar, das nur gleiche
 * Namen hat (Native oder voller Name): das versteckt nichts, es steht in der Prüfliste. Mehrdeutig (mehr als ein Partner) ist nie sicher.
 */
export type WerkEintrag = { t?: string; n?: string; en?: string; de?: string; mal?: number; ty: string; y?: number; f?: number; dub: string; syn?: string[]; rel?: Record<string, string> }
export type WerkTitel = {
  id: number
  titleRomaji?: string
  titleEn?: string
  titleDe?: string
  titleNative?: string
  format?: string | null
  jpYear?: number | null
  episodes?: number | null
  malId?: number
  anisearchId?: number
  franchiseId?: number
}
/** Obergrenze der wahrscheinlichen Paare in der Ausgabe (von Hand gepflegt, darf nur sinken); gelesen in `werk-doppelt-bau.ts`. */
export const GRENZE = 'data/dubletten-grenze.json'
export type WerkPaar ={ zeile: number; titel: number; grund: 'synonym' | 'beziehung' | 'name' }
export type WerkUrteil = { sicher: WerkPaar[]; wahrscheinlich: WerkPaar[] }

/** Namensschlüssel: Kleinschreibung, nur Buchstaben und Ziffern. */
export const schluessel = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Lang genug, um etwas zu belegen: sechs Zeichen, bei CJK drei. */
const belastbar = (k: string): boolean => [...k].length >= (/[぀-ヿ㐀-鿿가-힯]/.test(k) ? 3 : 6)

const STAFFEL_MUSTER = [
  /(?:^| )(?:staffel|season|saison|temporada|stagione|dai) ([1-9]\d?)(?: |$)/,
  /(?:^| )([1-9]\d?)(?:(?:st|nd|rd|th) (?:season|staffel|saison)| (?:staffel|saison))(?: |$)/,
  /第([1-9]\d?)[期季]/,
  /([1-9]\d?)[期季]/,
  /[぀-鿿]([1-9]\d?)$/,
  /[a-zÀ-ɏ]{2,} ([1-9]\d?)$/,
]
const ROEMISCH: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }

/**
 * Die Staffelnummern, die die Namen tragen („2nd Season", „Staffel 2", „Dai 2 Ki", „第2期", angehängte Ziffer). Mehrere Namen können verschiedene nennen
 * („… Nian Fan 2" und „… 4th Season"); gezählt wird, was sich deckt (`gleichGezaehlt`, `widerspruch`).
 */
export function staffelNummern(namen: (string | null | undefined)[]): Set<number> {
  const raus = new Set<number>()
  for (const roh of namen) {
    const s = roh ? schluessel(roh) : ''
    for (const muster of STAFFEL_MUSTER) {
      const treffer = muster.exec(s)?.[1]
      if (treffer) raus.add(Number(treffer))
    }
    const roemisch = / (ii|iii|iv|v|vi)$/.exec(s)?.[1]
    if (roemisch) raus.add(ROEMISCH[roemisch]!)
  }
  return raus
}
const gleichGezaehlt = (a: Set<number>, b: Set<number>): boolean => [...a].some((n) => b.has(n))
const widerspruch = (a: Set<number>, b: Set<number>): boolean => a.size > 0 && b.size > 0 && !gleichGezaehlt(a, b)
const nummernVon = (k: WerkTitel): Set<number> => staffelNummern([k.titleRomaji, k.titleEn, k.titleDe, k.titleNative])

/** „das band der unterwelt staffel 2" → Reihenname und Nummer. */
function staffelBasis(k: string): { basis: string; n: number } | undefined {
  const treffer = /^(.+?) (?:staffel|season|saison|temporada|stagione) ([1-9]\d?)$/.exec(k) ?? /^(.+?) ([1-9]\d?)(?:st|nd|rd|th)? (?:season|staffel|saison)$/.exec(k)
  return treffer ? { basis: treffer[1]!, n: Number(treffer[2]) } : undefined
}

const klasse = (format: string | null | undefined) => (format === 'TV_SHORT' || format === 'ONA' ? 'TV' : format ?? '?')
const namenVon = (t: WerkTitel): string[] => [t.titleRomaji, t.titleEn, t.titleDe].filter((n): n is string => Boolean(n)).map(schluessel).filter(belastbar)
const nativeVon = (n: string | null | undefined): string | undefined => {
  const k = n ? schluessel(n) : ''
  return belastbar(k) ? k : undefined
}

type Index = {
  titel: Map<number, WerkTitel>
  nachName: Map<string, WerkTitel[]>
  nachNative: Map<string, WerkTitel[]>
  /** Reihe (Kennung des Reihenkopfs) → Namensschlüssel ihrer Teile. */
  reiheNamen: Map<string, Set<number>>
  reiheVonAs: Map<number, number>
  nachReihe: Map<number, WerkTitel[]>
}

const reiheVon = (t: WerkTitel): number => t.franchiseId ?? t.id
const anreihen = <K, V>(m: Map<K, V[]>, k: K, v: V): void => void m.set(k, [...(m.get(k) ?? []), v])

/** Der Index aller Titel (Hauptbestand und Katalog); Kandidaten sind nur die `katalogIds`, die Reihen kennen alle. */
function baueIndex(titel: WerkTitel[], katalogIds: Set<number>): Index {
  const idx: Index = { titel: new Map(), nachName: new Map(), nachNative: new Map(), reiheNamen: new Map(), reiheVonAs: new Map(), nachReihe: new Map() }
  for (const t of titel) {
    idx.titel.set(t.id, t)
    const asId = t.id >= ANISEARCH_ID_BASIS ? t.id - ANISEARCH_ID_BASIS : t.anisearchId
    if (asId) idx.reiheVonAs.set(asId, reiheVon(t))
    for (const n of namenVon(t)) {
      const reihe = idx.reiheNamen.get(n) ?? new Set<number>()
      idx.reiheNamen.set(n, reihe.add(reiheVon(t)))
    }
    if (!katalogIds.has(t.id)) continue
    anreihen(idx.nachReihe, reiheVon(t), t)
    for (const n of new Set(namenVon(t))) anreihen(idx.nachName, n, t)
    const nat = nativeVon(t.titleNative)
    if (nat) anreihen(idx.nachNative, nat, t)
  }
  return idx
}

/** Widerspricht nichts: Format, Jahr (±1, 0 und leer zählen als offen), Folgen, Staffelzählung, MAL, bereits eine andere aniSearch-Kennung. */
function vertraeglich(e: WerkEintrag, asId: number, nummern: Set<number>, k: WerkTitel): boolean {
  if (klasse(FORMAT[e.ty] ?? 'SPECIAL') !== klasse(k.format)) return false
  if (e.y && k.jpYear && Math.abs(e.y - k.jpYear) > 1) return false
  if (e.f && k.episodes && e.f !== k.episodes) return false
  if (e.mal && k.malId && e.mal !== k.malId) return false
  if (k.anisearchId && k.anisearchId !== asId) return false
  return !widerspruch(nummern, nummernVon(k))
}

/** Ein Beleg von aniSearch (Synonym, Beziehung) schlägt den bloßen Namen. */
function merke(treffer: Map<WerkTitel, WerkPaar['grund']>, k: WerkTitel, grund: WerkPaar['grund']): void {
  if (!treffer.has(k) || grund !== 'name') treffer.set(k, grund)
}

/** Alle Titel, die zur Zeile `e` als dasselbe Werk in Frage kommen, mit dem stärksten Grund. */
function kandidaten(e: WerkEintrag, asId: number, idx: Index): Map<WerkTitel, WerkPaar['grund']> {
  const treffer = new Map<WerkTitel, WerkPaar['grund']>()
  const nummern = staffelNummern([e.t, e.en, e.de, e.n, ...(e.syn ?? [])])
  const eigene = [e.t, e.en, e.de].filter((n): n is string => Boolean(n)).map(schluessel).filter(belastbar)
  const nat = nativeVon(e.n)
  const gueltig = (k: WerkTitel) => k.id < ANISEARCH_ID_BASIS && vertraeglich(e, asId, nummern, k)
  for (const k of [...(nat ? idx.nachNative.get(nat) ?? [] : []), ...eigene.flatMap((n) => idx.nachName.get(n) ?? [])]) if (gueltig(k)) merke(treffer, k, 'name')
  for (const syn of (e.syn ?? []).map(schluessel)) {
    for (const k of idx.nachName.get(syn) ?? []) if (gueltig(k)) merke(treffer, k, 'synonym')
    const zerlegt = staffelBasis(syn)
    for (const reihe of zerlegt ? idx.reiheNamen.get(zerlegt.basis) ?? [] : []) {
      for (const k of idx.nachReihe.get(reihe) ?? []) if (gueltig(k) && nummernVon(k).has(zerlegt!.n)) merke(treffer, k, 'synonym')
    }
  }
  const verwandt = Object.entries(e.rel ?? {}).filter(([, art]) => art === 'Prequel' || art === 'Sequel').map(([id]) => Number(id))
  for (const reihe of new Set(verwandt.map((id) => idx.reiheVonAs.get(id)).filter((r): r is number => r !== undefined))) {
    for (const k of idx.nachReihe.get(reihe) ?? []) {
      if (gueltig(k) && gleichGezaehlt(nummern, nummernVon(k)) &&!verwandt.includes(k.anisearchId ?? 0)) merke(treffer, k, 'beziehung')
    }
  }
  return treffer
}

/**
 * @param titel      alle Titel der Ausgabe (Hauptbestand und Katalog)
 * @param katalogIds die AniList-Titel, die mit einer Zeile zusammengeführt werden dürfen (Katalog hinter dem Schalter)
 */
export function findeWerkDubletten(titel: WerkTitel[], eintraege: Record<string, WerkEintrag>, katalogIds: Set<number>): WerkUrteil {
  const idx = baueIndex(titel, katalogIds)
  const paare: WerkPaar[] = []
  for (const z of titel) {
    if (z.id < ANISEARCH_ID_BASIS) continue
    const asId = z.id - ANISEARCH_ID_BASIS
    const e = eintraege[String(asId)]
    if (!e || e.dub !== '-' || MAL_AUSNAHMEN[asId]) continue
    for (const [k, grund] of kandidaten(e, asId, idx)) if (k.anisearchId !== asId) paare.push({ zeile: z.id, titel: k.id, grund })
  }
  const zaehle = (feld: 'zeile' | 'titel', stark: WerkPaar[]) => stark.reduce((m, p) => m.set(p[feld], (m.get(p[feld]) ?? 0) + 1), new Map<number, number>())
  const starke = paare.filter((p) => p.grund !== 'name')
  const jeZeile = zaehle('zeile', starke)
  const jeTitel = zaehle('titel', starke)
  const eindeutig = (p: WerkPaar) => p.grund !== 'name' && jeZeile.get(p.zeile) === 1 && jeTitel.get(p.titel) === 1
  const sicher = paare.filter(eindeutig)
  const gesichert = new Set(sicher.map((p) => p.zeile))
  return { sicher, wahrscheinlich: paare.filter((p) => !eindeutig(p) && !gesichert.has(p.zeile)) }
}
