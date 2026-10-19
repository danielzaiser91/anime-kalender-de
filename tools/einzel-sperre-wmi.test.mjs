// Fehlt die WMI-Hilfsdatei (`prozess-kinder.vbs`), meldet die Kinder-Suche den Grund auf stderr, und die Sperre
// einer toten Shell wird trotzdem übernommen. Läuft gegen eine Temp-Kopie ohne .vbs, in einem Kindprozess mit eigenem TEMP.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TOT = 2_000_000_000 // keine gültige PID

const kind = (modul) => `
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { hatJungeKinder, nimmSperre } from ${JSON.stringify(modul)}
const seit = new Date(Date.now() - 60_000).toISOString()
console.log('direkt=' + hatJungeKinder(${TOT}, seit))
writeFileSync(join(tmpdir(), 'wmi-test.sperre'), JSON.stringify({ pid: ${TOT}, exe: 'node.exe', seit, kind: ${TOT} }))
console.log('sperre=' + nimmSperre('wmi-test'))
`

const wurzel = mkdtempSync(join(tmpdir(), 'wmi-warnung-'))
try {
  const kopie = join(wurzel, 'einzel-sperre.mjs')
  copyFileSync(join(import.meta.dirname, 'einzel-sperre.mjs'), kopie) // bewusst ohne prozess-kinder.vbs
  const skript = join(wurzel, 'lauf.mjs')
  writeFileSync(skript, kind(`file:///${kopie.replace(/\\/g, '/')}`))
  const temp = join(wurzel, 'temp')
  mkdirSync(temp)
  const r = spawnSync(process.execPath, [skript], {
    encoding: 'utf8',
    windowsHide: true,
    cwd: wurzel,
    env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp },
  })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^direkt=false$/m, 'Fehler zählt als nein')
  assert.match(r.stdout, /^sperre=null$/m, 'Sperre der toten Shell wird frei')
  assert.match(r.stderr, new RegExp(`Kinder-Suche \\(WMI\\) für PID ${TOT} fehlgeschlagen`), 'Warnung mit Grund')
  const gruende = r.stderr.split('\n').find((z) => z.includes('Kinder-Suche')) ?? ''
  assert.match(gruende, /: \S/, 'nach dem Doppelpunkt steht ein Grund')
  console.log('ok einzel-sperre-wmi.test.mjs (', process.platform, ')')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
