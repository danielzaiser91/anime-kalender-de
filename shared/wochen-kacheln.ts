import type { Release, StreamLink, Title, WatchLink } from './types.ts'
import type { WochenDatei } from './wochen-datei.ts'

/**
 * **Kachel-Datei: die Wochen-Datei ohne alles, was der Start der Wochenansicht nie liest** (`woche-kacheln.json`).
 *
 * Gleiche Form wie `WochenDatei`, aber Titel und Releases tragen nur noch die Felder, die Kacheln, Zeitmarken, „läuft jetzt“,
 * Favoriten und Filter der Startwoche lesen. Quellen, Kaufadressen, Namen in vier Sprachen, Sendungslisten und Weg-Adressen gehören dem
 * Panel und der Datenbank, und die bekommen ihre Daten erst mit den vollen Dateien (`useStartdaten`: das Panel öffnet erst dann).
 * Termine bleiben unverändert. Die Listen unten sind **Abzugslisten**: Ein neues Feld im Datensatz kommt von selbst mit — ein Zuviel
 * zeigt das Start-Budget, ein Zuwenig würde die Kachel still falsch zeichnen. Gemessen mit `tools/kachel-felder-messen.mjs`.
 */
export const TITEL_OHNE = [
  'angebotSeit', 'anisearchId', 'ankuendigung', 'annId', 'ausgabenOhneDe', 'bannerImage', 'dubHinweis', 'einzelquelle', 'entfernteStreams',
  'episodes', 'franchiseId', 'fskQuelle', 'hasVoices', 'jpEnd', 'jpSeason', 'jpStart', 'jpStatus', 'jpYear', 'kino', 'malId', 'runtimeMin',
  'score', 'scoreQuelle', 'staffeln', 'staffelnQuelle', 'studios', 'synopsis', 'titleDe', 'titleEn', 'titleNative', 'titleRomaji', 'tmdbId',
  'trailer', 'westlich',
] as const

export const RELEASE_OHNE = [
  'automatisch', 'buyUrl', 'cinemaUntil', 'disputedDates', 'edition', 'herkunft', 'netflixOriginal', 'nachtrag', 'note', 'platformUrl',
  'publisher', 'quellen', 'rhythmus', 'schnitt', 'sources',
] as const

export const STREAM_OHNE = ['url', 'seite', 'fenster', 'dubQuelle', 'dubStand', 'herkunft', 'kanal', 'sharedWith'] as const
export const WATCHLINK_OHNE = ['url', 'toggo', 'dubAbgeleitet', 'ueberTmdb', 'ersetzt'] as const

/** `kostenloseFolgen` (Filter „kostenlos“) liest Adresse, Fenster und Folge eines kostenlosen Wegs: Der bleibt ganz. */
const kostenlos = (weg: { zugang?: string }): boolean => weg.zugang === 'kostenlos'

type Feldliste = readonly string[]

const ohne = <T extends object>(eintrag: T, felder: Feldliste): T =>
  Object.fromEntries(Object.entries(eintrag).filter(([name]) => !felder.includes(name))) as T

const wegKachel = <T extends StreamLink | WatchLink>(weg: T, felder: Feldliste): T => (kostenlos(weg) ? weg : ohne(weg, felder))

function titelKachel(titel: Title): Title {
  const kachel = ohne(titel, TITEL_OHNE)
  if (kachel.streams) kachel.streams = kachel.streams.map((s) => wegKachel(s, STREAM_OHNE))
  if (kachel.watchLinks) kachel.watchLinks = kachel.watchLinks.map((w) => wegKachel(w, WATCHLINK_OHNE))
  return kachel
}

function releaseKachel(release: Release): Release {
  const kachel = ohne(release, RELEASE_OHNE)
  if (kachel.sendungen) kachel.sendungen = kachel.sendungen.map((s) => ({ start: s.start }) as typeof s)
  return kachel
}

/** Schneidet die Kachel-Datei aus der Wochen-Datei (Reihenfolge und Termine bleiben). */
export function baueKachelDatei(woche: WochenDatei): WochenDatei {
  return { von: woche.von, bis: woche.bis, titles: woche.titles.map(titelKachel), releases: woche.releases.map(releaseKachel), events: woche.events }
}

/** Ob `klein` aus `gross` stammt: jedes Feld gleich, Listen gleich lang, nichts Neues. */
function teilVon(klein: unknown, gross: unknown): boolean {
  if (Array.isArray(klein)) return Array.isArray(gross) && klein.length === gross.length && klein.every((k, i) => teilVon(k, gross[i]))
  if (klein !== null && typeof klein === 'object') {
    if (gross === null || typeof gross !== 'object' || Array.isArray(gross)) return false
    return Object.entries(klein).every(([name, wert]) => name in gross && teilVon(wert, (gross as Record<string, unknown>)[name]))
  }
  return klein === gross
}

/** Fehlende Felder eines Eintrags: alles, was weder auf der Abzugsliste steht noch in der Kachel ist. */
function fehlendes(kachel: object, voll: object, abzug: Feldliste): string[] {
  return Object.keys(voll).filter((name) => !abzug.includes(name) && !(name in kachel))
}

function pruefeEintraege<T extends object>(was: string, kachel: T[], voll: T[], schluessel: (e: T) => string | number, abzug: Feldliste): string[] {
  const fehler: string[] = []
  if (kachel.length !== voll.length) fehler.push(`Kachel-Datei: ${kachel.length} ${was} statt ${voll.length}`)
  kachel.forEach((k, i) => {
    const v = voll[i]
    if (!v || schluessel(k) !== schluessel(v)) fehler.push(`Kachel-Datei: ${was} an Stelle ${i} ist ${schluessel(k)} statt ${v ? schluessel(v) : 'nichts'}`)
    else if (!teilVon(k, v)) fehler.push(`Kachel-Datei: ${was} ${schluessel(k)} weicht von der Wochen-Datei ab`)
    else if (fehlendes(k, v, abzug).length) fehler.push(`Kachel-Datei: ${was} ${schluessel(k)} verliert ${fehlendes(k, v, abzug).join(', ')}`)
  })
  return fehler
}

/**
 * Widersprüche zwischen Kachel-Datei und Wochen-Datei (leer = in Ordnung): gleiche Woche, gleiche Einträge in gleicher Reihenfolge,
 * jedes Feld der Kachel steht gleich in der Wochen-Datei, kein Feld fehlt, das nicht auf der Abzugsliste steht, Termine unverändert.
 */
export function pruefeKachelDatei(kachel: WochenDatei, woche: WochenDatei): string[] {
  const fehler: string[] = []
  if (kachel.von !== woche.von || kachel.bis !== woche.bis) fehler.push('Kachel-Datei: andere Woche als die Wochen-Datei')
  fehler.push(...pruefeEintraege('Titel', kachel.titles, woche.titles, (t) => t.id, TITEL_OHNE))
  fehler.push(...pruefeEintraege('Release', kachel.releases, woche.releases, (r) => r.slug, RELEASE_OHNE))
  if (JSON.stringify(kachel.events) !== JSON.stringify(woche.events)) fehler.push('Kachel-Datei: Termine weichen von der Wochen-Datei ab')
  return fehler.slice(0, 20)
}
