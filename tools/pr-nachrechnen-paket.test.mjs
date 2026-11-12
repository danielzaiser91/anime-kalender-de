/**
 * package.json auf main entwertet einen PR nur, wenn die Kette die Änderung wirklich spürt (12.11.2026, Anlass: a07d036d6 änderte nur das
 * Skript `check:extension`, neun PRs ohne `extension/` wurden um 16:41 neu gestartet). Die Skriptwerte unten sind die echten vor und nach
 * a07d036d6 (Struktur wörtlich aus `git show`; fünf Werkzeugnamen durch ext-a bis ext-e ersetzt, weil der Wächter werkzeug-ohne-test jede Nennung als Test wertet). Fälle: reine Regel (`paketGrund`), Verdrahtung über `datenpfadGrund` (der Aufrufer reicht Basis,
 * main und PR-Dateien durch) und der Git-Anschluss (`standardPaket`) mit einer git-Attrappe, die Antworten im Format von `cat-file --batch` liefert.
 */
import { kettenSkripte, paketGrund } from './pr-nachrechnen-paket.mjs'
import { standardPaket } from './pr-nachrechnen-paket-git.mjs'
import { botSprungAusnahme, datenpfadGrund } from './pr-nachrechnen.mjs'

const fehler = []
let faelle = 0
const pruefe = (name, ok, info) => {
  faelle++
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const VORHER = 'node tools/ext-a.cjs && node tools/extension-tests.mjs && node tools/ext-b.cjs && eslint --config extension/eslint.config.mjs extension/*.js && node tools/ext-c.cjs && node tools/ext-d.cjs && node tools/ext-e.mjs'
const NACHHER = 'node tools/ext-a.cjs && node tools/extension-tests.mjs && node tools/ext-b.cjs && eslint --config extension/eslint.config.mjs extension/*.js && tsc --noEmit -p extension/tsconfig.json && node tools/extension-ts-liste-pruefen.mjs && node tools/extension-ts-liste-pruefen.test.mjs && node tools/ext-c.cjs && node tools/ext-d.cjs && node tools/ext-e.mjs'
const pkg = (scripts, extra = {}) => JSON.stringify({ name: 'x', scripts, ...extra })
const KETTE = ['jobs:\n  a:\n    steps:\n      - run: npm run check:extension\n      - run: npm run check:alles\n      - run: npm run build\n']
const BASIS = { 'check:extension': VORHER, 'check:alles': 'npm run check:unter && npm run check:logic', 'check:unter': 'node tools/unter.mjs', 'check:logic': 'tsx tools/check-logic-alle.mjs', 'data:bau': 'tsx pipeline/build.ts', 'check:vor-commit': 'npm run check:extension' }
const BAUM = {
  'tools/extension-tests.mjs': "import '../extension/melder.js'\n",
  'tools/unter.mjs': "import { h } from '../pipeline/lib/helfer.ts'\n",
  'pipeline/lib/helfer.ts': 'export const h = 1\n',
}
const lies = (p) => BAUM[p] ?? null
const urteil = (neuScripts, prDateien, extra = {}) => paketGrund({ alt: pkg(BASIS), neu: pkg({ ...BASIS, ...neuScripts }), prDateien, kettenTexte: KETTE, lies, ...extra })

// Anlass a07d036d6: PR ohne extension/ -> aktuell; Gegenprobe: PR mit extension/*.js -> veraltet.
const ANLASS = { 'check:extension': NACHHER }
for (const pr of [['pipeline/bau/x.ts'], ['web/src/App.tsx', 'data/patchnotes/a.yaml'], ['shared/logic.ts']]) {
  const r = urteil(ANLASS, pr)
  pruefe(`a07d036d6: PR ${pr[0]} -> aktuell`, r === null, r)
}
const g = urteil(ANLASS, ['extension/melder.js'])
pruefe('Gegenprobe: PR berührt extension/melder.js, check:extension geändert -> veraltet', g === 'main bewegte package.json: Skript check:extension läuft in der Kette und trifft extension/melder.js', g)
pruefe('Gegenprobe: PR berührt tools/extension-tests.mjs (Pfad im Skript) -> veraltet', /check:extension.*tools\/extension-tests\.mjs/.test(urteil(ANLASS, ['tools/extension-tests.mjs']) ?? ''))
pruefe('Gegenprobe: PR ändert extension/neu.js, Skript nur mit Konfigurationsordner (tsc -p extension/tsconfig.json) -> veraltet', /extension\/neu\.js/.test(urteil({ 'check:extension': 'tsc --noEmit -p extension/tsconfig.json' }, ['extension/neu.js']) ?? ''))
pruefe('Gegenprobe: Skript mit Glob extension/*.js, PR ändert extension/neu.js -> veraltet', /extension\/neu\.js/.test(urteil({ 'check:extension': 'eslint extension/*.js' }, ['extension/neu.js']) ?? ''))
pruefe('Importhülle: PR ändert Datei, die das Skriptziel importiert -> veraltet', /pipeline\/lib\/helfer\.ts/.test(urteil({ 'check:unter': 'node tools/unter.mjs --noEmit' }, ['pipeline/lib/helfer.ts']) ?? ''))
pruefe('Importhülle: PR ändert fremde Datei -> aktuell', urteil({ 'check:unter': 'node tools/unter.mjs --noEmit' }, ['pipeline/lib/anderes.ts']) === null)
pruefe('Ordner gilt nur für Dateien darunter: PR unter extension-x/ trifft extension/ nicht', urteil({ 'check:extension': 'eslint extension/*.js' }, ['extension-x/a.js']) === null)

// Kette: nur Skripte, die sie ruft (direkt oder über npm run).
pruefe('Skript außerhalb der Kette (data:bau) geändert -> aktuell, auch mit Treffer im Pfad', urteil({ 'data:bau': 'tsx pipeline/build.ts --neu' }, ['pipeline/build.ts']) === null)
pruefe('Skript, das nur ein anderes Skript ruft (check:vor-commit), ist nicht in der Kette -> aktuell', urteil({ 'check:vor-commit': 'npm run check:extension && node tools/x.mjs' }, ['tools/x.mjs']) === null)
pruefe('Skript über npm run erreichbar (check:unter via check:alles) -> veraltet bei Treffer', /check:unter/.test(urteil({ 'check:unter': 'node tools/neu.mjs' }, ['tools/neu.mjs']) ?? ''))
const namen = kettenSkripte(KETTE, BASIS)
pruefe('Kettenmenge: direkt und transitiv, ohne Fremde', ['check:extension', 'check:alles', 'build', 'check:unter', 'check:logic'].every((n) => namen.has(n)) && !namen.has('data:bau') && !namen.has('check:vor-commit') && namen.size === 5, [...namen])
pruefe('Skript, das nur npm run ruft und sich ändert (Reihenfolge) -> aktuell, die Ziele zählen selbst', urteil({ 'check:alles': 'npm run check:logic && npm run check:unter' }, ['tools/neu.mjs']) === null)
pruefe('npm run, dann ; und Nebenbefehl: der Nebenbefehl zählt', /tools\/neu\.mjs/.test(urteil({ 'check:alles': 'npm run check:unter; node tools/neu.mjs' }, ['tools/neu.mjs']) ?? ''))
pruefe('npm run, dann || und Nebenbefehl: der Nebenbefehl zählt', /tools\/neu\.mjs/.test(urteil({ 'check:alles': 'npm run check:unter || node tools/neu.mjs' }, ['tools/neu.mjs']) ?? ''))
pruefe('Kette ruft ein Skript, das es nicht gibt (npm run build) -> kein Absturz, aktuell', urteil({ 'data:bau': 'tsx pipeline/build.ts --neu' }, ['pipeline/build.ts']) === null)
pruefe('npm run mit Nebenbefehl: der Nebenbefehl zählt', /tools\/neu\.mjs/.test(urteil({ 'check:alles': 'npm run check:unter && node tools/neu.mjs' }, ['tools/neu.mjs']) ?? ''))

// Skriptteile ohne Eingrenzung (Prüfer 12.11., A1): Optionen, Verzeichnis-Argumente, Läufer, je &&-Teil.
const MEHR = [...KETTE, '      - run: npm run check:hooks\n      - run: npm run data:validate\n      - run: npm run check:tests-2\n']
const aendere = (alt, neu, prDateien, kette = MEHR) => paketGrund({ alt: pkg({ ...BASIS, ...alt }), neu: pkg({ ...BASIS, ...neu }), prDateien, kettenTexte: kette, lies })
const veraltet = (name, grund, muster) => pruefe(`${name} -> veraltet`, muster.test(grund ?? ''), grund)
const aktuell = (name, grund) => pruefe(`${name} -> aktuell`, grund === null, grund)
const HOOKS = { 'check:hooks': 'eslint web/src && eslint -c eslint.mjs-skripte.config.js pipeline tools' }
veraltet('check:hooks mit --max-warnings 0 und web/src/a.tsx (main-Fall)', aendere(HOOKS, { 'check:hooks': 'eslint --max-warnings 0 web/src && eslint -c eslint.mjs-skripte.config.js pipeline tools' }, ['web/src/a.tsx']), /Skript check:hooks mit Option --max-warnings/)
veraltet('build mit vite build --mode x und web/src/a.tsx (main-Fall)', aendere({ build: 'tsx pipeline/check-teilseiten.ts && vite build' }, { build: 'tsx pipeline/check-teilseiten.ts && vite build --mode x' }, ['web/src/a.tsx']), /Skript build /)
veraltet('data:validate mit --strikt und data/curated/a.yaml (main-Fall)', aendere({ 'data:validate': 'tsx pipeline/validate.ts' }, { 'data:validate': 'tsx pipeline/validate.ts --strikt' }, ['data/curated/a.yaml']), /Skript data:validate mit Option --strikt/)
veraltet('check:tests-2 mit --teil 2/3 und neuer tools/neu.test.mjs (main-Fall)', aendere({ 'check:tests-2': 'node tools/tests-alle.mjs --teil 2/2' }, { 'check:tests-2': 'node tools/tests-alle.mjs --teil 2/3' }, ['tools/neu.test.mjs']), /Skript check:tests-2 mit Läufer tools\/tests-alle\.mjs/)
veraltet('Läufer tests-alle ohne Option', aendere({ 'check:tests-2': 'node tools/unter.mjs' }, { 'check:tests-2': 'node tools/tests-alle.mjs' }, ['tools/neu.test.mjs']), /mit Läufer/)
veraltet('Läufer check-logic-alle ohne Option', aendere({ 'check:tests-2': 'node tools/unter.mjs' }, { 'check:tests-2': 'node tools/check-logic-alle.mjs' }, ['pipeline/check-neu.ts']), /mit Läufer tools\/check-logic-alle\.mjs/)
veraltet('Verzeichnis-Argument web/src trifft web/src/a.tsx', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint web/src' }, ['web/src/a.tsx']), /trifft web\/src\/a\.tsx/)
aktuell('Verzeichnis-Argument web/src: PR-Datei in fremdem Ordner', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint web/src' }, ['worker/a.ts']))
aktuell('Verzeichnis-Argument web/src: Ordner mit gleichem Anfang (web/srcx) trifft nicht', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint web/src' }, ['web/srcx/a.ts']))
veraltet('bloße Wurzelnamen (eslint pipeline tools) treffen tools/neu.mjs', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint pipeline tools' }, ['tools/neu.mjs']), /trifft tools\/neu\.mjs/)
aktuell('bloße Wurzelnamen: PR-Datei in shared/', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint pipeline tools' }, ['shared/a.ts']))
veraltet('Punkt-Argument (eslint .) mit weiterem Pfad', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint . tools/unter.mjs' }, ['worker/a.ts']), /mit Argument \./)
veraltet('ein Teil ohne Pfad (vite build) macht das ganze Skript unklar', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'node tools/unter.mjs && vite build' }, ['worker/a.ts']), /ohne erkennbaren Pfad/)
for (const flag of ['--noEmit', '-p', '--project', '--config', '-c']) {
  const wert = flag === '--noEmit' ? 'tsc --noEmit tools/unter.mjs' : `tsc ${flag} tools/tsconfig.x.json`
  aktuell(`neutrale Option ${flag}: PR-Datei in worker/`, aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': wert }, ['worker/a.ts']))
}
aktuell('neutrale Option --config=Pfad: PR-Datei in worker/', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint --config=extension/eslint.config.mjs' }, ['worker/a.ts']))
veraltet('Konfigurationsdatei eslint.config.mjs gilt für ihren Ordner', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'eslint --config extension/eslint.config.mjs' }, ['extension/neu.js']), /trifft extension\/neu\.js/)
veraltet('Glob in tools/ trifft tools/neu.test.mjs (WURZELN enthält tools)', aendere({ 'check:hooks': 'node tools/unter.mjs' }, { 'check:hooks': 'node tools/*.test.mjs' }, ['tools/neu.test.mjs']), /trifft tools\/neu\.test\.mjs/)

// pre-/post-Hooks, Install-Lebenszyklus, Schreibweisen von npm (Prüfer 12.11., A2/A3).
const HAKEN = [...KETTE, '      - run: npm run check:a\n']
for (const hook of ['precheck:a', 'postcheck:a']) {
  veraltet(`neuer Hook ${hook} eines Kettenskripts, PR trifft seine Datei`, aendere({ 'check:a': 'node tools/unter.mjs' }, { 'check:a': 'node tools/unter.mjs', [hook]: 'node tools/pre.mjs' }, ['tools/pre.mjs'], HAKEN), /Skript (?:pre|post)check:a ist ein Hook/)
  veraltet(`Hook ${hook} gilt kettenweit (PR-Datei fremd)`, aendere({ 'check:a': 'node tools/unter.mjs', [hook]: 'node tools/pre.mjs' }, { 'check:a': 'node tools/unter.mjs', [hook]: 'node tools/pre2.mjs' }, ['worker/a.ts'], HAKEN), /ist ein Hook/)
}
aktuell('Hook eines Skripts außerhalb der Kette (predata:bau)', aendere({}, { 'predata:bau': 'node tools/pre.mjs' }, ['tools/pre.mjs'], HAKEN))
for (const name of ['preinstall', 'install', 'postinstall', 'prepare']) {
  veraltet(`Install-Lebenszyklus ${name} gilt kettenweit`, aendere({}, { [name]: 'node tools/x.mjs' }, ['worker/a.ts'], HAKEN), /Skript .* ist ein Hook/)
}
for (const [kette, name] of [['npm test', 'test'], ['npm start', 'start'], ['npm run --silent check:c', 'check:c'], ['npm --silent run check:c', 'check:c'], ['npm run --if-present check:c', 'check:c'], ['npm run-script check:c', 'check:c'], ['npm --silent test', 'test']]) {
  const r = aendere({ [name]: 'node tools/unter.mjs' }, { [name]: 'node tools/neu.mjs' }, ['tools/neu.mjs'], [`jobs:\n  a:\n    steps:\n      - run: ${kette}\n`])
  veraltet(`Kette ruft \`${kette}\`: geändertes Skript ${name} zählt`, r, new RegExp(`Skript ${name} läuft in der Kette und trifft tools/neu\\.mjs`))
}
const zyklus = kettenSkripte(['npm run a'], { a: 'npm run b', b: 'npm run a' })
pruefe('Zyklus a -> b -> a: Abbruch, beide in der Kette', zyklus.size === 2 && zyklus.has('a') && zyklus.has('b'), [...zyklus])
const mitHook = kettenSkripte(['npm run a'], { a: 'x', prea: 'npm run b', b: 'y', postb: 'z' })
pruefe('Kettenmenge enthält Hooks und deren Ziele', ['a', 'prea', 'b', 'postb'].every((n) => mitHook.has(n)) && mitHook.size === 4, [...mitHook])
veraltet('neues Skript, die Kette ruft es, PR trifft es', aendere({}, { 'check:neu': 'node tools/neu.mjs' }, ['tools/neu.mjs'], [...KETTE, '      - run: npm run check:neu\n']), /Skript check:neu läuft in der Kette und trifft tools\/neu\.mjs/)

// Fail-closed.
const ohnePfad = urteil({ 'check:logic': 'tsc --noEmit -p .' }, ['web/src/a.tsx'])
pruefe('Kettenskript ohne erkennbaren Pfad (tsc --noEmit -p .) -> veraltet', ohnePfad === 'main bewegte package.json: Skript check:logic ohne erkennbaren Pfad', ohnePfad)
pruefe('dasselbe Skript außerhalb der Kette -> aktuell', urteil({ 'data:bau': 'tsc --noEmit -p .' }, ['web/src/a.tsx']) === null)
pruefe('package.json auf main nicht lesbar -> veraltet', /nicht vergleichbar/.test(paketGrund({ alt: pkg(BASIS), neu: '{kaputt', prDateien: ['a.ts'], kettenTexte: KETTE, lies }) ?? ''))
pruefe('package.json auf der Basis fehlt -> veraltet', /nicht vergleichbar/.test(paketGrund({ alt: null, neu: pkg(BASIS), prDateien: ['a.ts'], kettenTexte: KETTE, lies }) ?? ''))
pruefe('Kettendateien nicht gelesen -> veraltet', /nicht gelesen/.test(urteil(ANLASS, ['pipeline/bau/x.ts'], { kettenTexte: [] }) ?? ''))

// Felder außer scripts bleiben kettenweit.
for (const [feld, wert] of [['dependencies', { zod: '1' }], ['devDependencies', { tsx: '9' }], ['overrides', { a: '1' }], ['engines', { node: '24' }]]) {
  const r = paketGrund({ alt: pkg(BASIS), neu: pkg(BASIS, { [feld]: wert }), prDateien: ['pipeline/bau/x.ts'], kettenTexte: KETTE, lies })
  pruefe(`${feld} geändert -> veraltet`, r === `main bewegte package.json (${feld})`, r)
}
for (const feld of ['overrides', 'dependencies']) {
  const r = paketGrund({ alt: pkg(BASIS, { [feld]: { a: '1' } }), neu: pkg(BASIS), prDateien: ['pipeline/bau/x.ts'], kettenTexte: KETTE, lies })
  pruefe(`${feld} entfernt -> veraltet`, r === `main bewegte package.json (${feld})`, r)
}
pruefe('Delta 0: gleiche package.json -> aktuell', urteil({}, ['extension/melder.js']) === null)
pruefe('Skript entfernt (Kette ruft es nicht mehr) -> aktuell', paketGrund({ alt: pkg(BASIS), neu: pkg({ ...BASIS, 'data:bau': undefined }), prDateien: ['pipeline/build.ts'], kettenTexte: KETTE, lies }) === null)

// Verdrahtung: botSprungAusnahme und datenpfadGrund.
const vergleich = (dateien) => ({ status: 'ahead', anzahl: dateien.length, dateien, commitsGesamt: 1, autoren: ['danielzaiser91'], vollstaendig: true })
const stumm = () => null
const ohne = botSprungAusnahme(vergleich(['package.json']), ['pipeline/bau/x.ts'], stumm, () => null, () => null)
pruefe('botSprungAusnahme: package.json bewegt, Paket-Urteil null -> Ausnahme', ohne === null, ohne)
const mit = botSprungAusnahme(vergleich(['.claude/agents/bauer.md', 'package.json']), ['pipeline/bau/x.ts'], stumm, () => null, () => 'main bewegte package.json: Skript s trifft x')
pruefe('botSprungAusnahme: Paket-Urteil Grund -> Grund', mit === 'main bewegte package.json: Skript s trifft x', mit)
const standard = botSprungAusnahme(vergleich(['package.json']), ['pipeline/bau/x.ts'], stumm)
pruefe('botSprungAusnahme: ohne Paket-Rückruf gilt fail-closed', standard !== null && /package\.json/.test(standard), standard)
let gesehen = null
const zusammen = botSprungAusnahme(vergleich(['package.json', 'data/dub-confirmed.yaml']), ['pipeline/bau/x.ts'], (bewegt) => { gesehen = bewegt; return null }, () => null, () => null)
pruefe('package.json geht nicht als Datei an die Leser-Regel', zusammen === null && !gesehen.includes('package.json') && gesehen.includes('data/dub-confirmed.yaml'), gesehen)
const lock = botSprungAusnahme(vergleich(['package-lock.json']), ['pipeline/bau/x.ts'], stumm, () => null, () => null)
pruefe('package-lock.json bleibt kettenweit', lock === 'main bewegte package-lock.json', lock)

const ghFuer = (dateien, prDateien) => (args) => (args[1].includes('/compare/') ? JSON.stringify({ status: 'ahead', anzahl: dateien.length, dateien, commitsGesamt: 1, autoren: ['danielzaiser91'] }) : prDateien.join('\n'))
const gr = (dateien, prDateien, paket) => datenpfadGrund(ghFuer(dateien, prDateien), { number: 5, headRefOid: 'k' }, 'basis', 'main', stumm, () => ({ fehler: 'x' }), () => ({ fehler: 'x' }), () => 'Umfang', paket)
let uebergeben = null
const v = gr(['package.json'], ['extension/melder.js'], (refs, dateien) => { uebergeben = { refs, dateien }; return null })
pruefe('datenpfadGrund reicht Nummer, Kopf, main, Basis und die PR-Dateien an den Paket-Rückruf', v.ausnahme !== undefined && uebergeben.refs.nummer === 5 && uebergeben.refs.kopf === 'k' && uebergeben.refs.main === 'main' && uebergeben.refs.basis === 'basis' && uebergeben.dateien[0] === 'extension/melder.js', uebergeben)
const w = gr(['.claude/agents/bauer.md', 'package.json'], ['extension/melder.js'], () => 'main bewegte package.json: Skript check:extension läuft in der Kette und trifft extension/melder.js')
pruefe('datenpfadGrund: Grund steht allein, ohne .claude-Vorspann (16:41)', w.grund === 'main bewegte package.json: Skript check:extension läuft in der Kette und trifft extension/melder.js', w)

// Git-Anschluss mit Attrappe (Format von cat-file --batch).
const staende = { basis: { 'package.json': pkg(BASIS) }, main: { 'package.json': pkg({ ...BASIS, ...ANLASS }), '.github/workflows/pr-pruefung.yml': KETTE[0], ...BAUM } }
const blob = (z, text) => (text === undefined ? Buffer.from(`${z} missing\n`) : Buffer.concat([Buffer.from(`abc blob ${Buffer.byteLength(text)}\n`), Buffer.from(text), Buffer.from('\n')]))
function fakeGit({ werfe = false } = {}) {
  const aufrufe = []
  const git = (args, { input } = {}) => {
    aufrufe.push(args.join(' '))
    if (werfe) throw new Error('kein Netz\nzweite Zeile')
    if (args[0] === 'fetch') return Buffer.from('')
    if (args[0] === 'ls-tree') return Object.keys(staende.main).join('\n')
    return Buffer.concat(String(input).split('\n').filter(Boolean).map((z) => blob(z, (z.startsWith('M:') ? staende.main : staende.basis)[z.slice(2)])))
  }
  return { git, aufrufe }
}
const REFS = { nummer: 5, kopf: 'K', main: 'M', basis: 'B' }
const mitGit = (pr, kulisse = fakeGit()) => standardPaket(REFS, pr, kulisse.git)
const gOhne = mitGit(['pipeline/bau/x.ts'])
pruefe('Git-Anschluss, Anlassfall a07d036d6: PR ohne extension/ -> aktuell', gOhne === null, gOhne)
const gMit = mitGit(['extension/melder.js'])
pruefe('Git-Anschluss, Gegenprobe: PR berührt extension/ -> veraltet', /Skript check:extension .* trifft extension\/melder\.js/.test(gMit ?? ''), gMit)
const nurNeu = mitGit(['tools/extension-ts-liste-pruefen.mjs'])
pruefe('Git-Anschluss: Pfad nur im neuen Skriptwert (main), nicht im alten (Basis) trifft -> alt und neu nicht vertauscht', /extension-ts-liste-pruefen\.mjs/.test(nurNeu ?? ''), nurNeu)
const k = fakeGit()
mitGit(['pipeline/bau/x.ts'], k)
pruefe('Git-Anschluss: holt Kopf, main und Basis in einem fetch', k.aufrufe[0] === 'fetch -q origin refs/pull/5/head M B', k.aufrufe)
const kaputt = standardPaket(REFS, ['a.ts'], fakeGit({ werfe: true }).git)
pruefe('Git-Anschluss: git scheitert -> veraltet mit Ursache (erste Zeile)', kaputt === 'main bewegte package.json (nicht ermittelbar: kein Netz)', kaputt)

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-paket.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log(`pr-nachrechnen-paket.test: grün (${faelle} Fälle: Anlass a07d036d6 aktuell, Gegenprobe extension/ veraltet, Kettenmenge, fail-closed, Felder, Verdrahtung, Git-Anschluss)`)
