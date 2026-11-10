/**
 * Bestandsprüfung (`public/data`): Haupttitel ohne Streaming-Weg und ohne jeden Weg dürfen nur weniger werden
 * (`data/streaming-luecke-stand.json`, Regel und Lehre in `lib/streaming-luecke.ts`).
 *
 * Bewusst nur eine Warnung (Exit 0): Neue aniSearch-Titel kommen täglich ohne Weg hinzu, und das darf den Bestandsbau nicht anhalten.
 * Die Zeilen `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log. Test: `check-streaming-luecke.ts`.
 */
import { readJson } from './lib/util.ts'
import { lueckenBilanz, streamingLuecke, type LueckenStand } from './lib/streaming-luecke.ts'

const kennungen = (liste: number[]): string => `${liste.slice(0, 10).join(', ')}${liste.length > 10 ? ', …' : ''}`

const titles = readJson<Parameters<typeof streamingLuecke>[0]>('public/data/titles.json', [])
const releases = readJson<{ titleId: number }[]>('public/data/releases.json', [])
const stand = readJson<LueckenStand>('data/streaming-luecke-stand.json', { stand: '', ohneJedenWeg: [], ohneStreamingWeg: [] })
const ist = streamingLuecke(titles, new Set(releases.map((r) => r.titleId)))
const b = lueckenBilanz(ist, stand)

console.log(`Haupttitel ohne Streaming-Weg: ${ist.ohneStreamingWeg.length}, ohne jeden Weg: ${ist.ohneJedenWeg.length} (Stand ${stand.stand}: ${stand.ohneStreamingWeg.length} und ${stand.ohneJedenWeg.length})`)
if (b.neuOhneStreamingWeg.length)
  console.log(`  ⚠ WARNUNG Streaming-Lücke: ${b.neuOhneStreamingWeg.length} Titel ohne Streaming-Weg, die der Stand nicht kennt — JustWatch/TMDB-Zuordnung prüfen (tmdb-titles.json, justwatch-audio.json): ${kennungen(b.neuOhneStreamingWeg)}`)
if (b.neuOhneJedenWeg.length)
  console.log(`  ⚠ WARNUNG Streaming-Lücke: ${b.neuOhneJedenWeg.length} Titel ohne jeden Weg, die der Stand nicht kennt: ${kennungen(b.neuOhneJedenWeg)}`)
if (b.erledigt >= 10)
  console.log(`  ⚠ WARNUNG Streaming-Lücke: ${b.erledigt} Kennungen in data/streaming-luecke-stand.json haben inzwischen einen Weg — Listen kürzen (Ratsche)`)
console.log('VERSTÖSSE: 0')
