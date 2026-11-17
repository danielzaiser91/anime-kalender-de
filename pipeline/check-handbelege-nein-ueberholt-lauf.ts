/**
 * Prozesstest zur Ausnahme „überholtes Nein“ in `check-handbelege.ts` (PR 4133, Prüfer-Befund 2): das echte Skript läuft gegen eine Kulisse (`AK_ROOT`,
 * Wegwerf-Ordner unter `os.tmpdir()`) in der Kamisama-Kiss-Lage (14713): Prime-Nein „Suche ohne Treffer“ vom 27.08. ohne Adresse, der Titel führt einen
 * Prime-Weg mit `kanal`, der Aniverse-Termin beginnt am 08.10.2026.
 * Fall 1: Termin jünger als das Nein: kein Fund (ohne die Ausnahme Exit 1, „steht aber noch im Datensatz“).
 * Fall 2: kein Termin: das Nein gilt, Exit 1. Fall 3: Nein jünger als der Termin: Exit 1. Fall 4: Termin ohne `kanal`: Exit 1.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WAECHTER = resolve(dirname(fileURLToPath(import.meta.url)), 'check-handbelege.ts')
let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} ${JSON.stringify(info)}`)
}

const ID = 900301
const titel = [{ id: ID, slug: 'nein-ueberholt-probe', format: 'TV', streams: [{ platform: 'primevideo', url: '', kanal: 'Aniverse', herkunft: 'termin' }] }]
const nein = (datum: string): string => `- anilistId: ${ID}
  title: "Nein Überholt Probe"
  platform: primevideo
  available: false
  checkedAt: '${datum}'
  note: "Suche auf Prime Video: kein einziger Treffer"
`
const termin = (kanal: boolean) => ({
  slug: `auto-${ID}-primevideo`,
  titleId: ID,
  name: 'Nein Überholt Probe',
  platform: 'primevideo',
  ...(kanal ? { kanal: 'Aniverse' } : {}),
  releaseType: 'batch',
  schedule: { firstEpisodeDate: '2026-10-08', episodeCount: 13 },
  sources: ['https://www.anime2you.de/news/1056322/aniverse-oktober-2026-neuzugaenge/'],
})

function lauf(yamlText: string, releases: unknown[]): { status: number; text: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'check-handbelege-ueberholt-'))
  try {
    for (const d of ['data/curated', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
    writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), yamlText)
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titel))
    writeFileSync(join(wurzel, 'public/data/releases.json'), JSON.stringify(releases))
    for (const d of ['cartoons', 'ohne-synchro']) writeFileSync(join(wurzel, `public/data/${d}.json`), '[]')
    try {
      const text = execFileSync(process.execPath, [WAECHTER], { cwd: wurzel, env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 120000 })
      return { status: 0, text }
    } catch (e) {
      const x = e as { status?: number; stdout?: string; stderr?: string }
      return { status: x.status ?? -1, text: `${x.stdout ?? ''}${x.stderr ?? ''}` }
    }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const ueberholt = lauf(nein('2026-08-27'), [termin(true)])
pruefe('Nein vom 27.08. vor dem Kanal-Termin vom 08.10.: kein Fund, Zähler 1', ueberholt.status === 0 && ueberholt.text.includes('Nein überholt (Kanal-Termin) : 1'), ueberholt)
const ohneTermin = lauf(nein('2026-08-27'), [])
pruefe('ohne Termin gilt das Nein: Exit 1, Weg „steht aber noch im Datensatz“', ohneTermin.status === 1 && ohneTermin.text.includes('steht aber noch im Datensatz'), ohneTermin)
const jung = lauf(nein('2026-10-20'), [termin(true)])
pruefe('Nein jünger als der Termin gilt: Exit 1', jung.status === 1 && jung.text.includes('steht aber noch im Datensatz'), jung)
const ohneKanal = lauf(nein('2026-08-27'), [termin(false)])
pruefe('Termin ohne Kanal überholt das Nein nicht: Exit 1', ohneKanal.status === 1 && ohneKanal.text.includes('steht aber noch im Datensatz'), ohneKanal)

if (fehler) {
  console.error(`FEHL check-handbelege-nein-ueberholt-lauf: ${fehler}`)
  process.exit(1)
}
console.log('check-handbelege-nein-ueberholt-lauf: check-handbelege lässt ein Nein durch, das ein jüngerer Prime-Kanal-Termin überholt, und nur dieses.')
