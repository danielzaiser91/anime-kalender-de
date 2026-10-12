import { type Kante, type Namen, malKanten, zaehlt } from './anisearch-reihen.ts'
import type { Pruefzeile, ReiheRef } from './anisearch-reihen-uebernahme.ts'
import { WANDERREGEL } from './anisearch-reihen-uebernahme.ts'

/**
 * **Reihen rein aus aniSearch-Beziehungen** (Stufe C, Schritt 6 der AniList-Ablösung, 12.10.2026). Hinter dem Umgebungsschalter `REIHEN_QUELLE=anisearch`; ohne ihn bleibt die Basis
 * AniList (`03-reihen.ts`, `reihenFuerKatalog`) und aniSearch hängt nur Alleinstehende an. Reine Funktionen; Lesen, Schreiben und Anbindung in `anisearch-reihen-rein-bau.ts`.
 * Rechnet in Titel-Kennungen; Titel mit gleicher aniSearch-Kennung sind dieselbe Einheit; eine gleiche MAL-Kennung wirkt nur als Kante der Art `ART_MAL` (Regel „immer“), und nur bis `MAL_GRUPPE_MAX` aniSearch-Kennungen je MAL-Kennung (Sammelseiten nicht). Auch Seiten, zu denen es keinen Titel gibt, verbinden (wie bei AniList jeder Nachbar):
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
 * **Die Regel für „?“ und die Sammelarten.** Ohne AniList ist aniSearch die einzige Quelle, also darf ein Alleinstehender über sie wandern (die Hybridregel sperrte ihn im Katalog, weil dort AniList
 * die Reihe schon trug); gesperrt bleibt, was zwei Reihen verbände (Prüfer 11.10.2026: „?“-Brücke Gintama, Crossover Lupin/Conan). Stichprobe 12.10.2026: von 45 Alleinstehenden, die nur über
 * Anderes/Charakter/Crossover an einer Reihe hängen, sind nach Namen 43 plausibel (Sonderfolgen, Digests, Piloten zum selben Titel); Gegenbeispiel Final Fantasy → FF VII.
 *  1. Kernarten, gleiche MAL-Kennung und gleiche aniSearch-Kennung verbinden immer, zuerst — außer über einen Titel, dessen Haupthandlungen (`Hauptgeschichte`, `Komplette Geschichte`, von der Gegenseite
 *     `Nebengeschichte`, `Zusammenfassung`) in zwei Reihen mit mehreren Titeln liegen, die ohne ihn getrennt sind (Crossover, Sammelfilm: Fall 9, vier Serien um „Adesugata Mahou no Sannin Musume“).
 *     Er verbindet sie nicht, hängt sich an die Reihe mit der kleinsten Kennung und steht als `mehrdeutig` auf der Prüfliste; der Weg für eine andere Zuordnung ist `ids:`.
 *  2. „?“ zählt danach wie eine Kernart.
 *  3. Sammelarten (Anderes, Charakter, Crossover; Bedingung Namensanfang wie in `REGEL`) zuletzt.
 *  Eine Kante der Ränge 2 und 3 verbindet **nie zwei Reihen mit mehreren Titeln** (oder zwei feste Reihen): der Fall steht als `verschmilzt` auf der Prüfliste, der Weg ist `ids:` in
 *  `reihen-von-hand.yaml`. „Gemeinsames Universum“ verbindet nie und steht als Fall `universum` auf der Prüfliste.
 */
const SAMMELARTEN: ReadonlySet<string> = new Set(['Anderes', 'Charakter', 'Crossover', 'Gemeinsames Universum'])
const UNSICHER = '?'
const UNIVERSUM = 'Gemeinsames Universum'

/** 0 Kern, 1 „?“, 2 Sammelart. */
export const rangDerArt = (art: string): 0 | 1 | 2 => (art === UNSICHER ? 1 : SAMMELARTEN.has(art) ? 2 : 0)

type Sperre = { x: number; y: number; art: string }

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

/** Titel je aniSearch-Kennung (gleiche Kennung = dieselbe Einheit); die MAL-Kennung bildet keine Einheit, sie wirkt über `malVerbindungen` als Kante der Art `ART_MAL` zwischen aniSearch-Kennungen. */
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
function sperrgrund(b: Bildner, hand: ReinHand, x: number, y: number, rang: 0 | 1 | 2): 'getrennt' | 'bruecke' | undefined {
  const [rx, ry] = [b.find(x), b.find(y)]
  if (b.feste.has(rx) && b.feste.has(ry) && b.feste.get(rx) !== b.feste.get(ry)) return 'bruecke'
  if (getrennt(b, hand.trennen, x, y)) return 'getrennt'
  return rang !== 0 && b.gross(rx) && b.gross(ry) ? 'bruecke' : undefined
}

/** Sperren am Ende zu Prüfzeilen: nur solche, die am Schluss noch zwei Reihen trennen; je Reihenpaar eine Zeile. */
function sperrenZuZeilen(sperren: Sperre[], b: Bildner, name: (id: number) => string): Pruefzeile[] {
  const ref = (r: number): ReiheRef => ({ id: r, name: name(r), titel: b.groesse.get(r)! })
  const zeilen = new Map<string, Pruefzeile>()
  for (const s of sperren) {
    const [rx, ry] = [b.find(s.x), b.find(s.y)]
    if (rx === ry || rx >= ANONYM || ry >= ANONYM) continue
    const reihen = [rx, ry].sort((p, q) => p - q)
    const schluessel = reihen.join(',')
    if (!zeilen.has(schluessel)) zeilen.set(schluessel, { art: 'verschmilzt', reihen: reihen.map(ref), alleinstehende: [], beispiel: `${name(s.x)} —${s.art}→ ${name(s.y)}` })
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

/**
 * Gleiche MAL-Kennung verbindet — außer bei einer Sammelseite: MAL führt manchmal ganze Reihen unverwandter Titel unter einer Kennung (28149: 27 Kurzfilme, darunter Ryuu no Haisha und Carnage;
 * Verteilung am 12.10.2026: 6.767 Kennungen mit einem, 62 mit zwei, höchstens acht echte Teile einer Reihe, dann der Ausreißer mit 27). Mehr als `MAL_GRUPPE_MAX` Titel verbinden nicht.
 */
const MAL_GRUPPE_MAX = 8
function malVerbindungen(titel: ReinTitel[]): Kante[] {
  const kanten = malKanten(titel.map((t) => ({ anisearchId: t.anisearchId, mal: t.mal })))
  const groesse = new Map<number, number>()
  for (const k of kanten) groesse.set(k.a, (groesse.get(k.a) ?? 1) + 1)
  return kanten.filter((k) => groesse.get(k.a)! <= MAL_GRUPPE_MAX)
}

/** Die Kanten, die unter der Regel zählen, in der Reihenfolge Kern, „?“, Sammelart (innerhalb davon nach Kennung, damit das Ergebnis nicht von der Leseordnung abhängt). */
function zaehlendeKanten(titel: ReinTitel[], kanten: Kante[], namen: Namen): Kante[] {
  return [...kanten, ...malVerbindungen(titel)]
    .filter((k) => zaehlt(k, WANDERREGEL, namen))
    .sort((p, q) => rangDerArt(p.art) - rangDerArt(q.art) || p.a - q.a || p.b - q.b || p.art.localeCompare(q.art))
}

/** Verbindet die Kanten in der gegebenen Reihenfolge; gesperrte (Brücken) kommen zurück, Handtrennungen bleiben unbemerkt. */
function verbindeKanten(b: Bildner, hand: ReinHand, kanten: Kante[], jeKennung: Map<number, number[]>): Sperre[] {
  const sperren: Sperre[] = []
  for (const k of kanten) {
    for (const [x, y] of paare(k, jeKennung)) {
      if (b.find(x) === b.find(y)) continue
      const grund = sperrgrund(b, hand, x, y, rangDerArt(k.art))
      if (!grund) b.vereine(x, y)
      else if (grund !== 'getrennt') sperren.push({ x, y, art: k.art })
    }
  }
  return sperren
}

/** Kernarten, mit denen ein Titel auf seine Haupthandlung zeigt; `Nebengeschichte`/`Zusammenfassung` sind die Gegenrichtung (aniSearch führt jede Beziehung auf beiden Seiten). */
const AUF_HAUPT: ReadonlySet<string> = new Set(['Hauptgeschichte', 'Komplette Geschichte'])
const VON_HAUPT: ReadonlySet<string> = new Set(['Nebengeschichte', 'Zusammenfassung'])

/** Haupthandlungen (aniSearch-Kennungen) je Kennung. */
function haupthandlungen(kern: Kante[]): Map<number, Set<number>> {
  const haupt = new Map<number, Set<number>>()
  const merke = (titel: number, h: number): void => void haupt.set(titel, (haupt.get(titel) ?? new Set()).add(h))
  for (const k of kern) {
    if (AUF_HAUPT.has(k.art)) merke(k.a, k.b)
    else if (VON_HAUPT.has(k.art)) merke(k.b, k.a)
  }
  return haupt
}

/** Ein Alleinstehender, dessen Haupthandlungen in `reihen` (kleinste Kennung je Reihe) getrennt sind: Crossover, Sammelfilm. */
type Verbinder = { kennung: number; reihen: number[] }

/** Die Reihen mit mehreren Titeln, in denen die Haupthandlungen liegen. */
const haupthandlungsReihen = (b: Bildner, haupt: Set<number>, jeKennung: Map<number, number[]>): number[] =>
  [...new Set([...haupt].flatMap((h) => knoten(h, jeKennung).map((n) => b.find(n))).filter((r) => b.gross(r)))].sort((p, q) => p - q)

/**
 * Kernkanten. Ein Titel mit Haupthandlungen in zwei Reihen, die ohne ihn getrennt sind (Fall 9 im Messbericht: das Special „Adesugata Mahou no Sannin Musume“ verschmolz vier Serien), verbindet sie nicht:
 * erst werden die Reihen aus den Kanten der übrigen Titel gebildet, dann kommt jeder dieser Titel an die Reihe mit der kleinsten Kennung (Kanten in die anderen Reihen entfallen) und steht auf der Prüfliste.
 */
function verbindeKern(b: Bildner, hand: ReinHand, kern: Kante[], jeKennung: Map<number, number[]>): { sperren: Sperre[]; verbinder: Verbinder[] } {
  const haupt = haupthandlungen(kern)
  const offen = new Set([...haupt].filter(([, h]) => h.size > 1).map(([kennung]) => kennung))
  const frei = (k: Kante): boolean => !offen.has(k.a) && !offen.has(k.b)
  const jeKennungKanten = new Map<number, Kante[]>()
  for (const k of kern) for (const id of [k.a, k.b]) jeKennungKanten.set(id, [...(jeKennungKanten.get(id) ?? []), k])
  const sperren = verbindeKanten(b, hand, kern.filter(frei), jeKennung)
  const verbinder: Verbinder[] = []
  for (const kennung of [...offen].sort((p, q) => p - q)) {
    offen.delete(kennung)
    const reihen = haupthandlungsReihen(b, haupt.get(kennung)!, jeKennung)
    const eigene = (jeKennungKanten.get(kennung) ?? []).filter(frei)
    const ziel = reihen[0]
    const erlaubt = (k: Kante): boolean => knoten(k.a === kennung ? k.b : k.a, jeKennung).every((n) => !b.gross(b.find(n)) || b.find(n) === ziel)
    if (reihen.length > 1) verbinder.push({ kennung, reihen })
    sperren.push(...verbindeKanten(b, hand, reihen.length > 1 ? eigene.filter(erlaubt) : eigene, jeKennung))
  }
  return { sperren, verbinder }
}

/** Je Verbinder, dessen Reihen am Ende getrennt sind, eine Zeile `mehrdeutig` (wie `uebernimmReihen`: Alleinstehender mit Kanten in zwei Reihen). */
function verbinderZeilen(verbinder: Verbinder[], b: Bildner, jeKennung: Map<number, number[]>, name: (id: number) => string): Pruefzeile[] {
  const ref = (r: number): ReiheRef => ({ id: r, name: name(r), titel: b.groesse.get(r)! })
  return verbinder.flatMap(({ kennung, reihen }) => {
    const getrennte = [...new Set(reihen.map((r) => b.find(r)))].sort((p, q) => p - q)
    return getrennte.length > 1 ? [{ art: 'mehrdeutig' as const, reihen: getrennte.map(ref), alleinstehende: [name(knoten(kennung, jeKennung)[0]!)], beispiel: '' }] : []
  })
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
  const zaehlend = zaehlendeKanten(titel, kanten, namen)
  const kern = verbindeKern(b, hand, zaehlend.filter((k) => rangDerArt(k.art) === 0), jeKennung)
  const sperren = [...kern.sperren, ...verbindeKanten(b, hand, zaehlend.filter((k) => rangDerArt(k.art) > 0), jeKennung)]
  const reihe = new Map(ids.map((id): [number, number] => [id, b.feste.get(b.find(id)) ?? b.find(id)]))
  const pruefliste = [...sperrenZuZeilen(sperren, b, name), ...verbinderZeilen(kern.verbinder, b, jeKennung, name), ...universumZeilen(kanten, jeKennung, b, name)]
  const jeReihe = new Map<number, number>()
  for (const r of reihe.values()) jeReihe.set(r, (jeReihe.get(r) ?? 0) + 1)
  const mehrere = [...jeReihe.values()].filter((n) => n > 1)
  return { reihe, pruefliste, inReihen: mehrere.reduce((s, n) => s + n, 0), reihen: mehrere.length }
}

