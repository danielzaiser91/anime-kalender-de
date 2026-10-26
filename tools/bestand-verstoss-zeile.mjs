/**
 * Wächter für `tools/pr-bestand-vergleich.mjs` (25.10.2026): Der Vergleich zählt die Verstöße einer roten Bestandsprüfung als nichtleere Ausgabezeilen
 * (`tools/pr-bestand-zaehlen.mjs`). Ein Fehlerausgang ohne vorherige Ausgabe ergäbe 0 Zeilen: die Prüfung gälte als „geerbt“, sobald die Basis
 * ebenfalls stumm rot ist, und ein neuer Verstoß ginge unter. Dieses Modul findet solche stummen Ausgänge statisch (Syntaxbaum, kein Regex).
 */
import ts from 'typescript'

/** Ausgabe-Aufrufe, die eine Zeile in stdout/stderr schreiben. */
const AUSGABE_OBJEKTE = new Set(['console'])
const AUSGABE_METHODEN = new Set(['log', 'error', 'warn', 'info'])
const AUSGABE_STROEME = new Set(['stdout', 'stderr'])

/** Hilfsfunktionen der Pipeline (`pipeline/lib/util.ts`), die in console.log/warn münden. */
const AUSGABE_HELFER = new Set(['log', 'warn'])

/** Erste Zeile der Ausgabe als Text, soweit literal (Zeichenkette oder Schablone: deren Kopf), sonst `null`. */
function literalKopf(arg) {
  if (arg === undefined) return null
  if (ts.isStringLiteralLike(arg)) return arg.text
  return ts.isTemplateExpression(arg) ? arg.head.text : null
}

/** Erfolgszeilen (✓/✔) zählt `zaehleVerstoesse` nicht mit, sie belegen also keine Verstoßzeile. */
const istErfolgszeile = (arg) => /^\s*[✓✔]/.test(literalKopf(arg) ?? '')

function istAusgabe(knoten) {
  if (!ts.isCallExpression(knoten) || istErfolgszeile(knoten.arguments[0])) return false
  const f = knoten.expression
  if (ts.isIdentifier(f)) return AUSGABE_HELFER.has(f.text)
  if (!ts.isPropertyAccessExpression(f)) return false
  const objekt = f.expression
  if (ts.isIdentifier(objekt)) return AUSGABE_OBJEKTE.has(objekt.text) && AUSGABE_METHODEN.has(f.name.text)
  const strom = ts.isPropertyAccessExpression(objekt) && ts.isIdentifier(objekt.expression) && objekt.expression.text === 'process' && AUSGABE_STROEME.has(objekt.name.text)
  return strom && f.name.text === 'write'
}

const istProcess = (k, name) => ts.isPropertyAccessExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === 'process' && k.name.text === name

/** Ist das Argument die Literalzahl 0 (Erfolg)? Alles andere (auch ein Ausdruck) kann rot enden. */
const istNull = (arg) => arg !== undefined && ts.isNumericLiteral(arg) && Number(arg.text) === 0

/** Ausgang mit möglichem Fehlercode: `process.exit(x)` oder `process.exitCode = x`, x nicht die Literalzahl 0. */
function istFehlerAusgang(knoten) {
  if (ts.isCallExpression(knoten) && istProcess(knoten.expression, 'exit')) return !istNull(knoten.arguments[0])
  const zuweisung = ts.isBinaryExpression(knoten) && knoten.operatorToken.kind === ts.SyntaxKind.EqualsToken
  return zuweisung && istProcess(knoten.left, 'exitCode') && !istNull(knoten.right)
}

const istRumpf = (k) => ts.isFunctionLike(k) || ts.isSourceFile(k)

function naechsterRumpf(knoten) {
  let k = knoten.parent
  while (!istRumpf(k)) k = k.parent
  return k
}

/** Eine Ausgabe vor dem Ausgang zählt, wenn sie nicht vor dessen Funktion steht; auf Dateiebene also jede frühere (Hilfsfunktion davor). */
const liegtImRumpf = (ausgabe, rumpf) => ausgabe.pos >= rumpf.pos

/** Liste der Fehlerausgänge ohne eine früher stehende Ausgabe in ihrem Rumpf: `[{ zeile }]`. */
export function findeStummeAusgaenge(quelltext, dateiname = 'x.ts') {
  const quelle = ts.createSourceFile(dateiname, quelltext, ts.ScriptTarget.Latest, true)
  const ausgaben = []
  const ausgaenge = []
  const besuche = (k) => {
    if (istAusgabe(k)) ausgaben.push(k)
    if (istFehlerAusgang(k)) ausgaenge.push(k)
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return ausgaenge
    .filter((a) => !ausgaben.some((o) => o.getStart() < a.getStart() && liegtImRumpf(o, naechsterRumpf(a))))
    .map((a) => ({ zeile: quelle.getLineAndCharacterOfPosition(a.getStart()).line + 1 }))
}

/** Anzahl der Fehlerausgänge insgesamt (der Test verlangt mindestens einen: eine Prüfung ohne jeden roten Ausgang meldet nie etwas). */
export function zaehleFehlerAusgaenge(quelltext, dateiname = 'x.ts') {
  const quelle = ts.createSourceFile(dateiname, quelltext, ts.ScriptTarget.Latest, true)
  let n = 0
  const besuche = (k) => {
    if (istFehlerAusgang(k)) n++
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return n
}
