/** Tests für tools/pr-stufe-kette.mjs und die Handwerkzeug-Regel von tools/pr-stufe.mjs, gegen ein Wegwerf-Repo unter os.tmpdir(). */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bestimmeStufe } from './pr-stufe.mjs'
import { istHandwerkzeug, leseKette } from './pr-stufe-kette.mjs'

const fehler = []
const pruefe = (name, ist, soll) => {
  if (ist === soll) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — ${ist}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'pr-stufe-kette-'))
const schreibe = (pfad, text) => {
  const voll = join(wurzel, pfad)
  mkdirSync(join(voll, '..'), { recursive: true })
  writeFileSync(voll, text)
}
// Werkzeuge: hand (nur von Hand), wf (Workflow), npm (package.json), liste (Prüfliste), helfer (von Kettenwerkzeug importiert), ohnetest
for (const n of ['hand', 'wf', 'npm', 'liste', 'helfer', 'ohnetest', 'kettenwerk']) schreibe(`tools/${n}.mjs`, '// werkzeug\n')
for (const n of ['hand', 'wf', 'npm', 'liste', 'helfer', 'kettenwerk']) schreibe(`tools/${n}.test.mjs`, `import './${n}.mjs'\n`)
schreibe('.github/workflows/lauf.yml', 'run: node tools/wf.mjs\nrun: node tools/kettenwerk.mjs\n')
schreibe('package.json', '{"scripts":{"x":"node tools/npm.mjs"}}')
schreibe('tools/check-logic-liste.txt', 'tools/liste.test.mjs\ntools/liste.mjs\n')
schreibe('tools/kettenwerk.mjs', "import './helfer.mjs'\n")
const kette = leseKette(wurzel)
const stufe = (...pfade) => bestimmeStufe(pfade.map((pfad) => ({ pfad, hinzu: ['x'], weg: [] })), kette).stufe

pruefe('Handwerkzeug mit Test → true', istHandwerkzeug('tools/hand.mjs', kette), true)
pruefe('Workflow ruft auf → false', istHandwerkzeug('tools/wf.mjs', kette), false)
pruefe('npm-Skript ruft auf → false', istHandwerkzeug('tools/npm.mjs', kette), false)
pruefe('Prüfliste nennt es → false', istHandwerkzeug('tools/liste.mjs', kette), false)
pruefe('von Kettenwerkzeug importiert → false', istHandwerkzeug('tools/helfer.mjs', kette), false)
pruefe('ohne eigenen Test → false', istHandwerkzeug('tools/ohnetest.mjs', kette), false)
pruefe('Test eines Handwerkzeugs → true', istHandwerkzeug('tools/hand.test.mjs', kette), true)
pruefe('Test eines Workflow-Werkzeugs → false', istHandwerkzeug('tools/wf.test.mjs', kette), false)
pruefe('Unterordner → false', istHandwerkzeug('tools/claude-global/x.mjs', kette), false)
pruefe('ohne Kette → false', istHandwerkzeug('tools/hand.mjs', null), false)
pruefe('Namensteil (hand-x) zählt nicht als Aufruf von hand', istHandwerkzeug('tools/hand.mjs', { quellen: [{ pfad: 'a', text: 'tools/hand-x.mjs' }], tests: ['hand.test.mjs'] }), true)

pruefe('PR: Handwerkzeug + Test → 1', stufe('tools/hand.mjs', 'tools/hand.test.mjs'), 1)
pruefe('PR: Workflow-Werkzeug + Test → 2', stufe('tools/wf.mjs', 'tools/wf.test.mjs'), 2)
pruefe('PR: npm-Werkzeug → 2', stufe('tools/npm.mjs'), 2)
pruefe('PR: Prüflisten-Werkzeug → 2', stufe('tools/liste.mjs'), 2)
pruefe('PR: Handwerkzeug + Workflow-Eintrag im selben PR → 2', stufe('tools/hand.mjs', '.github/workflows/lauf.yml'), 2)
pruefe('PR: Handwerkzeug + package.json im selben PR → 2', stufe('tools/hand.mjs', 'package.json'), 2)
pruefe('PR: Handwerkzeug + pipeline → 2', stufe('tools/hand.mjs', 'pipeline/lib/x.ts'), 2)
pruefe('PR: neues Werkzeug samt neuem Test (nicht im Repo) → 1', stufe('tools/neu.mjs', 'tools/neu.test.mjs'), 1)
pruefe('PR: neues Werkzeug ohne Test → 2', stufe('tools/neu.mjs'), 2)
pruefe('PR: Handwerkzeug ohne Kette → 2', bestimmeStufe([{ pfad: 'tools/hand.mjs', hinzu: ['x'], weg: [] }]).stufe, 2)

// A1–A3: weitere Aufrufer-Arten, je Fall ein eigenes Werkzeug mit eigenem Test
const weitere = {
  vontest: ['tools/anderer.test.mjs', "import './vontest.mjs'\n"],
  vonpipeline: ['pipeline/x.ts', "import '../tools/vonpipeline.mjs'\n"],
  vonshared: ['shared/x.ts', 'tools/vonshared.mjs\n'],
  vonweb: ['web/src/x.ts', 'tools/vonweb.mjs\n'],
  vonworker: ['worker/src/x.ts', 'tools/vonworker.mjs\n'],
  vonextension: ['extension/x.js', 'tools/vonextension.mjs\n'],
  vonclaude: ['.claude/x.json', 'tools/vonclaude.mjs\n'],
  vonvite: ['vite.config.ts', "import 'vonvite'\n"],
  'pre-hand': ['tools/vorne.mjs', 'tools/pre-hand.mjs\n'],
  globbig: ['.github/workflows/glob.yml', "paths: ['tools/*globb*']\n"],
  globfern: ['.github/workflows/glob2.yml', "paths: ['tools/*.test.mjs']\n"],
  selbst: ['tools/selbst.mjs', '// selbst nennt sich selbst\n'],
  ausnahme: ['tools/skript-aufrufer-ausnahmen.txt', 'tools/ausnahme.mjs\n'],
}
for (const [n, [pfad, text]] of Object.entries(weitere)) {
  schreibe(`tools/${n}.mjs`, '// werkzeug\n')
  schreibe(`tools/${n}.test.mjs`, `import './${n}.mjs'\n`)
  schreibe(pfad, text)
}
// nur ein .spec.-Test, kein .test.-Test
schreibe('tools/nurspec.mjs', '// werkzeug\n')
schreibe('tools/nurspec.spec.mjs', "import './nurspec.mjs'\n")
const kette2 = leseKette(wurzel)
const stufe2 = (...pfade) => bestimmeStufe(pfade.map((pfad) => ({ pfad, hinzu: ['x'], weg: [] })), kette2).stufe
const ist = (name) => istHandwerkzeug(`tools/${name}.mjs`, kette2)
pruefe('von fremdem Test importiert → false', ist('vontest'), false)
pruefe('Aufruf aus pipeline → false', ist('vonpipeline'), false)
pruefe('Nennung in shared → false', ist('vonshared'), false)
pruefe('Nennung in web → false', ist('vonweb'), false)
pruefe('Nennung in worker → false', ist('vonworker'), false)
pruefe('Nennung in extension → false', ist('vonextension'), false)
pruefe('Nennung in .claude → false', ist('vonclaude'), false)
pruefe('Name nur in vite.config.ts → false', istHandwerkzeug('tools/vonvite.mjs', kette2), false)
pruefe('Namensteil vorn (pre-hand) zählt nicht als hand', ist('hand'), true)
pruefe('Glob in Workflow trifft → false', ist('globbig'), false)
pruefe('Glob auf Tests trifft Werkzeug nicht → true', ist('globfern'), true)
pruefe('Nennung in sich selbst → true', ist('selbst'), true)
pruefe('Name nur in skript-aufrufer-ausnahmen.txt → true', ist('ausnahme'), true)
pruefe('nur .spec.-Test zählt als eigener Test → true', ist('nurspec'), true)
pruefe('Test eines von fremdem Test importierten Werkzeugs → false', istHandwerkzeug('tools/vontest.test.mjs', kette2), false)

// Template-Pfad in Workflow: im Zweifel nichts ist Handwerkzeug
const wurzel2 = mkdtempSync(join(tmpdir(), 'pr-stufe-kette2-'))
mkdirSync(join(wurzel2, 'tools'))
mkdirSync(join(wurzel2, '.github'))
writeFileSync(join(wurzel2, 'tools/hand.mjs'), '// w\n')
writeFileSync(join(wurzel2, 'tools/hand.test.mjs'), "import './hand.mjs'\n")
writeFileSync(join(wurzel2, '.github/a.yml'), 'run: node tools/${{ matrix.skript }}.mjs\n')
pruefe('Template-Pfad in Workflow → false', istHandwerkzeug('tools/hand.mjs', leseKette(wurzel2)), false)
writeFileSync(join(wurzel2, '.github/a.yml'), 'run: node tools/${x}.mjs\n')
pruefe('Template-Pfad ${x} in Workflow → false', istHandwerkzeug('tools/hand.mjs', leseKette(wurzel2)), false)
writeFileSync(join(wurzel2, '.github/a.yml'), 'run: node tools/fest.mjs\n')
pruefe('fester anderer Pfad in Workflow → true', istHandwerkzeug('tools/hand.mjs', leseKette(wurzel2)), true)
writeFileSync(join(wurzel2, '.github/a.yml'), 'run: node tools/fest.mjs\n')
writeFileSync(join(wurzel2, 'package-lock.json'), '{"tools/hand.mjs":1}')
pruefe('package-lock.json zählt nicht als Aufrufer → true', istHandwerkzeug('tools/hand.mjs', leseKette(wurzel2)), true)
writeFileSync(join(wurzel2, 'package.json'), '{"scripts":{"x":"node tools/*han*.mjs"}}')
pruefe('Glob in package.json → false', istHandwerkzeug('tools/hand.mjs', leseKette(wurzel2)), false)
rmSync(join(wurzel2, 'package.json'))
writeFileSync(join(wurzel2, 'tools/gross.mjs'), `tools/hand.mjs${' '.repeat(2_000_000)}\n`)
pruefe('Quelle über 2 MB wird nicht gelesen → true', istHandwerkzeug('tools/hand.mjs', leseKette(wurzel2)), true)
pruefe('Stufe: Name nur in vite.config.ts → 2', stufe2('tools/vonvite.mjs', 'tools/vonvite.test.mjs'), 2)
pruefe('Stufe: Workflow-Glob → 2', stufe2('tools/globbig.mjs', 'tools/globbig.test.mjs'), 2)
pruefe('Stufe: von fremdem Test importiert → 2', stufe2('tools/vontest.mjs', 'tools/vontest.test.mjs'), 2)
rmSync(wurzel2, { recursive: true, force: true })

// Eigenschaft am Bestand: jedes tools/*.mjs, das ein fremder Test importiert, ist nie Handwerkzeug
const repo = join(fileURLToPath(import.meta.url), '../..')
const repoKette = leseKette(repo)
const importiert = new Set()
for (const t of readdirSync(join(repo, 'tools')).filter((n) => /\.(test|spec)\./.test(n))) {
  for (const m of readFileSync(join(repo, 'tools', t), 'utf8').matchAll(/['"]\.\/([\w-]+\.mjs)['"]/g)) {
    if (!t.startsWith(`${m[1].slice(0, -4)}.`) && existsSync(join(repo, 'tools', m[1]))) importiert.add(m[1])
  }
}
pruefe(`Bestand: ${importiert.size} von fremden Tests importierte Werkzeuge gefunden`, importiert.size > 0, true)
const zuUnrecht = [...importiert].filter((n) => istHandwerkzeug(`tools/${n}`, repoKette))
pruefe(`Bestand: kein importiertes Werkzeug ist Handwerkzeug (${zuUnrecht.join(', ')})`, zuUnrecht.length, 0)
pruefe('Bestand: pr-pruefer-schnappschuss ist kein Handwerkzeug', istHandwerkzeug('tools/pr-pruefer-schnappschuss.mjs', repoKette), false)
pruefe('Bestand: browser-weiche ist kein Handwerkzeug', istHandwerkzeug('tools/browser-weiche.mjs', repoKette), false)

rmSync(wurzel, { recursive: true, force: true })
if (fehler.length) {
  console.error(`\n${fehler.length} Fälle fehlgeschlagen`)
  process.exit(1)
}
console.log('pr-stufe-kette: alle Fälle grün')
