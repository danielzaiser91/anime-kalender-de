import yaml from 'js-yaml'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, readJson } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { ankuendigungenLaden } from '../lib/ankuendigungen.ts'

/**
 * **Kinostart-Ankündigungen, von Hand recherchiert** (`data/kino-ankuendigungen.yaml`).
 *
 * Nur, was über AniLists `jpStart` hinausgeht: ein genauerer japanischer
 * Termin, ein angekündigter deutscher Zeitraum, der Verleih. Ein genauer
 * deutscher Termin gehört nicht hierher, sondern als Release nach
 * `data/curated/kino-2026.yaml` — nur dort erscheint er im Kalender.
 *
 * Die Datei liegt bewusst nicht unter `data/curated/`: `loadCurated()` liest
 * dort jede YAML als Release-Liste.
 */
type KinoAnkuendigung = {
  anilistId: number
  /** `false`, wo die Recherche ergab, dass es kein Kinofilm ist (YouTube, Festival-Kurzfilm, Promo). */
  kinofilm?: false
  /** Herkunftsland, wo es nicht Japan ist — überschreibt den Katalog. */
  land?: string
  jp?: string | Date
  /** Deutscher Kinostart einer Fassung **ohne** Synchro (sonst ein Release in `kino-2026.yaml`). */
  deTermin?: string | Date
  deZeitraum?: string
  verleih?: string
  fassung?: 'synchro' | 'omu' | 'beides'
  sources?: string[]
}

const KINO_ANKUENDIGUNGEN = new Map(
  (
    (yaml.load(readFileSync(resolve(ROOT, 'data/kino-ankuendigungen.yaml'), 'utf8')) as KinoAnkuendigung[] | null) ?? []
  ).map((k) => [k.anilistId, k]),
)

export function kinoFeld(id: number): { kino?: NonNullable<Title['kino']>; land?: string } {
  const k = KINO_ANKUENDIGUNGEN.get(id)
  if (!k) return {}
  /* Ein unquotiertes Datum macht js-yaml zum Date — hier wird es wieder Text. */
  const text = (d: string | Date | undefined) => (d instanceof Date ? d.toISOString().slice(0, 10) : d)
  const jp = text(k.jp)
  const deTermin = text(k.deTermin)
  return {
    ...(k.land ? { land: k.land } : {}),
    kino: {
      ...(k.kinofilm === false ? { kinofilm: false as const } : {}),
      ...(jp ? { jp } : {}),
      ...(deTermin ? { deTermin } : {}),
      ...(k.deZeitraum ? { deZeitraum: k.deZeitraum } : {}),
      ...(k.verleih ? { verleih: k.verleih } : {}),
      ...(k.fassung ? { fassung: k.fassung } : {}),
      ...(k.sources?.[0] ? { quelle: k.sources[0] } : {}),
    },
  }
}

/**
 * **Von Hand nachgetragene aniSearch-Kennungen.**
 *
 * Die ID-Brücke (`data/anime-ids.json`) kommt aus der anime-offline-database
 * und hinkt bei neuen Titeln hinterher — genau die stehen bei uns auf der
 * Prüfliste. Fehlt die Kennung, verweist die Erweiterung auf die Suche statt
 * auf den Titel (Daniel, 06.09.2026 an „Nukitashi": „besser natürlich direkt
 * linken").
 *
 * Die Datei überlebt jeden Lauf; `anime-ids.json` wird beim Auffrischen
 * vollständig neu geschrieben. Deshalb steht sie hier davor.
 */
export const anisearchHand: Record<number, number> = (() => {
  try {
    const roh = yaml.load(readFileSync(resolve(ROOT, 'data/anisearch-ids-hand.yaml'), 'utf8'))
    const raus: Record<number, number> = {}
    for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
      if (Number.isFinite(Number(k)) && Number.isFinite(Number(v))) raus[Number(k)] = Number(v)
    }
    return raus
  } catch {
    /* Ohne Datei bleibt es bei der Brücke. */
    return {}
  }
})()

/** Termine, die ein Anbieter nicht eingehalten hat — siehe `pipeline/termine-pruefen.ts`. */
export const verpassteTermine = readJson<
  Array<{
    slug: string
    episode: number | null
    erwartetAm: string
    erschienenAm?: string | null
    verzugStunden?: number | null
    folgenVerfuegbar?: number | null
    neuErwartet?: string | null
    recherche?: string | null
    rechercheQuelle?: string | null
    rechercheAm?: string | null
    geprueftAm?: string | null
    newsGeprueftAm?: string | null
    hinweise?: { quelle: string; titel: string; url: string; datum: string }[]
  }>
>('data/termine-verpasst.json', [])

export const OUT = 'public/data'

/* Angekündigte Simulcasts fürs Panel — siehe `pipeline/lib/ankuendigungen.ts`. Ein Fehler in der Datei bricht hier ab. */
const ANKUENDIGUNGEN = ankuendigungenLaden(process.cwd())

export const mitAnkuendigung = <T extends { id: number }>(t: T): T =>
  ANKUENDIGUNGEN.has(t.id) ? { ...t, ankuendigung: ANKUENDIGUNGEN.get(t.id) } : t

/** Deutsche Sprechrollen, eine Datei je Titel — gefüllt von `data:voices`. */
export const VOICES_DIR = `${OUT}/voices`

export const KEYWORD_MIN_RANK = 55

export const KEYWORD_MAX = 24

export const CR_CALENDAR_URL = 'https://www.crunchyroll.com/de/simulcastcalendar'

/**
 * Woher die ADN-Termine **wirklich** stammen.
 *
 * Hier stand bis zum 15.08.2026 die deutsche Startseite von ADN — und die ist
 * keine Quelle: Dort steht kein einziger dieser Termine, und wer den Link
 * öffnet, kann nichts nachprüfen. Daniel hat es gemeldet („das ist keine
 * quelle").
 *
 * Die Termine kommen aus ADNs eigener Programmschnittstelle, die
 * `fetch-adn.ts` abfragt. Die Adresse steht jetzt hier, weil sie die Wahrheit
 * ist; die Oberfläche verlinkt sie **nicht**, sondern schreibt „Termine direkt
 * von ADN ausgelesen". Ein Link auf einen API-Endpunkt hilft niemandem weiter.
 */
export const ADN_CALENDAR_URL = 'https://gw.api.animationdigitalnetwork.com/video/calendar'

/** Wie lange ein belegtes Nein eine Ergänzung aus aniSearch sperrt. */
export const NEIN_GILT_TAGE = 28

export interface EntfernterVerweis {
  titleId: number
  titel: string
  plattform: string
  url: string
  seriesId: string | null
  grund: string
  geprueftAm: string | null
  /**
   * **Wann dieser Verweis entfernt wurde — die Frist hängt daran.**
   *
   * Ohne das Feld ist ein Nein für immer wahr, und genau daran ist am
   * 07.09.2026 „Kill Blue" gescheitert: Am 24.08. hatte Crunchyroll dort **null**
   * deutsche Folgen, der Verweis flog zu Recht heraus. Am 06.09. erschienen die
   * Folgen 1–8 auf Deutsch — und der Kalender zeigte weiter keinen
   * Crunchyroll-Weg, behauptete also das Gegenteil.
   *
   * Dieselbe Regel steht seit dem 15.08.2026 in `CLAUDE.md`, nur für
   * Warteschlangen: „Jede Warteschlange wird nach dem Alter gebildet, nie nach
   * ‚schon beantwortet'." Das Gedächtnis war die Stelle, an der sie nie
   * angewandt wurde.
   */
  entferntAm: string | null
  letzterWeg: boolean
}
