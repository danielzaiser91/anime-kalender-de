/**
 * Bestandsprüfung (`public/data`): Haupttitel ohne Streaming-Weg und ohne jeden Weg dürfen nur weniger werden
 * (`data/streaming-luecke-stand.json`, Regel und Lehre in `lib/streaming-luecke.ts`).
 *
 * Bewusst nur eine Warnung (Exit 0): Neue aniSearch-Titel kommen täglich ohne Weg hinzu, und das darf den Bestandsbau nicht anhalten.
 * Die Zeilen `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log. Test: `check-streaming-luecke.ts`.
 */
import { readJson } from './lib/util.ts'
import { lueckenBilanz, streamingLuecke, type LueckenStand } from './lib/streaming-luecke.ts'
import { lueckenKlassenZeile, zaehleLueckenKlassen, type LueckenQuellen, type TitelFuerKlasse } from './lib/streaming-luecke-klassen.ts'

const kennungen = (liste: number[]): string => `${liste.slice(0, 10).join(', ')}${liste.length > 10 ? ', …' : ''}`

const titles = readJson<(Parameters<typeof streamingLuecke>[0][number] & TitelFuerKlasse)[]>('public/data/titles.json', [])
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
const quellen: LueckenQuellen = {
  jw: readJson('data/justwatch-audio.json', {}),
  tmdb: readJson('data/tmdb-titles.json', {}),
  anisearch: readJson('data/anisearch.json', {}),
  verweiseEntfernt: new Set(readJson<{ verweise: { titleId: number }[] }>('data/verweise-entfernt.json', { verweise: [] }).verweise.map((v) => v.titleId)),
  kino: new Set(readJson<{ funde: { anilistId?: number }[] }>('data/tmdb-kino.json', { funde: [] }).funde.flatMap((f) => (f.anilistId ? [f.anilistId] : []))),
}
const ohneWeg = new Set(ist.ohneStreamingWeg)
console.log(lueckenKlassenZeile(zaehleLueckenKlassen(titles.filter((t) => ohneWeg.has(t.id)), quellen)))
console.log('VERSTÖSSE: 0')
