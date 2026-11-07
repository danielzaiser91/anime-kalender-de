/**
 * Ratsche „Haupttitel ohne Streaming-Weg“: Rechenregel (`streamingLuecke`, `lueckenBilanz`) und der Bestandswächter als eigener Prozess gegen einen
 * Wegwerf-Ordner (`AK_ROOT`): Zeile, Exit 0 und die Fälle neu / bekannt / erledigt / Stand fehlt. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StreamLink, WatchLink } from '../shared/types.ts'
import { lueckenBilanz, streamingLuecke, type LueckenStand } from './lib/streaming-luecke.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const stream = { platform: 'netflix', url: 'https://www.netflix.com/title/1' } as StreamLink
const disc = { name: 'aniSearch', url: 'https://www.anisearch.de/article/1,x', kind: 'buy', zugang: 'kauf' } as WatchLink
const bezug = { name: 'Netflix', url: 'https://www.netflix.com/title/2', kind: 'stream', zugang: 'abo' } as WatchLink
/* 900401 nichts, 900402 nur Disc-Link, 900403 nichts aber eine Ausgabe, 900404 Stream, 900405 Bezugsweg der Art stream. */
const titel = [
  { id: 900401, streams: [], watchLinks: [] },
  { id: 900402, streams: [], watchLinks: [disc] },
  { id: 900403, streams: [], watchLinks: [] },
  { id: 900404, streams: [stream], watchLinks: [] },
  { id: 900405, streams: [], watchLinks: [bezug] },
]

console.log('\nRechenregel:')
const ist = streamingLuecke(titel, new Set([900403]))
pruefe('ohne Streaming-Weg: Titel ohne alles, mit Disc-Link, mit Ausgabe', ist.ohneStreamingWeg.join() === '900401,900402,900403', ist.ohneStreamingWeg)
pruefe('ohne jeden Weg: nur der Titel ohne Link und ohne Ausgabe', ist.ohneJedenWeg.join() === '900401', ist.ohneJedenWeg)
pruefe('Stream und Bezugsweg der Art stream zählen als Weg', !ist.ohneStreamingWeg.includes(900404) && !ist.ohneStreamingWeg.includes(900405), ist)

const stand = (jeden: number[], streaming: number[]): LueckenStand => ({ stand: '2026-11-06', ohneJedenWeg: jeden, ohneStreamingWeg: streaming })
const gleich = lueckenBilanz(ist, stand([900401], [900401, 900402, 900403]))
pruefe('gleicher Stand: nichts neu, nichts erledigt', !gleich.neuOhneJedenWeg.length && !gleich.neuOhneStreamingWeg.length && gleich.erledigt === 0, gleich)
const neu = lueckenBilanz(ist, stand([], [900401, 900403]))
pruefe('eine Kennung außerhalb des Standes ist neu, je Liste getrennt', neu.neuOhneJedenWeg.join() === '900401' && neu.neuOhneStreamingWeg.join() === '900402', neu)
const erledigt = lueckenBilanz(ist, stand([900401, 900404], [900401, 900402, 900403, 900405, 900999]))
pruefe('Kennungen mit Weg zählen als erledigt (je Liste, genau 3)', erledigt.erledigt === 3 && !erledigt.neuOhneJedenWeg.length, erledigt)
const tausch = lueckenBilanz(streamingLuecke([{ id: 900402, streams: [], watchLinks: [disc] }], new Set()), stand([900402], [900402]))
pruefe('ein Disc-Link nimmt den Titel aus „ohne jeden Weg“, nicht aus „ohne Streaming-Weg“', tausch.erledigt === 1 && !tausch.neuOhneStreamingWeg.length, tausch)

console.log('\nBestandswächter als Prozess:')
const wurzel = mkdtempSync(join(tmpdir(), 'streaming-luecke-'))
try {
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titel))
  writeFileSync(join(wurzel, 'public', 'data', 'releases.json'), JSON.stringify([{ titleId: 900403 }]))
  const lauf = (): { status: number | null; aus: string } => {
    const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./check-streaming-luecke-bestand.ts', import.meta.url))], {
      cwd: wurzel,
      env: { ...process.env, AK_ROOT: wurzel },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
    })
    return { status: r.status, aus: r.stdout + r.stderr }
  }
  const ohne = lauf()
  pruefe('ohne Stand: Exit 0, Schlusszeile, Warnung nennt beide neuen Listen', ohne.status === 0 && /VERSTÖSSE: 0/.test(ohne.aus) && /WARNUNG Streaming-Lücke: 3 Titel ohne Streaming-Weg/.test(ohne.aus) && /WARNUNG Streaming-Lücke: 1 Titel ohne jeden Weg/.test(ohne.aus), ohne)
  writeFileSync(join(wurzel, 'data', 'streaming-luecke-stand.json'), JSON.stringify(stand([900401], [900401, 900402, 900403])))
  const bekannt = lauf()
  pruefe('mit passendem Stand: Exit 0, Zählzeile, keine Warnung', bekannt.status === 0 && /ohne Streaming-Weg: 3, ohne jeden Weg: 1/.test(bekannt.aus) && !/WARNUNG/.test(bekannt.aus), bekannt)
  const viele = Array.from({ length: 10 }, (_, i) => 900500 + i)
  writeFileSync(join(wurzel, 'data', 'streaming-luecke-stand.json'), JSON.stringify(stand([900401], [900401, 900402, 900403, ...viele])))
  const kuerzen = lauf()
  pruefe('zehn erledigte Kennungen: Hinweis zum Kürzen, bei neun nicht', /10 Kennungen/.test(kuerzen.aus), kuerzen)
  writeFileSync(join(wurzel, 'data', 'streaming-luecke-stand.json'), JSON.stringify(stand([900401], [900401, 900402, 900403, ...viele.slice(1)])))
  pruefe('neun erledigte Kennungen: kein Hinweis', !/Kennungen in data/.test(lauf().aus))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nStreaming-Lücke: ${faelle} Zusicherungen grün (Rechenregel, Wächter-Prozess, Ratsche über Kennungen).`)
