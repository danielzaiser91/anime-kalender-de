import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Fährt ein Bestandsprüf-Skript als eigenen Prozess gegen eine Kulisse (`AK_ROOT`, Wegwerf-Ordner unter `os.tmpdir()`); `dateien` = Pfad im Repo → Inhalt. */
export function laufeGegenKulisse(skript: string, dateien: Record<string, string>): { code: number | null; aus: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'ak-bestand-'))
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
    writeFileSync(join(kulisse, pfad), inhalt)
  }
  const tsx = createRequire(join(WURZEL, 'package.json')).resolve('tsx/cli')
  const r = spawnSync(process.execPath, [tsx, join(WURZEL, 'pipeline', skript)], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    env: { ...process.env, AK_ROOT: kulisse },
  })
  return { code: r.status, aus: `${r.stdout}${r.stderr}` }
}
