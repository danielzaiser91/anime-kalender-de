#!/usr/bin/env node
/**
 * Diff-Mutanten (13.11.2026): erzeugt aus `git diff origin/main...HEAD` Standardmutanten je geänderter Code-Zeile
 * (.ts/.tsx/.mjs/.js, keine Tests) im Listenformat von tools/mutationen/*.json und fährt sie mit dem Läufer.
 * Anlass: 205 von 585 Prüfer-Auflagen (29.10.–13.11.) waren überlebende Mutanten, die der Bauer von Hand suchte.
 *
 *   node tools/diff-mutanten.mjs                  erzeugen und mit tools/mutationslaeufer.mjs fahren; Überlebende als
 *                                                 „Überlebt: Datei:Zeile Mutant“ (Exit 0, ein Hinweis, kein Rot)
 *   node tools/diff-mutanten.mjs --liste          nur die Liste (JSON) auf stdout, fährt der Läufer direkt
 *   node tools/diff-mutanten.mjs --test "<befehl>"  Testbefehl statt der Zuordnung Datei → Test (mehrfach möglich)
 * Test je Datei: `<name>.test.(mjs|ts|tsx)` neben der Datei, sonst `pipeline/check-<name>.ts`; ohne Test keine Läuferfahrt.
 * Mutantenarten: Vergleich getauscht, Grenze ±1, && ↔ ||, ?:-Zweige vertauscht, Zahl 0/1, Aufruf entfernt, Argumente getauscht.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CODE = /\.(ts|tsx|mjs|js)$/
const KEIN_CODE = /(\.test\.|\.d\.ts$|(^|\/)pipeline\/check-|(^|\/)node_modules\/)/
export const istCodeDatei = (pfad) => CODE.test(pfad) && !KEIN_CODE.test(pfad)

/** Geänderte neue Zeilennummern je Datei aus `git diff -U0` (nur Hinzugefügtes, nur Code-Dateien). */
export function geaenderteZeilen(diff) {
  const jeDatei = new Map()
  let datei = null
  for (const z of diff.split('\n')) {
    if (z.startsWith('+++ ')) datei = z.startsWith('+++ b/') && istCodeDatei(z.slice(6)) ? z.slice(6) : null
    const m = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(z)
    if (!m || !datei) continue
    const von = Number(m[1])
    const zahl = m[2] === undefined ? 1 : Number(m[2])
    if (!jeDatei.has(datei)) jeDatei.set(datei, new Set())
    for (let i = 0; i < zahl; i++) jeDatei.get(datei).add(von + i)
  }
  return jeDatei
}

const K = ts.SyntaxKind
const VERGLEICH = new Map([
  [K.EqualsEqualsEqualsToken, ['!==']],
  [K.ExclamationEqualsEqualsToken, ['===']],
  [K.EqualsEqualsToken, ['!=']],
  [K.ExclamationEqualsToken, ['==']],
  [K.GreaterThanToken, ['>=', '<=']],
  [K.GreaterThanEqualsToken, ['>', '<']],
  [K.LessThanToken, ['<=', '>=']],
  [K.LessThanEqualsToken, ['<', '>']],
  [K.AmpersandAmpersandToken, ['||']],
  [K.BarBarToken, ['&&']],
])

/** Mutanten eines Knotens als { art, von, bis, ersetze } (Offsets im Quelltext). */
function mutantenVon(node, q) {
  const text = (n) => q.slice(n.getStart(), n.end)
  const art = (name, von, bis, ersetze) => ({ art: name, von, bis, ersetze })
  if (ts.isBinaryExpression(node) && VERGLEICH.has(node.operatorToken.kind)) {
    const t = node.operatorToken
    return VERGLEICH.get(t.kind).map((neu) => art(`${t.getText()} → ${neu}`, t.getStart(), t.end, neu))
  }
  if (ts.isConditionalExpression(node)) {
    const neu = `${text(node.condition)} ? ${text(node.whenFalse)} : ${text(node.whenTrue)}`
    return [art('?: Zweige vertauscht', node.getStart(), node.end, neu)]
  }
  if (ts.isNumericLiteral(node) && !ts.isLiteralTypeNode(node.parent)) {
    return [art(`Zahl ${node.text} → ${Number(node.text) === 0 ? 1 : 0}`, node.getStart(), node.end, Number(node.text) === 0 ? '1' : '0')]
  }
  if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression.kind === K.AwaitExpression ? node.expression.expression : node.expression)) {
    return [art('Aufruf entfernt', node.expression.getStart(), node.expression.end, 'void 0')]
  }
  if (ts.isCallExpression(node) && node.arguments.length >= 2) {
    const [a, b] = node.arguments
    return [art(`Argumente getauscht ${node.expression.getText()}`,a.getStart(), b.end, `${text(b)}, ${text(a)}`)]
  }
  return []
}

/** Nummer des Vorkommens von `suche` unter denen, die auf derselben Zeile wie `von` beginnen (Läufer: zeile + nr). */
function vorkommenAufZeile(q, suche, von, zeile) {
  let nr = 0
  for (let i = q.indexOf(suche); i >= 0 && i <= von; i = q.indexOf(suche, i + suche.length)) {
    if (q.slice(0, i).split('\n').length === zeile) nr++
  }
  return nr
}

/** Mutantenliste (Läuferformat) einer Datei für die geänderten Zeilen `zeilen` (Set); `tests` je Mutant, wenn gegeben. */
export function mutantenListe(datei, quelle, zeilen, tests) {
  const sf = ts.createSourceFile(datei, quelle, ts.ScriptTarget.Latest, true, datei.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const liste = []
  const besuche = (node) => {
    const zeile = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
    if (zeilen.has(zeile)) {
      for (const m of mutantenVon(node, quelle)) {
        const suche = quelle.slice(node.getStart(), node.end)
        const ersetze = quelle.slice(node.getStart(), m.von) + m.ersetze + quelle.slice(m.bis, node.end)
        if (suche === ersetze) continue
        const nr = vorkommenAufZeile(quelle, suche, node.getStart(), zeile)
        liste.push({ name: `${datei}:${zeile} ${m.art}`, aenderungen: [{ datei, suche, ersetze, zeile, ...(nr > 1 ? { nr } : {}) }], ...(tests ? { tests } : {}) })
      }
    }
    ts.forEachChild(node, besuche)
  }
  besuche(sf)
  return liste
}

/** Testbefehl für eine Datei: `<name>.test.*` daneben oder `pipeline/check-<name>.ts`; null ohne Treffer. */
export function testFuer(datei, existiert = existsSync) {
  const basis = datei.replace(CODE, '')
  const kandidaten = ['mjs', 'ts', 'tsx'].map((e) => `${basis}.test.${e}`)
  kandidaten.push(`tools/${basename(basis)}.test.mjs`, `pipeline/check-${basename(basis)}.ts`)
  const treffer = kandidaten.find(existiert)
  if (!treffer) return null
  return treffer.endsWith('.mjs') ? `node ${treffer}` : `node node_modules/tsx/dist/cli.mjs ${treffer}`
}

/** Gesamtliste aus Diff-Text; `lies(datei)` liefert den Quelltext. Mutanten ohne Test tragen kein `tests`; zweite Rückgabe: ihre Dateien. */
export function listeAusDiff(diff, lies, globaleTests = [], existiert = existsSync) {
  const liste = []
  const ohneTest = []
  for (const [datei, zeilen] of geaenderteZeilen(diff)) {
    const eigener = testFuer(datei, existiert)
    const tests = globaleTests.length ? globaleTests : eigener && [eigener]
    if (!tests) ohneTest.push(datei)
    liste.push(...mutantenListe(datei, lies(datei), zeilen, tests))
  }
  return { liste, ohneTest }
}

/** Namen der Überlebenden aus der Läuferausgabe (Zeilen `GRÜN  <name>`). */
export function ueberlebende(ausgabe) {
  return ausgabe.split('\n').filter((z) => z.startsWith('GRÜN ')).map((z) => z.slice(5).trim().replace(/ \(alle Tests grün\)$/, ''))
}

function main(argv) {
  const tests = argv.flatMap((a, i) => (a === '--test' ? [argv[i + 1]] : []))
  const diff = execFileSync('git', ['diff', '-U0', '--no-renames', 'origin/main...HEAD'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  const { liste, ohneTest } = listeAusDiff(diff, (d) => readFileSync(d, 'utf8'), tests)
  if (argv.includes('--liste')) return console.log(JSON.stringify(liste, null, 2))
  for (const d of ohneTest) console.log(`  ! Kein Test gefunden für ${d} (--test angeben), keine Mutanten gefahren.`)
  const fahrbar = liste.filter((m) => m.tests)
  if (!fahrbar.length) return console.log('diff-mutanten: keine fahrbaren Mutanten (Diff ohne Code-Zeilen oder ohne Test).')
  const ordner = mkdtempSync(join(tmpdir(), 'diff-mutanten-'))
  try {
    const pfad = join(ordner, 'liste.json')
    writeFileSync(pfad, JSON.stringify(fahrbar))
    const lauf = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'mutationslaeufer.mjs'), pfad], { encoding: 'utf8', maxBuffer: 1 << 28 })
    const aus = `${lauf.stdout}${lauf.stderr}`
    const lebt = ueberlebende(aus)
    for (const n of lebt) console.log(`  ! Überlebt: ${n}`)
    console.log(`diff-mutanten: ${fahrbar.length} Mutanten, ${lebt.length} überlebt.`)
    if (lauf.status === 2) console.error(aus.slice(-1500))
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
