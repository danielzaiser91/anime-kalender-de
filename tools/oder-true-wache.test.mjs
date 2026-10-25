import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bewerte, findeOderTrue, laufTexte, pruefe, zaehleArten } from './oder-true-wache.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const texte = (s) => findeOderTrue(s).map((t) => t.text)

// Positiv: jede Schreibweise des Verschluckers
assert.deepEqual(texte('npx tsx pipeline/x.ts || true'), ['npx tsx pipeline/x.ts || true'])
assert.equal(texte('a ||true').length, 1, 'ohne Leerzeichen')
assert.equal(texte('a || :').length, 1, '|| :')
assert.equal(texte('a; true').length, 1, '; true')
assert.equal(texte('a ;true;').length, 1, ';true;')
assert.equal(texte('a || /bin/true').length, 1, '/bin/true')
assert.equal(texte('a || /usr/bin/true').length, 1, '/usr/bin/true')
assert.equal(texte('x\n\n  b ||   true\n').length, 1, 'Leerzeichen und Folgezeile')
assert.deepEqual(findeOderTrue('x\ny || true\nz'), [{ zeile: 2, text: 'y || true', art: '|| true' }], 'Zeilennummer')

// Positiv: || exit 0 und set +e
const art = (s) => findeOderTrue(s).map((t) => t.art)
assert.deepEqual(art('cd x || exit 0'), ['|| exit 0'])
assert.deepEqual(art('cd x ||exit   0'), ['|| exit 0'], 'Leerzeichen')
assert.deepEqual(art('[ -z "$a" ] || exit 0;'), ['|| exit 0'], 'Semikolon danach')
assert.deepEqual(art('set +e'), ['set +e'])
assert.deepEqual(art('  set +e  '), ['set +e'], 'eingerückt')
assert.deepEqual(art('set +eu'), ['set +e'], 'gebündelte Schalter')
assert.deepEqual(art('set +ex'), ['set +e'], 'Schalter vor und nach e')
assert.deepEqual(art('set +o errexit'), ['set +e'], 'errexit')
assert.deepEqual(art('a && set +e'), ['set +e'], 'nach &&')
assert.deepEqual(art('x; set +e; y'), ['set +e'], 'nach Semikolon')
assert.deepEqual(art('( set +e; y )'), ['set +e'], 'in Klammer')
assert.deepEqual(art('a || true || exit 0'), ['|| true'], 'eine Zeile, ein Treffer')

// Negativ: Grenzfälle
assert.equal(texte('exit 0').length, 0, 'exit 0 ohne ||')
assert.equal(texte('  exit 0').length, 0, 'eingerückt, ohne ||')
assert.equal(texte('if [ -z "$T" ]; then exit 0; fi').length, 0, 'exit 0 im then')
assert.equal(texte('a && exit 0').length, 0, '&& exit 0 verschluckt nichts')
assert.equal(texte('a || exit 1').length, 0, '|| exit 1')
assert.equal(texte('a || exit 00').length, 0, 'exit 00 ist kein Muster')
assert.equal(texte('a || exit 0x').length, 0, 'exit 0x')
assert.equal(texte('# set +e').length, 0, 'set +e im Kommentar')
assert.equal(texte('# a || exit 0').length, 0, '|| exit 0 im Kommentar')
assert.equal(texte('set -e').length, 0, 'set -e')
assert.equal(texte('set +u').length, 0, 'set +u hat kein e')
assert.equal(texte('set -euo pipefail').length, 0, 'set -euo')
assert.equal(texte('set +o pipefail').length, 0, 'set +o pipefail')
assert.equal(texte('echo "set +e"').length, 0, 'set +e als Text')
assert.equal(texte('reset +e').length, 0, 'reset ist kein set')
assert.equal(texte('offset +e').length, 0, 'offset ist kein set')
assert.equal(texte('set +e2').length, 0, 'set +e2 (Wortzeichen dahinter)')
assert.equal(texte('a || exit0').length, 0, 'exit0 ist ein anderes Kommando')
assert.equal(texte('set+e').length, 0, 'set+e ist ein anderes Kommando')
assert.equal(texte('set +oerrexit').length, 0, 'set +oerrexit ist ungültig')
assert.deepEqual(art('a || set +e'), ['set +e'], 'nach ||')
assert.deepEqual(art('set +ue'), ['set +e'], 'e am Ende der Schalter')

// zaehleArten: Zahl je Muster, verschiedene Werte
assert.equal(zaehleArten([{ art: '|| true' }, { art: '|| true' }, { art: '|| true' }, { art: '|| exit 0' }, { art: 'set +e' }, { art: 'set +e' }]), '|| true: 3, || exit 0: 1, set +e: 2')
assert.equal(zaehleArten([]), '|| true: 0, || exit 0: 0, set +e: 0')

// Negativ: gleiche Wörter, kein Verschlucker
assert.equal(texte('# a || true').length, 0, 'Kommentarzeile')
assert.equal(texte('   # a; true').length, 0, 'eingerückter Kommentar')
assert.equal(texte('a || trueish').length, 0, 'Wortanfang true')
assert.equal(texte('a || true_wert').length, 0, 'true_wert')
assert.equal(texte('a || true-ish').length, 0, 'true-ish')
assert.equal(texte('a || :foo').length, 0, ':foo')
assert.equal(texte('a || exit 1').length, 0, 'exit 1')
assert.equal(texte('a && true').length, 0, '&& true ist kein Verschlucker')
assert.equal(texte('if [ "$x" = true ]; then').length, 0, 'true als Wert')
assert.equal(texte('').length, 0, 'leer')

// laufTexte: nur run-Blöcke geparster Schritte
const yaml = 'name: x\njobs:\n  a:\n    steps:\n      - uses: foo@v1\n      - run: |\n          echo 1\n          b || true\n  c:\n    steps:\n      - run: echo 2\n'
assert.deepEqual(laufTexte(yaml), ['echo 1\nb || true\n', 'echo 2'])
assert.deepEqual(laufTexte('a: [unclosed'), [], 'kaputtes YAML ist Sache von check-workflows')
assert.deepEqual(laufTexte('name: nur'), [], 'ohne jobs')

// bewerte: Ausnahme gilt nur für Datei und Text; ungenutzte Ausnahme ist verwaist
const funde = [{ datei: 'tools/a.sh', text: 'rm x || true' }, { datei: 'tools/b.sh', text: 'rm x || true' }]
const ausn = [{ datei: 'tools/a.sh', text: 'rm x' }, { datei: 'tools/c.sh', text: 'tot' }]
const r = bewerte(funde, ausn)
assert.deepEqual(r.offen, [funde[1]], 'gleiche Zeile in anderer Datei bleibt offen')
assert.deepEqual(r.verwaist, [ausn[1]])
assert.deepEqual(bewerte([], []), { offen: [], verwaist: [] })

// pruefe an einem Wegwerf-Baum
const wurzel = mkdtempSync(join(tmpdir(), 'oder-true-'))
try {
  mkdirSync(join(wurzel, '.github/workflows'), { recursive: true })
  mkdirSync(join(wurzel, 'tools'))
  writeFileSync(join(wurzel, '.github/workflows/w.yml'), 'name: w\njobs:\n  a:\n    steps:\n      - run: |\n          node tools/sammler.mjs || true\n')
  writeFileSync(join(wurzel, '.github/workflows/v.yaml'), 'name: v\njobs:\n  a:\n    steps:\n      - run: npm run daten || exit 0\n')
  writeFileSync(join(wurzel, 'tools/s.sh'), 'set -e\ntsx pipeline/x.ts || :\n# kommentiert || true\n')
  const meldungen = pruefe(wurzel, [])
  assert.equal(meldungen.length, 3)
  assert.match(meldungen[0], /v\.yaml.*npm run daten \|\| exit 0.*\(\|\| exit 0\)/)
  assert.match(meldungen[1], /w\.yml.*sammler\.mjs \|\| true/)
  assert.match(meldungen[2], /tools\/s\.sh/)
  const erlaubt = [{ datei: '.github/workflows/w.yml', text: 'sammler.mjs || true' }, { datei: 'tools/s.sh', text: 'x.ts || :' }, { datei: '.github/workflows/v.yaml', text: 'npm run daten' }]
  assert.deepEqual(pruefe(wurzel, erlaubt), [])
  assert.equal(pruefe(wurzel, [...erlaubt, { datei: 'tools/s.sh', text: 'gibt es nicht' }]).length, 1, 'verwaiste Ausnahme meldet')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// Verdrahtung: check-workflows.mjs wird mit einem neuen Verschlucker rot und ohne grün (Kopie der Workflows als Welt)
const welt = mkdtempSync(join(tmpdir(), 'oder-true-welt-'))
try {
  const echt = join(tools, '..')
  cpSync(join(echt, '.github/workflows'), join(welt, '.github/workflows'), { recursive: true })
  cpSync(join(echt, 'pipeline'), join(welt, 'pipeline'), { recursive: true })
  cpSync(join(echt, 'tools'), join(welt, 'tools'), { recursive: true, filter: (q) => !q.endsWith('.test.mjs') })
  const fahre = () => spawnSync(process.execPath, [join(tools, 'check-workflows.mjs')], { cwd: welt, encoding: 'utf8', windowsHide: true })
  const gruen = fahre()
  assert.equal(gruen.status, 0, gruen.stderr)
  assert.match(gruen.stdout, /✓ oder-true: (\d+) Ausnahmen, \1 Treffer \(\|\| true: \d+, \|\| exit 0: 3, set \+e: 0\)/)
  writeFileSync(join(welt, 'tools/neu.sh'), 'npx tsx pipeline/sammler.ts || true\n')
  const rot = fahre()
  assert.equal(rot.status, 1, 'neuer Verschlucker macht check-workflows rot')
  assert.match(rot.stderr, /tools\/neu\.sh.*sammler\.ts \|\| true/)
  writeFileSync(join(welt, 'tools/neu.sh'), 'npx tsx pipeline/sammler.ts || exit 0\n')
  const rotExit = fahre()
  assert.equal(rotExit.status, 1, '|| exit 0 macht check-workflows rot')
  assert.match(rotExit.stderr, /tools\/neu\.sh.*\|\| exit 0.*\(\|\| exit 0\)/)
  writeFileSync(join(welt, 'tools/neu.sh'), 'set +e\nnpx tsx pipeline/sammler.ts\n')
  const rotSet = fahre()
  assert.equal(rotSet.status, 1, 'set +e macht check-workflows rot')
  assert.match(rotSet.stderr, /tools\/neu\.sh.*set \+e.*\(set \+e\)/)
} finally {
  rmSync(welt, { recursive: true, force: true })
}

console.log('oder-true-wache: ok (Muster, laufTexte, bewerte, Wegwerf-Baum, Verdrahtung in check-workflows)')
