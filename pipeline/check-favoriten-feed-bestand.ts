/**
 * Bestandsprüfung des persönlichen Kalender-Feeds (23.10.2026): der Ausschnitt aus `feeds/all.ics` ist dieselbe Datei, die
 * `buildIcs` aus den Terminen der Favoriten baut, und auch mit allen Titeln als Favoriten bleibt er unter der Terminzahl-Grenze
 * und der Zeitgrenze. Liest `public/data`, gehört deshalb in `check:bestand`. Die Zusicherungen selbst stehen in
 * `pipeline/lib/feed-bestand.ts`, ihre Rotfälle in `pipeline/check-favoriten-feed-faelle.ts` (Kette).
 * Einheitenfälle des Workers: `tools/worker-favoriten-feed.test.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { ReleaseEvent } from '../shared/types.ts'
import { ladeAkVon, uebersetzeDatei } from './lib/ausgabe-kennung.ts'
import { messeMs, pruefeFeedBestand } from './lib/feed-bestand.ts'

let verletzt = 0
function melde(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

if (!existsSync('public/data/feeds/all.ics')) melde('public/data/feeds/all.ics ist da (npm run data:build)', false)
else {
  const alle = readFileSync('public/data/feeds/all.ics', 'utf8')
  const roh = JSON.parse(readFileSync('public/data/events.json', 'utf8')) as ReleaseEvent[]
  const events = uebersetzeDatei('events.json', roh, ladeAkVon('data/kennungen.json').akVon) as ReleaseEvent[]
  const uids = new Set([...alle.matchAll(/^UID:(.+)\r$/gm)].map((t) => t[1]))
  const aelteste = events.filter((e) => uids.has(`${e.id}@anime-kalender-de`)).map((e) => e.date).sort()[0]!
  const imFeed = events.filter((e) => e.date >= aelteste)
  for (const b of pruefeFeedBestand(alle, imFeed, messeMs)) melde(b.name, b.ok, b.gefunden)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) zum Favoriten-Feed am Bestand verletzt.` : '\nFavoriten-Feed (Bestand): alle Zusicherungen halten.')
console.log(`VERSTÖSSE: ${verletzt}`)
process.exit(verletzt ? 1 : 0)
