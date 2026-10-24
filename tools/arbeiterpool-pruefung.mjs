/**
 * Prüfung von `tools/arbeiterpool.mjs` und `tools/git-stand-wache.mjs` (läuft in `check:workflows` vor `tests-alle`).
 * Bewusst keine `*.test.mjs`: `tests-alle` startete sie sonst selbst über den Pool, den sie prüfen soll.
 * Aufruf: `node tools/arbeiterpool-pruefung.mjs`
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { laufePool, letzteZeilen } from './arbeiterpool.mjs'
import { gitStand, veraenderte } from './git-stand-wache.mjs'

const knoten = (code) => ({ befehl: process.execPath, args: ['-e', code], env: process.env })
const schreibe = (text, kanal = 'stdout') => `process.${kanal}.write(${JSON.stringify(text)})`
const warte = (ms) => `setTimeout(() => {}, ${ms})`

/** Läuft den Pool und fängt dessen Ausgabe ab: [Ergebnis, Zeilen in Ausgabereihenfolge]. */
async function fange(auftraege, optionen) {
  const zeilen = []
  const stdout = process.stdout.write
  const stderr = process.stderr.write
  process.stdout.write = (d) => zeilen.push(String(d)) > 0
  process.stderr.write = (d) => zeilen.push(String(d)) > 0
  try {
    const ergebnis = await laufePool(auftraege, { meldung: (i) => zeilen.push(`#${i}|`), ...optionen })
    return [ergebnis, zeilen.join('')]
  } finally {
    process.stdout.write = stdout
    process.stderr.write = stderr
  }
}

/** Acht Aufträge, spätere fertig früher; Auftrag 5 rot mit Exit 3. */
const acht = (rotNr = 5) =>
  Array.from({ length: 8 }, (_, i) =>
    knoten(`setTimeout(() => { ${schreibe(`aus${i};`)}; process.exitCode = ${i === rotNr ? 3 : 0} }, ${(8 - i) * 40})`),
  )

{
  const [e, text] = await fange(acht(), { alle: true, n: 3 })
  assert.equal(e.gelaufen, 8, 'alle acht Aufträge sind gelaufen')
  assert.deepEqual(e.rote, [{ index: 5, status: 3, ende: ['aus5;'] }], 'Auftrag 5 ist rot, mit seinem Exit-Code')
  const erwartet = Array.from({ length: 8 }, (_, i) => `#${i}|aus${i};`).join('')
  assert.equal(text, erwartet, 'Ausgabe je Auftrag steht in Auftragsreihenfolge, auch die des roten')
  console.log('  ✓ alle laufen, Ausgabe in Reihenfolge, roter Auftrag mit Exit-Code')
}
{
  let aktiv = 0
  let spitze = 0
  const zaehle = (a) => ({
    ...a,
    vorher: () => spitze = Math.max(spitze, ++aktiv),
    nachher: () => {
      aktiv--
      return null
    },
  })
  await fange(acht(-1).map(zaehle), { alle: true, n: 3 })
  assert.equal(spitze, 3, 'genau N Aufträge gleichzeitig, nicht mehr und nicht weniger')
  console.log('  ✓ Parallelität erreicht N und überschreitet es nicht')
}
{
  const [e] = await fange(acht(1), { alle: false, n: 1 })
  assert.equal(e.gelaufen, 2, 'ohne --alle startet nach dem ersten roten Auftrag keiner mehr')
  assert.deepEqual(e.rote, [{ index: 1, status: 3, ende: ['aus1;'] }])
  console.log('  ✓ ohne --alle: nach dem ersten roten kein weiterer Start')
}
{
  const [e, text] = await fange(acht(3), { alle: false, n: 1, anfang: [3] })
  assert.equal(e.gelaufen, 1, 'ein vorgezogener roter Auftrag stoppt die übrigen')
  assert.equal(text, '#3|aus3;', 'seine Ausgabe geht nicht verloren, obwohl davor nichts lief')
  console.log('  ✓ vorgezogener roter Auftrag: Ausgabe bleibt erhalten')
}
{
  const zehn = Array.from({ length: 10 }, (_, i) => [i % 2 ? 2 : 1, `z${i}

`])
  assert.deepEqual(letzteZeilen(zehn), ['z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8', 'z9'], 'acht letzte nicht leere Zeilen, beide Kanäle in Reihenfolge')
  assert.deepEqual(letzteZeilen(zehn, 1), ['z9'], 'genau eine Zeile bei n = 1')
  assert.deepEqual(letzteZeilen([]), [], 'ohne Ausgabe keine Zeilen')
  console.log('  ✓ letzteZeilen: Kürzung, Kanäle, leer')
}
if (process.platform === 'win32') {
  console.log('  übersprungen: Signal-Fall (Windows kennt keine Signale als Beendigungsgrund)')
} else {
  const [e, text] = await fange([knoten(`${schreibe('vorher\n')}; process.kill(process.pid, 'SIGKILL')`)], { alle: true })
  assert.deepEqual(e.rote, [{ index: 0, status: 1, ende: ['vorher', 'Prozess durch Signal SIGKILL beendet (kein Exit-Code).'] }])
  assert.match(text, /SIGKILL/)
  console.log('  ✓ Signal-Tod nennt das Signal in der Ausgabe')
}
{
  const a = knoten(schreibe('ok'))
  a.nachher = () => 'Nachprüfung rot'
  const [e, text] = await fange([a], { alle: true })
  assert.deepEqual(e.rote, [{ index: 0, status: 1, ende: ['okNachprüfung rot'] }], 'ein Fehltext von nachher macht den Auftrag rot')
  assert.match(text, /Nachprüfung rot/)
  console.log('  ✓ nachher() kann einen grünen Auftrag rot machen')
}
{
  const a = knoten(`${warte(150)}; ${schreibe('spaet')}`)
  const [e, text] = await fange([a], { alle: true })
  assert.equal(e.gelaufen, 1, 'der Pool wartet auf den letzten Auftrag')
  assert.match(text, /spaet/)
  console.log('  ✓ Pool kehrt erst nach dem letzten Auftrag zurück')
}

/** Kleines Git-Repo mit einer getrackten Datei. */
function repo() {
  const ordner = mkdtempSync(join(tmpdir(), 'git-wache-'))
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: ordner, stdio: 'ignore' })
  writeFileSync(join(ordner, 'x.txt'), 'eins\n')
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'a')
  return ordner
}
{
  const ordner = repo()
  const vorher = gitStand(ordner)
  assert.deepEqual(veraenderte(vorher, gitStand(ordner)), [], 'ohne Änderung nichts gemeldet')
  const schreibt = knoten(`require('node:fs').writeFileSync('x.txt', 'zwei\\n')`)
  schreibt.cwd = ordner
  const [e, text] = await fange([schreibt], { alle: true, wurzel: ordner })
  assert.deepEqual(e.veraendert, ['x.txt'], 'eine Prüfung, die eine getrackte Datei schreibt, wird gemeldet')
  assert.match(text, /x\.txt/)
  const nochmal = knoten(`require('node:fs').writeFileSync('x.txt', 'drei\\n')`)
  nochmal.cwd = ordner
  const [e3] = await fange([nochmal], { alle: true, wurzel: ordner })
  assert.deepEqual(e3.veraendert, ['x.txt'], 'auch eine schon geänderte Datei wird gemeldet, wenn der Lauf ihren Inhalt ändert')
  const neuAnlegen = knoten(`require('node:fs').writeFileSync('neu.txt', 'neu\\n')`)
  neuAnlegen.cwd = ordner
  const [e4] = await fange([neuAnlegen], { alle: true, wurzel: ordner })
  assert.deepEqual(e4.veraendert, ['neu.txt'], 'eine neu angelegte, ungetrackte Datei wird gemeldet')
  await new Promise((r) => setTimeout(r, 50))
  const neuAendern = knoten(`require('node:fs').writeFileSync('neu.txt', 'abc\\n')`)
  neuAendern.cwd = ordner
  const [e5] = await fange([neuAendern], { alle: true, wurzel: ordner })
  assert.deepEqual(e5.veraendert, ['neu.txt'], 'eine geänderte ungetrackte Datei wird gemeldet')
  const neuLoeschen = knoten(`require('node:fs').rmSync('neu.txt')`)
  neuLoeschen.cwd = ordner
  const [e6] = await fange([neuLoeschen], { alle: true, wurzel: ordner })
  assert.deepEqual(e6.veraendert, ['neu.txt'], 'eine gelöschte ungetrackte Datei wird gemeldet')
  const still = knoten(schreibe('still'))
  still.cwd = ordner
  const [e2] = await fange([still], { alle: true, wurzel: ordner })
  assert.deepEqual(e2.veraendert, [], 'eine schon vorher geänderte Datei bleibt ohne Meldung, wenn der Lauf sie nicht anfasst')
  const vertieft = knoten(`require('node:child_process').execFileSync('git', ['config', 'core.abbrev', '12'])`)
  vertieft.cwd = ordner
  const [e7] = await fange([vertieft], { alle: true, wurzel: ordner })
  assert.deepEqual(e7.veraendert, [], 'längere Hash-Abkürzung (flacher Klon vertieft) ändert keinen Dateistand')
  assert.deepEqual(veraenderte(gitStand(tmpdir()), gitStand(tmpdir())), [], 'kein Git-Arbeitsbaum: keine Meldung')
  console.log('  ✓ Wächter meldet geschriebene getrackte Dateien, sonst nichts')
}
console.log('arbeiterpool-pruefung: grün')
