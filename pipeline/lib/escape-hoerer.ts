/**
 * Findet rohe Tastenhörer für Escape (`addEventListener('keydown', …)` mit `'Escape'` im Handler) im Syntaxbaum.
 * Escape-Hörer auf `window`/`document` gehen über `useEscape` (`web/src/lib/escape.ts`): nur er beachtet `defaultPrevented`.
 */
import ts from 'typescript'

const TASTEN = new Set(['keydown', 'keyup', 'keypress'])

const istText = (n: ts.Node, wert?: string): n is ts.StringLiteralLike => ts.isStringLiteralLike(n) && (wert === undefined || n.text === wert)

function enthaeltEscape(n: ts.Node): boolean {
  let gefunden = false
  const geh = (k: ts.Node) => {
    if (istText(k, 'Escape')) gefunden = true
    else ts.forEachChild(k, geh)
  }
  geh(n)
  return gefunden
}

/** Namen von Variablen/Funktionen, deren Rumpf `'Escape'` enthält (ein Handler, der als Name übergeben wird). */
function escapeNamen(quelle: ts.SourceFile): Set<string> {
  const namen = new Set<string>()
  const geh = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && enthaeltEscape(n.initializer)) namen.add(n.name.text)
    if (ts.isFunctionDeclaration(n) && n.name && n.body && enthaeltEscape(n.body)) namen.add(n.name.text)
    ts.forEachChild(n, geh)
  }
  geh(quelle)
  return namen
}

function umgebendeFunktion(n: ts.Node): ts.Node | undefined {
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p
  return undefined
}

/** Ob der Aufruf `x.addEventListener(<Taste>, …)` ist; `x['addEventListener']` zählt ebenso. */
function istTastenHoerer(c: ts.CallExpression): boolean {
  const f = c.expression
  const name = ts.isPropertyAccessExpression(f) ? f.name.text : ts.isElementAccessExpression(f) && istText(f.argumentExpression) ? f.argumentExpression.text : ''
  return name === 'addEventListener' && c.arguments.length >= 2 && istText(c.arguments[0]) && TASTEN.has((c.arguments[0] as ts.StringLiteralLike).text)
}

/** Zeilen (ab 1) aller Tastenhörer, die auf Escape reagieren: Handler enthält `'Escape'`, wird mit einem Namen übergeben, der es enthält, oder die umgebende Funktion tut es. */
export function findeRoheEscapeHoerer(text: string, datei: string): number[] {
  const quelle = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, datei.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const namen = escapeNamen(quelle)
  const zeilen: number[] = []
  const geh = (n: ts.Node) => {
    if (ts.isCallExpression(n) && istTastenHoerer(n)) {
      const handler = n.arguments[1]
      const umgebung = umgebendeFunktion(n)
      const trifft = enthaeltEscape(handler) || (ts.isIdentifier(handler) && namen.has(handler.text)) || (umgebung !== undefined && enthaeltEscape(umgebung))
      if (trifft) zeilen.push(quelle.getLineAndCharacterOfPosition(n.getStart()).line + 1)
    }
    ts.forEachChild(n, geh)
  }
  geh(quelle)
  return zeilen
}
