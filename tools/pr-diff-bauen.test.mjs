/** Tests für tools/pr-diff-bauen.mjs: Stub nur für große Dateien der Positivliste, alles andere vollständig. */
import { readFileSync } from 'node:fs'
import { baueDiff, gitDiffRunner, gitInhaltRunner, istDatenJs, ladeQuellen, stubbar, GRENZE_STUB, GRENZE_GESAMT } from './pr-diff-bauen.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}
const groß = '+' + 'x'.repeat(GRENZE_STUB + 10)
const datei = (filename, patch, extra = {}) => ({ filename, status: 'modified', additions: 3, deletions: 1, patch, ...extra })
// Kleine Liste im Format von tools/quellen-liste.sh: Datei, Ordner, Kommentar, Handbeleg.
const quellen = ladeQuellen('x=1\nQUELLEN=(\n  # Kommentar\n  data/sammler.json\n\n  data/roh-ordner\n  data/dub-confirmed.yaml\n  daniel-zum-abarbeiten/listen/x.md\n)\nrest')
const bau = (dateien) => baueDiff(dateien, quellen)

pruefe('ladeQuellen: nur data/-Einträge, ohne Kommentare', quellen.join(',') === 'data/sammler.json,data/roh-ordner,data/dub-confirmed.yaml')
const echt = ladeQuellen(readFileSync(new URL('./quellen-liste.sh', import.meta.url), 'utf8'))
pruefe('ladeQuellen liest die echte Liste (mit anisearch-sprecher.json)', echt.length > 100 && echt.includes('data/anisearch-sprecher.json'))

const gross = bau([datei('data/sammler.json', groß), datei('pipeline/lib/x.ts', '@@ -1 +1 @@\n-a\n+b')])
pruefe('große Sammler-JSON → Stub, Code vollständig, ok', gross.zustand === 'ok' && gross.gestubbt.length === 1 && gross.diff.includes('+b') && !gross.diff.includes('xxxxx'))
pruefe('Stub-Text nennt Pfad, Byte und Zeilen', gross.diff.includes(`Datendatei data/sammler.json: ${GRENZE_STUB + 11} Byte Diff, +3/−1 Zeilen — nicht gelesen; Inhalt prüfen die CI-Checks (check:quellen, check:logic).`))
pruefe('kleine Sammler-JSON bleibt vollständig', !bau([datei('data/sammler.json', '+klein')]).gestubbt.length)
pruefe('Datei in Ordner der Liste gestubbt', bau([datei('data/roh-ordner/a/b.json', groß)]).gestubbt.length === 1)
pruefe('Ordnername als Präfix ohne Schrägstrich trifft nicht', bau([datei('data/roh-ordner-x.json', groß)]).gestubbt.length === 0)
pruefe('public/data gestubbt', bau([datei('public/data/titles.json', groß)]).gestubbt.length === 1)
pruefe('data/stammdaten gestubbt', bau([datei('data/stammdaten/x.json', groß)]).gestubbt.length === 1)
pruefe('data/stammdaten: kleine Handänderung bleibt lesbar', bau([datei('data/stammdaten/x.json', 'klein')]).gestubbt.length === 0)
pruefe('Bühnen-Fälle (Erzeugnis) gestubbt', bau([datei('web/buehne/faelle.json', groß)]).gestubbt.length === 1)
pruefe('andere Datei unter web/buehne bleibt vollständig', bau([datei('web/buehne/andere.json', groß)]).gestubbt.length === 0)
for (const name of ['data/synchro-von-hand.yaml', 'data/ankuendigungen.yaml', 'data/dubletten-grenze.json', 'data/neu-nicht-auf-liste.json']) {
  pruefe(`${name} (nicht auf der Liste) bleibt vollständig`, bau([datei(name, groß)]).gestubbt.length === 0)
}
pruefe('Handbeleg nie gestubbt, auch wenn auf der Liste', bau([datei('data/dub-confirmed.yaml', groß)]).gestubbt.length === 0)
pruefe('data/curated nie gestubbt', bau([datei('data/curated/x.yaml', groß)]).gestubbt.length === 0)
// Pfad zusammengesetzt: check-cache-abhaengigkeit liest Cache-Pfade als Literale und verlangt sonst einen Registereintrag.
pruefe('data/cache nie gestubbt (voller Diff sichtbar)', bau([datei('data/' + 'cache/x.json', groß)]).gestubbt.length === 0)
for (const pfad of ['data/stammdaten/x.ts', 'data/stammdaten/../cache/x.json', 'data/stammdaten-x/y.json', 'data/stammdaten.json', 'data/stammdaten/a\nb.json', 'data/skript.ts', 'data/x.mjs', 'data/x.yml', 'data/x.json.ts', 'data/x.md', 'tools/x.json', 'public/data/x.js', '.github/workflows/x.yaml', 'data/../tools/x.json', 'data/x.json\n.ts', 'data/roh-ordner/x.ts']) {
  pruefe(`Pfad ${JSON.stringify(pfad)} nie stubbar`, !stubbar(pfad, quellen))
}
const umbruch = bau([datei('data/curated/a\nb.json', groß), datei('data/a\nb.json', groß), datei('data/a\rb.json', groß)])
pruefe('Pfade mit Zeilenumbruch/CR nie gestubbt', umbruch.gestubbt.length === 0)
pruefe('Pfad mit Zeilenumbruch nie unmaskiert im Diff', !umbruch.diff.includes('a\nb.json') && !umbruch.diff.includes('a\rb') && umbruch.diff.includes('data/curated/a\\x0ab.json'))
pruefe('stubbar() lehnt Steuerzeichen ab', !stubbar('data/curated/a\nb.json', quellen) && !stubbar('data/a\u0001b.json', quellen))
const code = bau([datei('pipeline/lib/gross.ts', groß)])
pruefe('großer Code-Diff nie gestubbt (und unter 400000 Byte ok)', code.gestubbt.length === 0 && code.zustand === 'ok')
const ueber = bau([datei('pipeline/lib/a.ts', 'x'.repeat(250000)), datei('pipeline/lib/b.ts', 'y'.repeat(250000))])
pruefe('Rest über 400000 Byte → unvollstaendig, gekürzt', ueber.zustand === 'unvollstaendig' && Buffer.byteLength(ueber.diff) <= 400000)
pruefe('ohne Patch bei Code → unvollstaendig', bau([datei('pipeline/lib/a.ts', undefined)]).zustand === 'unvollstaendig')
const handOhnePatch = bau([datei('data/synchro-von-hand.yaml', undefined)])
pruefe('ohne Patch bei Handdatei (nicht auf der Liste) → unvollstaendig, nicht gestubbt', handOhnePatch.zustand === 'unvollstaendig' && handOhnePatch.gestubbt.length === 0 && handOhnePatch.diff.includes('Diff nicht lieferbar'))
pruefe('ohne Patch bei Sammler-Datei → Stub, ok', bau([datei('data/sammler.json', undefined)]).zustand === 'ok')
pruefe('leere Liste → leer (nicht ok, nicht unvollstaendig)', bau([]).zustand === 'leer')
const umbenannt = (von, nach) => datei(nach, groß, { status: 'renamed', previous_filename: von })
pruefe('Umbenennung web → public/data mit großem Patch nicht gestubbt', bau([umbenannt('web/x.ts', 'public/data/x.json')]).gestubbt.length === 0)
pruefe('Umbenennung Handbeleg → data/stammdaten nicht gestubbt', bau([umbenannt('data/dub-confirmed.yaml', 'data/stammdaten/x.json')]).gestubbt.length === 0)
pruefe('Umbenennung innerhalb public/data bleibt stubbar', bau([umbenannt('public/data/a.json', 'public/data/b.json')]).gestubbt.length === 1)
pruefe('Umbenennung ohne Änderung → ok', bau([datei('a.md', undefined, { status: 'renamed', previous_filename: 'b.md', additions: 0, deletions: 0 })]).zustand === 'ok')

// Git-Rückfall (11.10.2026): fehlt der API-Patch bei einer nicht stubbaren Datei, kommt der Diff aus Git-Objekten.
const hand = datei('data/dub-confirmed.yaml', undefined, { additions: 1230, deletions: 0 })
const gitDiff = 'diff --git a/data/dub-confirmed.yaml b/data/dub-confirmed.yaml\n--- a/data/dub-confirmed.yaml\n+++ b/data/dub-confirmed.yaml\n@@ -1 +1,2 @@\n+neu'
const mitGit = baueDiff([hand], quellen, () => gitDiff)
pruefe('ohne Patch, Git liefert → ok, Git-Diff im Text, nicht gestubbt', mitGit.zustand === 'ok' && mitGit.diff.includes('+neu') && mitGit.gestubbt.length === 0)
pruefe('ohne Patch, Git leer (null) → unvollstaendig (fail closed)', baueDiff([hand], quellen, () => null).zustand === 'unvollstaendig')
pruefe('Git wird bei vorhandenem Patch nicht gefragt', baueDiff([datei('pipeline/lib/a.ts', '+x')], quellen, () => { throw new Error('nicht fragen') }).zustand === 'ok')
pruefe('Positivliste ohne Patch bleibt Stub, Git nicht gefragt', baueDiff([datei('data/sammler.json', undefined)], quellen, () => { throw new Error('nicht fragen') }).gestubbt.length === 1)
pruefe('Pfad mit Steuerzeichen: Git nie gefragt, unvollstaendig', baueDiff([datei('data/a\nb.yaml', undefined)], quellen, () => { throw new Error('nicht fragen') }).zustand === 'unvollstaendig')

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)
const aufrufe = []
const falsch = (befehl, args, opt) => (aufrufe.push({ befehl, args, opt }), { status: 0, stdout: 'diff --git a/x b/x\n+y\n' })
const runner = gitDiffRunner(SHA_A, SHA_B, falsch)
pruefe('Runner liefert stdout ohne letzten Umbruch', runner({ filename: 'data/dub-confirmed.yaml' }) === 'diff --git a/x b/x\n+y')
const args = aufrufe[0].args
pruefe('Runner: git, Pfad als eigenes Argument nach "--", keine Shell', aufrufe[0].befehl === 'git' && args.at(-2) === '--' && args.at(-1) === 'data/dub-confirmed.yaml' && !aufrufe[0].opt.shell)
pruefe('Runner: Basis und Kopf davor, kein ext-diff/textconv', args.includes(SHA_A) && args.indexOf(SHA_B) === args.indexOf(SHA_A) + 1 && args.includes('--no-ext-diff') && args.includes('--no-textconv'))
runner({ filename: 'neu.md', previous_filename: 'alt.md' })
pruefe('Runner: Umbenennung übergibt beide Pfade', aufrufe[1].args.slice(-2).join(',') === 'alt.md,neu.md')
runner({ filename: '--exec=x' })
pruefe('Runner: Pfad mit Bindestrich bleibt hinter "--"', aufrufe[2].args.at(-2) === '--' && aufrufe[2].args.at(-1) === '--exec=x')
pruefe('Runner: Exit ≠ 0 → null', gitDiffRunner(SHA_A, SHA_B, () => ({ status: 128, stdout: '' }))({ filename: 'x' }) === null)
pruefe('Runner: leere Ausgabe → null', gitDiffRunner(SHA_A, SHA_B, () => ({ status: 0, stdout: '\n' }))({ filename: 'x' }) === null)
pruefe('Runner: Fehler beim Start (kein stdout) → null', gitDiffRunner(SHA_A, SHA_B, () => ({ status: null, error: new Error('x') }))({ filename: 'x' }) === null)
pruefe('Runner ohne/mit ungültiger SHA → nie ein Aufruf', gitDiffRunner(undefined, SHA_B, () => { throw new Error('x') })({ filename: 'x' }) === null && gitDiffRunner('--evil', SHA_B, () => { throw new Error('x') })({ filename: 'x' }) === null)

// Daten-JS (13.10.2026): gestubbt nur, wenn die Datei auf der Liste steht UND am Kopf nur aus `globalThis.AK_X = JSON` besteht.
const quellenJs = ladeQuellen('QUELLEN=(\n  data/sammler.json\n  extension/offene-x.js\n  extension/offene-y.js\n)')
pruefe('ladeQuellen: extension/-Einträge der Liste', quellenJs.join(',') === 'data/sammler.json,extension/offene-x.js,extension/offene-y.js')
pruefe('ladeQuellen liest echte extension/offene-*.js', ['amazon', 'disney', 'netflix'].every((n) => echt.includes(`extension/offene-${n}.js`)))
const daten = 'globalThis.AK_OFFENE_X = {"a":{"titel":"Ä","n":[1,2]}}\nglobalThis.AK_OFFENE_X_STAND = "abc"\n'
const jsBau = (pfad, text, extra = {}, liste = quellenJs) => baueDiff([datei(pfad, undefined, extra)], liste, () => null, () => text)
const jsStub = jsBau('extension/offene-x.js', daten)
pruefe('Daten-JS auf der Liste, ohne API-Patch → Stub, ok', jsStub.zustand === 'ok' && jsStub.gestubbt.join() === 'extension/offene-x.js')
pruefe('Daten-JS mit großem Patch → Stub', baueDiff([datei('extension/offene-x.js', groß)], quellenJs, () => null, () => daten).gestubbt.length === 1)
pruefe('Daten-JS mit kleinem Patch bleibt lesbar', baueDiff([datei('extension/offene-x.js', '+klein')], quellenJs, () => null, () => daten).gestubbt.length === 0)
pruefe('Daten-JS: Inhalt wird für kleine Patches nicht geholt', baueDiff([datei('extension/offene-x.js', '+klein')], quellenJs, () => null, () => { throw new Error('nicht fragen') }).zustand === 'ok')
pruefe('Daten-JS: Stub-Text nennt Pfad', jsStub.diff.includes('Datendatei extension/offene-x.js: Diff von GitHub nicht geliefert'))
const keinDatenJs = [
  ['Funktion', 'globalThis.AK_OFFENE_X = {"a":1}\nfunction f() { alert(1) }\n'],
  ['zweite Anweisung in der Zeile', 'globalThis.AK_OFFENE_X = {"a":1}; alert(1)\n'],
  ['abschließendes Semikolon', 'globalThis.AK_OFFENE_X = {"a":1};\n'],
  ['Kommentar mit Code', '// alert(1)\nglobalThis.AK_OFFENE_X = {"a":1}\n'],
  ['Blockkommentar', 'globalThis.AK_OFFENE_X = {"a":1} /* x */\n'],
  ['Wert kein JSON', 'globalThis.AK_OFFENE_X = {a:1}\n'],
  ['Wert ist Aufruf', 'globalThis.AK_OFFENE_X = alert(1)\n'],
  ['andere Zuweisung', 'window.AK_X = {"a":1}\n'],
  ['Name nicht AK_', 'globalThis.evil = {"a":1}\n'],
  ['Code-Global statt Datenliste', 'globalThis.AK_OFFENE_X = {"a":1}\nglobalThis.AK_TAGESLIMIT = null\n'],
  ['Name mit Kleinbuchstaben', 'globalThis.AK_x = {"a":1}\n'],
  ['Zeilenende CR', 'globalThis.AK_OFFENE_X = {"a":1}\r\nalert(1)\n'],
  ['Zeilentrenner U+2028', 'globalThis.AK_OFFENE_X = {"a":1} alert(1)\n'],
  ['leere Zeile mittendrin', 'globalThis.AK_OFFENE_X = {"a":1}\n\nglobalThis.AK_OFFENE_Y = 2\n'],
  ['leere Datei', ''],
]
for (const [name, text] of keinDatenJs) {
  const r = jsBau('extension/offene-x.js', text)
  pruefe(`JS mit ${name} wird nicht gestubbt (ohne Diff → unvollstaendig)`, r.gestubbt.length === 0 && r.zustand === 'unvollstaendig')
}
pruefe('Inhalt nicht lesbar (null) → nicht gestubbt', jsBau('extension/offene-x.js', null).gestubbt.length === 0)
pruefe('Daten-JS nicht auf der Liste → nicht gestubbt', jsBau('extension/offene-z.js', daten).gestubbt.length === 0)
pruefe('Daten-JS auf der Liste, aber andere Liste ohne extension → nicht gestubbt', jsBau('extension/offene-x.js', daten, {}, quellen).gestubbt.length === 0)
pruefe('Daten-JS in anderem Ordner (Listenpfad nur exakt) → nicht gestubbt', jsBau('web/src/offene-x.js', daten).gestubbt.length === 0 && jsBau('extension/unter/offene-x.js', daten).gestubbt.length === 0)
pruefe('Daten-JS gelöscht → nicht gestubbt', jsBau('extension/offene-x.js', daten, { status: 'removed' }).gestubbt.length === 0)
pruefe('Umbenennung von Code-JS nach Daten-JS → nicht gestubbt', jsBau('extension/offene-x.js', daten, { status: 'renamed', previous_filename: 'extension/melder.js' }).gestubbt.length === 0)
pruefe('Umbenennung zwischen Listen-Daten-JS → gestubbt', jsBau('extension/offene-x.js', daten, { status: 'renamed', previous_filename: 'extension/offene-y.js' }).gestubbt.length === 1)
pruefe('istDatenJs: nur Text, kein Objekt', !istDatenJs(undefined) && !istDatenJs({ toString: () => daten }))
const jsAufrufe = []
const jsLauf = (befehl, args, opt) => (jsAufrufe.push({ befehl, args, opt }), { status: 0, stdout: daten })
pruefe('Inhalts-Runner liest den Blob am Kopf ohne Shell', gitInhaltRunner(SHA_B, jsLauf)({ filename: 'extension/offene-x.js' }) === daten && jsAufrufe[0].args.join(' ') === `cat-file blob ${SHA_B}:extension/offene-x.js` && !jsAufrufe[0].opt.shell)
pruefe('Inhalts-Runner: Fehler → null', gitInhaltRunner(SHA_B, () => ({ status: 128, stdout: '' }))({ filename: 'x' }) === null)
pruefe('Inhalts-Runner ohne gültige SHA → nie ein Aufruf', gitInhaltRunner('', () => { throw new Error('x') })({ filename: 'x' }) === null)

// Gesamtgrenze (PR 1944): viele kleine Erzeugnis-Diffs unter GRENZE_STUB reißen GRENZE_GESAMT, Code bleibt vollständig.
const mitGroesse = (n) => '+' + 'y'.repeat(n)
const codeDatei = datei('pipeline/lib/x.ts', '@@ -1 +1 @@\n-a\n+codezeile')
const erzeugnisse = Array.from({ length: 90 }, (_, i) => datei(`public/data/folgen/${i}.json`, mitGroesse(10000)))
const viele = bau([...erzeugnisse, codeDatei])
pruefe('90 × 10 KB Erzeugnisse + Code → ok, Code vollständig', viele.zustand === 'ok' && viele.diff.includes('+codezeile'))
pruefe('Gesamtdiff passt in GRENZE_GESAMT', Buffer.byteLength(viele.diff) <= GRENZE_GESAMT)
pruefe('nicht mehr gestubbt als nötig', viele.gestubbt.length > 40 && viele.gestubbt.length < 60)
pruefe('Stub-Zeile nennt Pfad und +/−', viele.diff.includes('Datendatei public/data/folgen/') && viele.diff.includes('10001 Byte Diff, +3/−1 Zeilen'))
const gemischt = bau([datei('public/data/gross-a.json', mitGroesse(45000)), datei('public/data/gross-b.json', mitGroesse(40000)), ...erzeugnisse.slice(0, 40), codeDatei])
pruefe('größte zuerst gestubbt', gemischt.zustand === 'ok' && gemischt.gestubbt.slice(0, 2).join() === 'public/data/gross-a.json,public/data/gross-b.json' && gemischt.gestubbt.length <= 4)
pruefe('unter der Grenze: nichts zusätzlich gestubbt', bau([...erzeugnisse.slice(0, 30), codeDatei]).gestubbt.length === 0)
const nurCode = Array.from({ length: 12 }, (_, i) => datei(`pipeline/lib/c${i}.ts`, '@@\n' + mitGroesse(40000)))
const codeViel = bau([...nurCode, ...erzeugnisse.slice(0, 5)])
pruefe('Nicht-Stubbares allein über der Grenze → unvollstaendig', codeViel.zustand === 'unvollstaendig' && codeViel.gestubbt.length === 5)
const nie = bau([datei('data/dub-confirmed.yaml', mitGroesse(40000)), datei('data/curated/a.yaml', mitGroesse(40000)), ...Array.from({ length: 20 }, (_, i) => datei(`docs/d${i}.md`, mitGroesse(20000))), ...erzeugnisse.slice(0, 20)])
pruefe('NIE_STUB und Doku bleiben sichtbar, nur Erzeugnisse gestubbt', nie.diff.includes('y'.repeat(40000)) && nie.gestubbt.every((p) => p.startsWith('public/data/')))
// Genau auf der Grenze: nach dem ersten Stub ist der Rest exakt GRENZE_GESAMT, dann wird kein zweiter Stub gesetzt.
const paar = [datei('public/data/rand-a.json', mitGroesse(45000)), datei('public/data/rand-b.json', mitGroesse(44000))]
const mitRest = (n) => bau([...paar, datei('pipeline/lib/rest.ts', mitGroesse(n))])
let [klein, gross2] = [320000, 380000]
while (gross2 - klein > 1) {
  const mitte = Math.floor((klein + gross2) / 2)
  if (mitRest(mitte).gestubbt.length <= 1) klein = mitte
  else gross2 = mitte
}
const rand = mitRest(klein)
pruefe('Rest genau GRENZE_GESAMT: nur der größte gestubbt, ok', rand.gestubbt.join() === 'public/data/rand-a.json' && Buffer.byteLength(rand.diff) === GRENZE_GESAMT && rand.zustand === 'ok')
pruefe('Rest GRENZE_GESAMT + 1: auch der zweite gestubbt', mitRest(klein + 1).gestubbt.length === 2)
// Pfade mit Steuerzeichen werden maskiert, bleiben aber sichtbar und werden nie gestubbt (auch nicht als größte Datei).
const steuerDatei = datei('public/data/a\nb.json', mitGroesse(49000).replace(/y/g, 'q'))
const mitSteuer = bau([steuerDatei, ...erzeugnisse, codeDatei])
pruefe('Pfad mit Steuerzeichen bleibt unter Druck sichtbar', mitSteuer.diff.includes('q'.repeat(49000)) && mitSteuer.gestubbt.every((p) => !p.includes('\\x0a')))

if (fehler.length > 0) {
  console.error(`pr-diff-bauen.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-diff-bauen.test: grün')
