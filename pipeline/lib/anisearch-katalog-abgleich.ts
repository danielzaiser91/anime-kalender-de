/**
 * Abgleich der AniList-Katalogtitel ohne aniSearch-Kennung gegen aniSearchs Titelliste (`GET /v1/anime/titles`, 11.10.2026).
 * Reine Logik, ohne Abruf: `fetch-anisearch-katalog-abgleich.ts` liefert die Eingaben und schreibt die Ergebnisse.
 *
 * Ein falsch gebundener Titel bringt Cover, Beschreibung und Genres eines fremden Werks mit — deshalb ist „sicher" eng gefasst:
 * entweder dieselbe MAL-Kennung, oder gleicher Name (nach Normalisierung), Jahr höchstens eins daneben, verträgliches Format,
 * Folgenzahl nicht widersprüchlich und genau ein solcher Kandidat. Alles Übrige mit Namensnähe geht mit Grund auf die Prüfliste.
 */
import { bewerteTreffer } from './adn.ts'
import { belegGrund, widerlegtGrund } from './anisearch-katalog-merkmale.ts'
import { normalisiere } from './anisearch-namen.ts'

/** Eine Zeile der Titelliste: Jahr und alle Schreibweisen (Haupttitel, Japanisch, Kanji, Sprachen, Synonyme). */
export interface AsTitel {
  id: number
  jahr?: number
  namen: string[]
}

/** Was der Einzelabruf (`/v1/anime/<Kennung>`, kompakt) über den Kandidaten sagt. */
export interface AsEintrag {
  ty?: string
  y?: number
  f?: number
  mal?: number
  /** Erster und letzter Erscheinungstag (`JJJJ-MM-TT`, bei unbekanntem Tag mit `00`) und Folgenlänge in Minuten. */
  von?: string
  bis?: string
  min?: number
}

export interface KatalogTitel {
  id: number
  mal?: number
  namen: string[]
  format: string | null
  jahr: number | null
  folgen: number | null
  /** Start- und Endtag (AniList, `JJJJ-MM-TT`; kürzer, wo AniList nur Monat oder Jahr kennt) und Folgenlänge in Minuten. */
  start?: string
  ende?: string
  dauer?: number
  /** aniSearch-Einträge, die zu seiner MAL-Kennung gehören (Brücke oder Einzelabruf): Kandidaten auch ohne Namensnähe. */
  malAsIds?: number[]
}

export interface Kandidat {
  asId: number
  wert: number
  gleicherName: boolean
  ueberMal?: boolean
}

/** `widerlegt`: Es gibt Kandidaten, aber Tag, Länge oder MAL-Kennung zeigen bei allen ein anderes Werk — kein Treffer, keine Prüfung nötig. */
export type Urteil =
  | { art: 'sicher'; asId: number; weil: string }
  | { art: 'unsicher'; asId: number; weil: string; weitere: Kandidat[] }
  | { art: 'widerlegt'; weil: string }
  | { art: 'keiner' }

/** Unterhalb dieses Werts von `bewerteTreffer` (geteilte Wörter doppelt, fremde und fehlende einfach dagegen) gilt ein Kandidat nicht als Namensnähe. */
export const MINDESTWERT = 3
const KANDIDATEN_JE_TITEL = 40

export { normalisiere }

const woerter = (s: string): string[] => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 4)

/** Suchindex: Wörter (ab vier Zeichen) und vollständige normalisierte Namen → aniSearch-Kennungen. Die Namen finden auch kurze Titel („Big O“). */
export interface Index {
  woerter: Map<string, number[]>
  namen: Map<string, number[]>
}

export function wortIndex(titel: AsTitel[]): Index {
  const index: Index = { woerter: new Map(), namen: new Map() }
  for (const t of titel) {
    for (const w of new Set(t.namen.flatMap(woerter))) index.woerter.set(w, [...(index.woerter.get(w) ?? []), t.id])
    for (const n of new Set(t.namen.map(normalisiere).filter(Boolean))) index.namen.set(n, [...(index.namen.get(n) ?? []), t.id])
  }
  return index
}

/** Erst alle Namensgleichen, dann die Titel mit den meisten gemeinsamen seltenen Wörtern; seltene Wörter zuerst, damit „Season“ und „Movie“ die Auswahl nicht füllen. */
function vorauswahl(namen: string[], index: Index): number[] {
  const gleich = namen.flatMap((n) => index.namen.get(normalisiere(n)) ?? [])
  const zaehler = new Map<number, number>()
  const wortListe = [...new Set(namen.flatMap(woerter))]
    .filter((w) => index.woerter.has(w))
    .sort((a, b) => index.woerter.get(a)!.length - index.woerter.get(b)!.length)
    .slice(0, 6)
  for (const w of wortListe) {
    for (const id of index.woerter.get(w)!.slice(0, 400)) zaehler.set(id, (zaehler.get(id) ?? 0) + 1)
  }
  const aehnlich = [...zaehler.entries()].sort((a, b) => b[1] - a[1]).slice(0, KANDIDATEN_JE_TITEL).map(([id]) => id)
  return [...new Set([...gleich, ...aehnlich])]
}

const alsMedia = (name: string) => ({ title: { romaji: name, english: null, native: null } })

/** Bester Wert von `bewerteTreffer` über alle Namenspaare: unser Name als Anzeigename, jede Schreibweise des Kandidaten einzeln. */
export function namenWert(unsere: string[], ihre: string[]): number {
  let beste = 0
  for (const u of unsere) {
    for (const i of ihre) beste = Math.max(beste, bewerteTreffer({ title: u }, alsMedia(i)))
  }
  return beste
}

/** Kandidaten eines Katalogtitels, bester zuerst; `gleicherName` heißt: normalisierte Schreibweise stimmt mit einer von aniSearch überein. */
export function kandidaten(k: KatalogTitel, titel: Map<number, AsTitel>, index: Index, gesperrt: Set<number>): Kandidat[] {
  const unsere = new Set(k.namen.map(normalisiere).filter(Boolean))
  const raus: Kandidat[] = []
  for (const id of new Set([...(k.malAsIds ?? []), ...vorauswahl(k.namen, index)])) {
    const t = titel.get(id)
    if (!t || gesperrt.has(id)) continue
    const gleicherName = t.namen.some((n) => unsere.has(normalisiere(n)))
    const wert = namenWert(k.namen, t.namen)
    const ueberMal = k.malAsIds?.includes(id)
    if (gleicherName || ueberMal || wert >= MINDESTWERT) raus.push({ asId: id, wert, gleicherName, ...(ueberMal ? { ueberMal } : {}) })
  }
  return raus.sort((a, b) => Number(b.gleicherName) - Number(a.gleicherName) || b.wert - a.wert)
}

/** Formatfamilien: AniList kennt `TV_SHORT`, aniSearch führt asiatische Web-Serien als „TV-Serie"; OVA und Special sind bei beiden nicht trennscharf. */
const FAMILIE: Record<string, string> = { TV: 'tv', TV_SHORT: 'tv', ONA: 'tv', MOVIE: 'film', OVA: 'extra', SPECIAL: 'extra', MUSIC: 'musik' }

export const formatVertraeglich = (anilist: string | null, anisearch: string | undefined): boolean =>
  !anilist || !anisearch || FAMILIE[anilist] === FAMILIE[anisearch] || (FAMILIE[anilist] === 'tv' && FAMILIE[anisearch] === 'extra') || (FAMILIE[anilist] === 'extra' && FAMILIE[anisearch] === 'tv')

/** Gründe, die einen Kandidaten ausschließen oder auf die Prüfliste schieben; leer heißt: nichts spricht dagegen. */
export function einwaende(k: KatalogTitel, c: Kandidat, t: AsTitel, e: AsEintrag | undefined, aniSearchFormat: string | undefined): string[] {
  const grund: string[] = []
  const jahr = e?.y ?? t.jahr
  if (!jahr || !k.jahr) grund.push('Jahr fehlt')
  else if (Math.abs(jahr - k.jahr) > 1) grund.push(`Jahr ${jahr} statt ${k.jahr}`)
  if (!e) grund.push('Einzelabruf fehlt')
  if (e && !formatVertraeglich(k.format, aniSearchFormat)) grund.push(`Format ${e.ty} statt ${k.format}`)
  if (e?.f && k.folgen && e.f !== k.folgen) grund.push(`${e.f} Folgen statt ${k.folgen}`)
  if (e?.mal && k.mal && e.mal !== k.mal) grund.push(`MAL ${e.mal} statt ${k.mal}`)
  if (!c.gleicherName && !c.ueberMal) grund.push(`Name nur ähnlich (Wert ${c.wert})`)
  return grund
}

type FormatVon = (ty: string | undefined) => string | undefined

/** Urteil über die Kandidaten mit derselben MAL-Kennung (leer, wenn keiner sie trägt): einer genügt; bei mehreren entscheiden Jahr, Format und Folgen. */
function malUrteil(k: KatalogTitel, cs: Kandidat[], titel: Map<number, AsTitel>, eintraege: Record<string, AsEintrag>, format: FormatVon): Urteil | undefined {
  const treffer = cs.filter((c) => k.mal && eintraege[String(c.asId)]?.mal === k.mal)
  if (!treffer.length) return undefined
  if (treffer.length === 1) return { art: 'sicher', asId: treffer[0]!.asId, weil: `MAL ${k.mal}` }
  const ohneEinwand = treffer.filter((c) => !einwaende(k, c, titel.get(c.asId)!, eintraege[String(c.asId)], format(eintraege[String(c.asId)]?.ty)).length)
  if (ohneEinwand.length === 1) return { art: 'sicher', asId: ohneEinwand[0]!.asId, weil: `MAL ${k.mal}, Jahr und Format entscheiden` }
  const teil = teilungsUrteil(k, treffer, eintraege)
  if (teil) return teil
  return { art: 'unsicher', asId: treffer[0]!.asId, weil: `MAL ${k.mal} bei ${treffer.length} aniSearch-Einträgen`, weitere: treffer.slice(1, 4) }
}

/**
 * Teilung: aniSearch führt in mehreren Einträgen, was AniList als einen Titel hat (Hoozuki: 3 + 1 Folgen, Fanren Xiu Xian Zhuan: 8 + 9). Ergeben die Folgen der Einträge
 * mit derselben MAL-Kennung genau die AniList-Zahl, bekommt der früheste Teil die Kennung (ein Titel, eine Kennung); die übrigen bleiben eigene aniSearch-Zeilen.
 */
function teilungsUrteil(k: KatalogTitel, treffer: Kandidat[], eintraege: Record<string, AsEintrag>): Urteil | undefined {
  const folgen = treffer.map((c) => eintraege[String(c.asId)]?.f ?? 0)
  if (!k.folgen || folgen.some((f) => !f) || folgen.reduce((a, b) => a + b, 0) !== k.folgen) return undefined
  const von = (c: Kandidat): string => eintraege[String(c.asId)]?.von ?? '9999'
  const erster = [...treffer].sort((a, b) => von(a).localeCompare(von(b)) || b.wert - a.wert || a.asId - b.asId)[0]!
  return { art: 'sicher', asId: erster.asId, weil: `MAL ${k.mal}: ${treffer.length} aniSearch-Teile ergeben ${k.folgen} Folgen (Teilung), erster Teil` }
}

/** Genau ein Kandidat, den Tag, Länge und Name allein belegen (`belegGrund`): sicher, auch bei abweichendem Format, Jahr oder Folgenzahl. */
function belegUrteil(k: KatalogTitel, cs: Kandidat[], titel: Map<number, AsTitel>, eintraege: Record<string, AsEintrag>, format: FormatVon, heuteJahr: number): Urteil | undefined {
  const belegt = cs
    .map((c) => {
      const e = eintraege[String(c.asId)]
      return { c, grund: belegGrund({ k, c, t: titel.get(c.asId)!, e, formatOk: formatVertraeglich(k.format, format(e?.ty)), heuteJahr }) }
    })
    .filter((b) => b.grund)
  return belegt.length === 1 ? { art: 'sicher', asId: belegt[0]!.c.asId, weil: belegt[0]!.grund! } : undefined
}

/** Urteil für einen Katalogtitel. `format(ty)` bildet aniSearchs Typ auf das AniList-Format ab; `heuteJahr`: Jahre darüber hinaus (plus zwei) sind Platzhalter. */
export function urteile(k: KatalogTitel, cs: Kandidat[], titel: Map<number, AsTitel>, eintraege: Record<string, AsEintrag>, format: FormatVon, heuteJahr = new Date().getFullYear()): Urteil {
  if (!cs.length) return { art: 'keiner' }
  const ueberMal = malUrteil(k, cs, titel, eintraege, format)
  if (ueberMal) return ueberMal
  const geprueft = cs.map((c) => {
    const e = eintraege[String(c.asId)]
    return { c, grund: einwaende(k, c, titel.get(c.asId)!, e, format(e?.ty)) }
  })
  geprueft.sort((a, b) => a.grund.length - b.grund.length)
  const sauber = geprueft.filter((g) => !g.grund.length)
  if (sauber.length === 1) return { art: 'sicher', asId: sauber[0]!.c.asId, weil: 'Name, Jahr, Format gleich' }
  const beleg = belegUrteil(k, cs, titel, eintraege, format, heuteJahr)
  if (beleg) return beleg
  const gruende = cs.map((c) => widerlegtGrund(k, eintraege[String(c.asId)]))
  if (!sauber.length && gruende.every(Boolean)) return { art: 'widerlegt', weil: gruende[0]! }
  const erster = sauber[0] ?? geprueft[0]!
  const weil = sauber.length > 1 ? `${sauber.length} gleichwertige Kandidaten` : erster.grund.join('; ')
  return { art: 'unsicher', asId: erster.c.asId, weil, weitere: cs.filter((c) => c.asId !== erster.c.asId).slice(0, 3) }
}

/** Zwei Katalogtitel mit demselben „sicheren" Kandidaten sind keiner sicher: beide wandern auf die Prüfliste. */
export function doppelteEntschaerfen(urteile_: Map<number, Urteil>): number {
  const je = new Map<number, number[]>()
  for (const [id, u] of urteile_) if (u.art === 'sicher') je.set(u.asId, [...(je.get(u.asId) ?? []), id])
  let n = 0
  for (const ids of je.values()) {
    if (ids.length < 2) continue
    for (const id of ids) {
      const u = urteile_.get(id) as { asId: number }
      urteile_.set(id, { art: 'unsicher', asId: u.asId, weil: `aniSearch ${u.asId} auch für ${ids.filter((x) => x !== id).join(', ')}`, weitere: [] })
      n++
    }
  }
  return n
}
