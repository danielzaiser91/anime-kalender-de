/** Tests: Mutanten ohne `tests`-Eintrag werden gemeldet (Warnung) und die Zahl je Liste darf nur sinken (tools/mutationen-ohne-tests-bekannt.json). */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ohneTestsEintrag, ratscheLuecken, testsLueckenZeilen } from './mutationsanker.mjs'
import { BEKANNT_PFAD, basisBekannt, basisImOrdner, basisZeile, bestandPruefen, git, leseVonMain, ratscheRot } from './ratsche-basis.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}
const KEIN_EREIGNIS = {}
const m = (name, extra = {}) => ({ name, datei: 'a.ts', suche: 'x', ersetze: 'y', ...extra })
const text = (l) => JSON.stringify(l)

pruefe('Mutant ohne tests: gemeldet', ohneTestsEintrag(text([m('a')])).join() === 'a')
pruefe('Mutant mit tests: nicht gemeldet', ohneTestsEintrag(text([m('a', { tests: ['npx tsx t.ts'] })])).length === 0)
pruefe('leeres tests-Feld zählt als fehlend', ohneTestsEintrag(text([m('a', { tests: [] })])).join() === 'a')
pruefe('nur der Mutant ohne tests, mit Namen', ohneTestsEintrag(text([m('a', { tests: ['t'] }), m('b'), m('c')])).join() === 'b,c')
pruefe('Kontrollmutant ohne Änderungen zählt nicht', ohneTestsEintrag(text([{ name: 'Kontrolle', aenderungen: [] }])).length === 0)
pruefe('mehrere Änderungen ohne tests: gemeldet', ohneTestsEintrag(text([{ name: 'z', aenderungen: [{ datei: 'a.ts', suche: 'x', ersetze: 'y' }] }])).join() === 'z')
pruefe('Paar-Liste und kaputtes JSON: nichts', ohneTestsEintrag(text([['a', 'b']])).length === 0 && ohneTestsEintrag('{ kaputt').length === 0)
const lies = (p) => (p === 'tools/mutationen/x.json' ? text([m('eins'), m('zwei', { tests: ['t'] })]) : null)
pruefe('Warnzeile nennt Liste und Mutantenname', testsLueckenZeilen(['tools/mutationen/x.json'], lies).join() === 'tools/mutationen/x.json: „eins“ ohne tests-Eintrag')
pruefe('fehlende Datei: keine Zeile', testsLueckenZeilen(['tools/mutationen/weg.json'], lies).length === 0)

pruefe('Ratsche: gleich = grün', ratscheLuecken({ 'a.json': 3 }, { 'a.json': 3 }).length === 0)
pruefe('Ratsche: sinkend = grün', ratscheLuecken({ 'a.json': 2 }, { 'a.json': 3 }).length === 0)
pruefe('Ratsche: genau +1 = rot', ratscheLuecken({ 'a.json': 4 }, { 'a.json': 3 }).length === 1)
pruefe('Ratsche: neue Liste mit einem Mutanten ohne tests = rot, erlaubt 0', ratscheLuecken({ 'neu.json': 1 }, { 'a.json': 3 })[0]?.includes('erlaubt 0') === true)
pruefe('Ratsche: neue Liste ohne Lücke = grün', ratscheLuecken({ 'neu.json': 0 }, {}).length === 0)

// Prozess: Warnzeile auf stderr, Exit bleibt 0 (Wegwerf-Ordner).
const wurzel = mkdtempSync(join(tmpdir(), 'mutanker-tests-'))
try {
  writeFileSync(join(wurzel, 'a.ts'), 'eins zwei\n')
  writeFileSync(join(wurzel, 'l.json'), text([{ name: 'ohneT', datei: 'a.ts', suche: 'zwei', ersetze: 'X' }]))
  const skript = fileURLToPath(new URL('./mutationsanker.mjs', import.meta.url))
  const r = spawnSync(process.execPath, [skript, 'l.json'], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  pruefe('Prozess: Exit 0 und Zeile', r.status === 0 && /Mutationsanker: 1 Listen, 1 Mutanten, 0 Anker/.test(r.stdout))
  pruefe('Prozess: Warnzeile mit Liste und Mutant auf stderr', r.stderr.includes('⚠ l.json: „ohneT“ ohne tests-Eintrag'))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// Basis main: Anheben gegenüber main rot, Senken grün, neue Liste mit Lücke rot (die eigene Datei zählt nicht als Erlaubnis).
const main3 = { 'a.json': 3 }
pruefe('Basis: Ist über main (Datei mit angehoben) = rot', ratscheRot({ 'a.json': 5 }, { 'a.json': 5 }, main3).length === 2)
pruefe('Basis: nur die Datei angehoben, Ist gleich = rot', ratscheRot({ 'a.json': 3 }, { 'a.json': 4 }, main3).length === 1)
pruefe('Basis: Senken = grün', ratscheRot({ 'a.json': 1 }, { 'a.json': 1 }, main3).length === 0)
pruefe('Basis: gleich = grün', ratscheRot({ 'a.json': 3 }, { 'a.json': 3 }, main3).length === 0)
pruefe('Basis: neue Liste mit Lücke = rot', ratscheRot({ 'neu.json': 1 }, { 'neu.json': 1 }, main3).length === 2)
pruefe('Basis: neue Liste ohne Lücke = grün', ratscheRot({ 'neu.json': 0 }, {}, main3).length === 0)
pruefe('ohne Basis: heutiger Vergleich mit der eigenen Datei', ratscheRot({ 'a.json': 5 }, { 'a.json': 4 }, null).length === 1 && ratscheRot({ 'a.json': 4 }, { 'a.json': 4 }, null).length === 0)

const mainAlt = text({ 'a.json': 7 })
pruefe('leseVonMain: Objekt', leseVonMain(() => mainAlt)?.['a.json'] === 7)
pruefe('leseVonMain: Fehler, kaputtes JSON, Liste, null = null', [() => { throw new Error('x') }, () => '{ kaputt', () => '[1]', () => 'null'].every((z) => leseVonMain(z) === null))
let geholt = 0
pruefe('basisBekannt: direkt gelesen, nicht geholt', basisBekannt(() => ({ x: 1 }), () => { geholt++ })?.x === 1 && geholt === 0)
let stand = null
pruefe('basisBekannt: erst nach dem Holen lesbar', basisBekannt(() => stand, () => { geholt++; stand = { y: 2 } })?.y === 2 && geholt === 1)
pruefe('basisBekannt: Holen scheitert = null', basisBekannt(() => null, () => { throw new Error('offline') }) === null)
let halb = null
pruefe('basisBekannt: Holen wirft nach dem Schreiben = null', basisBekannt(() => halb, () => { halb = { z: 3 }; throw new Error('abgebrochen') }) === null)
pruefe('basisBekannt: auch nach dem Holen nichts = null', basisBekannt(() => null, () => {}) === null)

// Echtes git (K20): flacher Klon ohne origin/main-Ref wie die Kette; `bestandPruefen` läuft über die echte Verdrahtung.
const gitWurzel = mkdtempSync(join(tmpdir(), 'ratsche-basis-'))
const luecken = (n) => text(Array.from({ length: n }, (_, i) => m(`m${i}`)))
const schreibeStand = (wurzel, bekanntStand, anzahl) => {
  mkdirSync(join(wurzel, 'tools', 'mutationen'), { recursive: true })
  writeFileSync(join(wurzel, BEKANNT_PFAD), text(bekanntStand))
  for (const [liste, n] of Object.entries(anzahl)) writeFileSync(join(wurzel, 'tools', 'mutationen', liste), luecken(n))
}
try {
  const quelle = join(gitWurzel, 'quelle')
  const klon = join(gitWurzel, 'klon')
  mkdirSync(quelle, { recursive: true })
  git(['init', '-q', '-b', 'main'], quelle)
  schreibeStand(quelle, { 'a.json': 3 }, { 'a.json': 3 })
  git(['add', '.'], quelle)
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x'], quelle)
  git(['clone', '-q', '--depth=1', pathToFileURL(quelle).href, klon], gitWurzel)
  git(['update-ref', '-d', 'refs/remotes/origin/main'], klon)
  // Enge Refspec wie beim Checkout der Kette: ohne ausdrückliches Ziel legt `fetch origin main` den Ref nicht an.
  git(['config', 'remote.origin.fetch', '+refs/heads/nichts:refs/remotes/origin/nichts'], klon)
  pruefe('git: ohne origin/main-Ref nichts lesbar', leseVonMain(() => git(['show', `origin/main:${BEKANNT_PFAD}`], klon)) === null)
  pruefe('git: Nachholen im flachen Klon liefert den Stand von main', basisImOrdner(klon, KEIN_EREIGNIS)?.['a.json'] === 3)
  git(['update-ref', '-d', 'refs/remotes/origin/main'], klon)
  schreibeStand(klon, { 'a.json': 5 }, { 'a.json': 5 })
  const angehoben = bestandPruefen(klon, KEIN_EREIGNIS)
  pruefe('Verdrahtung: PR hebt Datei und Liste an = rot gegen main', angehoben.rot.length === 2 && angehoben.basis?.['a.json'] === 3)
  schreibeStand(klon, { 'a.json': 2 }, { 'a.json': 2 })
  pruefe('Verdrahtung: PR senkt = grün', bestandPruefen(klon, KEIN_EREIGNIS).rot.length === 0)
  schreibeStand(klon, { 'a.json': 3 }, { 'a.json': 3, 'neu.json': 1 })
  pruefe('Verdrahtung: neue Liste mit Lücke = rot', bestandPruefen(klon, KEIN_EREIGNIS).rot.length === 1)
  git(['remote', 'remove', 'origin'], klon)
  git(['update-ref', '-d', 'refs/remotes/origin/main'], klon)
  schreibeStand(klon, { 'a.json': 5 }, { 'a.json': 5, 'neu.json': 0 })
  const ohneMain = bestandPruefen(klon, KEIN_EREIGNIS)
  pruefe('Verdrahtung: main nicht erreichbar = Vergleich mit der eigenen Datei (grün bei gleicher Zahl)', ohneMain.basis === null && ohneMain.rot.length === 0)
} finally {
  rmSync(gitWurzel, { recursive: true, force: true })
}

// PR-Ereignis: Basis ist der erste Elternteil des Merge-Commits, auch wenn origin/main inzwischen weitergezogen ist (3481: 20 gegen 0).
const merge = mkdtempSync(join(tmpdir(), 'ratsche-merge-'))
const gitT = (args, cwd) => git(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], cwd)
const festhalten = (cwd, nachricht) => {
  gitT(['add', '.'], cwd)
  gitT(['commit', '-q', '-m', nachricht], cwd)
  return git(['rev-parse', 'HEAD'], cwd).trim()
}
/** Quelle mit main A (Grenze 20) → main B (Grenze 0) und Zweig `merge` = Merge-Commit aus A und einem PR-Commit; `prStand` ist die Grenze, die der PR setzt (null: berührt sie nicht). */
const baueQuelle = (ordner, prStand) => {
  git(['init', '-q', '-b', 'main'], ordner)
  schreibeStand(ordner, { 'a.json': 20 }, { 'a.json': 20 })
  const a = festhalten(ordner, 'A')
  git(['checkout', '-q', '-b', 'pr'], ordner)
  writeFileSync(join(ordner, 'pr.txt'), 'pr\n')
  if (prStand) schreibeStand(ordner, { 'a.json': prStand }, { 'a.json': prStand })
  festhalten(ordner, 'P')
  git(['checkout', '-q', 'main'], ordner)
  schreibeStand(ordner, { 'a.json': 0 }, { 'a.json': 0 })
  festhalten(ordner, 'B')
  git(['checkout', '-q', '-b', 'merge', a], ordner)
  gitT(['merge', '-q', '--no-ff', '-m', 'M', 'pr'], ordner)
  git(['checkout', '-q', 'main'], ordner)
}
const PR_EREIGNIS = { GITHUB_EVENT_NAME: 'pull_request' }
try {
  const q1 = join(merge, 'q1')
  mkdirSync(q1)
  baueQuelle(q1, null)
  const voll = join(merge, 'voll')
  git(['clone', '-q', pathToFileURL(q1).href, voll], merge)
  git(['checkout', '-q', 'origin/merge'], voll)
  const gruen = bestandPruefen(voll, PR_EREIGNIS)
  pruefe('Merge-Basis: main schon bei B (0), Baum aus A (20): Basis ist A, grün', gruen.basis?.['a.json'] === 20 && gruen.rot.length === 0)
  const heute = bestandPruefen(voll, KEIN_EREIGNIS)
  pruefe('Merge-Basis: ohne PR-Ereignis zählt origin/main (0), derselbe Baum ist rot', heute.basis?.['a.json'] === 0 && heute.rot.length === 2)
  const flach = join(merge, 'flach')
  git(['clone', '-q', '--depth=1', '--branch', 'merge', pathToFileURL(q1).href, flach], merge)
  git(['update-ref', '-d', 'refs/remotes/origin/main'], flach)
  const flachBasis = bestandPruefen(flach, PR_EREIGNIS)
  pruefe('Merge-Basis flach: erster Elternteil wird nachgeholt, grün', flachBasis.basis?.['a.json'] === 20 && flachBasis.rot.length === 0)
  const q2 = join(merge, 'q2')
  mkdirSync(q2)
  baueQuelle(q2, 25)
  const eigen = join(merge, 'eigen')
  git(['clone', '-q', pathToFileURL(q2).href, eigen], merge)
  git(['checkout', '-q', 'origin/merge'], eigen)
  const rotPr = bestandPruefen(eigen, PR_EREIGNIS)
  pruefe('Merge-Basis: PR hebt über A (20 auf 25) selbst an = rot (Datei und Ist)', rotPr.basis?.['a.json'] === 20 && rotPr.rot.length === 2)
  const flachOhne = join(merge, 'flach-ohne')
  git(['clone', '-q', '--depth=1', '--branch', 'merge', pathToFileURL(q2).href, flachOhne], merge)
  git(['remote', 'set-url', 'origin', pathToFileURL(join(merge, 'gibt-es-nicht')).href], flachOhne)
  const ohneBasis = bestandPruefen(flachOhne, PR_EREIGNIS)
  pruefe('Merge-Basis: Elternteil flach nicht holbar = Rückfall auf eigene Datei (Basis null, Warnzeile)', ohneBasis.basis === null && basisZeile(ohneBasis.basis).startsWith('⚠ WARNUNG'))
  git(['checkout', '-q', 'origin/main'], voll)
  const kein = bestandPruefen(voll, PR_EREIGNIS)
  pruefe('PR-Ereignis ohne Merge-Commit (HEAD = origin/main, 0): kein Rückgriff auf origin/main, Basis null', kein.basis === null)
} finally {
  rmSync(merge, { recursive: true, force: true })
}

// Bestand: keine echte Liste über dem Stand von origin/main (ohne erreichbares main: über der eigenen Datei).
const wurzelRepo = fileURLToPath(new URL('../', import.meta.url))
const { eigen: bekannt, ist, basis, rot } = bestandPruefen(wurzelRepo)
console.log(basisZeile(basis))
pruefe('Warnzeile: Rückfall auf die eigene Datei beginnt mit ⚠ WARNUNG', basisZeile(null).startsWith('⚠ WARNUNG Ratsche-Basis: eigene Datei'))
pruefe('Warnzeile: erreichbares main ist keine Warnung', basisZeile({ 'a.json': 3 }) === 'Ratsche-Basis: main (erster Elternteil des Merge-Commits bzw. origin/main)')
pruefe(`Bestand: Mutanten ohne tests nur sinkend (${rot.join('; ') || 'ok'})`, rot.length === 0)
pruefe('Bestand: bekannte Liste existiert noch', Object.keys(bekannt).every((n) => n in ist))
const summe = Object.values(ist).reduce((a, b) => a + b, 0)
console.log(`Mutationsanker tests-Lücke: ${Object.keys(ist).length} Listen, ${Object.values(ist).filter(Boolean).length} mit Lücke, ${summe} Mutanten ohne tests-Eintrag`)

if (fehler.length) {
  console.error(`✗ mutationsanker-ohne-tests: ${fehler.length} Fälle rot`)
  process.exit(1)
}
console.log('✓ mutationsanker-ohne-tests: alle Fälle grün')
