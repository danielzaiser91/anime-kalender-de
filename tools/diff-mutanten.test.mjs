/** Tests für tools/diff-mutanten.mjs: Mutanten aus dem Diff, Läuferformat, Überlebende. */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geaenderteZeilen, istCodeDatei, listeAusDiff, mutantenListe, testFuer, ueberlebende } from './diff-mutanten.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}

const alle = (q) => mutantenListe('a.mjs', q, new Set([1]), ['t'])
/** Mutanten einer Zeile als `suche → ersetze`. */
const paare = (q) => alle(q).map((m) => `${m.aenderungen[0].suche} → ${m.aenderungen[0].ersetze}`)
const hat = (q, suche, ersetze) => paare(q).includes(`${suche} → ${ersetze}`)

// Je Mutantenart ein Fall
pruefe('=== wird !==', hat('x = a === b', 'a === b', 'a !== b'))
pruefe('!== wird ===', hat('x = a !== b', 'a !== b', 'a === b'))
pruefe('== wird !=', hat('x = a == b', 'a == b', 'a != b'))
pruefe('!= wird ==', hat('x = a != b', 'a != b', 'a == b'))
pruefe('> wird >= (Grenze) und <=', hat('x = a > b', 'a > b', 'a >= b') && hat('x = a > b', 'a > b', 'a <= b'))
pruefe('>= wird > und <', hat('x = a >= b', 'a >= b', 'a > b') && hat('x = a >= b', 'a >= b', 'a < b'))
pruefe('< wird <= und >=', hat('x = a < b', 'a < b', 'a <= b') && hat('x = a < b', 'a < b', 'a >= b'))
pruefe('<= wird < und >', hat('x = a <= b', 'a <= b', 'a < b') && hat('x = a <= b', 'a <= b', 'a > b'))
pruefe('&& wird ||', hat('x = a && b', 'a && b', 'a || b'))
pruefe('|| wird &&', hat('x = a || b', 'a || b', 'a && b'))
pruefe('?:-Zweige vertauscht', hat('x = c ? 5 : 7', 'c ? 5 : 7', 'c ? 7 : 5'))
pruefe('Zahl ungleich 0 wird 0', hat('f(7)', '7', '0'))
pruefe('Zahl 0 wird 1', hat('f(0)', '0', '1'))
pruefe('Zahl 1 wird 0', hat('f(1)', '1', '0'))
pruefe('Aufruf als Anweisung entfernt', hat('weg(x)', 'weg(x)', 'void 0'))
pruefe('Aufruf mit await entfernt', hat('await weg(x)', 'await weg(x)', 'void 0'))
pruefe('Aufruf im Ausdruck (Rückgabewert genutzt) wird nicht entfernt', !paare('const r = f(x)').some((p) => p.endsWith('void 0')))
pruefe('Argumente getauscht', hat('x = f(a, b)', 'a, b', 'b, a') || hat('x = f(a, b)', 'f(a, b)', 'f(b, a)'))
pruefe('ein Argument: kein Tausch', !alle('x = f(a)').some((m) => m.name.includes('Argumente')))

// Namen je Art (Anzeige in „Überlebt: …“)
const namen = (q, datei = 'a.mjs') => mutantenListe(datei, q, new Set([1])).map((m) => m.name)
pruefe('Name ?:', namen('x = c ? 5 : 7').includes('a.mjs:1 ?: Zweige vertauscht'))
pruefe('Name Zahl', namen('f(7)').includes('a.mjs:1 Zahl 7 → 0') && namen('f(0)').includes('a.mjs:1 Zahl 0 → 1'))
pruefe('Name Aufruf entfernt', namen('weg(x)').includes('a.mjs:1 Aufruf entfernt'))
pruefe('Name Argumente trägt den Aufruf', namen('x = foo(a, b)').includes('a.mjs:1 Argumente getauscht foo'))
pruefe('Gleichstand ?: erzeugt genau einen Mutanten (Zahlen 5 und 7 dazu)', mutantenListe('a.mjs', 'x = c ? y : z', new Set([1])).length === 1)
pruefe('.tsx-Datei mit JSX wird gelesen', mutantenListe('a.tsx', 'const x = <div>{a && b}</div>', new Set([1])).length === 1)
pruefe('gleicher Text auf früherer Zeile zählt nicht mit', mutantenListe('a.mjs', 'f(a && b)\nf(a && b)', new Set([2]))[0].aenderungen[0].nr === undefined)
const drei = mutantenListe('a.mjs', 'x = (a && b) + (a && b) + (a && b)', new Set([1])).filter((m) => m.name.includes('&&'))
pruefe('drei gleiche Ausdrücke: nr 1 (fehlt), 2, 3', drei.length === 3 && drei[2].aenderungen[0].nr === 3)

const amAnfang = mutantenListe('a.mjs', 'a && b', new Set([1])).filter((m) => m.name.includes('&&'))
pruefe('Ausdruck ganz am Dateianfang (Index 0) wird gefunden', amAnfang.length === 1 && amAnfang[0].aenderungen[0].nr === undefined)
const zeile2 = mutantenListe('a.mjs', 'x\nf(a && b) + f(a && b)', new Set([2])).filter((m) => m.name.includes('&&'))
const ab0 = mutantenListe('a.mjs', 'a && b, a && b', new Set([1])).filter((m) => m.name.includes('&&'))
pruefe('erster gleicher Ausdruck bei Index 0 zählt: zweiter trägt nr 2', ab0.length === 2 && ab0[1].aenderungen[0].nr === 2)
pruefe('zwei gleiche Ausdrücke auf Zeile 2: nr 2 am zweiten', zeile2.length === 2 && zeile2[1].aenderungen[0].nr === 2)

// Genauigkeit: nichts in Zeichenketten, Kommentaren, Regex; Typ-Literale bleiben
pruefe('Operator in Zeichenkette erzeugt nichts', alle("x = 'a && b'").length === 0)
pruefe('Operator im Kommentar erzeugt nichts', alle('x = 1 // a && b').every((m) => !m.name.includes('&&')))
pruefe('Zahl im Regex erzeugt nichts', alle('x = /a{2}/').length === 0)
pruefe('Zahl im Typ-Literal erzeugt nichts', mutantenListe('a.ts', 'type T = 1 | 2', new Set([1])).length === 0)

// Zeilenauswahl und Listenformat
pruefe('nur geänderte Zeilen', mutantenListe('a.mjs', 'x = a && b\ny = c && d', new Set([2]), ['t']).length === 1)
const m0 = alle('x = a && b')[0]
pruefe('Name trägt Datei:Zeile und Art', m0.name === 'a.mjs:1 && → ||')
pruefe('Läuferformat: datei, suche, ersetze, zeile, tests', m0.aenderungen[0].datei === 'a.mjs' && m0.aenderungen[0].zeile === 1 && m0.tests[0] === 't')
const zwei = mutantenListe('a.mjs', 'x = f(a, b) && f(a, b)', new Set([1]), ['t']).filter((m) => m.name.includes('Argumente'))
pruefe('gleicher Text zweimal auf der Zeile: zweites Vorkommen trägt nr 2', zwei.length === 2 && zwei[0].aenderungen[0].nr === undefined && zwei[1].aenderungen[0].nr === 2)
pruefe('ohne tests: Feld fehlt', !('tests' in mutantenListe('a.mjs', 'x = a && b', new Set([1]))[0]))

// Diff lesen
const DIFF = [
  'diff --git a/pipeline/x.ts b/pipeline/x.ts',
  '--- a/pipeline/x.ts',
  '+++ b/pipeline/x.ts',
  '@@ -3,0 +4,2 @@',
  '+a',
  '+b',
  '@@ -9 +12 @@',
  '+c',
  'diff --git a/pipeline/x.test.ts b/pipeline/x.test.ts',
  '+++ b/pipeline/x.test.ts',
  '@@ -1 +1 @@',
  '+t',
  'diff --git a/README.md b/README.md',
  '+++ b/README.md',
  '@@ -1 +1 @@',
  '+m',
].join('\n')
const z = geaenderteZeilen(DIFF)
pruefe('Diff: Bereich und Einzelzeile, Tests und Markdown fehlen', z.size === 1 && [...z.get('pipeline/x.ts')].join() === '4,5,12')
pruefe('Diff ohne Code-Zeilen: leere Liste', listeAusDiff('+++ b/README.md\n@@ -1 +1 @@\n+m\n', () => '', [], () => false).liste.length === 0)
pruefe('gelöschte Datei (+++ /dev/null) zählt nicht', geaenderteZeilen('+++ /dev/null\n@@ -1,2 +0,0 @@\n').size === 0)
pruefe('Code-Dateien: .ts/.mjs ja, Test, check-, d.ts, Markdown nein', istCodeDatei('a/b.ts') && istCodeDatei('tools/x.mjs') && !istCodeDatei('tools/x.test.mjs') && !istCodeDatei('pipeline/check-x.ts') && !istCodeDatei('a.d.ts') && !istCodeDatei('a.md'))

// Test-Zuordnung
const gibt = (...pfade) => (p) => pfade.includes(p)
pruefe('Test daneben (.mjs): node', testFuer('tools/x.mjs', gibt('tools/x.test.mjs')) === 'node tools/x.test.mjs')
pruefe('Test daneben (.ts): tsx', testFuer('pipeline/lib/x.ts', gibt('pipeline/lib/x.test.ts')) === 'node node_modules/tsx/dist/cli.mjs pipeline/lib/x.test.ts')
pruefe('Test unter tools/ für Hook', testFuer('.claude/hooks/x.js', gibt('tools/x.test.mjs')) === 'node tools/x.test.mjs')
pruefe('Test als pipeline/check-<name>.ts', testFuer('pipeline/lib/x.ts', gibt('pipeline/check-x.ts')) === 'node node_modules/tsx/dist/cli.mjs pipeline/check-x.ts')
pruefe('Test daneben schlägt Test unter tools/ und check-', testFuer('pipeline/lib/x.ts', gibt('pipeline/lib/x.test.ts', 'tools/x.test.mjs', 'pipeline/check-x.ts')).endsWith('pipeline/lib/x.test.ts'))
pruefe('tools/ schlägt check-', testFuer('pipeline/lib/x.ts', gibt('tools/x.test.mjs', 'pipeline/check-x.ts')) === 'node tools/x.test.mjs')
pruefe('kein Test: null',testFuer('pipeline/lib/x.ts', gibt()) === null)
const ohne = listeAusDiff('+++ b/pipeline/x.ts\n@@ -1 +1 @@\n+x = a && b\n', () => 'x = a && b', [], () => false)
pruefe('Datei ohne Test: Mutanten ohne tests, Datei gemeldet', ohne.liste.length === 1 && !ohne.liste[0].tests && ohne.ohneTest[0] === 'pipeline/x.ts')
const global = listeAusDiff('+++ b/pipeline/x.ts\n@@ -1 +1 @@\n+x = a && b\n', () => 'x = a && b', ['mein test'], () => false)
pruefe('--test überschreibt die Zuordnung', global.liste[0].tests[0] === 'mein test' && global.ohneTest.length === 0)

// Läuferausgabe
pruefe('Überlebende aus der Läuferausgabe', ueberlebende('rot   a\nGRÜN           b:1 && → || (alle Tests grün)\nGRÜN           Kontrolle\n').join('|') === 'b:1 && → |||Kontrolle')

// Ganzer Lauf in einem Wegwerf-Repo: der Test fängt nur den ersten Mutanten, der zweite überlebt
const wurzel = mkdtempSync(join(tmpdir(), 'diff-mutanten-'))
try {
  const git = (...a) => execFileSync('git', a, { cwd: wurzel, stdio: 'pipe', encoding: 'utf8' })
  mkdirSync(join(wurzel, 'tools'))
  for (const d of ['diff-mutanten.mjs', 'mutationslaeufer.mjs']) copyFileSync(join(fileURLToPath(new URL('.', import.meta.url)), d), join(wurzel, 'tools', d))
  symlinkSync(join(fileURLToPath(new URL('..', import.meta.url)), 'node_modules'), join(wurzel, 'node_modules'))
  writeFileSync(join(wurzel, 'tools/lib.mjs'), 'export const f = (a, b) => a\n')
  writeFileSync(join(wurzel, 'tools/lib.test.mjs'), "import { f } from './lib.mjs'\nif (f(1, 2) !== 1) process.exit(1)\n")
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@t')
  git('config', 'user.name', 't')
  git('add', '-A')
  git('commit', '-q', '-m', 'basis')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('checkout', '-q', '-b', 'pr')
  writeFileSync(join(wurzel, 'tools/lib.mjs'), 'export const f = (a, b) => (a > 0 && b > 0 ? a : 0)\n')
  git('commit', '-q', '-am', 'aenderung')
  const lauf = spawnSync(process.execPath, ['tools/diff-mutanten.mjs'], { cwd: wurzel, encoding: 'utf8' })
  const aus = lauf.stdout
  pruefe('Lauf: Exit 0 (Überlebende sind gelb, nicht rot)', lauf.status === 0)
  pruefe('Lauf: Überlebender erscheint als „Überlebt: Datei:Zeile Mutant“', aus.includes('! Überlebt: tools/lib.mjs:1 && → ||'))
  pruefe('Lauf: vom Test gefangener Mutant erscheint nicht', !aus.includes('Überlebt: tools/lib.mjs:1 ?: Zweige vertauscht'))
  pruefe('Lauf: Schlusszeile zählt', /diff-mutanten: \d+ Mutanten, [1-9]\d* überlebt\./.test(aus))
  const nur = spawnSync(process.execPath, ['tools/diff-mutanten.mjs', '--liste'], { cwd: wurzel, encoding: 'utf8' })
  pruefe('--liste: JSON im Läuferformat, nichts gefahren', Array.isArray(JSON.parse(nur.stdout)) && !nur.stdout.includes('mutationslaeufer'))
  const tmp = join(wurzel, 'tmp')
  mkdirSync(tmp)
  const lauf2 = spawnSync(process.execPath, ['tools/diff-mutanten.mjs'], { cwd: wurzel, encoding: 'utf8', env: { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp } })
  pruefe('Lauf räumt sein Wegwerfverzeichnis auf', readdirSync(tmp).length === 0 && lauf2.status === 0)
  pruefe('Schlusszeile nennt genau die Mutantenzahl der Liste', aus.includes(`diff-mutanten: ${JSON.parse(nur.stdout).length} Mutanten,`))
  // Datei ohne eigenen Test: Hinweis, nichts gefahren; mit --test gefahren
  writeFileSync(join(wurzel, 'tools/solo.mjs'), 'export const g = (a, b) => (a && b)\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'solo')
  const ohneT = spawnSync(process.execPath, ['tools/diff-mutanten.mjs'], { cwd: wurzel, encoding: 'utf8' })
  pruefe('Datei ohne Test: Hinweis mit Dateiname', ohneT.stdout.includes('! Kein Test gefunden für tools/solo.mjs'))
  const mitT = spawnSync(process.execPath, ['tools/diff-mutanten.mjs', '--test', 'node tools/lib.test.mjs'], { cwd: wurzel, encoding: 'utf8' })
  pruefe('--test: Mutanten der Datei ohne Test werden gefahren', !mitT.stdout.includes('Kein Test gefunden') && mitT.stdout.includes('! Überlebt: tools/solo.mjs:1 && → ||'))
  // Grundlauf rot: Läuferfehler wird ausgegeben
  writeFileSync(join(wurzel, 'tools/lib.test.mjs'), 'process.exit(1)\n')
  git('commit', '-q', '-am', 'rot')
  const rot = spawnSync(process.execPath, ['tools/diff-mutanten.mjs'], { cwd: wurzel, encoding: 'utf8' })
  pruefe('Grundlauf rot: Läuferausgabe erscheint auf stderr', rot.stderr.includes('Grundlauf ohne Mutation ist rot'))
  pruefe('Quelldatei nach dem Lauf unverändert (keine .mutlauf-orig)', git('status', '--short').trim() === '?? node_modules' || git('status', '--short').trim() === '')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`\n${fehler.length} Fehler`)
  process.exit(1)
}
console.log('diff-mutanten.test: alle Fälle grün')
