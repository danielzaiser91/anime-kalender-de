/**
 * Ordnet die Katalogtitel, die nur AniList kennt (`keiner` in `data/anisearch-katalog-abgleich.json`), TMDB zu und schreibt
 * `data/tmdb-katalog-zuordnung.json` (AniList-Kennung → TMDB-Kennung, Art, Stufe sicher|unsicher|kein, Grund) sowie die Prüfliste
 * `daniel-zum-abarbeiten/listen/tmdb-katalog-unsicher.md`. Regel: `lib/tmdb-katalog.ts`. Noch nicht im Bau.
 *
 * Wiederaufnahme: Was in der Zuordnung steht, wird nicht noch einmal gesucht; alle 100 Titel wird gesichert. Höchstens 4 Anfragen je Sekunde.
 * Aufruf: `npm run data:tmdb-katalog [-- --limit N]` (Schlüssel `TMDB_API_KEY` aus `.env`).
 */
import { loadEnv, log, readJson, warn, writeText } from './lib/util.ts'
import { ordneZu } from './lib/tmdb-katalog-abruf.ts'
import { pruefliste, zaehleStufen } from './lib/tmdb-katalog-liste.ts'
import type { KatalogTitel, Zuordnung } from './lib/tmdb-katalog.ts'

const DATEI = 'data/tmdb-katalog-zuordnung.json'
const LISTE = 'daniel-zum-abarbeiten/listen/tmdb-katalog-unsicher.md'
/** Nach so vielen Fehlern (nicht 429) endet der Lauf; was fehlt, kommt beim nächsten Aufruf. */
const MAX_FEHLER = 20

type Abgleich = { keiner: { id: number; jahr: number | null; format: string | null }[] }
type Namen = { id: number; titleEn?: string; titleRomaji?: string; titleNative?: string; land?: string }

/** Ein Eintrag je Zeile, nach Kennung sortiert: kleine Diffs bei Wiederaufnahme. */
function speichere(zuordnung: Record<string, Zuordnung>): void {
  const zeilen = Object.keys(zuordnung)
    .sort((a, b) => Number(a) - Number(b))
    .map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(zuordnung[id])}`)
  writeText(DATEI, `{\n${zeilen.join(',\n')}\n}\n`)
}

function ladeTitel(): Map<number, KatalogTitel> {
  const namen = new Map(readJson<Namen[]>('public/data/ohne-synchro.json', []).map((n) => [n.id, n]))
  const titel = new Map<number, KatalogTitel>()
  for (const k of readJson<Abgleich>('data/anisearch-katalog-abgleich.json', { keiner: [] }).keiner) {
    const n = namen.get(k.id)
    if (n) titel.set(k.id, { id: k.id, format: k.format, jahr: k.jahr, en: n.titleEn, romaji: n.titleRomaji, native: n.titleNative, land: n.land })
  }
  return titel
}

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return void warn('TMDB_API_KEY fehlt — kein Abruf')
  const limit = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity
  const titel = ladeTitel()
  const zuordnung = readJson<Record<string, Zuordnung>>(DATEI, {})
  const offen = [...titel.values()].filter((t) => !(String(t.id) in zuordnung)).sort((a, b) => a.id - b.id)
  log(`TMDB-Katalog: ${titel.size} Titel, ${offen.length} noch zu suchen`)
  let gesucht = 0
  let fehler = 0
  for (const t of offen.slice(0, limit)) {
    if (fehler >= MAX_FEHLER) break
    try {
      zuordnung[String(t.id)] = await ordneZu(apiKey, t)
    } catch (e) {
      fehler++
      warn(`TMDB-Katalog ${t.id}: ${(e as Error).message.slice(0, 80)}`)
      continue
    }
    if (++gesucht % 100 === 0) {
      speichere(zuordnung)
      log(`${gesucht}/${Math.min(offen.length, limit)} gesucht`)
    }
  }
  speichere(zuordnung)
  writeText(LISTE, pruefliste(zuordnung, titel))
  const z = zaehleStufen(zuordnung)
  log(`TMDB-Katalog: ${gesucht} gesucht, ${fehler} Fehler; gesamt ${z.sicher} sicher, ${z.unsicher} unsicher, ${z.kein} kein`)
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('fetch-tmdb-katalog.ts')) await main()
