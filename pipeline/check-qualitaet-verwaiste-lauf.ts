/**
 * Verdrahtung (16.11.2026): `check-qualitaet.ts` zählt einen Termin eines Cartoons (ID in `cartoons.json`) nicht als verwaist,
 * einen Termin mit unbekannter ID schon (Exit 1, HART-Zeile). Aufruf: `npm run check:logic`.
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

function lauf(terminIds: number[]): { status: number | null; text: string } {
  const ak = mkdtempSync(join(tmpdir(), 'qualitaet-verwaist-'))
  try {
    mkdirSync(join(ak, 'public', 'data'), { recursive: true })
    mkdirSync(join(ak, 'data'), { recursive: true })
    const d = (n: string, v: unknown): void => writeFileSync(join(ak, 'public', 'data', n), JSON.stringify(v))
    d('titles.json', [{ id: 900001, titleRomaji: 'A', format: 'TV', episodes: 12, streams: [] }])
    d('cartoons.json', [{ id: -900002, titleEn: 'C', format: 'TV' }])
    d('events.json', terminIds.map((titleId) => ({ titleId, date: '2000-01-01' })))
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-qualitaet.ts')], {
      env: { ...process.env, AK_ROOT: ak },
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
    })
    return { status: r.status, text: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(ak, { recursive: true, force: true })
  }
}

const bestand = lauf([900001, -900002])
pruefe('Termine von Titel und Cartoon: Exit 0', bestand.status === 0, bestand)
const waise = lauf([900001, -900002, -900099])
pruefe('unbekannte ID: Exit 1 mit verwaisteTermine: 1', waise.status === 1 && waise.text.includes('verwaisteTermine: 1'), waise)

if (verletzt) process.exit(1)
console.log('check-qualitaet-verwaiste-lauf: 2 Fälle grün')
