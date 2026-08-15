import { ANILIST_COVER_BASIS } from '@shared/mappings.ts'
import { SYNOPSIS_GROUPS } from '@shared/types.ts'
import type { DataMeta, Franchises, Meldung, Release, ReleaseEvent, Title } from '@shared/types.ts'

export interface Dataset {
  titles: Title[]
  titleById: Map<number, Title>
  releases: Release[]
  releaseBySlug: Map<string, Release>
  events: ReleaseEvent[]
  eventsByDate: Map<string, ReleaseEvent[]>
  releasesByTitle: Map<number, Release[]>
  meta: DataMeta
}

/**
 * Kennung des Builds, in `vite.config.ts` einkompiliert.
 *
 * Im Test- und Pipeline-Kontext gibt es sie nicht — dort steht `dev`, und das
 * genügt: Beim Entwickeln gibt es keinen Service Worker, der etwas festhält.
 */
declare const __BUILD_ID__: string | undefined
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

/**
 * Adresse einer Datendatei — mit Build-Kennung.
 *
 * Ohne sie blieb nach einem Deploy die alte Fassung stehen, und nur ein hartes
 * Neuladen half. Die Kennung macht daraus eine neue Adresse; für Browser-Cache
 * und Service Worker ist das ein Erstabruf, kein Auffrischen.
 *
 * Der Service Worker weiß davon (siehe `public/sw.js`): Er antwortet bei
 * gleicher Kennung sofort aus dem Cache und fällt offline auf die letzte
 * bekannte Fassung zurück, egal welche Kennung die trägt.
 */
function url(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}?v=${BUILD_ID}`
}

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path))
  if (!res.ok) throw new Error(`${path} konnte nicht geladen werden (${res.status})`)
  return (await res.json()) as T
}

export async function loadDataset(): Promise<Dataset> {
  const [titles, releases, events, meta] = await Promise.all([
    loadJson<Title[]>('titles-core.json'),
    loadJson<Release[]>('releases.json'),
    loadJson<ReleaseEvent[]>('events.json'),
    loadJson<DataMeta>('meta.json'),
  ])

  const titleById = new Map(titles.map((t) => [t.id, t]))
  const releaseBySlug = new Map(releases.map((r) => [r.slug, r]))

  const eventsByDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) {
    const list = eventsByDate.get(ev.date)
    if (list) list.push(ev)
    else eventsByDate.set(ev.date, [ev])
  }

  const releasesByTitle = new Map<number, Release[]>()
  for (const r of releases) {
    const list = releasesByTitle.get(r.titleId)
    if (list) list.push(r)
    else releasesByTitle.set(r.titleId, [r])
  }

  return { titles, titleById, releases, releaseBySlug, events, eventsByDate, releasesByTitle, meta }
}

let allTitlesPromise: Promise<Title[]> | undefined

/**
 * Vollständige Titelliste — mehrere Megabyte, deshalb erst beim Öffnen der
 * Datenbank-Ansicht. Die geladenen Titel wandern in den bestehenden Index,
 * damit das Detail-Panel sie danach ohne weiteren Abruf findet.
 */
export function loadAllTitles(data: Dataset): Promise<Title[]> {
  allTitlesPromise ??= loadJson<Title[]>('titles.json').then((titles) => {
    for (const t of titles) {
      const existing = data.titleById.get(t.id)
      // Kuratierte Ergänzungen aus dem Kern-Datensatz nicht überschreiben.
      data.titleById.set(t.id, existing ? { ...t, ...existing } : t)
    }
    return titles.map((t) => data.titleById.get(t.id)!)
  })
  return allTitlesPromise
}

let ohneSynchroPromise: Promise<Title[]> | undefined

/**
 * Anime **ohne** belegte deutsche Synchro — die größte Datei des Projekts.
 *
 * Geholt wird sie erst, wenn jemand den Schalter in der Datenbank umlegt. Das
 * ist der ganze Grund, warum sie nicht in `titles.json` steht: Es sind ein
 * Vielfaches des gepflegten Bestands, und die überwältigende Mehrheit der
 * Besucher braucht sie nie.
 *
 * Wie bei `loadAllTitles` wandern die Titel in den bestehenden Index — sonst
 * fände das Detail-Panel einen gemerkten Titel nicht wieder.
 */
export function loadOhneSynchro(data: Dataset): Promise<Title[]> {
  ohneSynchroPromise ??= loadJson<OhneSynchroRoh[]>('ohne-synchro.json')
    .then((roh) => {
      const titles = roh.map((t) => ({
        ...t,
        // Der Adressvorsatz der Cover fehlt in der Datei — siehe
        // ANILIST_COVER_BASIS. Hier ist die einzige Stelle, an der er wieder
        // angehängt wird; danach sieht der Rest der App nur vollständige
        // Adressen. Ein bereits vollständiger Wert bleibt unangetastet.
        coverImage:
          t.coverImage && !t.coverImage.startsWith('http')
            ? ANILIST_COVER_BASIS + t.coverImage
            : t.coverImage,
        /**
         * Drei Felder, die die Datei nicht mitschickt, weil sie für jeden
         * dieser Titel leer wären — 900 KB, die niemand übertragen muss. Der
         * Rest der Anwendung darf sie trotzdem wie gewohnt vorfinden.
         *
         * Der Slug ist die Kennung als Text: Zu diesen Titeln gibt es keine
         * eigene Seite, also auch keinen sprechenden Namen dafür.
         */
        slug: String(t.id),
        keywords: [],
        streams: [],
      }))
      for (const t of titles) data.titleById.set(t.id, data.titleById.get(t.id) ?? t)
      return titles
    })
    .catch(() => [])
  return ohneSynchroPromise
}

/** Wie ein Eintrag in `ohne-synchro.json` wirklich aussieht — drei Felder fehlen. */
type OhneSynchroRoh = Omit<Title, 'slug' | 'keywords' | 'streams'>

let franchisesPromise: Promise<Franchises> | undefined

/**
 * Welche Staffeln, Filme und Specials zu einer Reihe gehören.
 *
 * Eigene Datei (33 KB gzip), geholt beim ersten Öffnen eines Detail-Panels.
 * Vorher las das Panel dafür `data.titles` — im Kalender sind das aber nur die
 * 133 Titel **mit Termin**. „That Time I Got Reincarnated as a Slime" zeigte
 * deshalb allein Staffel 4 als verwandten Eintrag, „I've Been Killing Slimes"
 * gar nichts (gemeldet von Daniel, 12.08.2026).
 */
export function loadFranchises(): Promise<Franchises> {
  franchisesPromise ??= loadJson<Franchises>('franchises.json')
    .then((reihen) => {
      // Der Adressvorsatz der Cover fehlt in der Datei — hier kommt er zurück,
      // an genau einer Stelle. Siehe ANILIST_COVER_BASIS.
      for (const mitglieder of Object.values(reihen)) {
        for (const m of mitglieder) {
          if (m.cover && !m.cover.startsWith('http')) m.cover = ANILIST_COVER_BASIS + m.cover
        }
      }
      return reihen
    })
    .catch(() => ({}) as Franchises)
  return franchisesPromise
}

let meldungenPromise: Promise<Map<number, Meldung[]>> | undefined

/**
 * Fundstellen aus den Nachrichtenquellen, nach Titel gebündelt.
 *
 * Eigene Datei und erst beim Öffnen eines Panels geholt: Sie betrifft eine
 * Handvoll Titel, und für alle anderen wäre sie Ladelast ohne Gegenwert.
 */
export function loadMeldungen(): Promise<Map<number, Meldung[]>> {
  meldungenPromise ??= loadJson<Meldung[]>('meldungen.json')
    .then((liste) => {
      const nachTitel = new Map<number, Meldung[]>()
      for (const m of liste) nachTitel.set(m.titleId, [...(nachTitel.get(m.titleId) ?? []), m])
      return nachTitel
    })
    .catch(() => new Map<number, Meldung[]>())
  return meldungenPromise
}

/** Handlung je Sprache. Deutsch stammt von TMDB, Englisch von AniList. */
export interface Synopsis {
  de?: string
  en?: string
  /**
   * Woher die deutsche Fassung stammt — aniSearch oder TMDB.
   *
   * aniSearch hängt die Quelle als Fließtext an die Beschreibung. Die Pipeline
   * löst sie heraus, damit sie hier genauso aussieht wie unter einem Termin,
   * statt einmal im Text zu stehen und einmal als Zeile darunter — und dort
   * womöglich noch mit dem falschen Namen (Daniel, 12.08.2026).
   */
  deSource?: { name: string; url: string }
}

/**
 * Bereits geholte Gruppen. Eine Gruppe deckt rund neunzig Titel ab, deshalb
 * lohnt das Merken: Wer sich durch eine Serie klickt, trifft oft dieselbe.
 */
const synopsisGroups = new Map<number, Promise<Record<number, Synopsis>>>()

/**
 * Handlung eines Titels — holt nur die Gruppe, in der er liegt.
 *
 * Vorher lag alles in einer Datei: 3,8 MB gingen beim ersten Öffnen eines
 * Detail-Panels über die Leitung, um **eine** Beschreibung anzuzeigen. Jetzt
 * sind es rund 120 KB (10.08.2026, aufgefallen, weil der Browser-Speicher
 * auffällig voll war).
 */
export async function loadSynopsis(titleId: number): Promise<Synopsis | undefined> {
  const gruppe = titleId % SYNOPSIS_GROUPS
  let geladen = synopsisGroups.get(gruppe)
  if (!geladen) {
    geladen = loadJson<Record<number, Synopsis>>(`synopses/${gruppe}.json`).catch(() => ({}))
    synopsisGroups.set(gruppe, geladen)
  }
  return (await geladen)[titleId]
}

/** Eine deutsche Sprechrolle: Figur und Stimme. */
export interface VoiceRole {
  character: string
  actor: string
  /** 'MAIN' | 'SUPPORTING' | 'BACKGROUND' */
  role?: string
  /**
   * Woher die Rolle stammt. Fehlt = AniList.
   *
   * Anime News Network verlangt fuer die Nutzung seiner Encyclopedia-Daten eine
   * Quellennennung **und** einen Link zum jeweiligen Eintrag auf jeder Seite,
   * die die Angaben zeigt. Ohne dieses Feld liesse sich nicht sagen, ob der
   * Link ueberhaupt faellig ist.
   */
  von?: 'ann'
}

/** Die Sprecherliste eines Titels samt Herkunft. */
export interface Voices {
  roles: VoiceRole[]
  /** Adresse des ANN-Encyclopedia-Eintrags, wenn von dort Rollen stammen. */
  annUrl?: string
}

const voiceCache = new Map<number, Promise<Voices>>()

/**
 * Deutsche Synchronsprecher eines Titels — eine eigene Datei je Titel.
 *
 * Anders als die Handlung liegt das **nicht** in Gruppen: Bei rund zwanzig
 * Rollen je Titel wäre eine Gruppe von neunzig Titeln schnell hundert Kilobyte
 * groß, und geholt wird sie für eine einzige aufgeklappte Liste. Eine Datei je
 * Titel sind zwei Kilobyte.
 *
 * Fehlt die Datei, hat AniList für diesen Titel keine deutschen Stimmen — das
 * ist kein Fehler, sondern die Antwort.
 */
export function loadVoices(titleId: number): Promise<Voices> {
  let geladen = voiceCache.get(titleId)
  if (!geladen) {
    geladen = loadJson<{ roles?: VoiceRole[]; annUrl?: string }>(`voices/${titleId}.json`)
      .then((d) => ({ roles: d.roles ?? [], annUrl: d.annUrl }))
      .catch(() => ({ roles: [] }))
    voiceCache.set(titleId, geladen)
  }
  return geladen
}

/**
 * Adresse eines ICS-Feeds — **ohne** Build-Kennung.
 *
 * Das ist kein Versehen, sondern der Unterschied zwischen Abrufen und
 * Abonnieren: Diese Adresse trägt jemand in Google Calendar oder Outlook ein,
 * und die fragt sie monatelang immer wieder ab. Eine Kennung darin würde beim
 * nächsten Deploy auf eine Datei zeigen, die es nicht mehr gibt — das Abo wäre
 * still tot.
 */
export function feedUrl(name: string): string {
  return `${import.meta.env.BASE_URL}data/feeds/${name}`
}

/** Absolute URL — Google Calendar und Outlook brauchen sie zum Abonnieren. */
export function absoluteFeedUrl(name: string): string {
  return new URL(feedUrl(name), window.location.href).toString()
}
