/**
 * Verdrahtung des Mängel-Registers in `check-qualitaet.ts` (Prüfer-Auflage N1, 16.11.2026): Der Lauf gegen eine Kulisse (`AK_ROOT`) mit `data/maengel.json`
 * druckt die Warnzeilen `MAENGEL_NEU …` / `MAENGEL_RUECKFALL …` / `MAENGEL_VORFASSUNG …` und trägt die offenen Mängel je Art in die Tageszeile des Verlaufs ein.
 * Ohne Register keine Zeile und kein Feld `maengel`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAENGEL_DATEI, type Register } from './lib/maengel-register.ts'
import { VERLAUF_DATEI } from './lib/streaming-rueckgang.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const zaehler = (offen: number, neu = 0, rueckfall = 0) => ({ wirkung: 2, wer: 'daniel', offen, neu, behoben: 0, rueckfall, ausnahme: 0 })
const zeile = (t: number, art: string, ereignis?: 'neu' | 'rueckfall') => ({ t, art, wirkung: 2, wer: 'daniel', status: 'offen' as const, seit: '2026-11-16', ...(ereignis ? { ereignis } : {}) })
const VERLAUF = [{ gemessenAm: '2000-01-01', mitStreamingWeg: 1 }]
const TITEL = [{ id: 900001, titleRomaji: 'A', format: 'TV', episodes: 12, streams: [{ platform: 'netflix', url: 'https://x.invalid/1', dub: true }] }]

function lauf(register: Register | null): { ausgabe: string; letzterVerlauf: Record<string, unknown> } {
  const ak = mkdtempSync(join(tmpdir(), 'qualitaet-maengel-'))
  try {
    mkdirSync(join(ak, 'public', 'data'), { recursive: true })
    mkdirSync(join(ak, 'data'), { recursive: true })
    writeFileSync(join(ak, 'public', 'data', 'titles.json'), JSON.stringify(TITEL))
    writeFileSync(join(ak, 'public', 'data', 'events.json'), '[]')
    writeFileSync(join(ak, 'public', 'data', 'releases.json'), '[]')
    writeFileSync(join(ak, VERLAUF_DATEI), JSON.stringify(VERLAUF))
    if (register) writeFileSync(join(ak, MAENGEL_DATEI), JSON.stringify(register))
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-qualitaet.ts')], { env: { ...process.env, AK_ROOT: ak }, encoding: 'utf8', timeout: 60000, windowsHide: true })
    if (r.status !== 0) throw new Error(`Exit ${r.status}: ${r.stderr}`)
    const verlauf = JSON.parse(readFileSync(join(ak, VERLAUF_DATEI), 'utf8')) as Record<string, unknown>[]
    return { ausgabe: `${r.stdout}${r.stderr}`, letzterVerlauf: verlauf.at(-1)! }
  } finally {
    rmSync(ak, { recursive: true, force: true })
  }
}

const mitNeu: Register = {
  stand: '2026-11-16',
  zaehler: { fsk: zaehler(2, 1), 'kein-weg': zaehler(1, 0, 1), banner: zaehler(0) },
  zeilen: [zeile(7, 'fsk', 'neu'), zeile(8, 'fsk'), zeile(495, 'kein-weg', 'rueckfall')],
}
const a = lauf(mitNeu)
pruefe('NEU: Zeile mit Art, Zahl und Beispiel in der Ausgabe', a.ausgabe.split('\n').includes('MAENGEL_NEU fsk: 1 (7)'), a.ausgabe)
pruefe('RÜCKFALL: Zeile mit Art, Zahl und Beispiel in der Ausgabe', a.ausgabe.split('\n').includes('MAENGEL_RUECKFALL kein-weg: 1 (495)'), a.ausgabe)
pruefe('Verlauf: offene Mängel je Art in der Tageszeile', JSON.stringify(a.letzterVerlauf.maengel) === '{"fsk":2,"kein-weg":1,"banner":0}', a.letzterVerlauf)

const b = lauf({ ...mitNeu, zeilen: mitNeu.zeilen.map(({ ereignis: _e, ...z }) => z) })
pruefe('ohne Ereignis keine Mängel-Zeile', !b.ausgabe.includes('MAENGEL_'), b.ausgabe)

const c = lauf({ ...mitNeu, hinweis: 'Vorfassung von data/maengel.json nicht lesbar' })
pruefe('Hinweis des Baus kommt als MAENGEL_VORFASSUNG-Zeile', c.ausgabe.split('\n').includes('MAENGEL_VORFASSUNG Vorfassung von data/maengel.json nicht lesbar'), c.ausgabe)

const d = lauf(null)
pruefe('ohne Register: keine Mängel-Zeile, kein Feld `maengel` im Verlauf', !d.ausgabe.includes('MAENGEL_') && !('maengel' in d.letzterVerlauf), d.letzterVerlauf)

if (verletzt) process.exit(1)
console.log('check-qualitaet-maengel-lauf: 6 Fälle grün')
