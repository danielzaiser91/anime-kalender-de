/** Gemeinsame Typen für Pipeline, Web-App und Newsletter-Worker. */

export type PlatformId =
  | 'crunchyroll'
  | 'netflix'
  | 'primevideo'
  | 'disneyplus'
  | 'adn'
  | 'aniverse'
  | 'wow'
  | 'joyn'
  | 'rtlplus'
  | 'youtube'
  | 'disc'
  | 'kino'
  | 'unbekannt'

/**
 * Art des Releases — bestimmt die Farbkodierung im Kalender.
 * weekly = Folge für Folge (Simuldub)
 * batch  = Katalogtitel, ganze Staffel auf einen Schlag
 * movie  = Film (Stream- oder Kinostart)
 * disc   = DVD/Blu-ray, kaufbar
 */
export type ReleaseType = 'weekly' | 'batch' | 'movie' | 'disc'

/**
 * Wird nie gespeichert, sondern immer aus den Daten + heutigem Datum berechnet.
 * `unbekannt` gibt es für Titel, bei denen eine deutsche Synchro belegt ist,
 * aber kein deutscher Termin — lieber ehrlich als geraten.
 */
export type ReleaseStatus = 'airing' | 'abgeschlossen' | 'tba' | 'erschienen' | 'unbekannt'

export type Fsk = 0 | 6 | 12 | 16 | 18

export type DubConfidence = 'low' | 'normal' | 'high' | 'very-high'

export interface Schedule {
  /** ISO-Datum der ersten Folge mit deutscher Synchro. */
  firstEpisodeDate: string
  /** "HH:MM" in Europe/Berlin. Fehlt, wenn die Uhrzeit nicht belegt ist. */
  time?: string
  episodeCount?: number
  /**
   * Nummer der ersten Folge dieses Releases. Fehlt, wenn es bei 1 anfängt.
   *
   * Netflix und Crunchyroll teilen Staffeln gern auf: „Steel Ball Run"
   * startete am 19.03.2026 mit einer einzelnen 47-Minuten-Folge, der Rest kam
   * ein halbes Jahr später als „2nd & 3rd STAGE". Beides sind eigene Releases
   * mit eigenem Termin — aber die Folgen laufen durch. Ohne dieses Feld begann
   * die Terminliste des zweiten Teils wieder bei „1.", und wer das las, hielt
   * den 25.09. für den Termin der Auftaktfolge.
   */
  firstEpisodeNumber?: number
  /** Explizites Enddatum; sonst aus firstEpisodeDate + episodeCount berechnet. */
  lastEpisodeDate?: string
  /** ISO-Daten, an denen wegen Sendepause keine Folge läuft. */
  skipDates?: string[]
  /**
   * Tatsächlich beobachtete Termine einzelner Folgen, `{ "1": "2026-07-04" }`.
   *
   * Der Wochenrhythmus ist eine Rechenregel, kein Naturgesetz: „Skeleton
   * Knight" startete an einem Samstag und lief danach montags weiter — neun
   * Tage Abstand. Wer solche Fälle in Siebener-Schritten erzwingt, verschiebt
   * entweder den Start oder alle Folgetermine.
   *
   * Was hier steht, ist im Kalender gesehen worden und schlägt jede Rechnung.
   */
  observed?: Record<number, string>
  /** true, wenn das Datum abgeleitet statt bestätigt ist. */
  estimated?: boolean
  /** true, wenn die Folgenzahl nicht belegt ist und angenommen wurde. */
  episodeCountAssumed?: boolean
  /**
   * Woher eine vorläufige Folgenzahl stammt.
   *
   * Der Unterschied zählt: „zwölf, weil das die übliche Länge ist" ist unsere
   * eigene Annahme, „zwölf laut aniSearch, dort als vorläufig gekennzeichnet"
   * ist eine gepflegte Angabe mit Vorbehalt. Beides trägt das ≈, aber der
   * Hinweis daneben soll nicht dasselbe behaupten.
   */
  episodeCountSource?: 'anisearch'
}

export interface StreamLink {
  platform: PlatformId
  url: string
  /**
   * true  — deutsche Synchro dort belegt
   * false — dort ausdrücklich nur Originalton mit Untertiteln
   * fehlt — nicht geprüft
   */
  dub?: boolean
}

/** Ein Anime (genauer: ein AniList-Eintrag) mit belegter deutscher Synchro. */
/**
 * Ein Weg, den Titel zu sehen oder zu kaufen — jenseits der Plattformen, die
 * dieses Projekt selbst kennt.
 *
 * `PlatformId` ist eine geschlossene Liste der großen Anbieter. Für einen alten
 * Katalogtitel steht der einzige deutsche Weg aber oft bei Maxdome, Videobuster
 * oder schlicht als DVD bei Amazon. Diese Angebote hier zu verschweigen, nur
 * weil sie nicht in die Liste passen, wäre die schlechtere Antwort.
 */
export interface WatchLink {
  /** Anzeigename, wie ihn ein Mensch erwartet: „Amazon", „Videobuster". */
  name: string
  url: string
  /** Ansehen oder erwerben — Streams stehen in der Oberfläche zuerst. */
  kind: 'stream' | 'buy'
}

export interface Title {
  id: number
  malId?: number
  slug: string
  titleDe?: string
  titleRomaji?: string
  titleEn?: string
  titleNative?: string
  format?: string
  episodes?: number
  /** Jahr der japanischen Erstausstrahlung. */
  jpYear?: number
  jpSeason?: string
  /** Ende der japanischen Ausstrahlung als ISO-Datum, falls bekannt. */
  jpEnd?: string
  /**
   * Kleinste AniList-ID der zusammenhängenden Reihe (Vorgänger/Nachfolger).
   * Dient dazu, Staffeln derselben Serie zu einer Karte zu bündeln.
   */
  franchiseId?: number
  genres: string[]
  keywords: string[]
  coverImage?: string
  bannerImage?: string
  synopsis?: string
  studios?: string[]
  score?: number
  fsk?: Fsk
  dubConfidence: DubConfidence
  streams: StreamLink[]
  /** Weitere Wege zum Ansehen oder Kaufen, die keine eigene Plattform sind. */
  watchLinks?: WatchLink[]
}

/** Eine konkrete deutsche Veröffentlichung — das, was im Kalender steht. */
export interface Release {
  slug: string
  titleId: number
  /** Anzeigename inklusive Staffel- oder Volume-Angabe. */
  name: string
  platform: PlatformId
  platformUrl?: string
  buyUrl?: string
  releaseType: ReleaseType
  fsk?: Fsk
  publisher?: string
  edition?: string
  note?: string
  schedule: Schedule
  /** Jahr der ersten Folge im deutschen Dub. */
  year: number
  sources: string[]
}

export interface ReleaseEvent {
  id: string
  releaseSlug: string
  titleId: number
  /** ISO-Datum "YYYY-MM-DD" in Europe/Berlin. */
  date: string
  /** "HH:MM" in Europe/Berlin, falls bekannt. */
  time?: string
  episode?: number
  episodeCount?: number
  releaseType: ReleaseType
  platform: PlatformId
  name: string
  estimated?: boolean
}

/**
 * In wie viele Gruppen die Handlungsbeschreibungen aufgeteilt sind.
 *
 * Die Zahl teilen sich Pipeline und Web-App: Die eine schreibt danach, die
 * andere rechnet aus einer Titel-ID die Datei aus. Wird sie geändert, müssen
 * beide Seiten neu gebaut werden — sonst sucht die App in einer Datei, die es
 * nicht gibt. Deshalb steht sie hier und nicht zweimal.
 */
export const SYNOPSIS_GROUPS = 32

export interface DataMeta {
  generatedAt: string
  titleCount: number
  releaseCount: number
  eventCount: number
  genres: string[]
  keywords: string[]
  platforms: PlatformId[]
  /**
   * Bezugsquellen jenseits der bekannten Plattformen — maxdome, Apple TV,
   * Videobuster, die Prime-Video-Kanäle. Nach Häufigkeit sortiert.
   */
  providers: string[]
  years: number[]
  attribution: string[]
}

export const PLATFORMS: Record<PlatformId, { name: string; color: string; home: string }> = {
  crunchyroll: { name: 'Crunchyroll', color: '#f47521', home: 'https://www.crunchyroll.com/de/' },
  netflix: { name: 'Netflix', color: '#e50914', home: 'https://www.netflix.com/de/' },
  primevideo: { name: 'Prime Video', color: '#00a8e1', home: 'https://www.primevideo.com/' },
  disneyplus: { name: 'Disney+', color: '#0063e5', home: 'https://www.disneyplus.com/de-de' },
  adn: { name: 'ADN', color: '#f92e6a', home: 'https://animationdigitalnetwork.com/de' },
  aniverse: { name: 'Aniverse', color: '#7c3aed', home: 'https://www.aniverse.de/' },
  wow: { name: 'WOW', color: '#00b1ff', home: 'https://www.wowtv.de/' },
  joyn: { name: 'Joyn', color: '#fa1b5a', home: 'https://www.joyn.de/' },
  rtlplus: { name: 'RTL+', color: '#e2001a', home: 'https://plus.rtl.de/' },
  youtube: { name: 'YouTube', color: '#ff0000', home: 'https://www.youtube.com/' },
  disc: { name: 'DVD / Blu-ray', color: '#16a34a', home: 'https://www.amazon.de/' },
  kino: { name: 'Kino', color: '#eab308', home: '' },
  unbekannt: { name: 'Unbekannt', color: '#6b7280', home: '' },
}

export const RELEASE_TYPES: Record<
  ReleaseType,
  { name: string; short: string; color: string; hint: string }
> = {
  weekly: {
    name: 'Wöchentlich (Simuldub)',
    short: 'Wöchentlich',
    color: '#3b82f6',
    hint: 'Folge für Folge, fester Wochentag',
  },
  batch: {
    name: 'Katalogtitel',
    short: 'Katalog',
    color: '#a855f7',
    hint: 'Ganze Staffel auf einen Schlag',
  },
  movie: { name: 'Film', short: 'Film', color: '#eab308', hint: 'Filmstart (Stream oder Kino)' },
  disc: { name: 'DVD / Blu-ray', short: 'Disc', color: '#22c55e', hint: 'Kaufbarer Datenträger' },
}

export const STATUS_LABEL: Record<ReleaseStatus, string> = {
  airing: 'Läuft',
  abgeschlossen: 'Abgeschlossen',
  tba: 'TBA',
  erschienen: 'Erschienen',
  unbekannt: 'Termin unbekannt',
}

export const FSK_COLORS: Record<Fsk, string> = {
  0: '#ffffff',
  6: '#ffd400',
  12: '#009d3e',
  16: '#0075bf',
  18: '#e30613',
}
