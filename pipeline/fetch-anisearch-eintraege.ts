/**
 * Holt aniSearch-Einträge, die bei uns noch keinen Titel haben, als kompakte Datei `data/anisearch-eintraege.json` (Kennung → Eintrag).
 *
 * Anlass (Daniel, 06.10.2026): „aniSearch-Einträge vollständig als Titel, außer Hentai." Aus der Datei legt `bau/anisearch-titel.ts` Titel mit der
 * Kennung `10.000.000 + aniSearch-Kennung` an (mit Deutsch im Hauptbestand, sonst nur im Katalog hinter dem Schalter).
 *
 * **Reihenfolge der Abrufe:** erst die Einträge, bei denen aniSearch Deutsch nennt (vertont, geplant, abgebrochen — `data/anisearch-dub-ids.json`,
 * geschrieben vom Dub-Schritt), dann der Rest in aufsteigender Kennung (`/v1/anime/titles`). Zehn Kennungen je Abruf, alle 5 Sekunden, **nur mit Token**; `--limit` begrenzt die Zahl der Kennungen je Lauf (Standard 400).
 *
 * **Musikvideos, Werbespots und Sonstiges ohne Synchro und ohne deutschen Anbieter bleiben ebenfalls draußen** (`istUnnoetig`).
 * **Hentai bleibt draußen** (Kennzeichen 18+ am Cover, Hauptgenre Hentai oder das Schlagwort „Keine Jugendfreigabe"); die Kennungen stehen in
 * `data/anisearch-eintraege-ausgelassen.json`, damit sie nicht wieder geholt werden. Cover und Bild-Adressen übernehmen wir nicht
 * (nicht zur Weitergabe freigegeben).
 *
 * Aufruf: `npx tsx pipeline/fetch-anisearch-eintraege.ts [--limit N]`
 */
import { existsSync, readFileSync } from 'node:fs'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 400
const GEHEIM = 'C:/code/ai/ai helper files/my_secrets.md'
const KOPF = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/json',
}

interface Roh {
  id: number
  title: string
  title_native?: string | null
  type: string
  year?: number | null
  episodes?: number | null
  duration?: number | null
  aired_from?: string | null
  aired_to?: string | null
  external_ids?: { myanimelist?: number | null }
  genres?: { main?: string[]; tags?: string[] }
  studios?: { name: string }[]
  cover?: { nsfw?: number | null }
  releases?: { de?: { title?: string; dubbed?: string; published_from?: string | null; publishers?: { name: string }[] }; en?: { title?: string } }
}

function token(): string | undefined {
  if (process.env.ANISEARCH_TOKEN) return process.env.ANISEARCH_TOKEN
  if (!existsSync(GEHEIM)) return undefined
  const block = readFileSync(GEHEIM, 'utf8').split(/\n## /).find((b) => /aniSearch-API-Token/i.test(b))
  return /([A-Za-z0-9_|.-]{24,})/.exec(block?.split('\n').find((z) => /^-\s*Wert\s*:/i.test(z)) ?? '')?.[1]
}

/** Deutsch bei aniSearch laut Eintrag (`?lang=de` liefert „Ja", „Abgebrochen", „Geplant"): dieselbe Antwort wie die Dub-Liste (404 von 404 gleich, 07.10.2026). */
export function dubKennzeichen(r: Pick<Roh, 'releases'>): 'd' | 'p' | 'c' | '-' {
  const d = r.releases?.de?.dubbed
  return d === 'Ja' || d === 'Yes' ? 'd' : d === 'Abgebrochen' || d === 'Canceled' ? 'c' : d === 'Geplant' || d === 'Planned' ? 'p' : '-'
}

export const istHentai = (r: Roh): boolean =>
  r.cover?.nsfw === 18 || /hentai/i.test(r.genres?.main?.[0] ?? '') || (r.genres?.tags ?? []).includes('Keine Jugendfreigabe')

/**
 * **Was wir nicht brauchen** (gemessen 08.10.2026 an 10.800 Einträgen): Musikvideos (0 mit Synchro) und Werbespots (CM: 0 mit Synchro, im Mittel eine Minute) immer; „Anderes“ (Pilotfilme, Kurzclips)
 * nur, wenn weder eine Synchro noch ein deutscher Anbieter dabei ist und die Laufzeit unter 20 Minuten liegt (längere sind OVA-artig; Daniel, 08.10.2026: Bikini Warriors). OVA, Film, Web und Bonus (dort stehen Extras wie „Angel Beats! Stairway to Heaven“) bleiben; „Unbekannt“ nur mit Jahr (ohne Jahr ist es ein leerer Platzhalter).
 */
export const istUnnoetig = (r: Roh): boolean =>
  /^(Musikvideo|Music Video|CM|Commercial)$/i.test(r.type) ||
  (/^(Unbekannt|Unknown)$/i.test(r.type) && !r.year) || (/^(Anderes|Other)$/i.test(r.type) && dubKennzeichen(r) === '-' && !r.releases?.de?.publishers?.length && (r.duration ?? 0) < 20)

export function kompakt(r: Roh): Record<string, unknown> {
  const de = r.releases?.de
  const frei = <T>(w: T | null | undefined): T | undefined => w ?? undefined
  return {
    t: r.title,
    n: frei(r.title_native),
    de: frei(de?.title),
    ty: r.type,
    y: frei(r.year),
    f: frei(r.episodes),
    min: frei(r.duration),
    von: frei(r.aired_from),
    bis: frei(r.aired_to),
    mal: frei(r.external_ids?.myanimelist),
    st: (r.studios ?? []).slice(0, 2).map((s) => s.name),
    dub: dubKennzeichen(r),
    en: frei(r.releases?.en?.title),
    pub: de?.publishers?.map((p) => p.name),
    dvon: frei(de?.published_from),
  }
}

async function holen<T>(url: string, t: string | undefined): Promise<T | undefined> {
  for (let versuch = 0; versuch < 3; versuch++) {
    const antwort = await fetch(url, { headers: { ...KOPF, ...(t ? { authorization: `Bearer ${t}` } : {}) } })
    if (antwort.status === 429) {
      await sleep(((await antwort.json().catch(() => ({}))) as { retry_after?: number }).retry_after ? 12_000 : 20_000)
      continue
    }
    if (!antwort.ok) {
      warn(`aniSearch ${url.slice(0, 60)}: HTTP ${antwort.status}`)
      return undefined
    }
    return (await antwort.json()) as T
  }
  return undefined
}

async function main(): Promise<void> {
  const t = token()
  /* Ohne Token antwortet `/v1/anime/<Kennungen>` mit 403 (gemessen im Lauf 37629092125, 07.10.2026) — in Actions braucht es das Secret `ANISEARCH_TOKEN`. */
  if (!t) {
    warn('aniSearch-Einträge: kein Token, kein Abruf (Secret ANISEARCH_TOKEN setzen)')
    recordSource('anisearch-eintraege', 0, 'kein Token')
    return
  }
  const pause = 5_500
  const eintraege = readJson<Record<string, Record<string, unknown>>>('data/anisearch-eintraege.json', {})
  const ausgelassen = new Set(readJson<number[]>('data/anisearch-eintraege-ausgelassen.json', []).map(String))
  const bekannt = new Set<string>([...Object.keys(eintraege), ...ausgelassen])
  for (const e of Object.values(readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {}))) if (e.anisearchId) bekannt.add(String(e.anisearchId))
  for (const m of readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^(\d+):\s*(\d+)/gm)) bekannt.add(m[2]!)
  const deutsch = Object.keys(readJson<Record<string, string>>('data/anisearch-dub-ids.json', {})).filter((id) => !bekannt.has(id))
  const titelListe = await holen<Record<string, unknown>>('https://api.anisearch.com/v1/anime/titles', t)
  const rest = Object.keys(titelListe ?? {}).filter((id) => !bekannt.has(id) && !deutsch.includes(id)).sort((a, b) => Number(a) - Number(b))
  const ziel = [...deutsch, ...rest].slice(0, LIMIT)
  log(`aniSearch-Einträge: ${deutsch.length} mit Deutsch offen, ${rest.length} weitere offen, ${ziel.length} in diesem Lauf`)
  let neu = 0
  let fehler = 0
  for (let k = 0; k < ziel.length; k += 10) {
    const teil = ziel.slice(k, k + 10)
    const antwort = await holen<{ results?: Roh[] }>(`https://api.anisearch.com/v1/anime/${teil.join(',')}?lang=de`, t)
    if (!antwort) {
      if (++fehler > 3) break
      continue
    }
    for (const r of antwort.results ?? []) {
      if (istHentai(r) || istUnnoetig(r)) ausgelassen.add(String(r.id))
      else eintraege[String(r.id)] = kompakt(r)
      neu++
    }
    writeJson('data/anisearch-eintraege.json', eintraege)
    writeJson('data/anisearch-eintraege-ausgelassen.json', [...ausgelassen].map(Number).sort((a, b) => a - b))
    await sleep(pause)
  }
  log(`${neu} Einträge neu, ${Object.keys(eintraege).length} insgesamt, ${ausgelassen.size} ausgelassen (Hentai, Musikvideo, CM, Sonstiges)`)
  /* Nichts offen ist Erfolg; lauter Fehlschläge (403 ohne gültiges Token) sind keiner und tragen ihre Ursache in `lastError`. */
  recordSource('anisearch-eintraege', neu, fehler > 0 ? `${fehler} Abrufe fehlgeschlagen (HTTP-Fehler, Token prüfen)` : undefined, undefined, ziel.length === 0)
}

if (process.argv[1]?.endsWith('fetch-anisearch-eintraege.ts')) await main()
