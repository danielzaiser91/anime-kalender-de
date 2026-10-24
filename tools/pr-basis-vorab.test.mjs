/**
 * Test zu `vorladeBasis` im Läufer `check-logic-alle.mjs` (Lauf als eigener Prozess in einem flachen Wegwerf-Klon):
 * Im PR-Ereignis ist die Basis geladen, bevor die ersten Prüfungen starten (sonst streiten parallele Abrufe um `shallow.lock`);
 * ohne Ereignis, bei linearem Kopf und bei Abruffehler bleibt der Läufer stumm und grün.
 * Aufruf: `node tools/pr-basis-vorab.test.mjs [Wurzelordner]` (Wegwerf-Ordner unter dem Wurzelordner, Standard `os.tmpdir()`)
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const WURZEL = process.argv[2] ?? tmpdir()
const REPO = resolve(import.meta.dirname, '..')
const KOPIEN = ['check-logic-alle.mjs', 'arbeiterpool.mjs', 'bau-umgebung.mjs', 'liste-pruefen.mjs', 'sperre-umgebung.mjs', 'check-logic-vollstaendig.mjs', 'bestand-sperre.cjs', 'git-stand-wache.mjs', 'pr-basis.mjs', 'check-logic-historie.mjs']

const gitIn = (ordner) => (...args) =>
  execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: ordner, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** Prüfung, die erwartet, dass die Basis (erster Elternteil von HEAD) im Klon `da` oder `fehlt`. */
function waechter(erwartet) {
  return [
    "import { execFileSync } from 'node:child_process'",
    "const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })",
    "const basis = git('cat-file', '-p', 'HEAD').split('\\n').find((z) => z.startsWith('parent ')).slice(7)",
    'let da = true',
    "try { git('cat-file', '-e', `${basis}^{commit}`) } catch { da = false }",
    `if ((da ? 'da' : 'fehlt') !== '${erwartet}') { console.error('Basis ist ' + (da ? 'da' : 'fehlt') + ', erwartet ${erwartet}'); process.exit(1) }`,
    '',
  ].join('\n')
}

/** Ursprung mit Läufer-Kopien und Wächtern; `linear`: HEAD ohne Merge. Gibt den Ursprungsordner zurück. */
function baueUrsprung(erwartet, linear) {
  const ordner = mkdtempSync(join(WURZEL, 'basis-vorab-ursprung-'))
  const git = gitIn(ordner)
  git('init', '-q', '-b', 'main')
  mkdirSync(join(ordner, 'tools'))
  for (const k of KOPIEN) copyFileSync(join(REPO, 'tools', k), join(ordner, 'tools', k))
  copyFileSync(join(REPO, 'package.json'), join(ordner, 'package.json'))
  writeFileSync(join(ordner, '.gitignore'), 'node_modules\n')
  writeFileSync(join(ordner, 'w1.mjs'), waechter(erwartet))
  writeFileSync(join(ordner, 'w2.mjs'), waechter(erwartet))
  writeFileSync(join(ordner, 'liste.txt'), 'w1.mjs\nw2.mjs\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'basis')
  git('checkout', '-q', '-b', 'pr')
  writeFileSync(join(ordner, 'pr.txt'), 'pr')
  git('add', '-A')
  git('commit', '-q', '-m', 'pr')
  git('checkout', '-q', 'main')
  writeFileSync(join(ordner, 'main.txt'), 'main')
  git('add', '-A')
  git('commit', '-q', '-m', 'main weiter')
  if (linear) git('checkout', '-q', 'pr')
  else git('merge', '-q', '--no-ff', '-m', 'Merge pr into main', 'pr')
  git('config', 'uploadpack.allowAnySHA1InWant', 'true')
  return ordner
}

/** Flacher Klon (Tiefe 1) des Ursprungs; `ursprungKaputt` biegt `origin` auf einen Pfad, den es nicht gibt. */
function klone(ursprung, ursprungKaputt) {
  const klon = mkdtempSync(join(WURZEL, 'basis-vorab-klon-'))
  execFileSync('git', ['clone', '-q', '--depth=1', pathToFileURL(ursprung).href, klon], { windowsHide: true })
  symlinkSync(join(REPO, 'node_modules'), join(klon, 'node_modules'), 'junction')
  if (ursprungKaputt) gitIn(klon)('remote', 'set-url', 'origin', pathToFileURL(join(klon, 'gibt-es-nicht')).href)
  return klon
}

function lauf(klon, ereignis) {
  const env = { ...process.env }
  delete env.CI
  delete env.GITHUB_EVENT_NAME
  if (ereignis) env.GITHUB_EVENT_NAME = ereignis
  const r = spawnSync(process.execPath, [join(klon, 'tools/check-logic-alle.mjs'), 'liste.txt', 'wegwerf'], { cwd: klon, encoding: 'utf8', env, windowsHide: true })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}

function fall(titel, { erwartet, linear = false, ereignis, ursprungKaputt = false, zweimal = false }, pruefe) {
  const ursprung = baueUrsprung(erwartet, linear)
  const klon = klone(ursprung, ursprungKaputt)
  try {
    let ergebnis = lauf(klon, ereignis)
    if (zweimal) ergebnis = lauf(klon, ereignis)
    pruefe(ergebnis)
  } catch (fehler) {
    fehler.message = `${titel}: ${fehler.message}`
    throw fehler
  } finally {
    rmSync(klon, { recursive: true, force: true })
    rmSync(ursprung, { recursive: true, force: true })
  }
}

const GELADEN = /PR-Basis [0-9a-f]{7} vor den parallelen Prüfungen geladen/

fall('PR-Ereignis: Basis vor den Prüfungen da', { erwartet: 'da', ereignis: 'pull_request' }, (r) => {
  assert.equal(r.status, 0, r.text)
  assert.match(r.text, GELADEN)
})

fall('PR-Ereignis, zweiter Lauf im selben Klon', { erwartet: 'da', ereignis: 'pull_request', zweimal: true }, (r) => {
  assert.equal(r.status, 0, r.text)
  assert.match(r.text, GELADEN)
})

// Seit PR 1433 holt der Läufer die ganze Historie eines flachen Klons (check-logic-historie.mjs): die Basis liegt dann ohnehin da.
// Dass vorladeBasis selbst nichts lädt, belegt die fehlende Zeile „PR-Basis … geladen“.
fall('ohne Ereignis wird nichts geladen', { erwartet: 'da' }, (r) => {
  assert.equal(r.status, 0, r.text)
  assert.doesNotMatch(r.text, GELADEN)
})

fall('Ereignis push: nichts geladen', { erwartet: 'da', ereignis: 'push' }, (r) => {
  assert.equal(r.status, 0, r.text)
  assert.doesNotMatch(r.text, GELADEN)
})

fall('linearer Kopf: still, Läufer grün', { erwartet: 'da', linear: true, ereignis: 'pull_request' }, (r) => {
  assert.equal(r.status, 0, r.text)
  assert.doesNotMatch(r.text, GELADEN)
})

fall('Abruffehler: der Läufer bricht nicht ab, die Prüfung sieht die fehlende Basis selbst', { erwartet: 'fehlt', ereignis: 'pull_request', ursprungKaputt: true }, (r) => {
  assert.equal(r.status, 0, r.text)
  assert.doesNotMatch(r.text, GELADEN)
})

console.log('  ✓ Basis vorab: im PR-Ereignis vor den parallelen Prüfungen geladen; ohne Ereignis, linear und bei Abruffehler stumm')
