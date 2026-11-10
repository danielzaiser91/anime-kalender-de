// Test für snapshot-path-reparatur.js: node .claude/hooks/snapshot-path-reparatur-test.mjs
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'
import { spawnSync } from 'child_process'

const require = createRequire(import.meta.url)
const hook = require('./snapshot-path-reparatur.js')
const bash = 'C:\\Program Files\\Git\\bin\\bash.exe'

const SCHLECHT = "# Snapshot\nexport FOO='x'\nexport PATH='C:\\Program Files\\Git\\cmd;C:\\Program Files\\nodejs\\;C:\\Program Files\\GitHub CLI'\nalias ll='ls'\n"
const GUT = "# Snapshot\nexport PATH='/usr/bin:/mingw64/bin:/c/Program Files/nodejs'\n"

let fehler = 0
const ok = (name, bedingung) => {
  console.log((bedingung ? 'OK   ' : 'FEHL ') + name)
  if (!bedingung) fehler++
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-test-'))
const schlecht = path.join(dir, 'snapshot-bash-1-aaa.sh')
const gut = path.join(dir, 'snapshot-bash-2-bbb.sh')
const fremd = path.join(dir, 'andere.sh')
fs.writeFileSync(schlecht, SCHLECHT)
fs.writeFileSync(gut, GUT)
fs.writeFileSync(fremd, SCHLECHT)

ok('Nicht-Bash wird ignoriert', hook.pruefe({ tool_name: 'Edit' }, dir) === null && fs.readFileSync(schlecht, 'utf8') === SCHLECHT)
ok('pruefe liefert null', hook.pruefe({ tool_name: 'Bash' }, dir) === null)
const nach = fs.readFileSync(schlecht, 'utf8')
ok('schlechter Snapshot ist POSIX', nach.includes("export PATH='/usr/bin:/mingw64/bin:/c/Program Files/Git/cmd:/c/Program Files/nodejs:/c/Program Files/GitHub CLI'"))
ok('übrige Zeilen unberührt', nach.includes("export FOO='x'") && nach.includes("alias ll='ls'"))
ok('guter Snapshot unverändert', fs.readFileSync(gut, 'utf8') === GUT)
ok('fremde Datei unverändert', fs.readFileSync(fremd, 'utf8') === SCHLECHT)
hook.pruefe({ tool_name: 'Bash' }, dir)
ok('idempotent', fs.readFileSync(schlecht, 'utf8') === nach)
ok('fehlendes Verzeichnis wirft nicht', hook.pruefe({ tool_name: 'Bash' }, path.join(dir, 'gibt-es-nicht')) === null)

// Ende-zu-Ende: Kopie eines echten schlechten Snapshots (falls noch einer vorhanden ist)
const echt = path.join(os.homedir(), '.claude', 'shell-snapshots')
const quelle = (fs.existsSync(echt) ? fs.readdirSync(echt) : [])
  .map((n) => path.join(echt, n))
  .find((p) => /^export PATH='[A-Za-z]:\\/m.test(fs.readFileSync(p, 'utf8')))
if (quelle) {
  const kopie = path.join(dir, 'snapshot-bash-3-ccc.sh')
  fs.copyFileSync(quelle, kopie)
  fs.utimesSync(kopie, new Date(), new Date())
  hook.pruefe({ tool_name: 'Bash' }, dir)
  const r = spawnSync(bash, ['-c', `source "${kopie.replace(/\\/g, '/')}" 2>/dev/null || true; which git node gh head`], {
    encoding: 'utf8', env: { SystemRoot: 'C:\\WINDOWS', HOME: os.homedir(), PATH: 'C:\\Windows\\system32' },
  })
  const gefunden = r.stdout.trim().split('\n').filter(Boolean)
  ok(`Ende-zu-Ende: which findet git node gh head (${gefunden.length}/4)`, gefunden.length === 4)
} else {
  console.log('SKIP Ende-zu-Ende: kein schlechter Snapshot mehr auf der Platte')
}

fs.rmSync(dir, { recursive: true, force: true })
process.exit(fehler ? 1 : 0)
