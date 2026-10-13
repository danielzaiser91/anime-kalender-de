/**
 * Die Vorschlagsdatei `data/proposals/offizielle-news.json`: Meldungen offizieller Seiten, deren Überschrift nach Termin, Synchro, Staffel oder Ausstrahlung
 * klingt. Sie speist keinen Bau. Erst eine Freigabe von Hand macht aus einem Vorschlag eine Meldung (wie bei den Anime2You-Vorschlägen).
 */
import { createHash } from 'node:crypto'
import { tageZwischen } from './offiziell-datum.ts'
import type { Eintrag } from './offiziell-lesen.ts'
import { kategorie, type Kategorie } from './offiziell-relevanz.ts'
import type { Seite } from './offiziell-seiten.ts'

export interface Vorschlag {
  id: string
  host: string
  /** Kacheln, zu denen die Seite gehört (jüngste Staffel; mehrere = die Freigabe wählt). */
  titelIds: number[]
  /** Die Überschrift wörtlich, in der Sprache der Seite. */
  titel: string
  /** Der Tag, den die Seite der Meldung gibt. */
  datum: string
  url: string
  sprache: string
  kategorie: Kategorie
  /** Der Tag, an dem der Sammler die Meldung zum ersten Mal sah. */
  gefundenAm: string
}

export interface Vorschlagsdatei {
  vorschlaege: Vorschlag[]
}

/** So weit zurück liegende Meldungen werden vorgeschlagen — so lange zeigt die News-Art „offiziell“ sie auch (`pipeline/lib/news.ts`). */
export const KANDIDATEN_TAGE = 365
/** Wie lange ein Vorschlag in der Datei bleibt, gerechnet ab dem Tag der Meldung. */
export const BEHALTEN_TAGE = 400

export const vorschlagId = (host: string, datum: string, titel: string): string =>
  createHash('sha1').update(`${host}|${datum}|${titel}`).digest('hex').slice(0, 12)

/** Aus den Meldungen einer Seite die relevanten im Fenster. */
export function kandidaten(seite: Seite, eintraege: Eintrag[], titelIds: number[], heute: string): Vorschlag[] {
  return eintraege.flatMap((e) => {
    const k = kategorie(e.titel)
    if (!k || tageZwischen(e.datum, heute) > KANDIDATEN_TAGE) return []
    return [{ id: vorschlagId(seite.host, e.datum, e.titel), host: seite.host, titelIds, titel: e.titel, datum: e.datum, url: e.url, sprache: seite.sprache, kategorie: k, gefundenAm: heute }]
  })
}

/** Bekanntes bleibt bytegleich (auch `gefundenAm`), Neues kommt dazu, Altes fällt nach `BEHALTEN_TAGE` heraus. Neueste Meldung zuerst. */
export function fuehreZusammen(alt: Vorschlag[], neu: Vorschlag[], heute: string): Vorschlag[] {
  const bekannt = new Set(alt.map((v) => v.id))
  return [...alt, ...neu.filter((v) => !bekannt.has(v.id))]
    .filter((v) => tageZwischen(v.datum, heute) <= BEHALTEN_TAGE)
    .sort((a, b) => b.datum.localeCompare(a.datum) || a.id.localeCompare(b.id))
}
