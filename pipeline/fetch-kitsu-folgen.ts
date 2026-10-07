/**
 * Folgentitel und Folgenlänge von Kitsu — der Rückfall, wo aniSearch, Crunchyroll und TMDB keine Titel haben.
 *
 * Anlass (Daniel, 07.10.2026, „Black Butler: Book of Murder"): Die Folgenliste zeigte „Die Folgentitel liegen noch nicht vor" und keine Laufzeit.
 * aniSearch führt für dieses OVA keine Folgen (`/v1/anime/9558/episodes` → `null`), TMDB kennt es nicht; Kitsu nennt „Book of Murder Part 1/2", je 58 Minuten.
 *
 * **Zuordnung nur über die MAL-Kennung** (Kitsu führt sie als Mapping) und nur, wo Kitsus Folgenzahl genau unserer entspricht — keine Nummer wird geraten.
 * Kitsu liefert englische/japanische Titel, keine deutschen; sie füllen nur Lücken (`bau/folgentitel-kitsu.ts`). Die Schnittstelle ist ohne Schlüssel lesbar
 * (JSON:API, Apache-2.0-Dokumentation, „reasonable rate limit"); wir fragen höflich (300 ms Abstand), holen jeden Titel einmal und nennen Kitsu im Impressum.
 *
 * Warteschlange: Titel mit mindestens zwei Folgen, deren `public/data/folgen/<id>.json` fehlt oder eine Folge ohne Titel hat (oder keine Minuten), mit MAL-Kennung,
 * höchstens 200 Folgen, noch nicht in `data/kitsu-folgen.json`. Aufruf: `npx tsx pipeline/fetch-kitsu-folgen.ts [--limit N] [--alle]`
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchJson, log, readJson, ROOT, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'

const BASIS = 'https://kitsu.io/api/edge'
const KOPF = { accept: 'application/vnd.api+json', 'user-agent': 'anime-kalender-de/1.0 (nichtkommerziell; danielzaiser91@googlemail.com)' }
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity
const ALLE = process.argv.includes('--alle')

type Eintrag = { k: number | null; f: [number, string, number][] }

/** Hat die Folgenliste Lücken (Titel oder Minuten)? Ohne Datei gilt sie als Lücke. */
function hatLuecke(id: number): boolean {
  const datei = resolve(ROOT, `public/data/folgen/${id}.json`)
  if (!existsSync(datei)) return true
  const d = JSON.parse(readFileSync(datei, 'utf8')) as { f: [number, string, number?][]; min?: number }
  return d.f.some((x) => !x[1]) || (!d.min && d.f.some((x) => !x[2]))
}

async function folgenVon(kitsuId: number): Promise<[number, string, number][]> {
  const aus: [number, string, number][] = []
  for (let offset = 0; offset < 400; offset += 20) {
    const seite = await fetchJson<{ data?: { attributes: { number?: number; canonicalTitle?: string; length?: number } }[] }>(
      `${BASIS}/anime/${kitsuId}/episodes?page[limit]=20&page[offset]=${offset}&sort=number`,
      { headers: KOPF },
    )
    const daten = seite.data ?? []
    for (const e of daten) aus.push([e.attributes.number ?? 0, (e.attributes.canonicalTitle ?? '').trim(), e.attributes.length ?? 0])
    if (daten.length < 20) break
    await sleep(300)
  }
  return aus
}

async function main(): Promise<void> {
  const titel = readJson<Title[] | { titles?: Title[] }>('public/data/titles.json', [])
  const liste = Array.isArray(titel) ? titel : (titel.titles ?? [])
  const bestand = readJson<Record<string, Eintrag>>('data/kitsu-folgen.json', {})
  const offen = liste
    .filter((t) => (t.episodes ?? 0) >= 2 && (t.episodes ?? 0) <= 200 && t.malId && hatLuecke(t.id) && (ALLE || !(String(t.id) in bestand)))
    .slice(0, LIMIT)
  log(`Kitsu-Folgen: ${offen.length} Titel abzufragen (${Object.keys(bestand).length} schon bekannt)`)
  let gefunden = 0
  let fehler = 0
  for (const t of offen) {
    try {
      const mapping = await fetchJson<{ included?: { id: string }[] }>(
        `${BASIS}/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${t.malId}&include=item`,
        { headers: KOPF },
      )
      const kitsuId = Number(mapping.included?.[0]?.id)
      await sleep(300)
      if (!kitsuId) {
        bestand[String(t.id)] = { k: null, f: [] }
        continue
      }
      const folgen = await folgenVon(kitsuId)
      bestand[String(t.id)] = { k: kitsuId, f: folgen }
      if (folgen.length) gefunden++
    } catch (e) {
      fehler++
      warn(`Kitsu ${t.id}: ${(e as Error).message.slice(0, 80)}`)
      if (fehler > 15) break
    }
    await sleep(300)
  }
  writeJson('data/kitsu-folgen.json', bestand)
  log(`${gefunden} von ${offen.length} Titeln mit Kitsu-Folgen, ${fehler} Fehler`)
  recordSource('kitsu-folgen', gefunden)
}

await main()
