/** Tests für tools/pr-diff-bauen.mjs: Stub nur für große Dateien der Positivliste, alles andere vollständig. */
import { readFileSync } from 'node:fs'
import { baueDiff, ladeQuellen, stubbar, GRENZE_STUB } from './pr-diff-bauen.mjs'

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
for (const name of ['data/synchro-von-hand.yaml', 'data/ankuendigungen.yaml', 'data/dubletten-grenze.json', 'data/neu-nicht-auf-liste.json']) {
  pruefe(`${name} (nicht auf der Liste) bleibt vollständig`, bau([datei(name, groß)]).gestubbt.length === 0)
}
pruefe('Handbeleg nie gestubbt, auch wenn auf der Liste', bau([datei('data/dub-confirmed.yaml', groß)]).gestubbt.length === 0)
pruefe('data/curated nie gestubbt', bau([datei('data/curated/x.yaml', groß)]).gestubbt.length === 0)
pruefe('data/cache nie gestubbt (voller Diff sichtbar)', bau([datei('data/cache/x.json', groß)]).gestubbt.length === 0)
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

if (fehler.length > 0) {
  console.error(`pr-diff-bauen.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-diff-bauen.test: grün')
