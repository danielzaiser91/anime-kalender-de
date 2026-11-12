/**
 * package.json auf main entwertet einen PR nur, wenn die Kette die Änderung wirklich spürt (12.11.2026, Anlass: a07d036d6 änderte nur das
 * Skript `check:extension`, neun PRs ohne `extension/` wurden um 16:41 neu gestartet). Die Skriptwerte unten sind die echten vor und nach
 * a07d036d6 (wörtlich aus `git show`). Fälle: reine Regel (`paketGrund`), Verdrahtung über `datenpfadGrund` (der Aufrufer reicht Basis,
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

const VORHER = 'node tools/extension-laden-pruefen.cjs && node tools/extension-tests.mjs && node tools/amazon-startseite-pruefen.cjs && eslint --config extension/eslint.config.mjs extension/*.js && node tools/extension-listenstand-pruefen.cjs && node tools/melder-leiste-pruefen.cjs && node tools/pruefstand-bekannt-pruefen.mjs'
const NACHHER = 'node tools/extension-laden-pruefen.cjs && node tools/extension-tests.mjs && node tools/amazon-startseite-pruefen.cjs && eslint --config extension/eslint.config.mjs extension/*.js && tsc --noEmit -p extension/tsconfig.json && node tools/extension-ts-liste-pruefen.mjs && node tools/extension-ts-liste-pruefen.test.mjs && node tools/extension-listenstand-pruefen.cjs && node tools/melder-leiste-pruefen.cjs && node tools/pruefstand-bekannt-pruefen.mjs'
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
pruefe('Importhülle: PR ändert Datei, die das Skriptziel importiert -> veraltet', /pipeline\/lib\/helfer\.ts/.test(urteil({ 'check:unter': 'node tools/unter.mjs --neu' }, ['pipeline/lib/helfer.ts']) ?? ''))
pruefe('Importhülle: PR ändert fremde Datei -> aktuell', urteil({ 'check:unter': 'node tools/unter.mjs --neu' }, ['pipeline/lib/anderes.ts']) === null)
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
