/**
 * Folgenlänge und Endtag aus AniList für wenige Titel (Katalogabgleich, 11.10.2026): `ohne-synchro.json` trägt beides nicht. Eine Abfrage holt bis zu 50
 * Titel (`id_in`); Rate Limit 90 je Minute, bei 429 wird nach `retry-after` wiederholt. Zwischenspeicher: eine Woche.
 */
import { readJson, sleep, warn, writeJson } from './util.ts'

const ENDPOINT = 'https://graphql.anilist.co'
const ABFRAGE = 'query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id duration endDate{year month day}}}}'
const WOCHE_MS = 7 * 24 * 3600 * 1000
const PAUSE_MS = 1_000

export interface AnilistMerkmal {
  dauer?: number
  /** `JJJJ-MM-TT`, nur wenn AniList den ganzen Tag kennt. */
  ende?: string
}

interface Zwischen {
  geholtAm?: string
  werte?: Record<string, AnilistMerkmal>
}

type Roh = { id: number; duration: number | null; endDate: { year: number | null; month: number | null; day: number | null } }

const zwei = (n: number): string => String(n).padStart(2, '0')

function alsMerkmal(m: Roh): AnilistMerkmal {
  const { year, month, day } = m.endDate
  return { ...(m.duration ? { dauer: m.duration } : {}), ...(year && month && day ? { ende: `${year}-${zwei(month)}-${zwei(day)}` } : {}) }
}

async function seite(ids: number[]): Promise<Roh[]> {
  for (let versuch = 0; versuch < 3; versuch++) {
    const antwort = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query: ABFRAGE, variables: { ids } }) })
    if (antwort.status === 429) {
      await sleep((Number(antwort.headers.get('retry-after')) || 60) * 1000)
      continue
    }
    if (!antwort.ok) {
      warn(`AniList ${antwort.status} bei den Abgleich-Merkmalen`)
      return []
    }
    return ((await antwort.json()) as { data?: { Page?: { media?: Roh[] } } }).data?.Page?.media ?? []
  }
  return []
}

/** Länge und Endtag der angegebenen AniList-Titel; was AniList nicht liefert, fehlt in der Antwort (die Regeln behandeln es als offen). */
export async function holeAnilistMerkmale(ids: number[], zwischenDatei: string): Promise<Map<number, AnilistMerkmal>> {
  const zwischen = readJson<Zwischen>(zwischenDatei, {})
  const frisch = zwischen.geholtAm && Date.now() - Date.parse(zwischen.geholtAm) < WOCHE_MS
  const werte: Record<string, AnilistMerkmal> = frisch ? (zwischen.werte ?? {}) : {}
  const fehlend = ids.filter((id) => !(String(id) in werte))
  for (let k = 0; k < fehlend.length; k += 50) {
    const block = fehlend.slice(k, k + 50)
    for (const m of await seite(block)) werte[String(m.id)] = alsMerkmal(m)
    await sleep(PAUSE_MS)
  }
  if (fehlend.length) writeJson(zwischenDatei, { geholtAm: frisch ? zwischen.geholtAm : new Date().toISOString(), werte })
  return new Map(ids.filter((id) => String(id) in werte).map((id) => [id, werte[String(id)]!]))
}
