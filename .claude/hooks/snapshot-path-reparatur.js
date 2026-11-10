// Repariert Shell-Snapshots, deren PATH-Zeile im rohen Windows-Format steht (`export PATH='C:\a;C:\b'`).
// Bash trennt an ':', dann fehlen git/gh/node/head in jedem Bash-Aufruf der Sitzung (Ursache 10.10.2026,
// Bericht daniel-zum-abarbeiten/berichte/bash-path.md). Wird vom Dispatcher bei Bash-Aufrufen gerufen.
// Idempotent, still bei jedem Fehler, nie blockierend.
const fs = require('fs')
const os = require('os')
const path = require('path')

const SNAPSHOT_DIR = path.join(os.homedir(), '.claude', 'shell-snapshots')
const MAX_DATEIEN = 5
const MAX_ALTER_MS = 24 * 3600 * 1000
const WINDOWS_PATH_ZEILE = /^export PATH='([A-Za-z]:\\[^']*)'$/m

function nachPosix(windowsPath) {
  const teile = windowsPath
    .split(';')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase()).replace(/\/$/, ''))
  return ['/usr/bin', '/mingw64/bin', ...teile].join(':')
}

// Gibt true zurück, wenn die Datei umgeschrieben wurde.
function repariereDatei(datei) {
  const text = fs.readFileSync(datei, 'utf8')
  const treffer = text.match(WINDOWS_PATH_ZEILE)
  if (!treffer) return false
  fs.writeFileSync(datei, text.replace(treffer[0], () => `export PATH='${nachPosix(treffer[1])}'`))
  return true
}

function juengsteSnapshots(dir, jetzt) {
  return fs.readdirSync(dir)
    .filter((n) => /^snapshot-bash-.*\.sh$/.test(n))
    .map((n) => ({ datei: path.join(dir, n), mtime: fs.statSync(path.join(dir, n)).mtimeMs }))
    .filter((e) => jetzt - e.mtime < MAX_ALTER_MS)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, MAX_DATEIEN)
    .map((e) => e.datei)
}

// Eintrittspunkt für den Dispatcher: nur bei Bash, nie werfen.
function pruefe(input, dir = SNAPSHOT_DIR) {
  try {
    if (input && input.tool_name && input.tool_name !== 'Bash') return null
    for (const datei of juengsteSnapshots(dir, Date.now())) {
      try { repariereDatei(datei) } catch (_) { /* nächste Datei */ }
    }
  } catch (_) { /* Hook darf nie blockieren */ }
  return null
}

module.exports = { pruefe, repariereDatei, nachPosix }
