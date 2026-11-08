/**
 * Schattenlauf der Anime2You-Regel (`lib/anime2you-regel.ts`): im Claude-Lauf liest die Regel dieselben Artikel und wird mit Claudes Rohantwort verglichen.
 * Der Vergleich beeinflusst nichts; er landet als Zeile je Lauf in `data/proposals/anime2you-schatten.json`. Die Schwellen für die Übernahme
 * stehen in `daniel-zum-abarbeiten/berichte/anime2you-ohne-claude-vergleich-2026-11-07.md` (Abschnitt 4).
 *
 * Je Artikel und Schlüssel (Titel + Plattform):
 * - **gleich**: die Regel behauptet deutsche Fassung, und Claude hat zum selben Titel und derselben Plattform einen Vorschlag mit deutscher Sprache
 *   (die Art ist gleich: die Regel kennt keine; Iron Man „abgang“ und Anlegion „ankuendigung“ sind dieselbe Aussage).
 * - **nurRegel**: die Regel behauptet, Claude nicht (kein Vorschlag, oder einer ohne deutsche Sprache: `widerspruch`). Das ist der mögliche Fehlbeleg.
 * - **nurClaude**: Claude hat einen belegtragenden Vorschlag (deutsch, nicht unsicher, Art start/folgen/sprachfassung, Stream-Plattform), die Regel keine
 *   Behauptung dazu: Rest, den Claude weiter lesen muss.
 */
import { leseBehauptungen, type Behauptung } from './anime2you-regel.ts'

/** Wie im Bericht: deutsche Sprache, nicht unsicher, Art eines Starts, eine Stream-Plattform. */
const BELEG_ARTEN = ['start', 'folgen', 'sprachfassung']
const STREAM_PLATTFORMEN = ['crunchyroll', 'netflix', 'primevideo', 'disneyplus', 'paramountplus', 'adn', 'aniverse', 'wow', 'joyn', 'rtlplus', 'youtube']

export interface Fall {
  titel: string
  plattform: string
  /** Nur bei nurRegel: Claude hatte zum selben Titel und derselben Plattform einen Vorschlag ohne deutsche Sprache. */
  widerspruch?: true
}

export interface ArtikelVergleich {
  artikelId: string
  gleich: number
  nurRegel: Fall[]
  nurClaude: Fall[]
}

export interface Lauf {
  am: string
  /** Artikel mit Claude-Antwort, die verglichen wurden. */
  artikel: number
  /** Artikel, bei denen Claude keine lesbare Antwort lieferte (nicht verglichen). */
  ohneAntwort: number
  /** Artikel, bei denen der Schatten selbst scheiterte (abgefangen, nicht verglichen). */
  schattenFehler: number
  gleich: number
  nurRegel: number
  nurClaude: number
  /** Dauer des Schattenschritts in Millisekunden. */
  ms: number
  /** Die Abweichungen im Einzelnen, damit jede ein Testfall werden kann. */
  faelle: { artikelId: string; seite: 'nurRegel' | 'nurClaude'; titel: string; plattform: string; widerspruch?: true }[]
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '')

/** Titel gleich oder einer der beiden der längere mit dem anderen als Anfang („Titel“ gegen „Titel Staffel 2“). */
export function titelGleich(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)))
}

interface Roh {
  titel: string
  plattform: string
  deutsch: boolean
  belegtragend: boolean
}

function liesRoh(roh: unknown): Roh | undefined {
  if (typeof roh !== 'object' || roh === null) return undefined
  const v = roh as Record<string, unknown>
  if (typeof v.titel !== 'string' || typeof v.plattform !== 'string') return undefined
  const sprache = typeof v.sprache === 'string' ? v.sprache : ''
  const art = typeof v.art === 'string' ? v.art : ''
  const deutsch = sprache.startsWith('deutsch')
  const belegtragend = deutsch && !v.unsicher && BELEG_ARTEN.includes(art) && STREAM_PLATTFORMEN.includes(v.plattform)
  return { titel: v.titel, plattform: v.plattform, deutsch, belegtragend }
}

const einmalJeSchluessel = <T extends { titel: string; plattform: string }>(liste: T[]): T[] =>
  liste.filter((x, i) => liste.findIndex((y) => y.plattform === x.plattform && titelGleich(y.titel, x.titel)) === i)

/** Vergleich der Regel mit Claudes Rohvorschlägen eines Artikels. */
export function vergleiche(artikelId: string, regel: Behauptung[], claude: unknown[]): ArtikelVergleich {
  const roh = claude.map(liesRoh).filter((r): r is Roh => r !== undefined)
  const belege = einmalJeSchluessel(roh.filter((r) => r.belegtragend))
  const behauptet = einmalJeSchluessel(regel)
  let gleich = 0
  const nurRegel: Fall[] = []
  for (const b of behauptet) {
    const gleicher = roh.filter((r) => r.plattform === b.plattform && titelGleich(r.titel, b.titel))
    if (gleicher.some((r) => r.deutsch)) {
      gleich++
      continue
    }
    nurRegel.push({ titel: b.titel, plattform: b.plattform, ...(gleicher.length ? { widerspruch: true as const } : {}) })
  }
  const nurClaude = belege.filter((r) => !behauptet.some((b) => b.plattform === r.plattform && titelGleich(r.titel, b.titel))).map((r) => ({ titel: r.titel, plattform: r.plattform }))
  return { artikelId, gleich, nurRegel, nurClaude }
}

/** Ein Artikel: Regel lesen, mit Claudes Antwort vergleichen. */
export function vergleicheArtikel(artikelId: string, text: string, claude: unknown[]): ArtikelVergleich {
  return vergleiche(artikelId, leseBehauptungen(text), claude)
}

export interface ArtikelEingabe {
  id: string
  /** Inhalt von `artikel/<id>.txt`. */
  text: string
  /** Claudes Rohvorschläge; `undefined`, wenn keine lesbare Antwort da ist. */
  claude: unknown[] | undefined
}

/**
 * Der ganze Lauf. Ein Fehler in einem Artikel (Regel wirft, kaputte Eingabe) zählt als `schattenFehler` und bricht nichts ab;
 * `jetzt` liefert Millisekunden (eingespeist, damit Tests keine Uhr lesen).
 */
export function schattenLauf(am: string, artikel: ArtikelEingabe[], jetzt: () => number): Lauf {
  const start = jetzt()
  const lauf: Lauf = { am, artikel: 0, ohneAntwort: 0, schattenFehler: 0, gleich: 0, nurRegel: 0, nurClaude: 0, ms: 0, faelle: [] }
  for (const a of artikel) {
    if (!a.claude) {
      lauf.ohneAntwort++
      continue
    }
    try {
      const v = vergleicheArtikel(a.id, a.text, a.claude)
      lauf.artikel++
      lauf.gleich += v.gleich
      lauf.nurRegel += v.nurRegel.length
      lauf.nurClaude += v.nurClaude.length
      for (const f of v.nurRegel) lauf.faelle.push({ artikelId: a.id, seite: 'nurRegel', ...f })
      for (const f of v.nurClaude) lauf.faelle.push({ artikelId: a.id, seite: 'nurClaude', ...f })
    } catch {
      lauf.schattenFehler++
    }
  }
  lauf.ms = Math.max(0, jetzt() - start)
  return lauf
}

export interface SchattenBestand {
  laeufe: Lauf[]
}

/** So lange bleiben Läufe im Bestand; die Auswertung braucht 7 Tage, der Rest ist Puffer für Wiederholungen. */
export const SCHATTEN_AUFBEWAHREN_TAGE = 30

const tage = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000

export function ergaenzeSchatten(alt: SchattenBestand, lauf: Lauf): SchattenBestand {
  const behalten = alt.laeufe.filter((l) => tage(lauf.am) - tage(l.am) <= SCHATTEN_AUFBEWAHREN_TAGE)
  return { laeufe: [...behalten, lauf] }
}

export const SCHWELLE = { mindestBehauptungen: 100, mindestTage: 7, hoechstensRest: 0.15 } as const

export interface Bilanz {
  laeufe: number
  tage: number
  behauptungen: number
  gleich: number
  fehlbelege: number
  widersprueche: number
  nurClaude: number
  /** nurClaude / (gleich + nurClaude); 0, wenn beide 0 sind. */
  restquote: number
  schattenFehler: number
  ohneAntwort: number
  maxMs: number
  urteil: 'ja' | 'nein' | 'offen'
  gruende: string[]
}

/** Hält den Bestand gegen die Schwellen: 0 Fehlbelege bei mindestens 100 Behauptungen und 7 Tagen, Rest höchstens 15 %. */
export function bilanz(b: SchattenBestand): Bilanz {
  const l = b.laeufe
  const summe = (f: (x: Lauf) => number): number => l.reduce((s, x) => s + f(x), 0)
  const gleich = summe((x) => x.gleich)
  const fehlbelege = summe((x) => x.nurRegel)
  const nurClaude = summe((x) => x.nurClaude)
  const behauptungen = gleich + fehlbelege
  const daten = l.map((x) => tage(x.am))
  const spanne = daten.length ? Math.max(...daten) - Math.min(...daten) : 0
  const restquote = gleich + nurClaude ? nurClaude / (gleich + nurClaude) : 0
  const widersprueche = l.reduce((s, x) => s + x.faelle.filter((f) => f.seite === 'nurRegel' && f.widerspruch).length, 0)
  const gruende: string[] = []
  if (fehlbelege > 0) gruende.push(`${fehlbelege} Fehlbelege (Schwelle 0)`)
  if (restquote > SCHWELLE.hoechstensRest) gruende.push(`Restquote ${(restquote * 100).toFixed(1)} % (Schwelle ${SCHWELLE.hoechstensRest * 100} %)`)
  const offen: string[] = []
  if (behauptungen < SCHWELLE.mindestBehauptungen) offen.push(`erst ${behauptungen} von ${SCHWELLE.mindestBehauptungen} Behauptungen`)
  if (spanne < SCHWELLE.mindestTage) offen.push(`erst ${spanne} von ${SCHWELLE.mindestTage} Tagen`)
  const urteil = gruende.length ? 'nein' : offen.length ? 'offen' : 'ja'
  return {
    laeufe: l.length,
    tage: spanne,
    behauptungen,
    gleich,
    fehlbelege,
    widersprueche,
    nurClaude,
    restquote,
    schattenFehler: summe((x) => x.schattenFehler),
    ohneAntwort: summe((x) => x.ohneAntwort),
    maxMs: Math.max(0, ...l.map((x) => x.ms)),
    urteil,
    gruende: [...gruende, ...offen],
  }
}
