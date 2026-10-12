import { type Kante, type Namen, malKanten, zaehlt } from './anisearch-reihen.ts'
import type { Pruefzeile, ReiheRef } from './anisearch-reihen-uebernahme.ts'
import { WANDERREGEL } from './anisearch-reihen-uebernahme.ts'

/**
 * **Reihen rein aus aniSearch-Beziehungen** (Stufe C, Schritt 6 der AniList-Ablösung, 12.10.2026). Hinter dem Umgebungsschalter `REIHEN_QUELLE=anisearch`; ohne ihn bleibt die Basis
 * AniList (`03-reihen.ts`, `reihenFuerKatalog`) und aniSearch hängt nur Alleinstehende an. Reine Funktionen; Lesen, Schreiben und Anbindung in `anisearch-reihen-rein-bau.ts`.
 * Rechnet in Titel-Kennungen; Titel mit gleicher aniSearch-Kennung oder gleicher MAL-Kennung sind dieselbe Einheit. Auch Seiten, zu denen es keinen Titel gibt, verbinden (wie bei AniList jeder Nachbar):
 * sie sind Knoten mit `ANONYM + aniSearch-Kennung` und zählen für die Größe einer Reihe mit, nie für ihre Kennung.
 */
const ANONYM = 2_000_000_000
export const reihenAusAnisearch = (): boolean => process.env.REIHEN_QUELLE === 'anisearch'

export type ReinTitel = { id: number; name: string; anisearchId?: number; mal?: number }
/** `verbinden`: `ids:` der Handdatei (gelten immer); `trennen`: `getrennt:` (keine Verbindung zwischen den Reihen dieser Titel, gleich welcher Art). */
export type ReinHand = { verbinden: number[][]; trennen: number[][] }
export type ReinErgebnis = {
  /** Reihe je Titel: die kleinste Titel-Kennung der Reihe, bei festen Titeln deren Reihe. */
  reihe: Map<number, number>
  pruefliste: Pruefzeile[]
  /** Titel, die mit anderen in einer Reihe stehen / Reihen mit mehreren Titeln. */
  inReihen: number
  reihen: number
}

/**
 * **Die Regel für „?“ und die Sammelarten** (Prüfer 11.10.2026: „?“ lag bei 4 von 15 Katalogtreffern falsch, ein Alleinstehender mit „Anderes“ als einziger Kante landete in Final Fantasy VII;
 * die „?“-Kante Gintama-Brücke verband zwei große Reihen). Gemessen in `daniel-zum-abarbeiten/berichte/reihen-anisearch-schalter-2026-10-12.md`.
 *  1. Kernarten (und gleiche MAL-Kennung, gleiche Kennung) verbinden immer; zuerst.
 *  2. „?“ zählt wie eine Kernart, aber danach und nie als Brücke: verbände sie zwei Reihen mit mehreren Titeln (oder zwei feste), bleibt sie auf der Prüfliste.
 *  3. Sammelarten (Anderes, Charakter, Crossover; Bedingung Namensanfang wie in `REGEL`) zuletzt, nie als Brücke und nie für einen Alleinstehenden, der nur über sie hängt: sie ergänzen nur
 *     Reihen, die schon feststehen. „Gemeinsames Universum“ verbindet nie und steht als Fall auf der Prüfliste.
 */
const SAMMELARTEN: ReadonlySet<string> = new Set(['Anderes', 'Charakter', 'Crossover', 'Gemeinsames Universum'])
const UNSICHER = '?'
const UNIVERSUM = 'Gemeinsames Universum'

/** 0 Kern, 1 „?“, 2 Sammelart. */
export const rangDerArt = (art: string): 0 | 1 | 2 => (art === UNSICHER ? 1 : SAMMELARTEN.has(art) ? 2 : 0)

type Sperre = { x: number; y: number; art: string; grund: 'bruecke' | 'sammelart' }

/** Union-Find über Knoten (kleinste Kennung gewinnt, Titel vor Seiten ohne Titel) mit Größe und fester Reihe je Wurzel; Knoten entstehen beim ersten Zugriff. */
function bildner(fest: Map<number, number>) {
  const eltern = new Map<number, number>()
  const groesse = new Map<number, number>()
  const feste = new Map(fest)
  const find = (id: number): number => {
    if (!eltern.has(id)) {
      eltern.set(id, id)
      groesse.set(id, 1)
    }
    let r = id
    while (eltern.get(r) !== r) r = eltern.get(r)!
    return r
  }
  const vereine = (a: number, b: number): void => {
    const [ra, rb] = [find(a), find(b)]
    if (ra === rb) return
    const [klein, gross] = ra < rb ? [ra, rb] : [rb, ra]
    eltern.set(gross, klein)
    groesse.set(klein, groesse.get(klein)! + groesse.get(gross)!)
    if (!feste.has(klein) && feste.has(gross)) feste.set(klein, feste.get(gross)!)
  }
  /** Eine Reihe zählt als groß, wenn sie mehrere Titel hat oder schon ausgeliefert (fest) ist. */
  const gross = (r: number): boolean => groesse.get(r)! > 1 || feste.has(r)
  return { find, vereine, gross, groesse, feste }
}
type Bildner = ReturnType<typeof bildner>

/** Titel je aniSearch-Kennung; zusätzlich je MAL-Kennung (gleiche MAL-Kennung = gleiche Einheit). */
function einheiten(titel: ReinTitel[]): Map<number, number[]> {
  const jeKennung = new Map<number, number[]>()
  for (const t of titel) if (t.anisearchId) jeKennung.set(t.anisearchId, [...(jeKennung.get(t.anisearchId) ?? []), t.id])
  return jeKennung
}

/** Knoten einer aniSearch-Kennung: ihre Titel, sonst die Seite selbst. */
const knoten = (kennung: number, jeKennung: Map<number, number[]>): number[] => jeKennung.get(kennung) ?? [ANONYM + kennung]

/** Knoten-Paare einer Kante (jede Kennung kann mehrere Titel tragen). */
const paare = (k: Kante, jeKennung: Map<number, number[]>): [number, number][] => knoten(k.a, jeKennung).flatMap((x) => knoten(k.b, jeKennung).map((y): [number, number] => [x, y]))

/** Verbietet eine Handtrennung die Verbindung der Reihen von `x` und `y`? */
const getrennt = (b: Bildner, trennen: number[][], x: number, y: number): boolean => {
  const [rx, ry] = [b.find(x), b.find(y)]
  return trennen.some((g) => g.some((m) => b.find(m) === rx) && g.some((m) => b.find(m) === ry))
}

/** Prüft eine Kante gegen die Regel; gibt den Sperrgrund zurück oder `undefined`, wenn verbunden werden darf. */
function sperrgrund(b: Bildner, hand: ReinHand, x: number, y: number, rang: 0 | 1 | 2): 'getrennt' | 'bruecke' | 'sammelart' | undefined {
  const [rx, ry] = [b.find(x), b.find(y)]
  if (b.feste.has(rx) && b.feste.has(ry) && b.feste.get(rx) !== b.feste.get(ry)) return 'bruecke'
  if (getrennt(b, hand.trennen, x, y)) return 'getrennt'
  if (rang === 0) return undefined
  if (b.gross(rx) && b.gross(ry)) return 'bruecke'
  return rang === 2 && (!b.gross(rx) || !b.gross(ry)) ? 'sammelart' : undefined
}

/** Sperren am Ende zu Prüfzeilen: nur solche, die am Schluss noch zwei Reihen trennen; je Reihenpaar (und Alleinstehende) eine Zeile. */
function sperrenZuZeilen(sperren: Sperre[], b: Bildner, name: (id: number) => string): Pruefzeile[] {
  const ref = (r: number): ReiheRef => ({ id: r, name: name(r), titel: b.groesse.get(r)! })
  const zeilen = new Map<string, Pruefzeile>()
  for (const s of sperren) {
    const [rx, ry] = [b.find(s.x), b.find(s.y)]
    if (rx === ry || rx >= ANONYM || ry >= ANONYM) continue
    const alleinstehend = [rx, ry].filter((r) => !b.gross(r))
    const reihen = [rx, ry].filter((r) => b.gross(r)).sort((p, q) => p - q)
    const art = s.grund === 'sammelart' ? 'sammelart' : 'verschmilzt'
    const schluessel = `${art}|${reihen.join(',')}|${alleinstehend.join(',')}`
    if (!zeilen.has(schluessel)) zeilen.set(schluessel, { art, reihen: reihen.map(ref), alleinstehende: alleinstehend.map(name), beispiel: `${name(s.x)} —${s.art}→ ${name(s.y)}` })
  }
  return [...zeilen.values()]
}

/** „Gemeinsames Universum“ verbindet nichts, zeigt aber, was zusammenpassen könnte: je Paar von Reihen, die verschieden bleiben, eine Zeile. */
function universumZeilen(kanten: Kante[], jeKennung: Map<number, number[]>, b: Bildner, name: (id: number) => string): Pruefzeile[] {
  const zeilen = new Map<string, Pruefzeile>()
  for (const k of kanten.filter((x) => x.art === UNIVERSUM)) {
    for (const [x, y] of paare(k, jeKennung)) {
      const [rx, ry] = [b.find(x), b.find(y)].sort((p, q) => p - q)
      if (rx === ry || rx! >= ANONYM || ry! >= ANONYM || zeilen.has(`${rx}|${ry}`)) continue
      const ref = (r: number): ReiheRef => ({ id: r, name: name(r), titel: b.groesse.get(r)! })
      zeilen.set(`${rx}|${ry}`, { art: 'universum', reihen: [ref(rx!), ref(ry!)], alleinstehende: [], beispiel: `${name(x)} —${UNIVERSUM}→ ${name(y)}` })
    }
  }
  return [...zeilen.values()]
}

/** Die Kanten, die unter der Regel zählen, in der Reihenfolge Kern, „?“, Sammelart (innerhalb davon nach Kennung, damit das Ergebnis nicht von der Leseordnung abhängt). */
function zaehlendeKanten(titel: ReinTitel[], kanten: Kante[], namen: Namen): Kante[] {
  const mal = malKanten(titel.map((t) => ({ anisearchId: t.anisearchId, mal: t.mal })))
  return [...kanten, ...mal]
    .filter((k) => zaehlt(k, WANDERREGEL, namen))
    .sort((p, q) => rangDerArt(p.art) - rangDerArt(q.art) || p.a - q.a || p.b - q.b || p.art.localeCompare(q.art))
}

/**
 * `titel`: alle Titel, die in Reihen gehören; `kanten`/`namen`: aniSearch-Beziehungen aus dem Archiv; `hand`: `reihen-von-hand.yaml`;
 * `fest`: Titel, deren Reihe schon ausgeliefert ist (Hauptbestand beim Katalog; Kennung = ihre Reihe) — zwei feste Reihen verschmelzen nie.
 */
export function reineReihen(titel: ReinTitel[], kanten: Kante[], namen: Namen, hand: ReinHand, fest: Map<number, number> = new Map()): ReinErgebnis {
  const ids = titel.map((t) => t.id)
  const b = bildner(fest)
  const vorhanden = new Set(ids)
  const jeKennung = einheiten(titel)
  const nameJeId = new Map(titel.map((t) => [t.id, t.name]))
  const name = (id: number): string => nameJeId.get(id) ?? namen.get(id - ANONYM)?.[0] ?? `#${id}`
  // Feste Titel derselben Reihe sind schon eins.
  const ersterJeReihe = new Map<number, number>()
  for (const [id, reihe] of fest) {
    if (!vorhanden.has(id)) continue
    ersterJeReihe.set(reihe, ersterJeReihe.get(reihe) ?? id)
    b.vereine(ersterJeReihe.get(reihe)!, id)
  }
  for (const g of hand.verbinden) g.filter((id) => vorhanden.has(id)).forEach((id, _i, l) => b.vereine(l[0]!, id))
  for (const l of jeKennung.values()) l.slice(1).forEach((id) => b.vereine(l[0]!, id))
  const sperren: Sperre[] = []
  for (const k of zaehlendeKanten(titel, kanten, namen)) {
    for (const [x, y] of paare(k, jeKennung)) {
      if (b.find(x) === b.find(y)) continue
      const grund = sperrgrund(b, hand, x, y, rangDerArt(k.art))
      if (!grund) b.vereine(x, y)
      else if (grund !== 'getrennt') sperren.push({ x, y, art: k.art, grund })
    }
  }
  const reihe = new Map(ids.map((id): [number, number] => [id, b.feste.get(b.find(id)) ?? b.find(id)]))
  const pruefliste = [...sperrenZuZeilen(sperren, b, name), ...universumZeilen(kanten, jeKennung, b, name)]
  const jeReihe = new Map<number, number>()
  for (const r of reihe.values()) jeReihe.set(r, (jeReihe.get(r) ?? 0) + 1)
  const mehrere = [...jeReihe.values()].filter((n) => n > 1)
  return { reihe, pruefliste, inReihen: mehrere.reduce((s, n) => s + n, 0), reihen: mehrere.length }
}

