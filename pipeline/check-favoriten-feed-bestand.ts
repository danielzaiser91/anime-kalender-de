/**
 * Bestandsprüfung des persönlichen Kalender-Feeds (23.10.2026): der Ausschnitt aus `feeds/all.ics` ist dieselbe Datei, die
 * `buildIcs` aus den Terminen der Favoriten baut, und auch mit allen Titeln als Favoriten bleibt er unter der Rechenzeit des
 * Workers Free (10 ms) und unter der Terminzahl-Grenze. Liest `public/data`, gehört deshalb in `check:bestand`.
 * Einheitenfälle ohne Dateizugriff: `tools/worker-favoriten-feed.test.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { buildIcs } from '../shared/ics.ts'
import type { ReleaseEvent } from '../shared/types.ts'
import { schneideFeed } from '../worker/src/favoriten-feed-schnitt.ts'
import { ladeAkVon, uebersetzeDatei } from './lib/ausgabe-kennung.ts'

/** Mehr Termine ab sieben Tage zurück sind ein Anlass, den Feed neu zu messen (23.10.2026: 518). */
const MAX_TERMINE = 800
const MAX_MS = 10
const NAME = 'Anime-Kalender DE – Meine Favoriten'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const median = (zahlen: number[]): number => [...zahlen].sort((a, b) => a - b)[Math.floor(zahlen.length / 2)]!

function messeMs(alle: string, favoriten: Set<number>): number {
  const dauern: number[] = []
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    schneideFeed(alle, favoriten, NAME)
    dauern.push(performance.now() - start)
  }
  return median(dauern)
}

if (!existsSync('public/data/feeds/all.ics')) pruefe('public/data/feeds/all.ics ist da (npm run data:build)', false)
else {
  const alle = readFileSync('public/data/feeds/all.ics', 'utf8')
  const roh = JSON.parse(readFileSync('public/data/events.json', 'utf8')) as ReleaseEvent[]
  const events = uebersetzeDatei('events.json', roh, ladeAkVon('data/kennungen.json').akVon) as ReleaseEvent[]
  const uids = new Set([...alle.matchAll(/^UID:(.+)\r$/gm)].map((t) => t[1]))
  const aelteste = events.filter((e) => uids.has(`${e.id}@anime-kalender-de`)).map((e) => e.date).sort()[0]!
  const imFeed = events.filter((e) => e.date >= aelteste)
  const titel = [...new Set(imFeed.map((e) => e.titleId))].sort((a, b) => a - b)
  const faelle: [string, number[]][] = [
    ['alle Titel', titel],
    ['jeder dritte Titel', titel.filter((_, i) => i % 3 === 0)],
    ['der terminreichste Titel', [[...titel].sort((a, b) => imFeed.filter((e) => e.titleId === b).length - imFeed.filter((e) => e.titleId === a).length)[0]!]],
  ]
  for (const [name, ids] of faelle) {
    const erwartet = buildIcs(imFeed.filter((e) => ids.includes(e.titleId)), { siteUrl: 'https://anime-kalender.de/', calendarName: NAME })
    pruefe(`Bestand: Ausschnitt gleich buildIcs (${name}, ${ids.length} Titel)`, schneideFeed(alle, new Set(ids), NAME) === erwartet)
  }
  const termine = alle.split('BEGIN:VEVENT').length - 1
  pruefe(`Bestand: all.ics führt höchstens ${MAX_TERMINE} Termine (jetzt ${termine})`, termine > 0 && termine <= MAX_TERMINE, termine)
  const ms = messeMs(alle, new Set(titel))
  pruefe(`Bestand: Ausschnitt mit allen ${titel.length} Titeln unter ${MAX_MS} ms (Median von 5: ${ms.toFixed(1)} ms)`, ms < MAX_MS, ms)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) zum Favoriten-Feed am Bestand verletzt.` : '\nFavoriten-Feed (Bestand): alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
