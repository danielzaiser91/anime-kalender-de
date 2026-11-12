/**
 * Tests für die Leser-Regel von tools/pr-nachrechnen.mjs: reine Regel (`pr-nachrechnen-leser.mjs`) über einem Fake-Baum und der
 * Git-Anschluss (`pr-nachrechnen-leser-git.mjs`) über einem Fake-git. Der Baum nennt die bewegte Datei `data/crunchyroll-woche.json`
 * wie der Anlassfall PR 2043 (Workflow-PR gegen Bot-Daten).
 */
import { attrappe } from './pr-nachrechnen-leser-attrappe.mjs'
import { GIT_TIMEOUT_MS, SUCHORDNER, gitAufrufMit, gitLeser, inhalte } from './pr-nachrechnen-leser-git.mjs'
import { bewegtesGelesen, geaenderteSkripte, importZiele, leserIn, ohneKommentare, ohneLeser, ordnerLeser, pfadTokens, trifft } from './pr-nachrechnen-leser.mjs'

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
pruefe('trifft: nur dieselbe Datei, kein Ordner-, Präfix- oder Namensvetter-Treffer', trifft('data/a.json', 'data/a.json') && !trifft('tools/sub', 'tools/sub/a') && !trifft('tools/sub', 'tools/subx/a') && !trifft('data/a', 'data/a.json'))
pruefe('importZiele: relativ zum Ordner der Datei, mit und ohne Endung', importZiele('tools/a/b.mjs', "import x from '../lib/h'").includes('tools/lib/h.ts') && importZiele('tools/a/b.mjs', "import x from '../lib/h'").includes('tools/lib/h'))
pruefe('ohneLeser: Doku, Daniel, Patch Notes, Wurzel-Markdown; nicht web/README.md', ['docs/a.md', 'daniel-zum-abarbeiten/s.md', 'data/patchnotes/a.yaml', 'CLAUDE.md'].every(ohneLeser) && !ohneLeser('web/README.md') && !ohneLeser('docsx/a.md'))

// Entscheidung
pruefe('PR berührt die bewegte Datei -> Grund', /^der PR berührt data\/crunchyroll-woche\.json$/.test(grund(['tools/anderes.mjs', F])), grund(['tools/anderes.mjs', F]))
pruefe('nur Doku -> null', grund(['docs/wissen/a.md', 'daniel-zum-abarbeiten/stand.md', 'CLAUDE.md', 'data/patchnotes/neu.yaml']) === null)
pruefe('Anlassfall: Workflow mit Kommentar-Nennung und Skript ohne Leser -> null', grund(['.github/workflows/bestand.yml', 'tools/anderes.mjs']) === null, grund(['.github/workflows/bestand.yml', 'tools/anderes.mjs']))
pruefe('Workflow nennt die Datei literal -> Grund', grund(['.github/workflows/nennt.yml']) === `der PR liest ${F} (.github/workflows/nennt.yml)`, grund(['.github/workflows/nennt.yml']))
pruefe('Workflow ruft Skript, das den Leser importiert -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(grund(['.github/workflows/lesend.yml'])), grund(['.github/workflows/lesend.yml']))
pruefe('Workflow nennt nur den Ordner des Lesers (ls pipeline/bau) -> null (kein Ordner-Treffer)', grund(['.github/workflows/ordner.yml']) === null, grund(['.github/workflows/ordner.yml']))
pruefe('PR ändert den Helfer des Lesers -> Grund (Rückrichtung)', /pipeline\/lib\/helfer\.ts wird von Code genutzt, der bewegte Daten liest/.test(grund(['pipeline/lib/helfer.ts'])), grund(['pipeline/lib/helfer.ts']))
pruefe('PR ändert den Leser selbst -> Grund', grund(['pipeline/bau/cr.ts']) !== null)
pruefe('PR ändert unbeteiligtes Skript -> null', grund(['tools/nachbar.mjs']) === null)
pruefe('ohne Leser auf main und unbeteiligter PR -> null', grund(['tools/anderes.mjs', '.github/workflows/bestand.yml'], { leser: [] }) === null)
pruefe('gelöschte oder nicht lesbare PR-Datei -> kein Absturz, null', grund(['tools/weg.mjs']) === null)
pruefe('keine bewegten Dateien -> null', bewegtesGelesen({ bewegt: [], pr: ['pipeline/bau/cr.ts'], leser: LESER, lies, paketSkripte: null }) === null)
pruefe('Umbenennung: alter Name im PR zählt', /berührt/.test(grund(['tools/neu.mjs', F])))

// Bewegter Code, den niemand nennt (Auflage Prüfer 3312 A1): die Rückwärtshülle startet auch bei ihm
{
  const text = {
    'tools/neu-g1.test.mjs': "import { x } from '../shared/logic.ts'\n",
    'pipeline/check-neu-g8.ts': "const d = readFileSync('data/dub-confirmed.yaml')\n",
    'pipeline/check-neu-g13.ts': "import { a } from './lib/adn.ts'\n",
    'tools/check-fremd-liste.txt': 'shared/logic.ts\n',
  }
  const mitBewegt = (bewegt, pr) => bewegtesGelesen({ bewegt, pr, leser: [], lies: (p) => text[p] ?? null, paketSkripte: null })
  pruefe('G1: neuer Test importiert shared/logic.ts, PR ändert sie -> Grund', /shared\/logic\.ts wird von Code genutzt/.test(mitBewegt(['tools/neu-g1.test.mjs'], ['shared/logic.ts'])), mitBewegt(['tools/neu-g1.test.mjs'], ['shared/logic.ts']))
  pruefe('G8: neuer Wächter liest data/dub-confirmed.yaml, PR ändert sie -> Grund', /data\/dub-confirmed\.yaml wird von Code genutzt/.test(mitBewegt(['pipeline/check-neu-g8.ts'], ['data/dub-confirmed.yaml'])), mitBewegt(['pipeline/check-neu-g8.ts'], ['data/dub-confirmed.yaml']))
  pruefe('G13: neuer Wächter importiert pipeline/lib/adn.ts, PR ändert sie -> Grund', /pipeline\/lib\/adn\.ts wird von Code genutzt/.test(mitBewegt(['pipeline/check-neu-g13.ts'], ['pipeline/lib/adn.ts'])), mitBewegt(['pipeline/check-neu-g13.ts'], ['pipeline/lib/adn.ts']))
  pruefe('bewegter Code ohne Bezug zum PR-Code -> null', mitBewegt(['tools/neu-g1.test.mjs'], ['tools/nachbar.mjs']) === null)
  pruefe('bewegte -liste.txt startet keine Hülle -> null', mitBewegt(['tools/check-fremd-liste.txt'], ['shared/logic.ts']) === null)
}

// Importketten: beliebig tief, kein Zweifel durch Größe
const kette = (n) => (p) => {
  const m = /^tools\/k(\d+)\.mjs$/.exec(p)
  if (m === null) return null
  return Number(m[1]) + 1 < n ? `import './k${Number(m[1]) + 1}.mjs'\n` : 'export {}\n'
}
pruefe('Importkette über 300 Dateien bis zum Leser -> Grund', /ruft tools\/k299\.mjs auf/.test(bewegtesGelesen({ bewegt: [F], pr: ['tools/k0.mjs'], leser: ['tools/k299.mjs'], lies: kette(300), paketSkripte: null })))
pruefe('Importkette über 300 Dateien ohne Leser -> null', bewegtesGelesen({ bewegt: [F], pr: ['tools/k0.mjs'], leser: ['tools/fern.mjs'], lies: kette(300), paketSkripte: null }) === null)
// Rückrichtung nur eine Stufe, und nie von Werkzeugen unter tools/ aus (PR 3341: workflows-beleg.mjs nennt crunchyroll-neu.json in einer Ausnahmeliste)
pruefe('Rückrichtung: Leser importiert die PR-Datei selbst -> Grund', /pipeline\/k1\.ts wird von Code genutzt/.test(bewegtesGelesen({ bewegt: [F], pr: ['pipeline/k1.ts'], leser: ['pipeline/k0.ts'], lies: (p) => (p === 'pipeline/k0.ts' ? "import './k1.ts'\n" : null), paketSkripte: null })))
const IMPORTKETTE = (p) => ({ 'pipeline/k0.ts': "import './k1.ts'\n", 'pipeline/k1.ts': "import './k2.ts'\n", 'pipeline/k2.ts': "import './k3.ts'\n" })[p] ?? null
pruefe('Rückrichtung: PR-Datei über zwei Importe vom Leser aus -> Grund', /pipeline\/k2\.ts wird von Code genutzt/.test(bewegtesGelesen({ bewegt: [F], pr: ['pipeline/k2.ts'], leser: ['pipeline/k0.ts'], lies: IMPORTKETTE, paketSkripte: null })))
pruefe('Rückrichtung: PR-Datei erst über drei Importe vom Leser aus -> null', bewegtesGelesen({ bewegt: [F], pr: ['pipeline/k3.ts'], leser: ['pipeline/k0.ts'], lies: IMPORTKETTE, paketSkripte: null }) === null)
pruefe('Rückrichtung: Leser unter tools/ importiert die PR-Datei -> null', bewegtesGelesen({ bewegt: [F], pr: ['tools/k1.mjs'], leser: ['tools/k0.mjs'], lies: kette(2), paketSkripte: null }) === null)

// Ausführungslisten: Inhalt zählt als Aufruf, die Liste selbst nutzt kein Leser (Anlass: PR 2099 änderte tools/check-logic-liste.txt)
{
  const LISTE = 'tools/check-logic-liste.txt'
  const nenntListe = { ...BAUM, 'tools/check-logic-alle.mjs': `const liste = '${LISTE}'\nconst d = '${F}'\n` }
  const g = (listenText, leser) => bewegtesGelesen({ bewegt: [F], pr: [LISTE], leser, lies: (p) => (p === LISTE ? listenText : nenntListe[p] ?? null), paketSkripte: null })
  pruefe('Liste mit unbeteiligten Prüfungen, obwohl ein Leser die Liste nennt -> null', g('# Kopf\npipeline/check-x.ts\n', ['tools/check-logic-alle.mjs']) === null, g('# Kopf\npipeline/check-x.ts\n', ['tools/check-logic-alle.mjs']))
  pruefe('Liste nimmt eine Prüfung auf, die der Leser ist -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(g('# Kopf\npipeline/bau/cr.ts\n', LESER)), g('# Kopf\npipeline/bau/cr.ts\n', LESER))
  pruefe('Liste: Kommentarzeile mit dem Leser zählt nicht', g('# pipeline/bau/cr.ts\n', LESER) === null)
  // Nur neu aufgenommene Einträge laufen neu: der Leser steht schon auf main -> null; ein zweiter, neuer Eintrag ohne Leser ändert daran nichts
  const mitMain = (kopfText, mainText) => bewegtesGelesen({ bewegt: [F], pr: [LISTE], leser: LESER, lies: (p) => (p === LISTE ? kopfText : lies(p)), liesMain: (p) => (p === LISTE ? mainText : null), paketSkripte: null })
  pruefe('Liste: Leser stand schon auf main, neuer Eintrag ohne Leser -> null', mitMain('pipeline/bau/cr.ts\npipeline/check-x.ts\n', 'pipeline/bau/cr.ts\n') === null, mitMain('pipeline/bau/cr.ts\npipeline/check-x.ts\n', 'pipeline/bau/cr.ts\n'))
  pruefe('Liste: Leser neu neben altem Eintrag -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(mitMain('pipeline/check-x.ts\npipeline/bau/cr.ts\n', 'pipeline/check-x.ts\n')))
  pruefe('Liste: Eintrag entfernt -> null', mitMain('pipeline/check-x.ts\n', 'pipeline/check-x.ts\npipeline/bau/cr.ts\n') === null)
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
// Datenkanal (Auflage A1/A3 des CI-Prüfers): ein PR mit Datenänderung, die der Bau mit der bewegten Datei zusammen liest, bleibt veraltet,
// auch wenn sein Code sie nicht nennt. Handbelege, kuratierte Daten und Sammlerdaten, je einzeln; ohne Leser der bewegten Datei gilt er nicht.
// Der Grund nennt Leser und die bewegte Datei, die dieser Leser nennt (11.11.2026); ist sein Text nicht lesbar, die erste bewegte.
const leserEnde = (pfad, bewegt = F) => new RegExp(`\\(Leser: ${pfad.replace(/[./]/g, '\\$&')}, nennt ${bewegt.replace(/[./]/g, '\\$&')}\\)$`)
for (const daten of ['data/curated/tv-2026.yaml', 'data/dub-confirmed.yaml', 'data/anbieter-staffeln.json', 'data/curated/ordner/tief/a.yaml']) {
  const g = grund(['tools/nachbar.mjs', daten])
  pruefe(`PR ändert ${daten}, Leser der bewegten Datei vorhanden -> Grund`, /^der PR ändert .*, das der Bau mit den bewegten Dateien zusammen liest /.test(g) && leserEnde('pipeline/bau/cr.ts').test(g) && g.includes(daten), g)
  pruefe(`PR ändert ${daten}, kein Leser der bewegten Datei -> null`, grund(['tools/nachbar.mjs', daten], { leser: [] }) === null)
}
// PR 3474: bewegt waren nur ein Test und ein Workflow, der PR ändert Daten -> kein Bau liest sie mit der bewegten Datei zusammen.
const NICHT_BAU = ['tools/mutationsprobe-workflow.test.mjs', '.github/workflows/mutationsprobe.yml', '.github/actions/herkunft-holen/action.yml', 'pipeline/check-x.test.ts']
pruefe('PR 3474: PR ändert data/…yaml, Leser nur Test und Workflow -> null', grund(['tools/nachbar.mjs', 'data/folgentitel-hand.yaml'], { leser: NICHT_BAU }) === null, grund(['tools/nachbar.mjs', 'data/folgentitel-hand.yaml'], { leser: NICHT_BAU }))
pruefe('PR 3474 Gegenprobe: ein Bau-Leser unter den Lesern bleibt Grund', leserEnde('tools/check-x.ts').test(grund(['tools/nachbar.mjs', 'data/folgentitel-hand.yaml'], { leser: [...NICHT_BAU, 'tools/check-x.ts'] })))
pruefe('PR 3474 Gegenprobe: shared/-Leser bleibt Grund', leserEnde('shared/l.ts').test(grund(['tools/nachbar.mjs', 'data/folgentitel-hand.yaml'], { leser: ['shared/l.ts'] })))
// Prüfer 3486 R1 (Befund 2): Generatoren und Sammler unter tools/, web/, worker/, extension/ lesen Daten wirklich und bleiben Leser.
for (const leser of ['tools/gen.mjs', 'web/src/lib/daten.ts', 'worker/src/feed.ts', 'extension/melder.js']) {
  pruefe(`PR ändert Handdatei, einziger Leser ${leser} -> Grund`, leserEnde(leser).test(grund(['tools/nachbar.mjs', 'data/folgentitel-hand.yaml'], { leser: [...NICHT_BAU, leser] })))
}
// Prüfer 3486 (Hinweis): die Meldung nennt den Bau-Kern vor Werkzeug und Workflow, auch wenn der andere in der Liste vorn steht.
pruefe('Meldung Datenkanal: Bau-Leser vor Werkzeug-Leser', /\(Leser: pipeline\/bau\/cr\.ts, tools\/gen\.mjs, nennt /.test(grund(['tools/nachbar.mjs', 'data/folgentitel-hand.yaml'], { leser: ['tools/gen.mjs', 'pipeline/bau/cr.ts'] })))
pruefe('Meldung Datenkanal: Bau-Leser vor Workflow-Leser', /\(Leser: tools\/check-x\.ts, tools\/gen\.mjs, nennt /.test(grund(['tools/nachbar.mjs', 'data/folgentitel-hand.yaml'], { leser: ['.github/workflows/pr-pruefer.yml', 'tools/gen.mjs', 'tools/check-x.ts'] })))
// PR 3490/3474 (11.11.2026): bewegt waren bauer.md und die Bot-Datei; der Bau-Leser nennt nur die Bot-Datei, der PR ändert nur Handdaten -> null.
const BAUER = '.claude/agents/bauer.md'
const ADN = ['data/adn-staffelzuordnung.yaml']
pruefe('PR 3490: Bot-Datei bewegt, Leser nennt nur sie -> null', bewegtesGelesen({ bewegt: [BAUER, F], pr: ADN, leser: LESER, lies, paketSkripte: null, botBewegt: [F] }) === null)
pruefe('PR 3490 Kontrolle: ohne botBewegt derselbe Fall -> Grund (nennt F)', leserEnde('pipeline/bau/cr.ts').test(bewegtesGelesen({ bewegt: [BAUER, F], pr: ADN, leser: LESER, lies, paketSkripte: null })))
// Gegenfall: bewegter Code mit Leser bleibt Grund, auch wenn zugleich eine Bot-Datei bewegt ist; der Grund nennt die Datei dieses Lesers, nicht die erste.
const CODE = 'pipeline/lib/neu.ts'
const texte = { ...BAUM, 'pipeline/bau/b.ts': "import { n } from '../lib/neu'\n// pipeline/lib/neu.ts\nconst pfad = 'pipeline/lib/neu.ts'\n" }
const gemischt = bewegtesGelesen({ bewegt: [F, CODE], pr: ADN, leser: ['pipeline/bau/cr.ts', 'pipeline/bau/b.ts'], lies: (p) => texte[p] ?? null, paketSkripte: null, botBewegt: [F] })
pruefe('PR 3490 Gegenfall: bewegter Code mit Leser neben Bot-Datei -> Grund mit dem Leser des Codes', leserEnde('pipeline/bau/b.ts', CODE).test(gemischt), gemischt)
// Leser nennt die zweite bewegte Datei: der Grund nennt sie, nicht die erste (Auftrag Punkt 1).
const zweite = bewegtesGelesen({ bewegt: [BAUER, CODE, F], pr: ADN, leser: ['pipeline/bau/b.ts'], lies: (p) => texte[p] ?? null, paketSkripte: null })
pruefe('Grund nennt die bewegte Datei, die der Leser nennt (zweite, nicht erste)', leserEnde('pipeline/bau/b.ts', CODE).test(zweite), zweite)
// PR 3490: der Bot-Leser erreicht per Import die Handdatei des PR (Rückwärtsweg); mit Bot-Datei als einziger Bewegung kein Grund, mit bewegtem Code schon.
const texteR = { ...BAUM, 'pipeline/bau/cr.ts': `import { a } from '../lib/adn'\nconst d = '${F}'\nconst y = 'data/adn-staffelzuordnung.yaml'\n`, 'pipeline/lib/adn.ts': "const y = 'data/adn-staffelzuordnung.yaml'\n", 'pipeline/lib/neu.ts': "const y = 'data/adn-staffelzuordnung.yaml'\n" }
const rueck = (bewegt, botBewegt, leser) => bewegtesGelesen({ bewegt, pr: [...ADN, 'tools/nachbar.mjs'], leser, lies: (p) => texteR[p] ?? null, paketSkripte: null, botBewegt })
pruefe('PR 3490 Rückwärtsweg: nur Bot-Datei bewegt, Leser importiert die Handdaten -> null', rueck([BAUER, F], [F], LESER) === null, rueck([BAUER, F], [F], LESER))
pruefe('PR 3490 Rückwärtsweg Kontrolle: dieselbe Lage ohne botBewegt -> Grund', rueck([BAUER, F], [], LESER) !== null, rueck([BAUER, F], [], LESER))
pruefe('PR 3490 Rückwärtsweg Gegenfall: bewegter Code erreicht die Handdaten -> Grund, auch mit Bot-Datei', /^data\/adn-staffelzuordnung\.yaml wird von Code genutzt/.test(rueck([F, 'pipeline/lib/neu.ts'], [F], []) ?? ''), rueck([F, 'pipeline/lib/neu.ts'], [F], []))
const codePr = bewegtesGelesen({ bewegt: [F], pr: ['data/anderes.yaml', 'pipeline/lib/adn.ts'], leser: LESER, lies: (p) => texteR[p] ?? null, paketSkripte: null, botBewegt: [F] })
pruefe('PR 3490 Gegenfall: PR ändert Code (keine Handdaten), Leser der Bot-Datei nutzt ihn -> Grund bleibt', /^pipeline\/lib\/adn\.ts wird von Code genutzt/.test(codePr ?? ''), codePr)
pruefe('Meldung Aufruf: Bau-Leser vor Werkzeug-Leser', /^der PR ruft pipeline\/bau\/cr\.ts auf/.test(grund(['.github/workflows/lesend.yml'], { leser: ['tools/cr-vorschau.ts', 'pipeline/bau/cr.ts'] })))
pruefe('PR ändert nur Patch Notes (ohne Leser in der Kette), Leser vorhanden -> null', grund(['data/patchnotes/neu.yaml']) === null)
pruefe('PR ändert Datei außerhalb von data/ mit Datenendung, Leser vorhanden -> null', grund(['tools/daten.json']) === null)
pruefe('PR ändert Namensvetter datax/ (kein Ordner data/), Leser vorhanden -> null', grund(['datax/a.json']) === null)
pruefe('PR ändert eine Datei unter public/og (kein Datenkanal des Baus), Leser vorhanden -> null', grund(['public/og/a.json']) === null)
{
  const gelesen = []
  const spaeh = (p) => {
    gelesen.push(p)
    return lies(p)
  }
  bewegtesGelesen({ bewegt: [F], pr: ['tools/daten.json', 'web/src/a.css', 'tools/nachbar.mjs', 'tools/b.yaml'], leser: LESER, lies: spaeh, paketSkripte: null })
  pruefe('Daten, Stile und Bilder werden nicht gelesen, Skripte und YAML schon', !gelesen.includes('tools/daten.json') && !gelesen.includes('web/src/a.css') && gelesen.includes('tools/nachbar.mjs') && gelesen.includes('tools/b.yaml'), gelesen)
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
pruefe('package.json: Skript nennt nur den Ordner der importierten Datei -> null (kein Ordner-Treffer)', grund(['package.json'], { paketSkripte: 'ls pipeline/lib' }) === null, grund(['package.json'], { paketSkripte: 'ls pipeline/lib' }))
{
  // Der Leser nennt einen Ordner (Token ohne Endung); eine PR-Datei darin hängt mit dem Leser zusammen.
  const ordner = (p) => ({ 'tools/r.mjs': `const d = 'tools/sub'\nconst f = '${F}'\n` })[p] ?? null
  pruefe('Rückrichtung: PR-Datei liegt nur im Ordner, den der Leser nennt -> null (kein Verzeichnis-Treffer)', bewegtesGelesen({ bewegt: [F], pr: ['tools/sub/x.mjs'], leser: ['tools/r.mjs'], lies: ordner, paketSkripte: null }) === null)
}
pruefe('Patch-Notes-YAML, die die Datei nennt, zählt nicht (ohne Leser)', bewegtesGelesen({ bewegt: [F], pr: ['data/patchnotes/neu.yaml'], leser: [], lies: () => `text: ${F}\n`, paketSkripte: null }) === null)
pruefe('package.json: Ordner-Token in geändertem Skript trifft den Leser-Ordner nicht mehr -> null', grund(['package.json'], { paketSkripte: 'ls pipeline/bau' }) === null)

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
  const { git, aufrufe, eingaben } = fakeGit({ main: PR_BAUM, kopf: {} })
  const g = gitLeser(git)([F], ['.github/workflows/bestand.yml', 'docs/x.md', 'web/gross.json', 'tools/anderes.mjs'], REFS)
  pruefe('gitLeser: im Kopf werden nur lesbare PR-Dateien geholt (keine Daten, keine Doku)', eingaben[1] === `${KOPF}:.github/workflows/bestand.yml\n${KOPF}:tools/anderes.mjs\n`, eingaben)
  pruefe('gitLeser: von main alle lesbaren Dateien der Code-Ordner, keine Bilder', eingaben[0].includes(`${MAIN}:tools/anderes.mjs\n`) && !eingaben[0].includes('bild.png') && !eingaben[0].includes('data/x.mjs'), eingaben[0])
  pruefe('gitLeser: Anlassfall (Workflow ohne Leser) -> null', g === null, g)
  pruefe('gitLeser: holt PR-Kopf und main zuerst', aufrufe[0] === `fetch -q origin refs/pull/7/head ${MAIN}`, aufrufe)
  pruefe('gitLeser: Baum von main in den Ordnern des Codes', aufrufe[1] === `ls-tree -r --name-only ${MAIN} -- pipeline shared tools web worker extension .github`, aufrufe)
  pruefe('gitLeser: ein Abruf für main, einer für die PR-Dateien im Kopf, nie je Datei', aufrufe.length === 4 && aufrufe[2] === 'cat-file --batch' && aufrufe[3] === 'cat-file --batch', aufrufe)
}
{
  // Nur lesbare Dateien kommen in den Speicher: Bilder und Dateien außerhalb der Ordner zählen nicht als Leser
  const { git } = fakeGit({ main: { 'tools/bild.png': `${F}\n`, 'data/x.mjs': `${F}\n`, 'tools/anderes.mjs': 'nichts\n' }, kopf: {} })
  pruefe('gitLeser: .png und Ordner außerhalb zählen nicht als Leser', gitLeser(git)([F], ['tools/anderes.mjs', 'tools/bild.png', 'data/x.mjs'], REFS) === null)
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
  const liste = 'tools/check-logic-liste.txt'
  const g = gitLeser(fakeGit({ main: { ...PR_BAUM, [liste]: 'pipeline/bau/cr.ts\n' }, kopf: { [liste]: 'pipeline/bau/cr.ts\npipeline/check-neu.ts\n' } }).git)([F], [liste], REFS)
  pruefe('gitLeser: Liste mit neuem Eintrag, der Leser stand schon auf main -> null', g === null, g)
  const g2 = gitLeser(fakeGit({ main: { ...PR_BAUM, [liste]: 'pipeline/check-x.ts\n' }, kopf: { [liste]: 'pipeline/check-x.ts\npipeline/bau/cr.ts\n' } }).git)([F], [liste], REFS)
  pruefe('gitLeser: Liste nimmt den Leser neu auf -> Grund', /ruft pipeline\/bau\/cr\.ts auf/.test(g2), g2)
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

// A2 (Prüfer 2123 R1): PR-Code, der ein Verzeichnis liest oder Namen darunter zusammensetzt, ist Leser jeder bewegten Datei darunter.
{
  const mitText = (text, datei = 'tools/neu.mjs') => grund([datei], { lies: (p) => (p === datei ? text : lies(p)) })
  const ordnerGrund = (text) => /^der PR liest einen Ordner mit data\/crunchyroll-woche\.json \(tools\/neu.mjs\)/.test(mitText(text) ?? '')
  pruefe('Ordner: readdirSync(data/) mit readFileSync(data/ + f) -> Grund', ordnerGrund("for (const f of fs.readdirSync('data/')) fs.readFileSync('data/' + f)\n"), mitText("fs.readdirSync('data/')\nreadFileSync('data/'+f)\n"))
  pruefe('Ordner: Template data/${n}.json ohne readdir -> Grund', ordnerGrund('readFileSync(`data/${n}.json`)\n'), mitText('readFileSync(`data/${n}.json`)\n'))
  pruefe('Ordner: readdirSync(data) als Literal ohne Schrägstrich -> Grund', ordnerGrund("fs.readdirSync('data')\n"), mitText("fs.readdirSync('data')\n"))
  pruefe('Ordner: unter data/ nur anderer Unterordner (data/curated/ + Name) -> null', mitText("readFileSync('data/curated/' + n)\n") === null, mitText("readFileSync('data/curated/' + n)\n"))
  pruefe('Ordner: readdirSync(data/curated) als Literal, Datei liegt darüber -> null', mitText("fs.readdirSync('data/curated')\n") === null)
  pruefe('Ordner: Kommentarzeile mit readdirSync(data/) -> null', mitText("// fs.readdirSync('data/'); readFileSync('data/' + f)\nconst a = 1\n") === null)
  pruefe('Ordner: public/data-Verzeichnis -> null', mitText("fs.readdirSync('public/data/')\nreadFileSync('public/data/' + f)\n") === null, mitText("fs.readdirSync('public/data/')\n"))
  pruefe('Ordner: Literal data ohne Verzeichnis-Aufruf (join(root, data)) -> null', mitText("const d = join(root, 'data')\n") === null)
  pruefe('Ordner: mkdirSync(data, { recursive: true }) legt an, liest nicht -> null (Anlass: bestand-cr-termine-schritt.test.mjs aus PR 2043)', mitText("fs.mkdirSync(join(root, 'data'), { recursive: true })\nconst d = 'data'\n") === null)
  pruefe('Ordner: globalThis ist kein glob -> null', mitText("globalThis.x = join(root, 'data')\n") === null)
  pruefe('Ordner: glob(data) und globSync(data/curated) -> Grund bzw. null je nach Lage der bewegten Datei', ordnerGrund("await glob('data')\n") && ordnerGrund("globSync('data')\n") && mitText("globSync('data/curated')\n") === null)
  pruefe('Ordner: Markdown ist kein lesbarer Code -> null', mitText("readFileSync('data/' + f)\n", 'docs/x.md') === null)
  pruefe('ordnerLeser: nur eine Datei unter dem Token, nicht der Token selbst', ordnerLeser("x('data/' + f)\n", ['data/a/b.json']) === 'data/a/b.json' && ordnerLeser("x('data/a.json')\n", ['data/a.json']) === undefined)
  pruefe('ordnerLeser: Ordnername als Namensanfang (data/a gegen data/ab.json) -> kein Treffer', ordnerLeser("fs.readdirSync('data/a')\n", ['data/ab.json']) === undefined && ordnerLeser("fs.readdirSync('data/a')\n", ['data/a/b.json']) === 'data/a/b.json')
  // PR 3367/3282 (11.11.2026): Zeilen wörtlich aus tools/sammler-pruefschritt-waechter.mjs und tools/logik-beleg.test.mjs; bewegt: die Ausführungsliste.
  const LISTE_TXT = 'tools/check-logic-liste.txt'
  const SAMMLER = "const skripte = Object.fromEntries(readdirSync(join(wurzel, 'tools')).filter((f) => f.endsWith('.sh')).map((f) => [f, lies(`tools/${f}`)]))\n"
  const YAMLS = "const yamls = (ordner) => readdirSync(join(wurzel, ordner)).filter((f) => /\\.ya?ml$/.test(f))\nconst a = readdirSync('tools')\n"
  const LOGIK = "  zeileOderGrund(r3.ordner, `tools/${n}.mjs`, 'x')\n"
  const TEST_FILTER = "readdirSync('tools').filter((f) => f.endsWith('.test.mjs'))\n"
  pruefe('Ordner 3367: Verzeichnis nur mit Filter .sh -> null, .sh bleibt Grund', ordnerLeser(SAMMLER, [LISTE_TXT]) === undefined && ordnerLeser(SAMMLER, [LISTE_TXT, 'tools/a.sh']) === 'tools/a.sh')
  pruefe('Ordner 3367: Regex-Filter ya?ml -> .txt null, .yml und .yaml bleiben Grund', ordnerLeser(YAMLS, [LISTE_TXT]) === undefined && ordnerLeser(YAMLS, ['tools/a.yml']) === 'tools/a.yml' && ordnerLeser(YAMLS, ['tools/a.yaml']) === 'tools/a.yaml')
  pruefe('Ordner 3367: Namen mit angehängter Endung (`tools/${n}.mjs`) -> .txt null, .mjs Grund', ordnerLeser(LOGIK, [LISTE_TXT]) === undefined && ordnerLeser(LOGIK, ['tools/x.mjs']) === 'tools/x.mjs')
  pruefe('Ordner 3367: readdirSync ohne Filter bleibt Grund', ordnerLeser("readdirSync('tools')\n", [LISTE_TXT]) === LISTE_TXT)
  pruefe('Ordner 3367: Filter auf die Endung der bewegten Datei (.txt) bleibt Grund', ordnerLeser("readdirSync('tools').filter((f) => f.endsWith('.txt'))\n", [LISTE_TXT]) === LISTE_TXT)
  pruefe('Ordner 3367: mehrteilige Endung (.test.mjs) schließt .txt aus, nicht einen Test', ordnerLeser(TEST_FILTER, [LISTE_TXT]) === undefined && ordnerLeser(TEST_FILTER, ['tools/a.test.mjs']) === 'tools/a.test.mjs')
  pruefe('Ordner 3367: Endung steht nur mitten im Namen (a.sh.bak) -> null', ordnerLeser(SAMMLER, ['tools/a.sh.bak']) === undefined)
  pruefe('Ordner 3367: ganze Entscheidung (PR-Skript mit Sammler-Zeile, bewegt die Liste) -> null', bewegtesGelesen({ bewegt: [LISTE_TXT], pr: ['tools/neu.mjs'], leser: [], lies: (p) => (p === 'tools/neu.mjs' ? SAMMLER : null), paketSkripte: null }) === null)
  pruefe('Ordner 3367: ganze Entscheidung ohne Filter -> Grund', /liest einen Ordner mit tools\/check-logic-liste\.txt/.test(bewegtesGelesen({ bewegt: [LISTE_TXT], pr: ['tools/neu.mjs'], leser: [], lies: (p) => (p === 'tools/neu.mjs' ? "readdirSync('tools')\n" : null), paketSkripte: null }) ?? ''))
}

// A3/A4 (Prüfer 2123 R1): leere oder abgelaufene git-Ausgabe ergibt nie „aktuell“.
{
  const leer = gitLeser(fakeGit({ main: {}, kopf: {} }).git)([F], ['tools/neu.mjs'], REFS)
  pruefe('gitLeser: nichts von main gelesen (leere Ladung) -> nicht ermittelbar', /^Leser nicht ermittelbar \(kein Code auf main/.test(leer), leer)
  const optionen = []
  const mit = gitAufrufMit((programm, args, opt) => { optionen.push([programm, args[0], opt.timeout]); return '' })
  mit(['fetch', '-q'])
  mit(['ls-tree', '-r'])
  mit(['cat-file', '--batch'], { input: 'x\n', roh: true })
  pruefe('gitAufruf: jeder Aufruf (fetch, ls-tree, cat-file) setzt das Zeitlimit von 120 s', GIT_TIMEOUT_MS === 120000 && optionen.length === 3 && optionen.every(([p, , t]) => p === 'git' && t === 120000), optionen)
  const abgelaufen = gitLeser(gitAufrufMit(() => { throw Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }) }))([F], ['tools/neu.mjs'], REFS)
  pruefe('gitLeser: Zeitlimit abgelaufen -> nicht ermittelbar', /^Leser nicht ermittelbar \(spawnSync git ETIMEDOUT\)$/.test(abgelaufen), abgelaufen)
}

// Fehlalarm PR 3310: Hooks unter .claude/ laufen nie in der Kette (Ordner-Leser und Namens-Leser dort zählen nicht)
{
  const HOOK_ORDNER = "const fs = require('fs')\nfs.readdirSync('data/')\n"
  const HOOK_NAME = `const d = '${F}'\n`
  const hook = (pfad, text) => bewegtesGelesen({ bewegt: [F], pr: [pfad], leser: LESER, lies: (p) => (p === pfad ? text : lies(p)), paketSkripte: null })
  pruefe('ohneLeser: .claude/ ja, Namensvetter claude/ und tools/.claude nein', ohneLeser('.claude/hooks/a.js') && !ohneLeser('claude/hooks/a.js') && !ohneLeser('tools/.claude/a.js'))
  pruefe('.claude/hooks mit readdir auf data/ -> null', hook('.claude/hooks/agenten-grenze.js', HOOK_ORDNER) === null, hook('.claude/hooks/agenten-grenze.js', HOOK_ORDNER))
  pruefe('.claude/hooks nennt die bewegte Datei -> null', hook('.claude/hooks/a.js', HOOK_NAME) === null, hook('.claude/hooks/a.js', HOOK_NAME))
  pruefe('Gegenprobe: dasselbe readdir in tools/ -> Ordner-Grund', /Verzeichnis nicht eindeutig/.test(hook('tools/sammler.mjs', HOOK_ORDNER)), hook('tools/sammler.mjs', HOOK_ORDNER))
  pruefe('Gegenprobe: dieselbe Nennung in tools/ -> Grund', hook('tools/a.mjs', HOOK_NAME) === `der PR liest ${F} (tools/a.mjs)`, hook('tools/a.mjs', HOOK_NAME))
  const gemischt = bewegtesGelesen({ bewegt: [F], pr: ['.claude/hooks/a.js', 'tools/a.mjs'], leser: LESER, lies: (p) => (p === 'tools/a.mjs' ? HOOK_NAME : lies(p)), paketSkripte: null })
  pruefe('.claude/ zusammen mit echtem Leser im PR -> Grund bleibt', gemischt === `der PR liest ${F} (tools/a.mjs)`, gemischt)
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-leser.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-leser.test: grün')
