/**
 * **Sprecherseiten von aniSearch** (`/anime/<id>/seiyuu`): deutsche Sprecher je Figur.
 *
 * Sie belegen eine deutsche Fassung unabhängig von der Marke „Synchronisiert" und sollen AniList bei
 * den Sprechern ablösen. Ergebnis: `data/anisearch-sprecher.json`, Schlüssel ist die aniSearch-ID.
 *
 * Reihenfolge: zuerst Titel **ohne** Synchro-Marke. Takt und Abbruch wie `fetch-anisearch-artikel.ts`.
 *
 * Aufruf: `tsx pipeline/fetch-anisearch-sprecher.ts [--limit N]`
 */
import { arbeiteAb, type Abruf } from './lib/anisearch-sprecher-lauf.ts'
import { katalogAus, warteschlange, type AnisearchEintrag, type Eintrag } from './lib/anisearch-sprecher-reihe.ts'
import { KENNUNG } from './lib/kennung.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const TAKT_MS = 6000
/** Zeitbudget: Der Workflow bricht bei 120 Minuten ab und verwirft dann alles, was noch nicht geschrieben ist (03.10.2026: 1.100 Seiten × ~6,7 s ≈ 123 Minuten). */
const MINUTEN = Number(/--minuten[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 100)
const START = Date.now()
const GRENZE = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 400)
const ZIEL = 'data/anisearch-sprecher.json'

async function hole(id: number): Promise<Abruf> {
  try {
    const antwort = await fetch(`https://www.anisearch.de/anime/${id}/seiyuu`, {
      headers: { 'User-Agent': KENNUNG, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (antwort.ok) return { art: 'ok', html: await antwort.text() }
    warn(`aniSearch Sprecher ${id}: HTTP ${antwort.status}`)
    return { art: 'fehler', status: antwort.status }
  } catch (err) {
    warn(`aniSearch Sprecher ${id}: ${(err as Error).message}`)
    return { art: 'fehler' }
  }
}

const bestand = readJson<Record<string, Eintrag>>(ZIEL, {})
const katalog = katalogAus(readJson<Record<string, AnisearchEintrag>>('data/anisearch.json', {}))
const offen = warteschlange(katalog, bestand, Date.now())
const dran = offen.slice(0, GRENZE)
log(`${offen.length} von ${katalog.size} Sprecherseiten offen, davon kommen ${dran.length} dran`)

const geholt = await arbeiteAb(dran, bestand, { hole, warte: sleep, taktMs: TAKT_MS, ende: START + MINUTEN * 60_000, minuten: MINUTEN })

writeJson(ZIEL, bestand, true)
log(`${geholt} Seiten geholt, ${Object.keys(bestand).length} insgesamt`)
