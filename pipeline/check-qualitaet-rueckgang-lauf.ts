/**
 * Verdrahtung (15.11.2026): `check-qualitaet.ts` läuft als Prozess gegen eine Kulisse (`AK_ROOT`) und warnt, wenn die Titel mit
 * Streaming-Weg gegenüber dem letzten Verlaufswert um mehr als 1 % sinken; ohne Rückgang bleibt die Warnung aus.
 * Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const stream = { name: 'Amazon', url: 'https://www.amazon.de/gp/video/detail/B0KULISSE1', kind: 'stream' }
/* Zwei Titel mit Streaming-Weg: einmal über streams, einmal über watchLinks. */
const titel = [
  { id: 900001, titleRomaji: 'A', format: 'TV', episodes: 12, streams: [{ platform: 'netflix', url: 'https://x.invalid/1', dub: true }] },
  { id: 900002, titleRomaji: 'B', format: 'TV', episodes: 12, streams: [], watchLinks: [stream] },
]

function lauf(vorherWert: number): string {
  const ak = mkdtempSync(join(tmpdir(), 'qualitaet-rueckgang-'))
  try {
    mkdirSync(join(ak, 'public/data'), { recursive: true })
    mkdirSync(join(ak, 'data'), { recursive: true })
    writeFileSync(join(ak, 'public/data/titles.json'), JSON.stringify(titel))
    writeFileSync(join(ak, 'public/data/events.json'), '[]')
    writeFileSync(join(ak, 'data/qualitaet-verlauf.json'), JSON.stringify([{ gemessenAm: '2000-01-01', mitStreamingWeg: vorherWert }]))
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-qualitaet.ts')], {
      env: { ...process.env, AK_ROOT: ak },
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
    })
    if (r.status !== 0) throw new Error(`Exit ${r.status}: ${r.stderr}`)
    return `${r.stdout}${r.stderr}`
  } finally {
    rmSync(ak, { recursive: true, force: true })
  }
}

const mit = lauf(3)
pruefe('Rückgang 3 → 2 warnt im Lauf', /mitStreamingWeg: 3 → 2/.test(mit), mit)
const ohne = lauf(2)
pruefe('gleicher Wert warnt im Lauf nicht', !/mitStreamingWeg: \d/.test(ohne), ohne)

if (verletzt) process.exit(1)
console.log('check-qualitaet-rueckgang-lauf: 2 Fälle grün')
