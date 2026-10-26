/**
 * Tests für die Leser-Regel von tools/pr-nachrechnen.mjs: reine Regel (`pr-nachrechnen-leser.mjs`) über einem Fake-Baum und der
 * Git-Anschluss (`pr-nachrechnen-leser-git.mjs`) über einem Fake-git. Der Baum nennt die bewegte Datei `data/crunchyroll-woche.json`
 * wie der Anlassfall PR 2043 (Workflow-PR gegen Bot-Daten).
 */
import { attrappe } from './pr-nachrechnen-leser-attrappe.mjs'
import { SUCHORDNER, gitLeser, inhalte } from './pr-nachrechnen-leser-git.mjs'
import { LESER_GRENZE, bewegtesGelesen, geaenderteSkripte, importZiele, leserIn, ohneKommentare, ohneLeser, pfadTokens, trifft } from './pr-nachrechnen-leser.mjs'

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

// Importketten: beliebig tief, kein Zweifel durch Größe
const kette = (n) => (p) => {
  const m = /^tools\/k(\d+)\.mjs$/.exec(p)
  if (m === null) return null
  return Number(m[1]) + 1 < n ? `import './k${Number(m[1]) + 1}.mjs'\n` : 'export {}\n'
}
pruefe('Importkette über 300 Dateien bis zum Leser -> Grund', /ruft tools\/k299\.mjs auf/.test(bewegtesGelesen({ bewegt: [F], pr: ['tools/k0.mjs'], leser: ['tools/k299.mjs'], lies: kette(300), paketSkripte: null })))
pruefe('Importkette über 300 Dateien ohne Leser -> null', bewegtesGelesen({ bewegt: [F], pr: ['tools/k0.mjs'], leser: ['tools/fern.mjs'], lies: kette(300), paketSkripte: null }) === null)
pruefe('Rückrichtung über 300 Dateien: Leser am Anfang, PR-Datei am Ende -> Grund', /tools\/k299\.mjs wird von Code genutzt/.test(bewegtesGelesen({ bewegt: [F], pr: ['tools/k299.mjs'], leser: ['tools/k0.mjs'], lies: kette(300), paketSkripte: null })))
for (const [n, ok] of [[LESER_GRENZE, true], [LESER_GRENZE + 1, false]]) {
  const g = bewegtesGelesen({ bewegt: [F], pr: ['tools/nachbar.mjs'], leser: Array.from({ length: n }, (_, i) => `pipeline/l${i}.ts`), lies, paketSkripte: null })
  pruefe(`${n} Leser -> ${ok ? 'null' : 'Zweifel'}`, ok ? g === null : /41 Leser/.test(g), g)
}

// Ausführungslisten: Inhalt zählt als Aufruf, die Liste selbst nutzt kein Leser (Anlass: PR 2099 änderte tools/check-logic-liste.txt)
{
  const LISTE = 'tools/check-logic-liste.txt'
  const nenntListe = { ...BAUM, 'tools/check-logic-alle.mjs': `const liste = '${LISTE}'\nconst d = '${F}'\n` }
  const g = (listenText, leser) => bewegtesGelesen({ bewegt: [F], pr: [LISTE], leser, lies: (p) => (p === LISTE ? listenText : nenntListe[p] ?? null), paketSkripte: null })
  pruefe('Liste mit unbeteiligten Prüfungen, obwohl ein Leser die Liste nennt -> null', g('# Kopf\npipeline/check-x.ts\n', ['tools/check-logic-alle.mjs']) === null, g('# Kopf\npipeline/check-x.ts\n', ['tools/check-logic-alle.mjs']))
  pruefe('Liste nimmt eine Prüfung auf, die der Leser ist -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(g('# Kopf\npipeline/bau/cr.ts\n', LESER)), g('# Kopf\npipeline/bau/cr.ts\n', LESER))
  pruefe('Liste: Kommentarzeile mit dem Leser zählt nicht', g('# pipeline/bau/cr.ts\n', LESER) === null)
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
{
  // Der Leser nennt einen Ordner (Token ohne Endung); eine PR-Datei darin hängt mit dem Leser zusammen.
  const ordner = (p) => ({ 'tools/r.mjs': `const d = 'tools/sub'\nconst f = '${F}'\n` })[p] ?? null
  pruefe('Rückrichtung: PR-Datei liegt im Ordner, den der Leser nennt -> Grund', /tools\/sub\/x\.mjs wird von Code genutzt/.test(bewegtesGelesen({ bewegt: [F], pr: ['tools/sub/x.mjs'], leser: ['tools/r.mjs'], lies: ordner, paketSkripte: null })))
}
pruefe('Patch-Notes-YAML, die die Datei nennt, zählt nicht (ohne Leser)', bewegtesGelesen({ bewegt: [F], pr: ['data/patchnotes/neu.yaml'], leser: [], lies: () => `text: ${F}\n`, paketSkripte: null }) === null)
pruefe('package.json: Ordner-Token in geändertem Skript trifft den Leser-Ordner', /ruft pipeline\/bau\/cr\.ts auf/.test(grund(['package.json'], { paketSkripte: 'ls pipeline/bau' })))

// leserIn: Treffer in Code, nicht in Kommentaren, sortiert
{
  const texte = new Map([['tools/z.mjs', `const d = '${F}'\n`], ['tools/a.mjs', "join(o, 'crunchyroll-woche.json')\n"], ['tools/k.mjs', `// ${F}\nconst x = 1\n`], ['tools/n.mjs', "const a = 'zweite-datei.json'\n"]])
  pruefe('leserIn: Pfad oder nur Name im Code, Kommentar nicht, sortiert', leserIn(texte, [F]).join() === 'tools/a.mjs,tools/z.mjs', leserIn(texte, [F]))
  pruefe('leserIn: mehrere bewegte Dateien, jede zählt', leserIn(texte, ['data/nichts-da.json', 'data/zweite-datei.json']).join() === 'tools/n.mjs', leserIn(texte, ['data/nichts-da.json', 'data/zweite-datei.json']))
}

// Git-Anschluss mit Fake-git: Repo als { main: {...}, kopf: {...} }
const MAIN = 'a'.repeat(40)
const KOPF = 'b'.repeat(40)
const fakeGit = (repo, opt = {}) => attrappe(repo, { mainSha: MAIN, ...opt })
const REFS = { nummer: 7, kopf: KOPF, main: MAIN }
const PR_BAUM = { ...BAUM, 'docs/leser.md': `${F}\n`, 'tools/notiz.mjs': '// data/crunchyroll-woche.json nur Kommentar\nconst z = 1\n', 'tools/bild.png': `${F}\n`, 'data/x.mjs': `${F}\n` }
pruefe('SUCHORDNER sind genau die Ordner des Codes', SUCHORDNER.join() === 'pipeline,shared,tools,web,worker,extension,.github', SUCHORDNER)
{
  const { git, aufrufe } = fakeGit({ main: PR_BAUM, kopf: {} })
  const g = gitLeser(git)([F], ['.github/workflows/bestand.yml', 'tools/anderes.mjs'], REFS)
  pruefe('gitLeser: Anlassfall (Workflow ohne Leser) -> null', g === null, g)
  pruefe('gitLeser: holt PR-Kopf und main zuerst', aufrufe[0] === `fetch -q origin refs/pull/7/head ${MAIN}`, aufrufe)
  pruefe('gitLeser: Baum von main in den Ordnern des Codes', aufrufe[1] === `ls-tree -r --name-only ${MAIN} -- pipeline shared tools web worker extension .github`, aufrufe)
  pruefe('gitLeser: ein Abruf für main, einer für die PR-Dateien im Kopf, nie je Datei', aufrufe.length === 4 && aufrufe[2] === 'cat-file --batch' && aufrufe[3] === 'cat-file --batch', aufrufe)
}
{
  // Nur lesbare Dateien kommen in den Speicher: Bilder und Dateien außerhalb der Ordner zählen nicht als Leser
  const { git } = fakeGit({ main: { 'tools/bild.png': `${F}\n`, 'data/x.mjs': `${F}\n`, 'tools/anderes.mjs': 'nichts\n' }, kopf: {} })
  pruefe('gitLeser: .png und Ordner außerhalb zählen nicht als Leser', gitLeser(git)([F], ['tools/anderes.mjs'], REFS) === null)
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
  const g = gitLeser(fakeGit({ main: PR_BAUM, kopf: {} }).git)([F], ['tools/gelöscht-im-pr.mjs'], REFS)
  pruefe('gitLeser: PR-Datei in keinem Stand vorhanden (gelöscht) -> kein Absturz, null', g === null, g)
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
for (const [name, opt] of [['fetch scheitert', { fetchFehler: true }], ['ls-tree scheitert', { lsFehler: true }]]) {
  const g = gitLeser(fakeGit({ main: PR_BAUM, kopf: {} }, opt).git)([F], ['tools/anderes.mjs'], REFS)
  pruefe(`gitLeser: ${name} -> „nicht ermittelbar“, also veraltet`, /^Leser nicht ermittelbar \(/.test(g), g)
}
{
  // inhalte: Mehrbyte-Zeichen und Reihenfolge, fehlende Datei in der Mitte
  const { git } = fakeGit({ main: { 'tools/a.mjs': 'Größe ä\n', 'tools/c.mjs': 'drei\n' }, kopf: {} })
  const k = inhalte(git, MAIN, ['tools/a.mjs', 'tools/fehlt.mjs', 'tools/c.mjs'])
  pruefe('inhalte: Mehrbyte-Inhalt richtig geschnitten, fehlende Datei fehlt, Nachbarn stimmen', k.size === 2 && k.get('tools/a.mjs') === 'Größe ä\n' && k.get('tools/c.mjs') === 'drei\n', [...k])
  pruefe('inhalte: keine Dateien -> kein git-Aufruf', inhalte(() => { throw new Error('nicht aufrufen') }, MAIN, []).size === 0)
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-leser.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-leser.test: grün')
