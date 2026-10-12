// Prüft die Sperre mit echten Prozessen: Halter läuft → zweiter bricht ab (Exit 3);
// Halter hart beendet (Sperre bleibt liegen) → nächster übernimmt sie mit Meldung.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { nurEinmalGleichzeitig } from './einzel-sperre.mjs'

const [modus, name] = process.argv.slice(2)

if (modus === 'halte') {
  nurEinmalGleichzeitig(name)
  console.log('gesperrt')
  setTimeout(() => {}, 30_000) // wird vom Test beendet
} else if (modus === 'versuche') {
  nurEinmalGleichzeitig(name)
} else {
  const eigener = `sperre-test-${process.pid}`
  const aufruf = (m) => spawnSync(process.execPath, [import.meta.filename, m, eigener], { encoding: 'utf8' })
  const halter = spawn(process.execPath, [import.meta.filename, 'halte', eigener], { stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((fertig) => halter.stdout.once('data', fertig))

  const zweiter = aufruf('versuche')
  assert.equal(zweiter.status, 3, 'zweiter Lauf muss mit Exit 3 abbrechen')
  assert.match(zweiter.stderr, new RegExp(`läuft schon \\(PID ${halter.pid},`))

  halter.kill('SIGKILL') // hart: kein exit-Handler, die Sperre bleibt liegen
  await new Promise((fertig) => halter.once('exit', fertig))
  const dritter = aufruf('versuche')
  assert.equal(dritter.status, 0, 'verwaiste Sperre muss übernommen werden')
  assert.match(dritter.stderr, /verwaiste Sperre .*tot\) übernommen/)

  const vierter = aufruf('versuche')
  assert.equal(vierter.status, 0, 'nach regulärem Ende ist die Sperre frei')
  assert.equal(vierter.stderr, '', 'und es gibt keine Meldung mehr')
  console.log('einzel-sperre: ok')
}
