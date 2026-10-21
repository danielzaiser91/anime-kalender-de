// Prüft die Sperre mit echten Prozessen: Halter läuft → zweiter bricht ab (Exit 3);
// ein Wartender gibt nach seiner Frist mit Exit 3 auf, übernimmt aber die Sperre, sobald der
// Halter hart beendet wird (Sperre bleibt liegen, Übernahme mit Meldung).
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { lebt, nimmSperre, nurEinmalGleichzeitig } from './einzel-sperre.mjs'
import { wartAufSperre } from './einzel-sperre-schlange.mjs'

const [modus, name, wer] = process.argv.slice(2)

if (modus === 'halte') {
  nurEinmalGleichzeitig(name, wer)
  console.log('gesperrt')
  setTimeout(() => {}, 30_000) // wird vom Test beendet
} else if (modus === 'versuche') {
  nurEinmalGleichzeitig(name)
} else if (modus === 'warte-kurz') {
  // Frist großzügig: unter Last braucht schon der erste Durchlauf (tasklist je Ticket) über 1 s, dann gäbe der Wartende vor der ersten Meldung auf.
  await wartAufSperre(name, 8_000, 200)
} else if (modus === 'warte-lang') {
  await wartAufSperre(name, 20_000, 200)
} else {
  const eigener = `sperre-test-${process.pid}`
  const aufruf = (m, n = eigener) => spawnSync(process.execPath, [import.meta.filename, m, n], { encoding: 'utf8' })
  const wer = 'bau-vergleich 1234abcd5678 gegen 9876fedc5432 in C:/code/baum'
  const halter = spawn(process.execPath, [import.meta.filename, 'halte', eigener, wer], { stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((fertig) => halter.stdout.once('data', fertig))

  const zweiter = aufruf('versuche')
  assert.equal(zweiter.status, 3, 'zweiter Lauf muss mit Exit 3 abbrechen')
  assert.match(zweiter.stderr, new RegExp(`läuft schon \\(PID ${halter.pid},`))

  assert.ok(zweiter.stderr.includes(wer), 'die Absage nennt, was der Halter ausführt')
  assert.match(zweiter.stderr, /seit \d{4}-\d\d-\d\dT[^,]+, vor \d+ min/, 'und seit wann (Zeitpunkt und Alter)')

  const kurz = aufruf('warte-kurz')
  assert.equal(kurz.status, 3, 'nach Ablauf der Frist Exit 3')
  assert.match(kurz.stdout, /warte bis zu \d+ min/, 'das Warten wird gemeldet')
  assert.match(kurz.stderr, /Warten aufgegeben/)
  assert.ok(kurz.stdout.includes(wer), 'schon die erste Wartemeldung nennt den Halter (nicht erst nach einer Minute)')

  const wartender = spawn(process.execPath, [import.meta.filename, 'warte-lang', eigener], { stdio: ['ignore', 'pipe', 'pipe'] })
  let gemeldet = ''
  wartender.stderr.on('data', (d) => (gemeldet += d))
  await new Promise((fertig) => wartender.stdout.once('data', fertig)) // wartet jetzt
  halter.kill('SIGKILL') // hart: kein exit-Handler, die Sperre bleibt liegen
  await new Promise((fertig) => halter.once('exit', fertig))
  const wartEnde = await new Promise((fertig) => wartender.once('exit', fertig))
  assert.equal(wartEnde, 0, 'der Wartende muss die verwaiste Sperre übernehmen')
  assert.match(gemeldet, /verwaiste Sperre .*tot\) übernommen/)

  // Ohne Angabe beschreibt die Sperre den Aufruf selbst (Skript, Argumente, Ort); das Alter wird aus `seit` gerechnet.
  const stdName = `${eigener}-std`
  const stdHalter = spawn(process.execPath, [import.meta.filename, 'halte', stdName], { stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((fertig) => stdHalter.stdout.once('data', fertig))
  assert.match(aufruf('versuche', stdName).stderr, /einzel-sperre\.test\.mjs halte sperre-test-\d+-std in /, 'Vorgabe: Skript, Argumente, Ort')
  stdHalter.kill('SIGKILL')
  await new Promise((fertig) => stdHalter.once('exit', fertig))
  rmSync(join(tmpdir(), `${stdName}.sperre`), { force: true })
  const altName = `${eigener}-alt`
  const altDatei = join(tmpdir(), `${altName}.sperre`)
  writeFileSync(altDatei, JSON.stringify({ pid: process.pid, seit: new Date(Date.now() - 12 * 60_000).toISOString(), wer: 'x' }))
  try {
    assert.match(nimmSperre(altName), /vor 12 min, x\)/, 'Alter der Sperre in Minuten')
  } finally {
    rmSync(altDatei, { force: true })
  }

  // Wiederverwendete PID: lebt, gehört aber einem anderen Programm → verwaist. Fehlendes Feld `exe` = alte Prüfung (nur PID).
  const meinName = basename(process.execPath).toLowerCase()
  assert.equal(lebt(process.pid, meinName), true, 'echter Name des eigenen Prozesses stimmt')
  assert.equal(lebt(process.pid, 'explorer.exe'), false, 'echter Namensabgleich: PID gehört einem anderen Programm')
  assert.equal(lebt(process.pid), true, 'ältere Sperre ohne exe: nur PID zählt')
  assert.equal(lebt(process.pid, 'x.exe', () => null), true, 'Name nicht ermittelbar: im Zweifel lebt der Halter')
  const fremdName = `${eigener}-fremd`
  const fremdDatei = join(tmpdir(), `${fremdName}.sperre`)
  writeFileSync(fremdDatei, JSON.stringify({ pid: process.pid, exe: 'explorer.exe', seit: new Date().toISOString(), wer: 'x' }))
  try {
    assert.equal(nimmSperre(fremdName), null, 'Sperre mit fremdem Programm unter lebender PID wird übernommen')
    assert.equal(JSON.parse(readFileSync(fremdDatei, 'utf8')).exe, meinName, 'neue Sperre vermerkt das eigene Programm')
  } finally {
    rmSync(fremdDatei, { force: true })
  }

  const vierter = aufruf('versuche')
  assert.equal(vierter.status, 0, 'nach regulärem Ende ist die Sperre frei')
  assert.equal(vierter.stderr, '', 'und es gibt keine Meldung mehr')
  console.log('einzel-sperre: ok')
}
