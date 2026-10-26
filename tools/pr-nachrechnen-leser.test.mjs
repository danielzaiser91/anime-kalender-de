/**
 * Tests für die Leser-Regel von tools/pr-nachrechnen.mjs: reine Regel (`pr-nachrechnen-leser.mjs`) über einem Fake-Baum und der
 * Git-Anschluss (`pr-nachrechnen-leser-git.mjs`) über einem Fake-git. Der Baum nennt die bewegte Datei `data/crunchyroll-woche.json`
 * wie der Anlassfall PR 2043 (Workflow-PR gegen Bot-Daten).
 */
import { attrappe } from './pr-nachrechnen-leser-attrappe.mjs'
import { gitLeser, suchLeser } from './pr-nachrechnen-leser-git.mjs'
import { HUELLE_GRENZE, LESER_GRENZE, bewegtesGelesen, geaenderteSkripte, importZiele, ohneKommentare, ohneLeser, pfadTokens, trifft } from './pr-nachrechnen-leser.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const F = 'data/crunchyroll-woche.json'
const BAUM = {
  'pipeline/bau/cr.ts': `import { x } from '../lib/helfer'\nconst d = '${F}'\n`,
  'pipeline/lib/helfer.ts': 'export const x = 1\n',
  'tools/cr-vorschau.ts': "import { lesen } from '../pipeline/bau/cr'\n",
  'tools/anderes.mjs': `// ${F} steht nur im Kommentar\nconst a = 1\n`,
  'tools/nachbar.mjs': 'export const n = 2\n',
  '.github/workflows/bestand.yml': `steps:\n  - run: node tools/anderes.mjs\n  # ${F}\n  - run: npm run data:build\n`,
  '.github/workflows/lesend.yml': 'steps:\n  - run: npx tsx tools/cr-vorschau.ts\n',
  '.github/workflows/nennt.yml': `paths:\n  - ${F}\n`,
  '.github/workflows/ordner.yml': 'steps:\n  - run: ls pipeline/bau\n',
}
const lies = (p) => BAUM[p] ?? null
const LESER = ['pipeline/bau/cr.ts']
const grund = (pr, extra = {}) => bewegtesGelesen({ bewegt: [F], pr, leser: LESER, lies, paketSkripte: null, ...extra })

// Reine Hilfen
pruefe('ohneKommentare: //, *, /*, # fallen weg', ohneKommentare('a\n// b\n * c\n/* d\n# e\n  f').split('\n').join() === 'a,  f', ohneKommentare('a\n// b\n * c\n/* d\n# e\n  f'))
pruefe('pfadTokens: Aufruf, Daten-Literal, Ordnerkopf', pfadTokens('run: node tools/x.mjs "data/a/b.json" pipeline/bau').join() === 'tools/x.mjs,data/a/b.json,pipeline/bau', pfadTokens('run: node tools/x.mjs "data/a/b.json" pipeline/bau'))
pruefe('pfadTokens: URL und Namensteil zählen nicht', pfadTokens('https://x.de/data/a.json mydata/b.json').length === 0, pfadTokens('https://x.de/data/a.json mydata/b.json'))
pruefe('pfadTokens: Kommentarzeile zählt nicht', pfadTokens('# tools/x.mjs').length === 0)
pruefe('trifft: Datei, Ordner, Namensvetter', trifft('data/cache', 'data/cache/a') && trifft('data/a.json', 'data/a.json') && !trifft('data/cache', 'data/cachex/a'))
pruefe('importZiele: relativ zum Ordner der Datei, mit und ohne Endung', importZiele('tools/a/b.mjs', "import x from '../lib/h'").includes('tools/lib/h.ts') && importZiele('tools/a/b.mjs', "import x from '../lib/h'").includes('tools/lib/h'))
pruefe('ohneLeser: Doku, Daniel, Patch Notes, Wurzel-Markdown; nicht web/README.md', ['docs/a.md', 'daniel-zum-abarbeiten/s.md', 'data/patchnotes/a.yaml', 'CLAUDE.md'].every(ohneLeser) && !ohneLeser('web/README.md') && !ohneLeser('docsx/a.md'))

// Entscheidung
pruefe('PR berührt die bewegte Datei -> Grund', /^der PR berührt data\/crunchyroll-woche\.json$/.test(grund(['tools/anderes.mjs', F])), grund(['tools/anderes.mjs', F]))
pruefe('nur Doku -> null', grund(['docs/wissen/a.md', 'daniel-zum-abarbeiten/stand.md', 'CLAUDE.md', 'data/patchnotes/neu.yaml']) === null)
pruefe('Anlassfall: Workflow mit Kommentar-Nennung und Skript ohne Leser -> null', grund(['.github/workflows/bestand.yml', 'tools/anderes.mjs']) === null, grund(['.github/workflows/bestand.yml', 'tools/anderes.mjs']))
pruefe('Workflow nennt die Datei literal -> Grund', grund(['.github/workflows/nennt.yml']) === `der PR liest ${F} (.github/workflows/nennt.yml)`, grund(['.github/workflows/nennt.yml']))
pruefe('Workflow ruft Skript, das den Leser importiert -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(grund(['.github/workflows/lesend.yml'])), grund(['.github/workflows/lesend.yml']))
pruefe('Workflow nennt den Ordner des Lesers -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(grund(['.github/workflows/ordner.yml'])), grund(['.github/workflows/ordner.yml']))
pruefe('PR ändert den Helfer des Lesers -> Grund (Rückrichtung)', /pipeline\/lib\/helfer\.ts wird von Code genutzt, der bewegte Daten liest/.test(grund(['pipeline/lib/helfer.ts'])), grund(['pipeline/lib/helfer.ts']))
pruefe('PR ändert den Leser selbst -> Grund', grund(['pipeline/bau/cr.ts']) !== null)
pruefe('PR ändert unbeteiligtes Skript -> null', grund(['tools/nachbar.mjs']) === null)
pruefe('ohne Leser auf main und unbeteiligter PR -> null', grund(['tools/anderes.mjs', '.github/workflows/bestand.yml'], { leser: [] }) === null)
pruefe('gelöschte oder nicht lesbare PR-Datei -> kein Absturz, null', grund(['tools/weg.mjs']) === null)
pruefe('keine bewegten Dateien -> null', bewegtesGelesen({ bewegt: [], pr: ['pipeline/bau/cr.ts'], leser: LESER, lies, paketSkripte: null }) === null)
pruefe('Umbenennung: alter Name im PR zählt', /berührt/.test(grund(['tools/neu.mjs', F])))

// Grenzen: genau an der Grenze, eins darüber
const kette = (n) => (p) => {
  const m = /^tools\/k(\d+)\.mjs$/.exec(p)
  return m === null ? null : Number(m[1]) + 1 < n ? `import './k${Number(m[1]) + 1}.mjs'\n` : 'export {}\n'
}
for (const [n, ok] of [[HUELLE_GRENZE, true], [HUELLE_GRENZE + 1, false]]) {
  const g = bewegtesGelesen({ bewegt: [F], pr: ['tools/k0.mjs'], leser: ['pipeline/bau/cr.ts'], lies: kette(n), paketSkripte: null })
  pruefe(`Hülle mit ${n} Dateien -> ${ok ? 'null' : 'Zweifel'}`, ok ? g === null : /Hülle größer als 200/.test(g), g)
}
{
  const g = bewegtesGelesen({ bewegt: [F], pr: ['tools/nachbar.mjs'], leser: ['tools/k0.mjs'], lies: kette(HUELLE_GRENZE + 1), paketSkripte: null })
  pruefe('Hülle des Lesers zu groß -> Zweifel (Rückrichtung)', /Hülle größer als 200/.test(g), g)
}
for (const [n, ok] of [[LESER_GRENZE, true], [LESER_GRENZE + 1, false]]) {
  const g = bewegtesGelesen({ bewegt: [F], pr: ['tools/nachbar.mjs'], leser: Array.from({ length: n }, (_, i) => `pipeline/l${i}.ts`), lies, paketSkripte: null })
  pruefe(`${n} Leser -> ${ok ? 'null' : 'Zweifel'}`, ok ? g === null : /41 Leser/.test(g), g)
}

// package.json zählt nur mit den geänderten Skripten
pruefe('package.json: geändertes Skript ruft Leser-Skript -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(grund(['package.json'], { paketSkripte: 'npx tsx tools/cr-vorschau.ts' })))
pruefe('package.json: geändertes Skript ohne Leser -> null', grund(['package.json'], { paketSkripte: 'node tools/anderes.mjs' }) === null)
pruefe('package.json: nur Abhängigkeiten geändert (leerer Skripttext) -> null', grund(['package.json'], { paketSkripte: '' }) === null)
pruefe('package.json: nicht vergleichbar -> Zweifel', grund(['package.json'], { paketSkripte: null }) === 'package.json nicht vergleichbar')
const pj = (scripts) => JSON.stringify({ scripts, dependencies: { a: '1' } })
pruefe('geaenderteSkripte: nur der geänderte und neue Wert', geaenderteSkripte(pj({ a: 'x', b: 'y' }), pj({ a: 'x', b: 'z', c: 'w' })) === 'z\nw', geaenderteSkripte(pj({ a: 'x', b: 'y' }), pj({ a: 'x', b: 'z', c: 'w' })))
pruefe('geaenderteSkripte: unverändert -> leer', geaenderteSkripte(pj({ a: 'x' }), pj({ a: 'x' })) === '')
pruefe('geaenderteSkripte: kein JSON oder null -> null', geaenderteSkripte('{', pj({})) === null && geaenderteSkripte(null, pj({})) === null)

// Weitere Fälle: jede Ordnerkopf-, Endungs- und Lesegrenze einzeln
pruefe('pfadTokens: jeder Ordnerkopf zählt', pfadTokens(['.github/a.yml', 'data/a.json', 'public/a', 'tools/a.mjs', 'pipeline/a.ts', 'shared/a.ts', 'web/a.tsx', 'worker/a.ts', 'extension/a.js'].join(' ')).length === 9)
for (const [ende, ziel] of [['.ts', 'a/b.ts'], ['.tsx', 'a/b.tsx'], ['.mjs', 'a/b.mjs'], ['.cjs', 'a/b.cjs'], ['.mts', 'a/b.mts'], ['/index.ts', 'a/b/index.ts']]) {
  pruefe(`importZiele: Kandidat ${ende}`, importZiele('a/c.ts', "import './b'").includes(ziel), importZiele('a/c.ts', "import './b'"))
}
{
  const gelesen = []
  const spaeh = (p) => {
    gelesen.push(p)
    return lies(p)
  }
  bewegtesGelesen({ bewegt: [F], pr: ['data/curated/a.json', 'web/src/a.css', 'tools/nachbar.mjs', 'data/curated/b.yaml'], leser: LESER, lies: spaeh, paketSkripte: null })
  pruefe('Daten, Stile und Bilder werden nicht gelesen, Skripte und YAML schon', !gelesen.includes('data/curated/a.json') && !gelesen.includes('web/src/a.css') && gelesen.includes('tools/nachbar.mjs') && gelesen.includes('data/curated/b.yaml'), gelesen)
}
{
  const kreis = (p) => ({ 'tools/a.mjs': "import './b.mjs'\n", 'tools/b.mjs': "import './a.mjs'\n" })[p] ?? null
  pruefe('Importkreis endet (kein zweites Lesen derselben Datei)', bewegtesGelesen({ bewegt: [F], pr: ['tools/a.mjs'], leser: LESER, lies: kreis, paketSkripte: null }) === null)
}
{
  // Pfad-Tokens folgt nur die Startdatei: Workflow nennt a.mjs (Stufe 1), a.mjs nennt b.mjs (Stufe 2, nicht gefolgt), b.mjs ist Leser.
  const stufen = (p) => ({ '.github/workflows/w.yml': 'run: node tools/a.mjs\n', 'tools/a.mjs': "spawn('tools/b.mjs')\n", 'tools/b.mjs': `const d = '${F}'\n` })[p] ?? null
  pruefe('Token der zweiten Stufe werden nicht gefolgt', bewegtesGelesen({ bewegt: [F], pr: ['.github/workflows/w.yml'], leser: ['tools/b.mjs'], lies: stufen, paketSkripte: null }) === null)
  const importiert = (p) => ({ '.github/workflows/w.yml': 'run: node tools/a.mjs\n', 'tools/a.mjs': "import './b.mjs'\n", 'tools/b.mjs': `const d = '${F}'\n` })[p] ?? null
  pruefe('Importe der zweiten Stufe werden gefolgt', /ruft tools\/b\.mjs auf/.test(bewegtesGelesen({ bewegt: [F], pr: ['.github/workflows/w.yml'], leser: ['tools/b.mjs'], lies: importiert, paketSkripte: null })))
}
pruefe('Nennung nur über den Dateinamen -> Grund', /liest data\/crunchyroll-woche\.json/.test(bewegtesGelesen({ bewegt: [F], pr: ['tools/b.mjs'], leser: [], lies: () => "join(ordner, 'crunchyroll-woche.json')", paketSkripte: null })))
pruefe('geaenderteSkripte: package.json ohne scripts -> leer', geaenderteSkripte('{}', '{}') === '' && geaenderteSkripte('{}', pj({ a: 'x' })) === 'x')
pruefe('package.json: Skript nennt Datei, die der Leser importiert -> Rückrichtung', /pipeline\/lib\/helfer\.ts wird von Code genutzt/.test(grund(['package.json'], { paketSkripte: 'node pipeline/lib/helfer.ts' })), grund(['package.json'], { paketSkripte: 'node pipeline/lib/helfer.ts' }))
pruefe('package.json: Skript nennt den Ordner der importierten Datei -> Rückrichtung', /pipeline\/lib wird von Code genutzt/.test(grund(['package.json'], { paketSkripte: 'ls pipeline/lib' })), grund(['package.json'], { paketSkripte: 'ls pipeline/lib' }))
pruefe('Patch-Notes-YAML, die die Datei nennt, zählt nicht (ohne Leser)', bewegtesGelesen({ bewegt: [F], pr: ['data/patchnotes/neu.yaml'], leser: [], lies: () => `text: ${F}\n`, paketSkripte: null }) === null)
pruefe('package.json: Ordner-Token in geändertem Skript trifft den Leser-Ordner', /ruft pipeline\/bau\/cr\.ts auf/.test(grund(['package.json'], { paketSkripte: 'ls pipeline/bau' })))

// Git-Anschluss mit Fake-git: Repo als { main: {...}, kopf: {...} }
const MAIN = 'a'.repeat(40)
const KOPF = 'b'.repeat(40)
const fakeGit = (repo, opt = {}) => attrappe(repo, { mainSha: MAIN, ...opt })
const REFS = { nummer: 7, kopf: KOPF, main: MAIN }
const PR_BAUM = { ...BAUM, 'docs/leser.md': `${F}\n`, 'tools/notiz.mjs': '// data/crunchyroll-woche.json nur Kommentar\nconst z = 1\n' }
{
  const { git, aufrufe } = fakeGit({ main: PR_BAUM, kopf: {} })
  pruefe('suchLeser: Treffer in Code, nicht in Kommentar, nicht in Markdown', suchLeser(git, MAIN, [F]).join() === 'pipeline/bau/cr.ts,.github/workflows/nennt.yml'.split(',').sort().join(), suchLeser(git, MAIN, [F]))
  pruefe('suchLeser: sucht den Dateinamen als Festtext in den Ordnern des Codes', aufrufe[0] === `grep -n -F -e crunchyroll-woche.json ${MAIN} -- pipeline shared tools web worker extension .github`, aufrufe[0])
}
{
  const { git } = fakeGit({ main: { 'tools/x.mjs': 'nichts\n' }, kopf: {} })
  pruefe('suchLeser: kein Treffer (Status 1) -> leere Liste', suchLeser(git, MAIN, [F]).length === 0)
  let werfen = false
  try {
    suchLeser(fakeGit({ main: {}, kopf: {} }, { grepStatus: 2 }).git, MAIN, [F])
  } catch {
    werfen = true
  }
  pruefe('suchLeser: anderer Fehler (Status 2) wird nicht als „kein Leser“ gelesen', werfen)
}
{
  const { git, aufrufe } = fakeGit({ main: PR_BAUM, kopf: {} })
  const g = gitLeser(git)([F], ['.github/workflows/bestand.yml', 'tools/anderes.mjs'], REFS)
  pruefe('gitLeser: Anlassfall (Workflow ohne Leser) -> null, holt PR-Kopf und main', g === null && aufrufe[0] === `fetch -q origin refs/pull/7/head ${MAIN}`, { g, aufrufe })
}
{
  const kopfBaum = { '.github/workflows/neu.yml': `run: echo ${F}\n` }
  const g = gitLeser(fakeGit({ main: PR_BAUM, kopf: kopfBaum }).git)([F], ['.github/workflows/neu.yml'], REFS)
  pruefe('gitLeser: Datei nur im PR-Kopf (neuer Workflow nennt die Datei) -> Grund', g === `der PR liest ${F} (.github/workflows/neu.yml)`, g)
}
{
  const g = gitLeser(fakeGit({ main: PR_BAUM, kopf: { 'tools/anderes.mjs': `const d = '${F}'\n` } }).git)([F], ['tools/anderes.mjs'], REFS)
  pruefe('gitLeser: der Kopf schlägt main (PR-Fassung nennt die Datei, main-Fassung nur im Kommentar) -> Grund', /der PR liest/.test(g), g)
}
{
  const g = gitLeser(fakeGit({ main: PR_BAUM, kopf: {} }).git)([F], ['pipeline/lib/helfer.ts'], REFS)
  pruefe('gitLeser: Helfer des Lesers aus main gelesen -> Rückrichtung', /wird von Code genutzt/.test(g), g)
}
{
  const kopf = { 'package.json': JSON.stringify({ scripts: { 'check:neu': 'npx tsx tools/cr-vorschau.ts' } }) }
  const main = { ...PR_BAUM, 'package.json': JSON.stringify({ scripts: {} }) }
  const g = gitLeser(fakeGit({ main, kopf }).git)([F], ['package.json'], REFS)
  pruefe('gitLeser: package.json mit neuem Skript, das den Leser aufruft -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(g), g)
  const g2 = gitLeser(fakeGit({ main, kopf: { 'package.json': main['package.json'] } }).git)([F], ['package.json'], REFS)
  pruefe('gitLeser: package.json ohne Skriptänderung -> null', g2 === null, g2)
  const g3 = gitLeser(fakeGit({ main, kopf: {} }).git)([F], ['package.json'], REFS)
  pruefe('gitLeser: package.json im Kopf nicht lesbar -> Zweifel', g3 === 'package.json nicht vergleichbar', g3)
}
for (const [name, opt, repo] of [['fetch scheitert', { fetchFehler: true }, { main: PR_BAUM, kopf: {} }], ['grep scheitert', { grepStatus: 2 }, { main: PR_BAUM, kopf: {} }]]) {
  const g = gitLeser(fakeGit(repo, opt).git)([F], ['tools/anderes.mjs'], REFS)
  pruefe(`gitLeser: ${name} -> „nicht ermittelbar“, also veraltet`, /^Leser nicht ermittelbar \(/.test(g), g)
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-leser.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-leser.test: grün')
