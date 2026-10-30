/**
 * Ersatz-`gh` für Prozess-Tests der Wachphase: `legeGhAttrappe(dir, { befehl, antwortDatei })` legt eine ausführbare Datei `gh`
 * ins Verzeichnis (Windows: `gh.exe`, denn `execFileSync('gh')` findet dort kein `gh.cmd`). Sie antwortet auf genau `befehl`
 * mit dem Inhalt von `antwortDatei`, auf alles andere mit Exit 1; ohne `befehl` hängt sie (für Zeitlimit-Tests).
 * Rückgabe: Umgebung (PATH, unter Windows NODE_OPTIONS) zum Mischen in `env` des Prüflings.
 */
import { chmodSync, copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TRENNER = process.platform === 'win32' ? ';' : ':'

// Unter Windows ist die Attrappe eine Kopie von node.exe; der Vorlader greift nur dort (execPath-Name), nie im Prüfling selbst.
const VORLADER = (befehl, antwortDatei) => `
const { basename } = require('node:path')
if (basename(process.execPath).toLowerCase() === 'gh.exe') {
  const args = [basename(process.argv[1]), ...process.argv.slice(2)].join(' ')
  const befehl = ${JSON.stringify(befehl ?? null)}
  if (befehl === null) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600000)
  if (args === befehl) { process.stdout.write(require('node:fs').readFileSync(${JSON.stringify(antwortDatei ?? '')}, 'utf8')); process.exit(0) }
  process.stderr.write('falsche Parameter: ' + args + '\\n')
  process.exit(1)
}
`

export function legeGhAttrappe(dir, { befehl, antwortDatei } = {}) {
  const env = { PATH: `${dir}${TRENNER}${process.env.PATH}` }
  if (process.platform === 'win32') {
    copyFileSync(process.execPath, join(dir, 'gh.exe'))
    const vorlader = join(dir, 'gh-vorlader.cjs')
    writeFileSync(vorlader, VORLADER(befehl, antwortDatei))
    return { ...env, NODE_OPTIONS: `--require=${vorlader.replace(/\\/g, '/')}` }
  }
  const sh = befehl === undefined
    ? '#!/bin/sh\nsleep 600\n'
    : `#!/bin/sh\ncase "$*" in "${befehl}") cat "${antwortDatei}" ;; *) echo "falsche Parameter: $*" >&2; exit 1 ;; esac\n`
  writeFileSync(join(dir, 'gh'), sh)
  chmodSync(join(dir, 'gh'), 0o755)
  return env
}
