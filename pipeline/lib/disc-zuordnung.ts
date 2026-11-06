/**
 * Welchem Titel gehört eine Disc-Ausgabe einer aniSearch-Seite?
 *
 * Eine aniSearch-Kennung kann mehrere Titel tragen (ein Film-Dreiteiler, eine Serie samt OVA). Die Ausgaben der
 * Seite gehören dann nicht alle zu jedem Titel. Hier gilt: nur, was sich eindeutig zuordnen lässt, wird
 * zugeordnet — Rest wird als `unklar` gezählt und nie geraten (gemessen am 06.11.2026: 41 geteilte Seiten im Archiv).
 *
 * Reihenfolge der Belege je Ausgabe:
 * 1. Ordnungszahl („Film 2", „Movie 1+2", „Chapter 1&2") gegen die Zahl im Titel („Crown Handler 2", „Teil 3").
 * 2. Einmaliger Namensteil des Titels steht in der Ausgabe („Gewinner und Verlierer").
 * 3. Positionsfolge: kein Titel trägt eine Zahl, aber die Seite nennt genau so viele Filme wie es Titel gibt.
 * 4. Sammelwort („Trilogie", „Filmbox") bei lauter Filmen: gilt für alle.
 */

export interface DiscKandidat {
  id: number
  /** Alle Namen des Titels (deutsch, englisch, romaji). */
  namen: string[]
  format?: string
  jpYear?: number
}

export type ZuordnungsWeg = 'einzig' | 'ordnung' | 'name' | 'position' | 'sammel'

const SCHLUESSEL = 'Movie|Film|Filme|Teil|Part|Chapter|Kapitel|Border'
const ROEMISCH: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }

function zahlenAus(spec: string): number[] {
  const raus = new Set<number>()
  for (const m of spec.matchAll(/(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/g)) {
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (b >= a && b - a <= 20) for (let i = a; i <= b; i++) raus.add(i)
  }
  return [...raus]
}

/** „Film 1-3" → [1,2,3]; „Chapter 1&2" → [1,2]; ohne Schlüsselwort + Zahl → []. */
export function ordnungszahlen(edition: string): number[] {
  const raus = new Set<number>()
  const re = new RegExp(`\\b(?:${SCHLUESSEL})\\s*:?\\s*(\\d{1,2}(?:\\s*(?:[-–+&,]|und|and)\\s*\\d{1,2})*)`, 'gi')
  for (const m of edition.matchAll(re)) {
    for (const spec of m[1]!.split(/\s*(?:[+&,]|und|and)\s*/)) for (const z of zahlenAus(spec)) raus.add(z)
  }
  return [...raus]
}

/** Die Zahlen im Titel: nach einem Schlüsselwort, sonst alle freistehenden ein- bis zweistelligen. */
export function titelOrdnung(namen: string[]): number[] {
  const raus = new Set<number>()
  const mitWort = new RegExp(`\\b(?:${SCHLUESSEL})\\s*:?\\s*(\\d{1,2})\\b`, 'gi')
  const roemisch = new RegExp(`\\b(?:${SCHLUESSEL})\\s*(I{1,3}|IV|VI{0,3}|IX|X)\\b`, 'g')
  const frei = /(?<![\w.'’])(\d{1,2})(?![\w'’])/g
  for (const n of namen) {
    const treffer = [...n.matchAll(mitWort)]
    for (const m of treffer.length ? treffer : [...n.matchAll(frei)]) raus.add(Number(m[1]))
    for (const m of n.matchAll(roemisch)) raus.add(ROEMISCH[m[1]!]!)
  }
  return [...raus]
}

/** Je Kandidat seine Ordnungszahlen; eine Zahl, die alle tragen („Persona 3 the Movie"), ordnet nichts. */
export function kandidatenOrdnung(kandidaten: DiscKandidat[]): Map<number, number[]> {
  const roh = kandidaten.map((k) => titelOrdnung(k.namen))
  const gemeinsam = roh[0]!.filter((z) => roh.every((r) => r.includes(z)))
  return new Map(kandidaten.map((k, i) => [k.id, roh[i]!.filter((z) => !gemeinsam.includes(z))]))
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Namensteile (mind. 6 Zeichen), die nur dieser Kandidat trägt. */
function eigeneTeile(k: DiscKandidat, alle: DiscKandidat[]): string[] {
  const fremd = alle.filter((x) => x.id !== k.id).flatMap((x) => x.namen.map(norm))
  const teile = k.namen.flatMap((n) => n.split(/[:\-–()~[\]]/)).map(norm)
  return [...new Set(teile)].filter((t) => t.length >= 6 && !fremd.some((f) => f.includes(t)))
}

const SAMMEL = /Trilogie|Filmbox|Film-Box|Kinofilme|Movie-Set|\bMovies\b|\bFilme\b/i

/** Kein Titel trägt eine Zahl, die Seite nennt genau so viele Filme wie es Titel gibt: n-ter Film = n-ter Titel nach Jahr. */
function nachPosition(zahlen: number[], kandidaten: DiscKandidat[], filmeAufSeite: number): number[] {
  if (filmeAufSeite > kandidaten.length) return []
  const folge = [...kandidaten].sort((a, b) => (a.jpYear ?? 9999) - (b.jpYear ?? 9999) || a.id - b.id)
  const ids = zahlen.filter((z) => z <= folge.length).map((z) => folge[z - 1]!.id)
  return ids.length === zahlen.length ? ids : []
}

/** Die Titel, zu denen die Ausgabe gehört (leer = unklar), und der Beleg. */
export function ausgabeGehoertZu(
  edition: string,
  kandidaten: DiscKandidat[],
  filmeAufSeite: number,
): { ids: number[]; weg: ZuordnungsWeg | null } {
  if (kandidaten.length === 1) return { ids: [kandidaten[0]!.id], weg: 'einzig' }
  const zahlen = ordnungszahlen(edition)
  const ordnung = kandidatenOrdnung(kandidaten)
  const nachZahl = zahlen.length ? kandidaten.filter((k) => ordnung.get(k.id)!.some((z) => zahlen.includes(z))).map((k) => k.id) : []
  if (nachZahl.length) return { ids: nachZahl, weg: 'ordnung' }
  const en = norm(edition)
  const nachName = kandidaten.filter((k) => eigeneTeile(k, kandidaten).some((t) => en.includes(t))).map((k) => k.id)
  if (nachName.length) return { ids: nachName, weg: 'name' }
  if (zahlen.length && ![...ordnung.values()].some((o) => o.length)) {
    const ids = nachPosition(zahlen, kandidaten, filmeAufSeite)
    if (ids.length) return { ids, weg: 'position' }
  }
  if (SAMMEL.test(edition) && kandidaten.every((k) => k.format === 'MOVIE')) return { ids: kandidaten.map((k) => k.id), weg: 'sammel' }
  return { ids: [], weg: null }
}

export interface Verteilung<A> {
  je: Map<number, A[]>
  /** Ausgaben, die zu keinem Titel eindeutig passen. */
  unklar: A[]
  /** Kandidaten, die dadurch ohne Ausgabe bleiben. */
  leer: number[]
}

/** Verteilt die Ausgaben einer Seite auf die Titel, die sich ihre Kennung teilen. */
export function verteileAusgaben<A extends { edition: string }>(ausgaben: A[], kandidaten: DiscKandidat[]): Verteilung<A> {
  const filme = Math.max(0, ...ausgaben.flatMap((a) => ordnungszahlen(a.edition)))
  const je = new Map<number, A[]>()
  const unklar: A[] = []
  for (const a of ausgaben) {
    const { ids } = ausgabeGehoertZu(a.edition, kandidaten, filme)
    if (!ids.length) unklar.push(a)
    for (const id of ids) je.set(id, [...(je.get(id) ?? []), a])
  }
  return { je, unklar, leer: kandidaten.map((k) => k.id).filter((id) => !je.has(id)) }
}

export interface Bilanz {
  /** Seiten, deren Kennung mehr als ein Titel trägt. */
  geteilteSeiten: number
  /** Ausgaben auf geteilten Seiten, die keinem Titel eindeutig gehören — nicht zugeordnet. */
  unklar: number
  /** Titel, die durch `anisearchId` (nicht durch `anisearch.json`) eine Ausgabe bekamen. */
  neuUeberKennung: number
  /** Titel auf geteilten Seiten, die ohne Ausgabe blieben. */
  leereKandidaten: number[]
}

/**
 * Ordnet die Ausgaben aller Seiten ihren Titeln zu. `besitzer` ist die bisherige 1:1-Zuordnung aus `anisearch.json`:
 * Der Besitzer behält alle Ausgaben seiner Seite (wie bisher); Geschwister auf derselben Seite bekommen nur,
 * was sich ihnen eindeutig zuordnen lässt. Ohne Besitzer gilt das für alle Titel der Seite.
 */
export function ordneZu<A extends { edition: string }>(
  seiten: Iterable<[number, A[]]>,
  kandidatenVon: Map<number, DiscKandidat[]>,
  besitzer: Map<number, number>,
): { raus: Record<string, A[]>; bilanz: Bilanz } {
  const raus: Record<string, A[]> = {}
  const bilanz: Bilanz = { geteilteSeiten: 0, unklar: 0, neuUeberKennung: 0, leereKandidaten: [] }
  for (const [asId, ausgaben] of seiten) {
    if (!ausgaben.length) continue
    const kandidaten = kandidatenVon.get(asId) ?? []
    const eigner = besitzer.get(asId)
    if (eigner !== undefined) raus[String(eigner)] = ausgaben
    const andere = kandidaten.filter((k) => k.id !== eigner)
    if (!andere.length) continue
    if (kandidaten.length > 1) bilanz.geteilteSeiten++
    const v = verteileAusgaben(ausgaben, kandidaten)
    if (eigner === undefined) {
      bilanz.unklar += v.unklar.length
      bilanz.leereKandidaten.push(...v.leer)
    }
    for (const k of andere) {
      const eigene = v.je.get(k.id)
      if (!eigene?.length) continue
      raus[String(k.id)] = eigene
      bilanz.neuUeberKennung++
    }
  }
  return { raus, bilanz }
}
