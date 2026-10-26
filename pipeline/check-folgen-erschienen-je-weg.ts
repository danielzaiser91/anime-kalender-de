/**
 * Ein Weg ohne Bereiche deckt nur die Folgen, die sein Wochenplan schon ausgespielt hat (26.10.2026, Beyblade X: Panel
 * „128 von 128“, belegt 122 bei RTL+). Fälle: der echte Beyblade-X-Plan wörtlich, Komplettdrop, Plan ohne Folgenzahl,
 * Weg mit Bereichen, anderer Anbieter, Plan vor dem Start, mehrere Pläne eines Anbieters; dazu der Bau-Ablauf in einer
 * Kulisse (`AK_ROOT`), der die Pläne wirklich an `deutscheFolgen` durchreicht. Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { deutscheFolgen } from './bau/folgen-dateien.ts'
import { hoechsteFolgeJeAnbieter } from './bau/folgen-erschienen-je-weg.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${ist === undefined ? '' : ` — gefunden: ${JSON.stringify(ist)}`}`)
}

const text = (b: [number, number][]) => b.map(([a, c]) => `${a}-${c}`).join(',')
const titel = (streams: StreamLink[], extra: Partial<Title> = {}) => ({ id: 900001, jpYear: 2026, streams, ...extra }) as unknown as Title
const rtl: StreamLink = { platform: 'rtlplus', url: 'https://plus.rtl.de/beyblade-x-p_9519', dub: true, zugang: 'abo' }
const weg = (releases: Release[], heute: string) => hoechsteFolgeJeAnbieter(releases, heute)

// Wörtlich aus public/data/releases.json (Stand 26.10.2026), ohne Quellen: Folge 102 fehlt in `observed`, Folge 122 am 23.10.
const observed: Record<string, string> = {}
const tage = ['06-05', '06-12', '06-19', '06-26', '07-03', '07-10', '07-17', '07-24', '07-31', '08-07', '08-14', '08-21', '08-28', '09-04', '09-11', '09-18', '09-25', '10-02', '10-09', '10-16', '10-23']
const nummern = [101, ...Array.from({ length: 20 }, (_, i) => 103 + i)]
for (const [i, nr] of nummern.entries()) observed[String(nr)] = `2026-${tage[i]}`
const beyblade = {
  slug: 'auto-165159-rtlplus-staffel-3',
  titleId: 165159,
  name: 'Beyblade X Staffel 3',
  platform: 'rtlplus',
  releaseType: 'weekly',
  schedule: { firstEpisodeDate: '2026-06-05', firstEpisodeNumber: 101, episodeCount: 22, observed },
} as unknown as Release
const wochen = (platform: string, von: string, anzahl: number, extra: Record<string, unknown> = {}) =>
  ({ slug: `t-${platform}-${von}`, titleId: 900001, name: 'T', platform, releaseType: 'weekly', schedule: { firstEpisodeDate: von, episodeCount: anzahl, ...extra } }) as unknown as Release

console.log('\nDeutsche Folgen: Weg ohne Bereiche folgt dem Wochenplan')
const beyblade2 = weg([beyblade], '2026-10-26')
pruefe('Beyblade X: Plan liefert 122', beyblade2.get('rtlplus') === 122, [...beyblade2])
pruefe('Beyblade X: 128 japanische Folgen, deutsch 1-122', text(deutscheFolgen(titel([rtl]), undefined, '2026-10-26', 128, beyblade2)) === '1-122')
pruefe('Beyblade X: ohne Plan wie bisher 1-128', text(deutscheFolgen(titel([rtl]), undefined, '2026-10-26', 128)) === '1-128')
pruefe('Beyblade X am Vortag von Folge 122: 121', weg([beyblade], '2026-10-22').get('rtlplus') === 121)
pruefe('Beyblade X am Tag von Folge 122: 122', weg([beyblade], '2026-10-23').get('rtlplus') === 122)
pruefe('Plan über der japanischen Zählung: Obergrenze bleibt die japanische (nicht über 100)', text(deutscheFolgen(titel([rtl]), undefined, '2026-10-26', 100, beyblade2)) === '1-100')

const drop = { slug: 'drop', titleId: 900001, name: 'T', platform: 'netflix', releaseType: 'batch', schedule: { firstEpisodeDate: '2026-08-06', episodeCount: 12 } } as unknown as Release
const netflix: StreamLink = { platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true, zugang: 'abo' }
pruefe('Komplettdrop (batch, keine Folgennummern): voll', text(deutscheFolgen(titel([netflix]), undefined, '2026-10-26', 12, weg([drop], '2026-10-26'))) === '1-12')
const start = { slug: 'start', titleId: 213805, name: 'The Ramparts of Ice: Staffel 2', platform: 'netflix', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-01', estimated: true } } as unknown as Release
pruefe('Nur Starttermin ohne Folgenzahl (213805, wörtlich): kein Plan, voll', text(deutscheFolgen(titel([netflix]), undefined, '2026-10-26', 12, weg([start], '2026-10-26'))) === '1-12')
pruefe('Wochenplan eines anderen Anbieters begrenzt den Weg nicht', text(deutscheFolgen(titel([netflix]), undefined, '2026-10-26', 12, weg([wochen('crunchyroll', '2026-10-04', 12)], '2026-10-26'))) === '1-12')
const mitBereich: StreamLink = { ...netflix, dubRanges: [{ from: 1, to: 8, dub: true }] }
pruefe('Weg mit Bereichen bleibt, wie belegt', text(deutscheFolgen(titel([mitBereich]), undefined, '2026-10-26', 12, weg([wochen('netflix', '2026-10-04', 12)], '2026-10-26'))) === '1-8')
pruefe('Plan vor dem Start: nichts erschienen, nichts deutsch', text(deutscheFolgen(titel([netflix]), undefined, '2026-10-26', 12, weg([wochen('netflix', '2026-11-04', 12)], '2026-10-26'))) === '')
pruefe('Blue Box S2: vier Wochen Netflix, deutsch 1-4 von 12', text(deutscheFolgen(titel([netflix]), undefined, '2026-10-26', 12, weg([wochen('netflix', '2026-10-04', 12)], '2026-10-26'))) === '1-4')
pruefe('Genau eine erschienene Folge: 1-1', text(deutscheFolgen(titel([netflix]), undefined, '2026-10-26', 12, weg([wochen('netflix', '2026-10-25', 12)], '2026-10-26'))) === '1-1')
pruefe('Zwei Pläne eines Anbieters: der höhere zählt', weg([wochen('netflix', '2026-01-04', 3), wochen('netflix', '2026-10-04', 12)], '2026-10-26').get('netflix') === 4)
pruefe('Zwei Pläne, der ältere höher: der höhere zählt', weg([wochen('netflix', '2026-01-04', 12), wochen('netflix', '2026-10-18', 12)], '2026-10-26').get('netflix') === 12)
pruefe('Zwei Anbieter im selben Titel: Komplettdrop deckt voll, Plan nur sein Stück', text(deutscheFolgen(titel([netflix, rtl]), undefined, '2026-10-26', 12, weg([wochen('rtlplus', '2026-10-04', 12)], '2026-10-26'))) === '1-12')
pruefe('Kein nicht-TV-Plan, nur Disc: nichts', weg([{ ...drop, releaseType: 'disc' } as Release], '2026-10-26').size === 0)

console.log('\nDeutsche Folgen: der Bau reicht die Pläne durch (Kulisse)')
/** Startet den Lauf in der Kulisse (`AK_ROOT`) und liest die `de`-Zeile; ein Fehlschlag des Kindprozesses ist ein Fehler des Falls. */
function lauf(wurzel: string, art: 'mit' | 'ohne'): string {
  const wurzelRepo = join(import.meta.dirname, '..')
  const tsx = createRequire(join(wurzelRepo, 'package.json')).resolve('tsx/cli')
  const r = spawnSync(process.execPath, [tsx, join(wurzelRepo, 'pipeline/lib/kulisse-folgen-erschienen.ts'), art], {
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  return r.status === 0 ? r.stdout.trim().split('\n').pop()! : `Exit ${r.status}: ${r.stderr.slice(-300)}`
}

function kulisse(): void {
  const wurzel = mkdtempSync(join(tmpdir(), 'folgen-erschienen-'))
  try {
    for (const d of ['data', 'data/cache', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
    const folgen = Array.from({ length: 40 }, (_, i) => ({ nr: i + 1, de: `Folge ${i + 1}`, datum: '2020-01-01' }))
    writeFileSync(join(wurzel, 'data/anisearch-folgen.json'), JSON.stringify({ 777: { folgen } }))
    writeFileSync(join(wurzel, 'data/anisearch.json'), JSON.stringify({ 900001: { anisearchId: 777 } }))
    writeFileSync(join(wurzel, 'data/folgen-hinweise.yaml'), '[]\n')
    /* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
    writeFileSync(join(wurzel, 'data/kino-ankuendigungen.yaml'), '[]\n')
    const mit = lauf(wurzel, 'mit')
    pruefe('Bau: 40 Folgen, 20 ausgespielte Wochen — deutsch 1-20', mit === '[[1,20]]', mit)
    const ohne = lauf(wurzel, 'ohne')
    pruefe('Bau: ohne Plan unverändert 1-40', ohne === '[[1,40]]', ohne)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

kulisse()
console.log(`check-folgen-erschienen-je-weg: ${fehler ? `${fehler} Fehler` : 'ok'}`)
process.exit(fehler ? 1 : 0)
