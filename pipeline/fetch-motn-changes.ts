/**
 * Täglicher Blick auf das, was bei Netflix, Prime Video und Disney+ neu ist.
 *
 * ## Warum neben `fetch-motn.ts`
 *
 * Der große Lauf holt **Bestand**: den deutschen Katalog eines Anbieters,
 * seitenweise, einmal im Monat. Das ist richtig für die Frage „welche unserer
 * 2.700 Titel laufen wo" — und falsch für die Frage, die ein *Kalender*
 * beantworten muss.
 *
 * Daniel am 23.08.2026: „wir brauchen die beste quelle, schnellster weg
 * aktuelle infos für die webseite beschaffen, nicht erst tage später."
 * Ein Bestandslauf am 2. jedes Monats sieht eine Staffel, die am 3. startet,
 * dreißig Tage später.
 *
 * Dieser Lauf holt stattdessen **Änderungen** über `/changes` — 25 je Seite,
 * nach Datum sortiert, mit `from` als Zeitfenster. Ein Tag Rückstand kostet
 * ein bis zwei Anfragen statt eines halben Monatskontingents.
 *
 * ## Was gemessen wurde, bevor das hier entstand (23.08.2026)
 *
 * - **`change_type=upcoming` ist für Anime nutzlos.** Ein Abruf über alle drei
 *   Anbieter ergab **12 künftige Serien für ganz Deutschland, keinen einzigen
 *   Anime** — Reality, Drama, Crime. Dieselbe Falle wie bei JustWatch im
 *   Juli (siehe `ai_agent_learnings.md`): Ein Feld namens `upcoming` heißt
 *   nicht, dass es gefüllt ist. Deshalb fragt dieser Lauf `new` ab.
 * - **`change_type=new` bringt Anime**, mit Tonspur: „Beelzebub" bei Netflix
 *   mit `audios: [deu, jpn]`, dazu „The Dangers in My Heart" und „GTO (2026)".
 * - **Die Zuordnung geht über `imdbId` und `tmdbId`**, die im Show-Objekt
 *   mitkommen — kein Titelraten nötig.
 *
 * ## Was dieser Lauf ausdrücklich **nicht** tut
 *
 * Er schreibt **kein `dub: false`**. Die Quelle belegt, was da ist, nie was
 * fehlt — dieselbe Grenze wie beim großen Lauf, begründet in `lib/motn.ts`.
 * Ein Titel, den sie nicht nennt, bleibt offen.
 *
 * Aufruf: npm run data:motn:changes [-- --tage 3] [-- --budget 6]
 */
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { loadEnv, log, readJson, ROOT, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

loadEnv()

const BASIS = 'https://api.movieofthenight.com/v4'
const SCHLUESSEL = process.env.STREAMING_API_KEY
const ARCHIV = resolve(ROOT, 'data/motn-raw')

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}

/**
 * Wie weit zurück gefragt wird.
 *
 * Drei Tage statt einem: Ein ausgefallener Lauf soll keine Lücke hinterlassen,
 * und dreifach gesehene Änderungen kosten nichts — sie werden ohnehin gegen den
 * Bestand abgeglichen.
 */
const TAGE = zahl('--tage', 3)
/** Harte Grenze, keine Empfehlung — dasselbe Kontingent wie der große Lauf. */
const BUDGET = zahl('--budget', 6)

/** Die Anbieter, für die sich die Frage lohnt. */
const KATALOGE = 'netflix,prime.subscription,disney'

interface Aenderung {
  changeType: string
  itemType: string
  showId: string
  timestamp?: number
  service?: { id?: string }
}

interface MotnShow {
  id: string
  imdbId?: string
  tmdbId?: string
  title?: string
  originalTitle?: string
  showType?: string
  firstAirYear?: number
  streamingOptions?: Record<string, { service?: { id?: string }; type?: string; audios?: { language?: string }[] }[]>
}

interface Antwort {
  changes?: Aenderung[]
  shows?: Record<string, MotnShow>
  hasMore?: boolean
  nextCursor?: string
}

interface Bestand {
  fetchedAt?: string
  /** Verbrauchte Anfragen je Monat — dieselbe Buchhaltung wie der große Lauf. */
  verbrauch?: Record<string, number>
  /** Zuletzt gesehene Änderungen, damit ein Bericht sagen kann, was neu ist. */
  gesehen?: Record<string, { titel?: string; imdbId?: string; tmdbId?: string; dienst?: string; am?: string; deutsch?: boolean }>
}

async function hole(pfad: string): Promise<Antwort | undefined> {
  const res = await fetch(`${BASIS}${pfad}`, { headers: { 'X-API-Key': SCHLUESSEL as string } })
  if (res.status === 429) {
    warn('Kontingent erschöpft (429) — der Lauf endet hier.')
    return undefined
  }
  if (!res.ok) {
    warn(`HTTP ${res.status} bei ${pfad.slice(0, 60)}`)
    return undefined
  }
  const rest = Number(res.headers.get('x-quota-granted')) - Number(res.headers.get('x-quota-used'))
  if (Number.isFinite(rest)) log(`  Kontingent übrig: ${rest}`)
  return (await res.json()) as Antwort
}

/** Führt eine Antwort ins Archiv — eine zweite Auswertung kostet dann nichts. */
function archiviere(name: string, daten: unknown): void {
  if (!existsSync(ARCHIV)) mkdirSync(ARCHIV, { recursive: true })
  writeFileSync(resolve(ARCHIV, `${name}.json.gz`), gzipSync(JSON.stringify(daten)))
}

async function main(): Promise<void> {
  if (!SCHLUESSEL) {
    warn('STREAMING_API_KEY fehlt — der Lauf tut nichts. Schlüssel siehe my_secrets.md.')
    return
  }
  const pfad = resolve(ROOT, 'data/motn-changes.json')
  const bestand = readJson<Bestand>(pfad, {})
  const monat = new Date().toISOString().slice(0, 7)
  bestand.verbrauch ??= {}
  bestand.gesehen ??= {}

  const von = Math.floor(Date.now() / 1000) - TAGE * 86_400
  let cursor: string | undefined
  let anfragen = 0
  let neue = 0
  let mitDeutsch = 0

  while (anfragen < BUDGET) {
    const query = new URLSearchParams({
      country: 'de',
      change_type: 'new',
      item_type: 'show',
      show_type: 'series',
      catalogs: KATALOGE,
      from: String(von),
      order_direction: 'desc',
    })
    if (cursor) query.set('cursor', cursor)

    const antwort = await hole(`/changes?${query}`)
    anfragen++
    bestand.verbrauch[monat] = (bestand.verbrauch[monat] ?? 0) + 1
    if (!antwort) break
    archiviere(`changes-${monat}-${anfragen}`, antwort)

    for (const c of antwort.changes ?? []) {
      const show = antwort.shows?.[c.showId]
      if (!show) continue
      const optionen = show.streamingOptions?.de ?? []
      const deutsch = optionen.some((o) => (o.audios ?? []).some((a) => a.language === 'deu'))
      const schluessel = `${c.showId}:${c.service?.id ?? '?'}`
      if (!bestand.gesehen[schluessel]) neue++
      if (deutsch) mitDeutsch++
      bestand.gesehen[schluessel] = {
        titel: show.title,
        imdbId: show.imdbId,
        tmdbId: show.tmdbId,
        dienst: c.service?.id,
        am: c.timestamp ? new Date(c.timestamp * 1000).toISOString().slice(0, 10) : undefined,
        deutsch,
      }
    }

    if (!antwort.hasMore || !antwort.nextCursor) break
    cursor = antwort.nextCursor
    await sleep(400)
  }

  bestand.fetchedAt = new Date().toISOString()
  writeJson(pfad, bestand, true)
  recordSource('motn-changes', neue)
  log(`${anfragen} Anfragen, ${neue} neue Einträge, ${mitDeutsch} davon mit deutscher Tonspur.`)
  log(`Verbrauch ${monat}: ${bestand.verbrauch[monat]} (dieser Lauf) — der Monatslauf zählt eigene.`)
}

void main()
