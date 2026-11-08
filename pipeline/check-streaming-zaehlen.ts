/**
 * Streaming-Weg zählen (06.11.2026): `check-qualitaet.ts` führt `mitStreamingWeg`, `tools/datenqualitaet-messen.mjs` zählt
 * einen `watchLinks`-Eintrag mit `kind: 'stream'` nicht mehr als Kauf-/Disc-Weg. Beide laufen als Prozess gegen einen Wegwerf-Bestand.
 *
 * Aufruf: `npx tsx pipeline/check-streaming-zaehlen.ts`
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const strom = { platform: 'netflix', url: 'https://www.netflix.com/title/1' }
const kauf = { name: 'Amazon', url: 'https://www.amazon.de/dp/B1', kind: 'buy' }
const sicht = { name: 'Anbieter', url: 'https://example.org/a', kind: 'stream' }
/* Verschiedene Mengen: 1 mit streams, 2 nur watchLink-Stream, 3 nur Kauf, 1 ohne alles, 1 mit streams und Kauf. */
const titel = [
  { id: 1, streams: [strom], watchLinks: [] },
  { id: 2, streams: [], watchLinks: [sicht] },
  { id: 3, streams: [], watchLinks: [kauf] },
  { id: 4, streams: [] },
  { id: 5, streams: [strom], watchLinks: [kauf] },
  { id: 6, streams: [], watchLinks: [sicht, sicht] },
  { id: 7, streams: [], watchLinks: [kauf, sicht] },
].map((t) => ({ titleEn: `T${t.id}`, keywords: [], genres: [], ...t }))

const wurzel = mkdtempSync(join(tmpdir(), 'streaming-zaehlen-'))
const daten = join(wurzel, 'public', 'data')
mkdirSync(daten, { recursive: true })
mkdirSync(join(wurzel, 'data'), { recursive: true })
writeFileSync(join(daten, 'titles.json'), JSON.stringify(titel))
writeFileSync(join(daten, 'events.json'), '[]')
for (const n of ['ohne-synchro', 'cartoons', 'releases', 'franchises']) writeFileSync(join(daten, `${n}.json`), '[]')

console.log('\ncheck-qualitaet: mitStreamingWeg')
const q = spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/check-qualitaet.ts'], { encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, AK_ROOT: wurzel } })
pruefe('check-qualitaet lief (Exit 0)', q.status === 0, { status: q.status, err: q.stderr.slice(-300) })
const verlaufDatei = readdirSync(join(wurzel, 'data')).find((n) => n.endsWith('-verlauf.json')) ?? ''
const verlauf = JSON.parse(readFileSync(join(wurzel, 'data', verlaufDatei), 'utf8')) as { mitStreamingWeg: number; mitVerweis: number }[]
const letzte = verlauf[verlauf.length - 1]
pruefe('mitStreamingWeg zählt streams und watchLinks-Stream (Titel 1, 2, 5, 6, 7 = 5)', letzte?.mitStreamingWeg === 5, letzte)
pruefe('mitVerweis bleibt bei streams allein (Titel 1, 5 = 2)', letzte?.mitVerweis === 2, letzte)
pruefe('Logzeile nennt mitStreamingWeg', /5 mit Streaming-Weg/.test(q.stdout + q.stderr), q.stdout.slice(-300))

console.log('\ndatenqualitaet-messen: Kauf-/Disc-Weg ohne Stream')
const m = spawnSync(process.execPath, ['tools/datenqualitaet-messen.mjs', `--daten=${daten}`, '--nur-json', '--herkunft=aus'], { encoding: 'utf8', windowsHide: true, timeout: 120000 })
pruefe('datenqualitaet-messen lief (Exit 0)', m.status === 0, { status: m.status, err: m.stderr.slice(-300) })
const zeile = m.stdout.split('\n').find((z) => z.startsWith('JSON '))
const k = zeile ? (JSON.parse(zeile.slice(5)) as { kennzahlen?: Record<string, number> } & Record<string, number>) : undefined
const zahl = (k?.kennzahlen ?? k)?.['hauptOhneStreamMitDisc']
pruefe('nur Titel 3 ist „nur Kauf-/Disc-Weg“ (Stream-Links zählen nicht)', zahl === 1, { zahl, zeile: zeile?.slice(0, 200) })

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
