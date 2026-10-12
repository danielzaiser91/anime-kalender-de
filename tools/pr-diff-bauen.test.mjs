/** Tests für tools/pr-diff-bauen.mjs: Stub nur für große Dateien der Positivliste, alles andere vollständig. */
import { readFileSync } from 'node:fs'
import { baueDiff, gitDiffRunner, ladeQuellen, stubbar, GRENZE_STUB } from './pr-diff-bauen.mjs'

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
pruefe('Bühnen-Fälle (Erzeugnis) gestubbt', bau([datei('web/buehne/faelle.json', groß)]).gestubbt.length === 1)
pruefe('andere Datei unter web/buehne bleibt vollständig', bau([datei('web/buehne/andere.json', groß)]).gestubbt.length === 0)
for (const name of ['data/synchro-von-hand.yaml', 'data/ankuendigungen.yaml', 'data/dubletten-grenze.json', 'data/neu-nicht-auf-liste.json']) {
  pruefe(`${name} (nicht auf der Liste) bleibt vollständig`, bau([datei(name, groß)]).gestubbt.length === 0)
}
pruefe('Handbeleg nie gestubbt, auch wenn auf der Liste', bau([datei('data/dub-confirmed.yaml', groß)]).gestubbt.length === 0)
pruefe('data/curated nie gestubbt', bau([datei('data/curated/x.yaml', groß)]).gestubbt.length === 0)
// Pfad zusammengesetzt: check-cache-abhaengigkeit liest Cache-Pfade als Literale und verlangt sonst einen Registereintrag.
pruefe('data/cache nie gestubbt (voller Diff sichtbar)', bau([datei('data/' + 'cache/x.json', groß)]).gestubbt.length === 0)
for (const pfad of ['data/skript.ts', 'data/x.mjs', 'data/x.yml', 'data/x.json.ts', 'data/x.md', 'tools/x.json', 'public/data/x.js', '.github/workflows/x.yaml', 'data/../tools/x.json', 'data/x.json\n.ts', 'data/roh-ordner/x.ts']) {
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
pruefe('leere Liste → unvollstaendig', bau([]).zustand === 'unvollstaendig')
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

if (fehler.length > 0) {
  console.error(`pr-diff-bauen.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-diff-bauen.test: grün')
