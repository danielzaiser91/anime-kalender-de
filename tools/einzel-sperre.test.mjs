// Prüft die Sperre mit echten Prozessen: Halter läuft → zweiter bricht ab (Exit 3);
// ein Wartender gibt nach seiner Frist mit Exit 3 auf, übernimmt aber die Sperre, sobald der
// Halter hart beendet wird (Sperre bleibt liegen, Übernahme mit Meldung).
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { nurEinmalGleichzeitig, wartAufSperre } from './einzel-sperre.mjs'

const [modus, name] = process.argv.slice(2)

if (modus === 'halte') {
  nurEinmalGleichzeitig(name)
  console.log('gesperrt')
  setTimeout(() => {}, 30_000) // wird vom Test beendet
} else if (modus === 'versuche') {
  nurEinmalGleichzeitig(name)
} else if (modus === 'warte-kurz') {
  await wartAufSperre(name, 1_000, 200)
} else if (modus === 'warte-lang') {
  await wartAufSperre(name, 20_000, 200)
} else {
  const eigener = `sperre-test-${process.pid}`
  const aufruf = (m) => spawnSync(process.execPath, [import.meta.filename, m, eigener], { encoding: 'utf8' })
  const halter = spawn(process.execPath, [import.meta.filename, 'halte', eigener], { stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((fertig) => halter.stdout.once('data', fertig))

  const zweiter = aufruf('versuche')
  assert.equal(zweiter.status, 3, 'zweiter Lauf muss mit Exit 3 abbrechen')
  assert.match(zweiter.stderr, new RegExp(`läuft schon \\(PID ${halter.pid},`))

  const kurz = aufruf('warte-kurz')
  assert.equal(kurz.status, 3, 'nach Ablauf der Frist Exit 3')
  assert.match(kurz.stdout, /warte bis zu \d+ min/, 'das Warten wird gemeldet')
  assert.match(kurz.stderr, /Warten aufgegeben/)

  const wartender = spawn(process.execPath, [import.meta.filename, 'warte-lang', eigener], { stdio: ['ignore', 'pipe', 'pipe'] })
  let gemeldet = ''
  wartender.stderr.on('data', (d) => (gemeldet += d))
  await new Promise((fertig) => wartender.stdout.once('data', fertig)) // wartet jetzt
  halter.kill('SIGKILL') // hart: kein exit-Handler, die Sperre bleibt liegen
  await new Promise((fertig) => halter.once('exit', fertig))
  const wartEnde = await new Promise((fertig) => wartender.once('exit', fertig))
  assert.equal(wartEnde, 0, 'der Wartende muss die verwaiste Sperre übernehmen')
  assert.match(gemeldet, /verwaiste Sperre .*tot\) übernommen/)

  const vierter = aufruf('versuche')
  assert.equal(vierter.status, 0, 'nach regulärem Ende ist die Sperre frei')
  assert.equal(vierter.stderr, '', 'und es gibt keine Meldung mehr')
  console.log('einzel-sperre: ok')
}
