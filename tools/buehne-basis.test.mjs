/**
 * Test `buehne-basis.mjs` (Basis-Messung der Bühne): Reihenfolge Archiv → Entpacken → Bau → Messung → Kopf mit `--basis`, Rückfall ohne
 * Basis bei jedem gescheiterten Schritt (mit Warnzeile), Exit-Code des Kopfs, Aufräumen ohne das echte `node_modules` anzufassen.
 * Ein Fall nutzt echtes git und tar in einem Wegwerf-Repo (Attrappen allein verdeckten Aufrufformfehler).
 * Aufruf: node tools/buehne-basis.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { BAU_PFADE, fuehreAus, lauf } from './buehne-basis.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'buehne-basis-test-'))
mkdirSync(path.join(wurzel, 'node_modules'))
writeFileSync(path.join(wurzel, 'node_modules', 'marke.txt'), 'da')

/** Attrappe: protokolliert Aufrufe als `{ art, args, env }`; `status(art)` bestimmt den Exit-Code je Schritt (Vorgabe 0). */
function attrappe(status = () => 0) {
  const aufrufe = []
  const art = (b, args) => (b === 'git' ? 'archiv' : b === 'tar' ? 'entpacken' : args[0].endsWith('vite.js') ? 'bau' : args.includes('--schreibe') ? 'messung' : 'kopf')
  const fuehre = (b, args, opt = {}) => {
    const a = art(b, args)
    aufrufe.push({ art: a, args, env: opt.env })
    return { status: status(a) }
  }
  return { aufrufe, fuehre }
}

const lege = (optionen) => {
  const aus = []
  const code = lauf({ wurzel, ausgabe: (z) => aus.push(z), ...optionen })
  return { aus, code }
}

/** Alles gut: feste Reihenfolge, die Messung schreibt dieselbe Datei, die der Kopf als Basis liest; BUEHNE_DIST nur bei der Basis-Messung. */
{
  const { aufrufe, fuehre } = attrappe()
  const { aus, code } = lege({ fuehre, ref: 'abc123' })
  assert.deepEqual(aufrufe.map((a) => a.art), ['archiv', 'entpacken', 'bau', 'messung', 'kopf'])
  assert.ok(aufrufe[0].args.includes('abc123'))
  const ziel = aufrufe[3].args[aufrufe[3].args.indexOf('--schreibe') + 1]
  assert.deepEqual(aufrufe[4].args.slice(1), ['--basis', ziel, '--nur-vorher'])
  assert.match(aufrufe[3].env.BUEHNE_DIST, /baum[\\/]buehne-dist$/)
  assert.equal(aufrufe[4].env, undefined)
  assert.equal(code, 0)
  assert.deepEqual(aus, [])
  assert.ok(existsSync(path.join(wurzel, 'node_modules', 'marke.txt')), 'echtes node_modules unberührt')
}

/** `--mockup` geht an Basis-Messung und Kopf; ohne Angabe an keinen von beiden. */
{
  const { aufrufe, fuehre } = attrappe()
  lege({ fuehre, mockup: 'tabs' })
  assert.deepEqual(aufrufe.filter((a) => a.art === 'messung' || a.art === 'kopf').map((a) => a.args.slice(-2)), [['--mockup', 'tabs'], ['--mockup', 'tabs']])
  const ohne = attrappe()
  lege({ fuehre: ohne.fuehre })
  assert.ok(ohne.aufrufe.every((a) => !a.args.includes('--mockup')))
}

/** Jeder gescheiterte Schritt: Warnzeile mit seinem Namen, Kopf ohne `--basis`, nachfolgende Schritte entfallen. */
for (const [schritt, name, folgen] of [['archiv', 'Archiv', ['archiv', 'kopf']], ['entpacken', 'Entpacken', ['archiv', 'entpacken', 'kopf']], ['bau', 'Bau', ['archiv', 'entpacken', 'bau', 'kopf']], ['messung', 'Messung', ['archiv', 'entpacken', 'bau', 'messung', 'kopf']]]) {
  const { aufrufe, fuehre } = attrappe((a) => (a === schritt ? 1 : 0))
  const { aus } = lege({ fuehre })
  assert.deepEqual(aufrufe.map((a) => a.art), folgen, schritt)
  assert.deepEqual(aufrufe.at(-1).args.slice(1), [], `${schritt}: Kopf ohne Basis`)
  assert.equal(aus.length, 1)
  assert.match(aus[0], new RegExp(`^⚠ WARNUNG Bühne-Basis HEAD\\^1 nicht messbar: ${name} \\(Exit 1\\)`))
}

/** Der Exit-Code des Kopfs gilt; ein fehlender Code (Frist/Startfehler) zählt als rot. */
assert.equal(lege({ fuehre: attrappe((a) => (a === 'kopf' ? 1 : 0)).fuehre }).code, 1)
assert.equal(lege({ fuehre: (b, args) => ({ status: b !== 'git' && b !== 'tar' && !args[0].endsWith('vite.js') && !args.includes('--schreibe') ? null : 0 }) }).code, 1)

/** Echtes git und tar: Das Archiv enthält die Bau-Dateien der Basis (nicht die des Kopfs), und der Bau-Schritt sieht sie entpackt. */
{
  const repo = mkdtempSync(path.join(tmpdir(), 'buehne-basis-repo-'))
  const git = (...a) => assert.equal(spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { windowsHide: true, timeout: 20000 }).status, 0)
  mkdirSync(path.join(repo, 'web'))
  mkdirSync(path.join(repo, 'shared'))
  mkdirSync(path.join(repo, 'public/anbieter'), { recursive: true })
  for (const d of ['web/a.txt', 'shared/b.txt', 'public/anbieter/c.svg', 'vite.buehne.config.ts', 'package.json', 'tsconfig.json']) writeFileSync(path.join(repo, d), 'basis')
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'basis')
  writeFileSync(path.join(repo, 'web/a.txt'), 'kopf')
  let gelesen
  const fuehre = (b, args, opt) => {
    if (b === 'git' || b === 'tar') return fuehreAus(b, args, { ...opt, stdio: 'ignore' })
    if (args[0].endsWith('vite.js')) gelesen = ['web/a.txt', 'shared/b.txt', 'public/anbieter/c.svg'].map((d) => existsSync(path.join(opt.cwd, d)))
    return { status: 0 }
  }
  mkdirSync(path.join(repo, 'node_modules'))
  const { code, aus } = lege({ fuehre, wurzel: repo, ref: 'HEAD' })
  assert.equal(code, 0)
  assert.deepEqual(gelesen, [true, true, true], String(aus))
  rmSync(repo, { recursive: true, force: true })
}

/** Jeder Bau-Pfad gibt es im echten Repo (der Test des Wegwerf-Repos allein ließ `public/anbieter` aus). */
for (const p of BAU_PFADE) assert.ok(existsSync(path.join(import.meta.dirname, '..', p)), p)

/** `BUEHNE_DIST` lenkt die Bühne um (echter Kindprozess); ohne die Variable bleibt es `buehne-dist/` im Repo. */
{
  const frage = (env) => spawnSync(process.execPath, ['--input-type=module', '-e', "import('./tools/buehne-seite.mjs').then((m) => console.log(m.BUEHNE))"], { cwd: path.join(import.meta.dirname, '..'), env, encoding: 'utf8', windowsHide: true, timeout: 60000 })
  const { BUEHNE_DIST: _weg, ...ohne } = process.env
  assert.equal(frage({ ...ohne, BUEHNE_DIST: wurzel }).stdout.trim(), path.resolve(wurzel))
  assert.equal(frage(ohne).stdout.trim(), path.join(import.meta.dirname, '..', 'buehne-dist'))
}

rmSync(wurzel, { recursive: true, force: true })
console.log('ok  buehne-basis: Reihenfolge Archiv/Entpacken/Bau/Messung/Kopf, 4 Rückfälle mit Warnzeile (je Schritt), --mockup, Exit-Code des Kopfs, echtes git+tar im Wegwerf-Repo, BUEHNE_DIST im Kindprozess, node_modules unberührt')
