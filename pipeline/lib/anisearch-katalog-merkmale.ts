/**
 * Merkmale, die einen AniList-Titel und einen aniSearch-Eintrag zusammenführen oder trennen (Katalogabgleich, 11.10.2026): genauer Erscheinungstag,
 * Folgenlänge, gemeinsamer Namensteil. Daniel (11.10.2026): „Gleiches Erscheinungsdatum, gleiche Folgenzahl, gleiche Länge, beide Namen enthalten
 * denselben Teil — so eindeutige Zuweisungen entscheidest du selbst." Reine Logik; `anisearch-katalog-abgleich.ts` ruft sie auf.
 */
import type { AsEintrag, AsTitel, Kandidat, KatalogTitel } from './anisearch-katalog-abgleich.ts'
import { normalisiere } from './anisearch-namen.ts'

/** Ein gemeinsamer Namensteil zählt ab so vielen normalisierten Zeichen; kürzer ist es Zufall („anime", „movie"). */
const NAMENSTEIL_MIN = 10

type Lage = 'gleich' | 'anders' | 'offen'

const vollerTag = (s: string | undefined): string | undefined => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !s.includes('-00') ? s : undefined)

/** Nur ganze Tage zählen; „2018-06", „1976" und aniSearchs „2029-00-00" sind offen. */
export function vergleicheTag(a: string | undefined, b: string | undefined): Lage {
  const x = vollerTag(a)
  const y = vollerTag(b)
  if (!x || !y) return 'offen'
  return x === y ? 'gleich' : 'anders'
}

/** Gleich ist dieselbe Minutenzahl, ab zehn Minuten auch eine daneben (AniList und aniSearch runden verschieden). */
export function vergleicheLaenge(a: number | null | undefined, b: number | null | undefined): Lage {
  if (!a || !b) return 'offen'
  return a === b || (Math.min(a, b) >= 10 && Math.abs(a - b) <= 1) ? 'gleich' : 'anders'
}

/** Folgenzahl mal Länge: AniList zählt Kurzformate anders als aniSearch (26 × 21 Minuten gegen 78 × 7), die Laufzeit bleibt dieselbe. */
export function gleicheGesamtlaufzeit(k: KatalogTitel, e: AsEintrag): boolean {
  return Boolean(k.folgen && k.dauer && e.f && e.min) && k.folgen! * k.dauer! === e.f! * e.min!
}

function laengsterGemeinsamerTeil(x: string, y: string): number {
  let vorher = new Array<number>(y.length + 1).fill(0)
  let beste = 0
  for (let i = 1; i <= x.length; i++) {
    const jetzt = new Array<number>(y.length + 1).fill(0)
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) jetzt[j] = vorher[j - 1]! + 1
      beste = Math.max(beste, jetzt[j]!)
    }
    vorher = jetzt
  }
  return beste
}

/** Teilen zwei Schreibweisen (je eine aus beiden Listen) einen Namensteil von mindestens `NAMENSTEIL_MIN` Zeichen? */
export function gemeinsamerNamensteil(a: string[], b: string[]): boolean {
  const lang = (namen: string[]) => [...new Set(namen.map(normalisiere).filter((n) => n.length >= NAMENSTEIL_MIN))]
  const ys = lang(b)
  return lang(a).some((x) => ys.some((y) => laengsterGemeinsamerTeil(x, y) >= NAMENSTEIL_MIN))
}

/** Ein Jahr, das AniList oder aniSearch als Platzhalter für „noch nicht angekündigt" führen, zählt nicht. */
const jahrOffen = (j: number | null | undefined, heuteJahr: number): boolean => !j || j > heuteJahr + 2

export interface Pruefling {
  k: KatalogTitel
  c: Kandidat
  t: AsTitel
  e: AsEintrag | undefined
  /** Format beider Seiten verträglich (`formatVertraeglich`). */
  formatOk: boolean
  heuteJahr: number
}

const folgenVertraeglich = (k: KatalogTitel, e: AsEintrag): boolean => !k.folgen || !e.f || k.folgen === e.f

/**
 * Grund, warum Tag, Länge und Name den Kandidaten **allein** belegen, auch bei abweichendem Format, Jahr oder Folgenzahl — sonst leer.
 * Eine andere MAL-Kennung schließt es aus. Die Fälle: Starttag + Länge, Starttag + Gesamtlaufzeit, Start- und Endtag (je mit gleichem Namen oder Namensteil),
 * gleicher Name + Länge + Folgenzahl bei fehlendem Jahr, gleicher Name bei beiderseits fehlendem Jahr.
 */
export function belegGrund(p: Pruefling): string | undefined {
  const { k, c, t, e } = p
  if (!e || (e.mal && k.mal && e.mal !== k.mal)) return undefined
  const tag = vergleicheTag(k.start, e.von) === 'gleich'
  const laenge = vergleicheLaenge(k.dauer, e.min) === 'gleich'
  const nameNah = (): boolean => c.gleicherName || gemeinsamerNamensteil(k.namen, t.namen)
  if (tag && laenge && nameNah()) return 'Starttag, Folgenlänge und Name gleich'
  if (tag && gleicheGesamtlaufzeit(k, e) && nameNah()) return 'Starttag und Gesamtlaufzeit (Folgen × Länge) gleich, Name gleich'
  if (tag && vergleicheTag(k.ende, e.bis) === 'gleich' && nameNah()) return 'Start- und Endtag gleich, Name gleich'
  const keinJahr = jahrOffen(k.jahr, p.heuteJahr) || jahrOffen(e.y, p.heuteJahr)
  if (c.gleicherName && laenge && k.folgen && k.folgen === e.f && keinJahr) return 'Name, Folgenlänge und Folgenzahl gleich, Jahr fehlt'
  if (c.gleicherName && p.formatOk && folgenVertraeglich(k, e) && jahrOffen(k.jahr, p.heuteJahr) && jahrOffen(e.y, p.heuteJahr)) return 'Name gleich, beide ohne gesichertes Jahr'
  return undefined
}

/** Grund, warum ein Merkmal den Kandidaten klar widerlegt (anderes Werk): andere MAL-Kennung, oder anderer Starttag **und** andere Länge. */
export function widerlegtGrund(k: KatalogTitel, e: AsEintrag | undefined): string | undefined {
  if (!e) return undefined
  if (e.mal && k.mal && e.mal !== k.mal) return `MAL ${e.mal} statt ${k.mal}`
  if (vergleicheTag(k.start, e.von) === 'anders' && vergleicheLaenge(k.dauer, e.min) === 'anders' && !gleicheGesamtlaufzeit(k, e)) {
    return `Starttag ${e.von} statt ${k.start} und ${e.min} statt ${k.dauer} Minuten`
  }
  return undefined
}
