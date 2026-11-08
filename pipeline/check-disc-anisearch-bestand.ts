/**
 * Bestandsprüfung (`public/data`): Jeder Titel, dessen archivierte aniSearch-Seite eine deutsche Disc-Ausgabe nennt, steht in `data/disc-ausgaben.json`.
 * Lehre 06.11.2026: reine aniSearch-Titel (Kennung ab 10 Mio.) fielen aus der Zuordnung des Auszugs, 0 von 163 hatten eine Disc (Regel `lib/disc-ohne-zuordnung.ts`).
 *
 * Nur eine Warnung (Exit 0): Der Auszug läuft vor dem Bau, ein Titel, der heute neu in `titles.json` kommt, hat bis zum nächsten Lauf keine Zeile,
 * und Rot würde den Bestandsbau stoppen. Die Zeile `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log; ab `LUFT` Titeln heißt es, der Auszug läuft nicht.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { ausgabenAusSeite } from './extract-disc-ausgaben.ts'
import { titelOhneDisc } from './lib/disc-ohne-zuordnung.ts'
import { seiteZuTitel } from './lib/anisearch-seite-zu-titel.ts'

/** Titel eines Tages, die der Auszug noch nicht kannte; mehr als das ist ein ausgefallener Auszug. */
const LUFT = 10

const lies = <T>(wurzel: string, pfad: string, vorgabe: T): T => {
  const datei = join(wurzel, pfad)
  return existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as T) : vorgabe
}

export function bilanz(wurzel: string): string[] {
  const titel = lies<{ id: number }[]>(wurzel, 'public/data/titles.json', [])
  const bruecke = lies<Record<string, { anisearchId?: number }>>(wurzel, 'data/anisearch.json', {})
  const disc = lies<Record<string, unknown[]>>(wurzel, 'data/disc-ausgaben.json', {})
  const ids = titel.map((t) => t.id)
  const asIdVon = new Map<number, number>()
  for (const [asId, titelId] of seiteZuTitel(bruecke, ids)) asIdVon.set(titelId, asId)
  const ausgabenVon = (titelId: number): number => {
    const datei = join(wurzel, 'data/anisearch-raw', `${asIdVon.get(titelId)}.html.gz`)
    if (!asIdVon.has(titelId) || !existsSync(datei)) return 0
    return ausgabenAusSeite(gunzipSync(readFileSync(datei)).toString('utf8')).ausgaben.length
  }
  const fehlt = titelOhneDisc(ids, ausgabenVon, disc)
  const zeilen = [`Disc-Zuordnung: ${fehlt.length} Titel mit Disc-Ausgabe auf der aniSearch-Seite, aber ohne Zeile in data/disc-ausgaben.json (von ${ids.length} Titeln)`]
  if (fehlt.length)
    zeilen.push(`  ⚠ WARNUNG Disc-Zuordnung: ${fehlt.length} Titel ohne Zeile in data/disc-ausgaben.json${fehlt.length > LUFT ? ' — mehr als ein Tag erklärt, npm run data:disc-ausgaben prüfen' : ''}: ${fehlt.slice(0, 10).join(', ')}${fehlt.length > 10 ? ', …' : ''}`)
  return zeilen
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const zeile of bilanz(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)))) console.log(zeile)
  console.log('VERSTÖSSE: 0')
}
