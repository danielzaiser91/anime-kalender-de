/**
 * Holt für die westlichen Animationsserien die Wikidata-Aussagen, aus denen `pipeline/bau/cartoon-reihen.ts`
 * Reihen bildet (Befund und Zahlen: `docs/wissen/cartoon-reihen.md`).
 *
 * Zwei Schritte, beide über dokumentierte Programmwege (kein SPARQL — `query.wikidata.org/robots.txt` sperrt
 * `/sparql` für alle, die Auslegung als „nur Crawler" ist nicht abgesichert):
 *   1. TMDB `/tv/{id}/external_ids` → `wikidata_id` (braucht `TMDB_API_KEY`; ein Aufruf je Serie, nur für neue oder alte Einträge)
 *   2. `www.wikidata.org/w/api.php?action=wbgetentities` in Blöcken à 50, mit `maxlag` und `Retry-After`
 *
 * **Eine Nichtauskunft ist kein Befund:** schlägt ein Aufruf fehl, bleibt der alte Eintrag stehen; `qid: null`
 * heißt nur „TMDB nennt kein Item" und wird nach `ALTER_TAGE` neu gefragt. Der Stand liegt in
 * `data/cartoon-reihen.json` (im Repo, damit jede Zuordnung auf ein nachlesbares Item zeigt).
 *
 * Aufruf: `npm run data:cartoon-reihen [-- --alle] [-- --qid-datei <json>]`; `--qid-datei` liefert
 * {tmdbId: "Q…"} statt Schritt 1 (zum Messen ohne TMDB-Schlüssel).
 */
import { readFileSync } from 'node:fs'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { leseEntitaeten, qidAusExternalIds, type ReihenEintrag } from './lib/cartoon-reihen.ts'
import { REIHEN_DATEI } from './bau/cartoon-reihen.ts'

const TMDB = 'https://api.themoviedb.org/3'
const WIKIDATA = 'https://www.wikidata.org/w/api.php'
/** Wikimedia verlangt `<Client>/<Version> (<Kontakt>)`; leere oder allgemeine Kennungen werden gesperrt. */
const UA = 'anime-kalender-de-reihen/1.0 (https://anime-kalender.de; https://github.com/danielzaiser91/anime-kalender-de) node'
const ALTER_TAGE = 30
const BLOCK = 50
const ARGS = process.argv.slice(2)
const ALLE = ARGS.includes('--alle')
const QID_DATEI = ARGS[ARGS.indexOf('--qid-datei') + 1] && ARGS.includes('--qid-datei') ? ARGS[ARGS.indexOf('--qid-datei') + 1]! : undefined

type Daten = Record<string, ReihenEintrag>

/**
 * Eine GET-Anfrage mit Wiederholung: 429, maxlag und 5xx warten `Retry-After` und versuchen es bis zu fünfmal. Hält der Datenbank-Rückstau von Wikidata
 * so lange an (gemessen 09.10.2026: 12 s über Stunden), geht der letzte Versuch ohne `maxlag` — eine einzelne lesende Anfrage je 1,5 s belastet nichts.
 */
async function holeMitGeduld(url: string, kopf: Record<string, string>, letzteUrl = url): Promise<unknown | null> {
  for (let versuch = 1; versuch <= 5; versuch++) {
    let antwort: Response
    try {
      antwort = await fetch(versuch === 5 ? letzteUrl : url, { headers: { 'User-Agent': UA, ...kopf } })
    } catch (e) {
      warn(`Versuch ${versuch}: ${(e as Error).message}`)
      await sleep(5000 * versuch)
      continue
    }
    const warte = Math.min(Number(antwort.headers.get('retry-after') ?? 0) || 0, 120)
    if (antwort.status === 429 || antwort.status >= 500) {
      await sleep((warte || 10 * versuch) * 1000)
      continue
    }
    if (!antwort.ok) {
      warn(`HTTP ${antwort.status}`)
      return null
    }
    const json = (await antwort.json().catch(() => null)) as { error?: { code?: string } } | null
    if (json?.error?.code === 'maxlag') {
      await sleep((warte || 10 * versuch) * 1000)
      continue
    }
    if (json === null) warn('Antwort kein JSON')
    return json
  }
  return null
}

function faellig(e: ReihenEintrag | undefined, heute: string): boolean {
  if (ALLE || !e) return true
  const grenze = new Date(Date.parse(heute) - ALTER_TAGE * 864e5).toISOString().slice(0, 10)
  return e.geholtAm < grenze
}

async function schritt1Kennungen(tmdbIds: number[], daten: Daten, heute: string, schluessel: string | undefined): Promise<number> {
  const vorgabe = QID_DATEI ? (JSON.parse(readFileSync(QID_DATEI, 'utf8')) as Record<string, string>) : undefined
  if (!vorgabe && !schluessel) return -1
  let geholt = 0
  for (const id of tmdbIds) {
    if (!faellig(daten[String(id)], heute) && daten[String(id)]) continue
    let qid: string | null
    if (vorgabe) {
      qid = vorgabe[String(id)] ?? null
    } else {
      const antwort = await holeMitGeduld(`${TMDB}/tv/${id}/external_ids?api_key=${schluessel}`, {})
      await sleep(60)
      if (antwort === null) continue
      qid = qidAusExternalIds(antwort)
    }
    const alt = daten[String(id)]
    // Ein neuer Abruf behält die Aussagen, wenn das Item dasselbe geblieben ist.
    daten[String(id)] = alt && alt.qid === qid ? { ...alt, geholtAm: heute } : { qid, geholtAm: heute }
    geholt++
  }
  return geholt
}

async function schritt2Aussagen(daten: Daten, heute: string): Promise<{ geholt: number; ausgefallen: number }> {
  const grenze = new Date(Date.parse(heute) - ALTER_TAGE * 864e5).toISOString().slice(0, 10)
  const offen = [...new Set(Object.values(daten).filter((e) => e.qid && (ALLE || !e.rel || (e.aussagenAm ?? '') < grenze)).map((e) => e.qid!))]
  let geholt = 0
  let ausgefallen = 0
  for (let i = 0; i < offen.length; i += BLOCK) {
    const block = offen.slice(i, i + BLOCK)
    const url = `${WIKIDATA}?action=wbgetentities&ids=${block.join('|')}&props=claims|labels&languages=de|en&format=json&maxlag=5`
    const antwort = await holeMitGeduld(url, {}, url.replace("&maxlag=5", ""))
    if (antwort === null) {
      // Pause statt Abbruch: der Block bleibt offen (`rel` fehlt) und kommt im nächsten Lauf wieder dran.
      ausgefallen += block.length
      warn(`Wikidata-Block ${i / BLOCK + 1} nicht beantwortet — ${block.length} Items bleiben offen`)
      await sleep(30_000)
      continue
    }
    const gelesen = leseEntitaeten(antwort, heute)
    for (const e of Object.values(daten)) {
      const neu = e.qid ? gelesen[e.qid] : undefined
      if (neu) Object.assign(e, { label: neu.label, rel: neu.rel, aussagenAm: heute })
    }
    geholt += block.length
    await sleep(1500)
  }
  return { geholt, ausgefallen }
}

async function main(): Promise<void> {
  const schluessel = process.env.TMDB_API_KEY
  const heute = new Date().toISOString().slice(0, 10)
  const cartoons = Object.values(readJson<Record<string, { tmdbId: number }>>('data/cartoons.json', {}))
  const tmdbIds = cartoons.map((c) => c.tmdbId).sort((a, b) => a - b)
  const daten = readJson<Daten>(REIHEN_DATEI, {})

  const neueKennungen = await schritt1Kennungen(tmdbIds, daten, heute, schluessel)
  if (neueKennungen < 0) {
    warn('Kein TMDB_API_KEY und keine --qid-datei — es gibt nichts zu holen.')
    recordSource('cartoon-reihen', 0, 'kein TMDB_API_KEY')
    return
  }
  // Ein Eintrag, dessen Serie nicht mehr im Bestand ist, fällt weg (kein Gedächtnis für Verschwundenes).
  const imBestand = new Set(tmdbIds.map(String))
  for (const k of Object.keys(daten)) if (!imBestand.has(k)) delete daten[k]

  const { geholt, ausgefallen } = await schritt2Aussagen(daten, heute)
  const sortiert = Object.fromEntries(Object.entries(daten).sort(([a], [b]) => Number(a) - Number(b)))
  writeJson(REIHEN_DATEI, sortiert, true)
  const mitItem = Object.values(sortiert).filter((e) => e.qid).length
  recordSource('cartoon-reihen', geholt, undefined, geholt + ausgefallen, true)
  log(`${neueKennungen} Kennungen gefragt, ${mitItem} von ${tmdbIds.length} Serien mit Wikidata-Item, ${geholt} Items gelesen, ${ausgefallen} offen geblieben`)
}

await main()
