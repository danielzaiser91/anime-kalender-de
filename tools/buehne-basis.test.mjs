/**
 * Test `buehne-basis.mjs` (Basis-Messung der Bühne): Reihenfolge Archiv → Entpacken → Bühne-Vergleich → Bau → Messung → Kopf mit
 * `--basis`, Warnung (Log, `::warning::`, Zusammenfassung) und grüner Ausgang bei jedem gescheiterten Schritt, Zeitbudget mit
 * Attrappe-Uhr, `web/buehne` vom Kopf über der Basis, Exit-Code des Kopfs, Aufräumen ohne das echte `node_modules` anzufassen.
 * Ein Fall nutzt echtes git und tar in einem Wegwerf-Repo (Attrappen allein verdeckten Aufrufformfehler).
 * Aufruf: node tools/buehne-basis.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { BAU_PFADE, fuehreAus, lauf } from './buehne-basis.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'buehne-basis-test-'))
mkdirSync(path.join(wurzel, 'node_modules'))
writeFileSync(path.join(wurzel, 'node_modules', 'marke.txt'), 'da')

/**
 * Attrappe: protokolliert Aufrufe als `{ art, args, env, timeout }`; `status(art)` bestimmt den Exit-Code je Schritt (Vorgabe 0),
 * `dauer[art]` (ms) schiebt die Attrappe-Uhr `uhr()` vor.
 */
function attrappe(status = () => 0, dauer = {}) {
  const aufrufe = []
  const zeit = { ms: 0 }
  const art = (b, args) => {
    if (b === 'git') return args.includes('diff') ? 'diff' : args.some((a) => a.endsWith('kopf-buehne.tar')) ? 'archiv-kopf' : 'archiv'
    if (b === 'tar') return args[1].includes('kopf-buehne') ? 'entpacken-kopf' : 'entpacken'
    return args[0].endsWith('vite.js') ? 'bau' : args.includes('--schreibe') ? 'messung' : 'kopf'
  }
  const fuehre = (b, args, opt = {}) => {
    const a = art(b, args)
    aufrufe.push({ art: a, args, env: opt.env, timeout: opt.timeout })
    zeit.ms += dauer[a] ?? 0
    return { status: status(a) }
  }
  return { aufrufe, fuehre, uhr: () => zeit.ms }
}

const lege = (optionen) => {
  const aus = []
  const summe = path.join(wurzel, `summe-${aus.length}-${Math.random().toString(36).slice(2)}.md`)
  const code = lauf({ wurzel, ausgabe: (z) => aus.push(z), zusammenfassung: summe, ...optionen })
  return { aus, code, summe: existsSync(summe) ? readFileSync(summe, 'utf8') : '' }
}
const arten = (a) => a.aufrufe.map((x) => x.art)

/** Alles gut: feste Reihenfolge, die Messung schreibt dieselbe Datei, die der Kopf als Basis liest; BUEHNE_DIST nur bei der Basis-Messung; Fristen. */
{
  const a = attrappe(() => 0, { bau: 1000 })
  const { aus, code, summe } = lege({ fuehre: a.fuehre, uhr: a.uhr, ref: 'abc123' })
  assert.deepEqual(arten(a), ['archiv', 'entpacken', 'diff', 'bau', 'messung', 'kopf'])
  assert.ok(a.aufrufe[0].args.includes('abc123'))
  assert.ok(a.aufrufe[2].args.includes('abc123') && a.aufrufe[2].args.includes('HEAD'))
  const [bau, messung, kopf] = a.aufrufe.slice(3)
  const ziel = messung.args[messung.args.indexOf('--schreibe') + 1]
  assert.deepEqual(kopf.args.slice(1), ['--basis', ziel, '--nur-vorher'])
  assert.match(messung.env.BUEHNE_DIST, /baum[\\/]buehne-dist$/)
  assert.equal(kopf.env, undefined)
  assert.equal(bau.timeout, 600000)
  assert.equal(messung.timeout, 599000, 'Messung bekommt den Rest des Basis-Budgets')
  assert.equal(kopf.timeout, 600000)
  assert.equal(code, 0)
  assert.deepEqual(aus, [])
  assert.equal(summe, '')
  assert.ok(existsSync(path.join(wurzel, 'node_modules', 'marke.txt')), 'echtes node_modules unberührt')
}

/** `--mockup` geht an Basis-Messung und Kopf; ohne Angabe an keinen von beiden. */
{
  const a = attrappe()
  lege({ fuehre: a.fuehre, uhr: a.uhr, mockup: 'tabs' })
  assert.deepEqual(a.aufrufe.filter((x) => x.art === 'messung' || x.art === 'kopf').map((x) => x.args.slice(-2)), [['--mockup', 'tabs'], ['--mockup', 'tabs']])
  const ohne = attrappe()
  lege({ fuehre: ohne.fuehre, uhr: ohne.uhr })
  assert.ok(ohne.aufrufe.every((x) => !x.args.includes('--mockup')))
}

/** Jeder gescheiterte Schritt: Warnung dreifach (Log, `::warning::`, Zusammenfassung), kein Kopf-Lauf, Exit 0, nachfolgende Schritte entfallen. */
for (const [schritt, wert, name, folgen] of [
  ['archiv', 1, 'Archiv \\(Exit 1\\)', ['archiv']],
  ['entpacken', 1, 'Entpacken \\(Exit 1\\)', ['archiv', 'entpacken']],
  ['diff', 2, 'Bühne des Kopfs \\(Exit 2\\)', ['archiv', 'entpacken', 'diff']],
  ['bau', 1, 'Bau \\(Exit 1\\)', ['archiv', 'entpacken', 'diff', 'bau']],
  ['messung', 1, 'Messung \\(Exit 1\\)', ['archiv', 'entpacken', 'diff', 'bau', 'messung']],
]) {
  const a = attrappe((x) => (x === schritt ? wert : 0))
  const { aus, code, summe } = lege({ fuehre: a.fuehre, uhr: a.uhr })
  assert.deepEqual(arten(a), folgen, schritt)
  assert.equal(code, 0, schritt)
  assert.equal(aus.length, 2, schritt)
  assert.match(aus[0], new RegExp(`^⚠ WARNUNG Bühne-Basis HEAD\\^1 nicht messbar: ${name}`))
  assert.match(aus[1], /^::warning title=Bühne-Basis::HEAD\^1 nicht messbar: /)
  assert.match(summe, /Bühne-Basis:\*\* HEAD\^1 nicht messbar: /)
}

/** Zeitbudget (Attrappe-Uhr): 10 min genau für die Messung noch erlaubt, eine ms mehr = Warnung ohne Kopf-Lauf; ein verbrauchtes Budget stoppt vor dem nächsten Schritt. */
{
  const zuspaet = attrappe((x) => (x === 'messung' ? null : 0), { messung: 600001 })
  const r1 = lege({ fuehre: zuspaet.fuehre, uhr: zuspaet.uhr })
  assert.match(r1.aus[0], /Zeitbudget von 10 min in „Messung“ überschritten/)
  assert.equal(r1.code, 0)
  assert.ok(!arten(zuspaet).includes('kopf'))
  const knapp = attrappe(() => 0, { messung: 599999 })
  assert.equal(lege({ fuehre: knapp.fuehre, uhr: knapp.uhr }).aus.length, 0)
  assert.equal(arten(knapp).at(-1), 'kopf')
  const leer = attrappe(() => 0, { bau: 600000 })
  const r2 = lege({ fuehre: leer.fuehre, uhr: leer.uhr })
  assert.match(r2.aus[0], /Zeitbudget von 10 min vor „Messung“ aufgebraucht/)
  assert.deepEqual(arten(leer), ['archiv', 'entpacken', 'diff', 'bau'])
}

/** Ändert der PR `web/buehne` (diff = 1), kommt es vom Kopf über die Basis — vor dem Bau; sonst nicht. */
{
  const a = attrappe((x) => (x === 'diff' ? 1 : 0))
  lege({ fuehre: a.fuehre, uhr: a.uhr })
  assert.deepEqual(arten(a), ['archiv', 'entpacken', 'diff', 'archiv-kopf', 'entpacken-kopf', 'bau', 'messung', 'kopf'])
  const archiv = a.aufrufe[3].args
  assert.ok(archiv.includes('HEAD') && archiv.includes('web/buehne'))
  const b = attrappe()
  lege({ fuehre: b.fuehre, uhr: b.uhr })
  assert.ok(!arten(b).includes('archiv-kopf'))
  const kaputt = attrappe((x) => (x === 'archiv-kopf' ? 1 : x === 'diff' ? 1 : 0))
  assert.match(lege({ fuehre: kaputt.fuehre, uhr: kaputt.uhr }).aus[0], /Bühne des Kopfs \(Exit 1\)/)
}

/** Der Exit-Code des Kopfs gilt; ein fehlender Code (Frist/Startfehler) zählt als rot. */
{
  const rot = attrappe((x) => (x === 'kopf' ? 1 : 0))
  assert.equal(lege({ fuehre: rot.fuehre, uhr: rot.uhr }).code, 1)
  const keiner = attrappe((x) => (x === 'kopf' ? null : 0))
  assert.equal(lege({ fuehre: keiner.fuehre, uhr: keiner.uhr }).code, 1)
}

/** Echtes git und tar: Basis-Dateien aus `ref`, aber `web/buehne` vom Kopf (zweiter Commit); der Bau-Schritt sieht beides entpackt. */
{
  const repo = mkdtempSync(path.join(tmpdir(), 'buehne-basis-repo-'))
  const git = (...a) => assert.equal(spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { windowsHide: true, timeout: 20000 }).status, 0)
  mkdirSync(path.join(repo, 'web/buehne'), { recursive: true })
  mkdirSync(path.join(repo, 'shared'))
  mkdirSync(path.join(repo, 'public/anbieter'), { recursive: true })
  for (const d of ['web/a.txt', 'web/buehne/m.txt', 'web/buehne/alt.txt', 'shared/b.txt', 'public/anbieter/c.svg', 'vite.buehne.config.ts', 'package.json', 'tsconfig.json']) writeFileSync(path.join(repo, d), 'basis')
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'basis')
  writeFileSync(path.join(repo, 'web/a.txt'), 'kopf')
  writeFileSync(path.join(repo, 'web/buehne/m.txt'), 'kopf')
  git('rm', '-q', 'web/buehne/alt.txt')
  git('commit', '-q', '-a', '-m', 'kopf')
  let gelesen
  const fuehre = (b, args, opt) => {
    if (b === 'git' || b === 'tar') return fuehreAus(b, args, { ...opt, stdio: 'ignore' })
    if (args[0].endsWith('vite.js')) gelesen = ['web/a.txt', 'web/buehne/m.txt', 'shared/b.txt', 'public/anbieter/c.svg'].map((d) => readFileSync(path.join(opt.cwd, d), 'utf8')).concat(String(existsSync(path.join(opt.cwd, 'web/buehne/alt.txt'))))
    return { status: 0 }
  }
  mkdirSync(path.join(repo, 'node_modules'))
  const { code, aus } = lege({ fuehre, wurzel: repo, ref: 'HEAD~1' })
  assert.equal(code, 0)
  assert.deepEqual(gelesen, ['basis', 'kopf', 'basis', 'basis', 'false'], String(aus))
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
console.log('ok  buehne-basis: Reihenfolge mit Bühne-Vergleich, 5 gescheiterte Schritte mit dreifacher Warnung und Exit 0, Zeitbudget (Grenze 600000/600001 ms, verbraucht), web/buehne vom Kopf (Attrappe und echtes git+tar), --mockup, Exit-Code des Kopfs, BUEHNE_DIST im Kindprozess, node_modules unberührt')
