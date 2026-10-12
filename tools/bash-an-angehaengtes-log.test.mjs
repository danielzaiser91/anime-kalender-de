/**
 * Die Bash-Hüllen unserer Tests müssen auch laufen, wenn ihre Ausgabe in ein Log mit Anhängemodus geht (`prozess-register.mjs`
 * öffnet das Log mit `'a'`). Ein geerbtes Anhänge-Handle kann die MSYS-Laufzeit von bash.exe nicht beschreiben: Exit 1 ohne
 * ein Zeichen Ausgabe (12.10.2026, `bau-schon-gebaut.test.mjs` nur im losgelösten `check:vor-commit` rot).
 */
import { spawnSync } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const huellen = ['bau-schon-gebaut.test.mjs', 'commit-data.test.mjs']
const ordner = mkdtempSync(join(tmpdir(), 'bash-log-'))
let fehler = 0
for (const huelle of huellen) {
  const fd = openSync(join(ordner, 'log.txt'), 'a')
  const lauf = spawnSync(process.execPath, [join(tools, huelle)], { stdio: ['ignore', fd, fd] })
  closeSync(fd)
  const ok = lauf.status === 0
  console.log(`${ok ? '✓' : '✗'} ${huelle} mit Anhänge-Log: Exit ${lauf.status}`)
  if (!ok) fehler++
}
rmSync(ordner, { recursive: true, force: true })
process.exit(fehler ? 1 : 0)
