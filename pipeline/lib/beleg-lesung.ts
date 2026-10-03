/**
 * **Lesungen eines Belegs** (Stufe 4 des Datenbank-Plans: Quelle → Lesung → Snapshot).
 *
 * Eine Lesung hält fest, was ein Artikel an einem Tag sagte: Hash des Textes, Veröffentlicht- und
 * Aktualisiert-Datum, dazu Bild und HTML in der privaten R2-Ablage. Erst mit zwei Lesungen lassen
 * sich „zuletzt aktualisiert" und „unverändert seit" belegen statt raten. Hier stehen nur reine
 * Rechnungen — der Abruf liegt in `pipeline/belege-lesen.ts`.
 */
import { createHash } from 'node:crypto'
import type { Quelle } from '../../shared/types.ts'

/** Artikel, keine Kalender, APIs oder Katalogseiten — nur sie haben einen Text, der sich ändern kann. */
const ARTIKEL = [
  /^https:\/\/www\.crunchyroll\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\/[a-z-]+\/\d{4}\//,
  /^https:\/\/www\.anime2you\.de\/news\/\d+\//,
  /^https:\/\/www\.anisearch\.de\/(?:article\/\d+|news\/)/,
  /^https:\/\/news\.animationdigitalnetwork\.com\/de\/\d{4}\//,
]

export function istArtikel(url: string): boolean {
  return ARTIKEL.some((m) => m.test(url))
}

/**
 * Hat die Seite ein Veröffentlichungsdatum des **Textes**? Eine aniSearch-Produktseite (`/article/…`)
 * nicht: Ihr „Veröffentlicht:" ist der Erscheinungstag der Ausgabe — der Tooltip nannte so „veröffentlicht
 * am 19.11.2026" für einen Artikel vom September (03.10.2026).
 */
export const traegtArtikeldatum = (url: string): boolean => !/anisearch\.de\/article\//.test(url)

export interface Lesung {
  /** Tag der Lesung (Europe/Berlin). */
  am: string
  /** SHA-256 des normalisierten Artikeltextes, gekürzt auf 16 Zeichen. */
  hash: string
  veroeffentlicht?: string
  aktualisiert?: string
  /** Schlüssel in der privaten Ablage, falls das Hochladen gelang. */
  bild?: string
  /** Artikeltext, gepackt (seit 03.10.2026; davor die ganze HTML-Seite in `html`). */
  text?: string
  html?: string
}

export interface BelegGedaechtnis {
  [url: string]: { zuletzt: string; lesungen: Lesung[] }
}

/** Leerraum und unsichtbare Zeichen zählen nicht als Änderung. */
export function textHash(text: string): string {
  const norm = text.replace(/[­​]/g, '').replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(norm).digest('hex').slice(0, 16)
}

const MONATE: Record<string, number> = {
  jan: 1, feb: 2, 'mär': 3, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12,
}

/** „15. SEPT. 2026, 18:00 MESZ" → „2026-09-15" (Crunchyrolls Kopfzeile). */
export function crunchyrollDatum(text: string | undefined): string | undefined {
  const m = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]{3,5})\.?\s*(\d{4})/.exec(text ?? '')
  const monat = m && MONATE[m[2]!.toLowerCase().slice(0, 3)]
  return m && monat ? `${m[3]}-${String(monat).padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : undefined
}

/** Nur das Datum einer ISO-Zeitangabe aus `article:published_time` u. ä. */
export function isoTag(wert: string | undefined | null): string | undefined {
  return /^\d{4}-\d{2}-\d{2}/.exec(wert ?? '')?.[0]
}

/**
 * Welche Artikel diesmal gelesen werden: nie gelesene zuerst, dann die am längsten nicht
 * gelesenen, aber keiner öfter als alle `abstandTage` Tage.
 */
export function warteschlange(urls: string[], gedaechtnis: BelegGedaechtnis, heute: string, abstandTage: number, limit: number): string[] {
  const grenze = new Date(Date.parse(heute) - abstandTage * 86_400_000).toISOString().slice(0, 10)
  return [...new Set(urls)]
    .filter(istArtikel)
    .filter((u) => !gedaechtnis[u] || gedaechtnis[u]!.zuletzt <= grenze)
    .sort((a, b) => (gedaechtnis[a]?.zuletzt ?? '').localeCompare(gedaechtnis[b]?.zuletzt ?? ''))
    .slice(0, limit)
}

/** Eine neue Lesung kommt nur dazu, wenn sich Text oder Daten geändert haben; sonst rückt `zuletzt` vor. */
export function merkeLesung(gedaechtnis: BelegGedaechtnis, url: string, lesung: Lesung): boolean {
  const eintrag = (gedaechtnis[url] ??= { zuletzt: lesung.am, lesungen: [] })
  eintrag.zuletzt = lesung.am
  const letzte = eintrag.lesungen.at(-1)
  /* Ein Datum, das die Seite nicht mehr nennt, ist keine Änderung — sonst entstünde bei gleichem Text eine zweite Lesung. */
  const gleich =
    letzte &&
    letzte.hash === lesung.hash &&
    (!lesung.veroeffentlicht || letzte.veroeffentlicht === lesung.veroeffentlicht) &&
    (!lesung.aktualisiert || letzte.aktualisiert === lesung.aktualisiert)
  if (gleich) return false
  eintrag.lesungen.push(lesung)
  return true
}

/** Seit wann der Text unverändert ist: Tag der letzten Lesung mit neuem Hash. */
export function unveraendertSeit(eintrag: BelegGedaechtnis[string] | undefined): string | undefined {
  return eintrag?.lesungen.at(-1)?.am
}

/**
 * Veröffentlicht- und Aktualisiert-Datum laut Lesung an die Quellen eines Termins — damit sagt der
 * Tooltip, wann die Quelle es gesagt hat, nicht wann wir sie zuerst sahen (news-plan.md).
 */
export function mitArtikeldaten(quellen: Quelle[], gedaechtnis: BelegGedaechtnis): Quelle[] {
  return quellen.map((q) => {
    const lesungen = traegtArtikeldatum(q.url) ? (gedaechtnis[q.url]?.lesungen ?? []) : []
    const veroeffentlicht = lesungen.map((l) => l.veroeffentlicht).find(Boolean)
    const aktualisiert = lesungen.map((l) => l.aktualisiert).filter(Boolean).at(-1)
    return {
      ...q,
      ...(veroeffentlicht ? { veroeffentlichtAm: veroeffentlicht } : {}),
      ...(aktualisiert && aktualisiert !== veroeffentlicht ? { aktualisiertAm: aktualisiert } : {}),
    }
  })
}
