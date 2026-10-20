import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TSX = createRequire(join(REPO, 'package.json')).resolve('tsx/cli')

/** Fährt eine Prüfung als eigenen Prozess gegen eine Wegwerf-Kulisse (`AK_ROOT`) mit genau den übergebenen Dateien; die Kulisse liegt unter dem Temp-Ordner, nie im Repo. */
export function laufeInKulisse(skript: string, dateien: Record<string, string>): { code: number; aus: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'kulisse-lauf-'))
  try {
    for (const [pfad, inhalt] of Object.entries(dateien)) {
      mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
      writeFileSync(join(kulisse, pfad), inhalt)
    }
    const r = spawnSync(process.execPath, [TSX, join(REPO, 'pipeline', skript)], { cwd: kulisse, env: { ...process.env, AK_ROOT: kulisse }, encoding: 'utf8', windowsHide: true })
    return { code: r.status ?? -1, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}
