import { fetchJson, log, readJson, sleep, warn, writeJson } from './util.ts'
import type { Title } from '../../shared/types.ts'
import { abrufTag, istAbgelaufen } from './tmdb-ablauf.ts'
import { waehlePlakat, type TmdbBild } from './tmdb-plakat.ts'
import { plakatEintrag, type PlakatBestand } from './tmdb-plakat-suche.ts'
import { BANNER_DATEI, waehleBanner, type TmdbBanner } from './tmdb-banner.ts'
import { eintragAus, mehrfachBelegt, urteilStaffel0, type Staffel0Eintrag, type Staffel0Folge, type Staffel0Serie, type Staffel0Urteil } from './tmdb-staffel0.ts'
import { staffel0Kandidaten, type ReiheMitglied, type Staffel0Kandidat } from './tmdb-staffel0-kandidaten.ts'
import { schreibeStaffel0Liste } from './tmdb-staffel0-liste.ts'

export const STAFFEL0_DATEI = 'data/tmdb-staffel0.json'
export type Staffel0Bestand = Record<string, Staffel0Eintrag>

const API = 'https://api.themoviedb.org/3'
const BILDSPRACHEN = 'include_image_language=ja,null,de,en'
/** Etwa 8 Abfragen je Sekunde, weit unter TMDBs Obergrenze (laut Doku rund 50 je Sekunde). */
const PAUSE_MS = 120
const MAX_FEHLER = 20

type SeasonAntwort = { episodes?: { episode_number: number; name?: string; air_date?: string | null; runtime?: number | null }[] }
/** Die drei Bestände, die ein Lauf verändert. */
type Bestaende = { eintraege: Staffel0Bestand; poster: PlakatBestand; banner: TmdbBanner }

/** Ob der Eintrag gegen TMDB neu zu prüfen ist (Urteil und Bilder): fehlt oder ist älter als 150 Tage (`tmdb-ablauf.ts`). */
export const staffel0Faellig = (e: Pick<Staffel0Eintrag, 'inhaltAm'> | undefined, jetzt: Date): boolean => e === undefined || istAbgelaufen(e.inhaltAm, jetzt)

/** Ein 404 heißt hier „TMDB kennt das nicht“, kein Ausfall; der Fehlertext trägt nie die Adresse (Schlüssel). */
async function leseOder404<T>(url: string, schluessel: string): Promise<T | null> {
  try {
    return await fetchJson<T>(`${url}${url.includes('?') ? '&' : '?'}api_key=${schluessel}`)
  } catch (e) {
    if ((e as Error).message.startsWith('404')) return null
    throw new Error(`TMDB ${(e as Error).message.slice(0, 3)}`)
  }
}

/** Staffel 0 einer Serie, englisch und japanisch (der japanische Folgenname gleicht oft unserem `titleNative`). */
async function holeStaffel0Serie(apiKey: string, tmdbId: number): Promise<Staffel0Serie> {
  const en = await leseOder404<SeasonAntwort>(`${API}/tv/${tmdbId}/season/0?language=en-US`, apiKey)
  await sleep(PAUSE_MS)
  const ja = en?.episodes?.length ? await leseOder404<SeasonAntwort>(`${API}/tv/${tmdbId}/season/0?language=ja-JP`, apiKey) : null
  if (ja) await sleep(PAUSE_MS)
  const japanisch = new Map((ja?.episodes ?? []).map((x) => [x.episode_number, x.name]))
  const folgen: Staffel0Folge[] = (en?.episodes ?? []).map((x) => ({
    e: x.episode_number,
    name: x.name ?? '',
    nameJa: japanisch.get(x.episode_number),
    datum: x.air_date || null,
    minuten: x.runtime ?? null,
  }))
  return { tmdbId, folgen }
}

type Pruefung = { urteile: Map<number, Staffel0Urteil>; ausgefallen: Set<number> }

/** Urteilt über jeden Kandidaten; eine Serie, die TMDB nicht lieferte, lässt ihre Titel ungeurteilt (der alte Eintrag bleibt). */
async function pruefeKandidaten(apiKey: string, kandidaten: Staffel0Kandidat[]): Promise<Pruefung> {
  const serien = new Map<number, Staffel0Serie>()
  let fehler = 0
  for (const id of new Set(kandidaten.flatMap((k) => k.serien))) {
    if (fehler > MAX_FEHLER) break
    try {
      serien.set(id, await holeStaffel0Serie(apiKey, id))
    } catch (e) {
      fehler++
      warn(`TMDB-Staffel 0 tv/${id}: ${(e as Error).message}`)
    }
  }
  const urteile = new Map<number, Staffel0Urteil>()
  const ausgefallen = new Set<number>()
  for (const k of kandidaten) {
    const hat = k.serien.map((s) => serien.get(s)).filter((s): s is Staffel0Serie => s !== undefined)
    if (hat.length < k.serien.length) ausgefallen.add(k.id)
    else urteile.set(k.id, urteilStaffel0(k.titel, hat))
  }
  return { urteile, ausgefallen }
}

type Bilder = { plakat?: TmdbBild; stand?: TmdbBild }

/** Plakat der Staffel 0 (Hochformat) und Standbild der Folge (Querformat ab 1.280 px); das Plakat je Serie nur einmal geholt. */
async function holeBilder(apiKey: string, e: Staffel0Eintrag, plakate: Map<number, TmdbBild | undefined>): Promise<Bilder> {
  if (!plakate.has(e.tmdbId)) {
    const s = await leseOder404<{ posters?: TmdbBild[] }>(`${API}/tv/${e.tmdbId}/season/0/images?${BILDSPRACHEN}`, apiKey)
    plakate.set(e.tmdbId, waehlePlakat(s?.posters ?? []))
    await sleep(PAUSE_MS)
  }
  const f = await leseOder404<{ stills?: TmdbBild[] }>(`${API}/tv/${e.tmdbId}/season/0/episode/${e.e}/images?${BILDSPRACHEN}`, apiKey)
  await sleep(PAUSE_MS)
  return { plakat: plakate.get(e.tmdbId), stand: waehleBanner(f?.stills ?? []) }
}

/** Ein Bild darf gesetzt werden, wenn der Titel keins hat oder das vorhandene aus dieser Zuordnung stammt (`eigener` = Pfad der früheren Prüfung). */
const frei = (bild: { p?: string } | null | undefined, eigener: string | undefined): boolean => !bild?.p || bild.p === eigener

/**
 * Setzt Plakat und Hintergrund eines frisch geprüften Eintrags und merkt die Pfade im Eintrag (`pp`, `sp`). Ein fremdes Bild bleibt; ein eigenes, das
 * TMDB nicht mehr führt, fällt weg. Gibt zurück, ob ein Plakat gesetzt wurde.
 */
function setzeBilder(id: string, e: Staffel0Eintrag, alt: Staffel0Eintrag | undefined, b: Bilder, bestaende: Bestaende): boolean {
  const { poster, banner } = bestaende
  let plakatGesetzt = false
  if (b.plakat && frei(poster[id], alt?.pp)) {
    poster[id] = plakatEintrag(b.plakat)
    e.pp = b.plakat.file_path
    plakatGesetzt = true
  } else if (!b.plakat && alt?.pp && poster[id]?.p === alt.pp) delete poster[id]
  if (b.stand && frei(banner[id], alt?.sp)) {
    banner[id] = { p: b.stand.file_path, w: b.stand.width, h: b.stand.height, inhaltAm: abrufTag() }
    e.sp = b.stand.file_path
  } else if (!b.stand && alt?.sp && banner[id]?.p === alt.sp) delete banner[id]
  return plakatGesetzt
}

/** Streicht Eintrag und die Bilder, die er gesetzt hat. */
function streiche(id: string, bestaende: Bestaende): void {
  const e = bestaende.eintraege[id]
  if (!e) return
  if (e.pp && bestaende.poster[id]?.p === e.pp) delete bestaende.poster[id]
  if (e.sp && bestaende.banner[id]?.p === e.sp) delete bestaende.banner[id]
  delete bestaende.eintraege[id]
}

type Urteile = { neu: Staffel0Bestand; offen: Map<number, Staffel0Urteil>; doppelt: Set<string> }

/** Aus den Urteilen die neuen Einträge; eine Folge, die zwei Titel tragen würden, bekommt keiner (`mehrfachBelegt`), ein nicht mehr tragender Eintrag fällt weg. */
function wende(zuPruefen: Staffel0Kandidat[], p: Pruefung, tag: string, bestaende: Bestaende): Urteile {
  const neu: Staffel0Bestand = {}
  const offen = new Map<number, Staffel0Urteil>()
  for (const k of zuPruefen) {
    const u = p.urteile.get(k.id)
    if (u?.stufe === 'sicher') neu[k.id] = eintragAus(k.titel, u.treffer!, tag)
    else if (u) offen.set(k.id, u)
  }
  const doppelt = mehrfachBelegt({ ...bestaende.eintraege, ...neu })
  for (const id of doppelt) {
    delete neu[id]
    streiche(id, bestaende)
  }
  for (const k of zuPruefen) if (!neu[k.id] && !p.ausgefallen.has(k.id)) streiche(String(k.id), bestaende)
  return { neu, offen, doppelt }
}

/**
 * **Staffel-0-Zuordnung** (`tmdb-staffel0.ts`): Specials, OVAs und Filme ohne eigene TMDB-Kennung bekommen Plakat und Standbild ihrer Folge in der Staffel 0
 * der Serie ihrer Reihe. Läuft im Plakat-Lauf (`fetch-tmdb-poster.ts`) vor `holeBanner`. Geprüft wird, was keinen Eintrag hat oder dessen Eintrag über 150 Tage alt
 * ist; ein Urteil, das nicht mehr trägt, streicht Eintrag und Bilder. Gibt die Zahl neu gesetzter Plakate zurück.
 */
export async function holeStaffel0(apiKey: string, poster: PlakatBestand): Promise<number> {
  const bestaende: Bestaende = { eintraege: readJson<Staffel0Bestand>(STAFFEL0_DATEI, {}), poster, banner: readJson<TmdbBanner>(BANNER_DATEI, {}) }
  const kandidaten = staffel0Kandidaten(
    readJson<Title[]>('public/data/titles.json', []),
    readJson<Record<string, ReiheMitglied[]>>('public/data/franchises.json', {}),
    readJson('data/tmdb-titles.json', {}),
  )
  const kennungen = new Set(kandidaten.map((k) => String(k.id)))
  for (const id of Object.keys(bestaende.eintraege)) if (!kennungen.has(id)) streiche(id, bestaende)
  const jetzt = new Date()
  const zuPruefen = kandidaten.filter((k) => staffel0Faellig(bestaende.eintraege[k.id], jetzt))
  const pruefung = await pruefeKandidaten(apiKey, zuPruefen)
  const { neu, offen, doppelt } = wende(zuPruefen, pruefung, abrufTag(jetzt), bestaende)
  const plakate = new Map<number, TmdbBild | undefined>()
  let gesetzt = 0
  for (const [id, e] of Object.entries(neu)) {
    try {
      if (setzeBilder(id, e, bestaende.eintraege[id], await holeBilder(apiKey, e, plakate), bestaende)) gesetzt++
    } catch (err) {
      /* Ohne Bilder bleibt der Eintrag aus, damit der nächste Lauf es erneut versucht. */
      delete neu[id]
      warn(`TMDB-Staffel 0, Bilder zu ${id}: ${(err as Error).message}`)
    }
  }
  Object.assign(bestaende.eintraege, neu)
  writeJson(STAFFEL0_DATEI, bestaende.eintraege)
  writeJson(BANNER_DATEI, bestaende.banner)
  schreibeStaffel0Liste(kandidaten, offen, doppelt, bestaende.eintraege)
  log(`TMDB-Staffel 0: ${zuPruefen.length} Titel geprüft, ${Object.keys(neu).length} zugeordnet, ${offen.size} unsicher oder ohne Folge, ${gesetzt} Plakate`)
  return gesetzt
}
