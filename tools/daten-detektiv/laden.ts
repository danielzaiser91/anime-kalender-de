/**
 * Lädt den veröffentlichten Datensatz (`public/data/*`) und die Zweitquellen aus `data/`, gegen die
 * der Detektiv prüft. Alles wird nur gelesen; Zweitquellen, die fehlen, liefern leere Strukturen,
 * damit der Lauf auch auf einem Rechner ohne vollständiges `data/` durchläuft.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as yaml } from 'yaml'
import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'

export const WURZEL = resolve(fileURLToPath(new URL('../../', import.meta.url)))

function lies<T>(pfad: string, leer: T): T {
  const voll = resolve(WURZEL, pfad)
  if (!existsSync(voll)) return leer
  return JSON.parse(readFileSync(voll, 'utf8')) as T
}

export interface Linkstatus { status: number | string; geprueftAm: string }
export interface JustwatchAngebot { anbieter: string; art: string; audio: string[]; untertitel: string[]; url: string }
export interface MotnTonspur { titleId: number; platform: string; deutsch: boolean; von: number; bis: number; stand: string }
export interface CrSerie {
  url: string; seriesId: string; deutschImAngebot?: boolean; fehler?: string
  staffeln?: Array<{ name: string; staffelId: string; folgen: number; deutsch: number; deutscheFassung: boolean }>
}

export interface Bestand {
  heute: string
  titles: Title[]
  ohneSynchro: Title[]
  cartoons: Title[]
  releases: Release[]
  events: ReleaseEvent[]
  franchises: Record<string, Array<{ id: number; name: string }>>
  news: Array<{ titel: string; titleId?: number; meldungen: Array<{ art: string; datum?: string; release?: string; ersetzt?: unknown; zurueckgezogen?: unknown }> }>
  meta: { titleCount: number; releaseCount: number; eventCount: number; generatedAt: string }
  synopsen: Set<number>
  // Zweitquellen
  linkCheck: Record<string, Linkstatus>
  anisearchDubs: Record<string, string>
  anisearchDubIds: Record<string, string>
  /** Folgenlisten je aniSearch-Kennung (`data/anisearch-folgen.json`). */
  anisearchFolgen: Record<string, { folgen: Array<{ nr: number; datum?: string }> }>
  anisearchCover: Record<string, { cover: string }>
  tmdbPoster: Record<string, { p: string }>
  justwatch: Record<string, { angebote?: JustwatchAngebot[] }>
  motnTonspur: MotnTonspur[]
  crDub: CrSerie[]
  /** Handbelege `anilistId|platform` → dub (true/false), höchste Beweisstufe. */
  dubConfirmed: Map<string, boolean>
  /** AniList-Kennungen mit Handbeleg `dub: true`, ohne die bewusst nicht im Bestand geführten (`nichtImBestand`). */
  handbelegteIds: Set<number>
  /** AniList-Kennungen mit Handurteil „keine Synchro" samt Quelle (`data/ohne-synchro-von-hand.yaml`). */
  handKeine: Set<number>
  /** Gemessene Urteile `titleId|platform` → Menge der Urteile („deutsch", „kein deutsch", …). */
  urteile: Map<string, Set<string>>
  /** aniSearch-Rohdaten je Titel-Kennung — nur `descriptionDe`, die Datei ist 24 MB. */
  anisearchBeschreibung: Set<number>
}

function handbelege(): Map<string, boolean> {
  const pfad = resolve(WURZEL, 'data/dub-confirmed.yaml')
  const m = new Map<string, boolean>()
  if (!existsSync(pfad)) return m
  for (const e of (yaml(readFileSync(pfad, 'utf8')) as Array<{ anilistId: number; platform: string; dub?: boolean }>) ?? [])
    if (typeof e.dub === 'boolean') m.set(`${e.anilistId}|${e.platform}`, e.dub)
  return m
}

function handbelegteIds(): Set<number> {
  const pfad = resolve(WURZEL, 'data/dub-confirmed.yaml')
  const liste = (existsSync(pfad) ? yaml(readFileSync(pfad, 'utf8')) : []) as Array<{ anilistId: number; dub?: boolean; nichtImBestand?: boolean }> | null
  return new Set((liste ?? []).filter((e) => e.dub === true && !e.nichtImBestand).map((e) => e.anilistId))
}

function handKeine(): Set<number> {
  const pfad = resolve(WURZEL, 'data/ohne-synchro-von-hand.yaml')
  const liste = (existsSync(pfad) ? yaml(readFileSync(pfad, 'utf8')) : []) as Array<{ anilistId?: number; sources?: string[] }> | null
  return new Set((liste ?? []).filter((e) => e.anilistId && e.sources?.length).map((e) => e.anilistId!))
}

function urteile(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const [k, v] of Object.entries(lies<Record<string, { urteil: string; art: string }>>('data/urteile.json', {}))) {
    if (v.art !== 'gemessen') continue
    const [id, plattform] = k.split('|')
    const key = `${id}|${plattform}`
    ;(m.get(key) ?? m.set(key, new Set()).get(key)!).add(v.urteil)
  }
  return m
}

function anisearchBeschreibungen(): Set<number> {
  const roh = lies<Record<string, { descriptionDe?: string }>>('data/anisearch.json', {})
  return new Set(Object.entries(roh).filter(([, v]) => v.descriptionDe).map(([k]) => Number(k)))
}

function synopsenIds(): Set<number> {
  const ids = new Set<number>()
  for (let g = 0; g < 32; g++) {
    const datei = lies<Record<string, unknown>>(`public/data/synopses/${g}.json`, {})
    for (const id of Object.keys(datei)) ids.add(Number(id))
  }
  return ids
}

export function ladeBestand(heute = new Date().toISOString().slice(0, 10)): Bestand {
  return {
    heute,
    titles: lies('public/data/titles.json', []),
    ohneSynchro: lies('public/data/ohne-synchro.json', []),
    cartoons: lies('public/data/cartoons.json', []),
    releases: lies('public/data/releases.json', []),
    events: lies('public/data/events.json', []),
    franchises: lies('public/data/franchises.json', {}),
    news: lies('public/data/news.json', []),
    meta: lies('public/data/meta.json', { titleCount: 0, releaseCount: 0, eventCount: 0, generatedAt: '' }),
    synopsen: synopsenIds(),
    linkCheck: lies('data/link-check.json', {}),
    anisearchDubs: lies('data/anisearch-dubs.json', {}),
    anisearchDubIds: lies('data/anisearch-dub-ids.json', {}),
    anisearchFolgen: lies('data/anisearch-folgen.json', {}),
    anisearchCover: lies('data/anisearch-cover.json', {}),
    tmdbPoster: lies('data/tmdb-poster.json', {}),
    justwatch: lies('data/justwatch-audio.json', {}),
    motnTonspur: lies('data/motn-tonspur.json', []),
    crDub: lies<{ serien: CrSerie[] }>('data/crunchyroll-dub.json', { serien: [] }).serien,
    dubConfirmed: handbelege(),
    handbelegteIds: handbelegteIds(),
    handKeine: handKeine(),
    urteile: urteile(),
    anisearchBeschreibung: anisearchBeschreibungen(),
  }
}

/** Lesbarer Name eines Titels — nie eine nackte Nummer. */
export function titelName(t: Title | undefined, id?: number): string {
  if (!t) return `Titel ${id ?? '?'}`
  return `${t.titleDe ?? t.titleRomaji ?? t.titleEn ?? t.id} (${t.jpYear ?? '?'}, ${t.episodes ?? '?'} Fg.)`
}
