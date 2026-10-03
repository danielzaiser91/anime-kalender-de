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
import { sprecherAus, type Sprecher } from './lib/anisearch-sprecher.ts'
import { KENNUNG } from './lib/kennung.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const TAKT_MS = 6000
const MAX_FEHLER_IN_FOLGE = 5
const ALTER_TAGE = 180
/** Hochzählen, sobald `sprecherAus()` ein Feld mehr liest. */
const PARSER_STAND = 1
const GRENZE = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 400)
const ZIEL = 'data/anisearch-sprecher.json'

interface Eintrag extends Sprecher {
  fetchedAt: string
  stand: number
}
interface AnisearchEintrag {
  anisearchId?: number
  info?: { languages?: { language: string; dubbed?: boolean }[] }
}

const bestand = readJson<Record<string, Eintrag>>(ZIEL, {})
const anisearch = readJson<Record<string, AnisearchEintrag>>('data/anisearch.json', {})

const titel = new Map<number, boolean>() // aniSearch-ID → hat Marke
for (const e of Object.values(anisearch)) {
  if (!e.anisearchId) continue
  titel.set(e.anisearchId, !!e.info?.languages?.some((l) => l.language === 'Deutsch' && l.dubbed))
}

const faellig = (id: number): boolean => {
  const e = bestand[String(id)]
  if (!e || e.stand < PARSER_STAND) return true
  return (Date.now() - Date.parse(e.fetchedAt)) / 86_400_000 >= ALTER_TAGE
}

const warteschlange = [...titel.entries()]
  .filter(([id]) => faellig(id))
  .sort((a, b) => Number(a[1]) - Number(b[1]))
  .map(([id]) => id)

log(`${warteschlange.length} von ${titel.size} Sprecherseiten offen, davon kommen ${Math.min(GRENZE, warteschlange.length)} dran`)

let geholt = 0
let fehlerInFolge = 0
for (const id of warteschlange.slice(0, GRENZE)) {
  try {
    const antwort = await fetch(`https://www.anisearch.de/anime/${id}/seiyuu`, {
      headers: { 'User-Agent': KENNUNG, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (!antwort.ok) {
      warn(`aniSearch Sprecher ${id}: HTTP ${antwort.status}`)
      if (antwort.status === 403 || antwort.status === 423 || antwort.status === 429) {
        warn('Abbruch: aniSearch weist ab. Der Rest kommt im nächsten Lauf.')
        break
      }
      if (++fehlerInFolge >= MAX_FEHLER_IN_FOLGE) {
        warn(`Abbruch: ${MAX_FEHLER_IN_FOLGE} Fehlschläge in Folge.`)
        break
      }
      await sleep(TAKT_MS)
      continue
    }
    fehlerInFolge = 0
    bestand[String(id)] = { ...sprecherAus(await antwort.text()), fetchedAt: new Date().toISOString(), stand: PARSER_STAND }
    geholt++
    if (geholt % 100 === 0) log(`  ${geholt}/${Math.min(GRENZE, warteschlange.length)}`)
  } catch (err) {
    warn(`aniSearch Sprecher ${id}: ${(err as Error).message}`)
    if (++fehlerInFolge >= MAX_FEHLER_IN_FOLGE) {
      warn(`Abbruch: ${MAX_FEHLER_IN_FOLGE} Fehlschläge in Folge — aniSearch ist nicht erreichbar.`)
      break
    }
  }
  await sleep(TAKT_MS)
}

writeJson(ZIEL, bestand, true)
log(`${geholt} Seiten geholt, ${Object.keys(bestand).length} insgesamt`)
