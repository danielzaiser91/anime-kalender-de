/**
 * Liest per Syntaxbaum, welche Quellen eine Frist haben (`FRISTEN` in check-sources.ts)
 * und welche Namen irgendwo über `recordSource('<name>', …)` geschrieben werden.
 * Ein Name, der nicht als Zeichenkette dasteht (Variable, Vorlage), zählt als „?“.
 */
import ts from 'typescript'

function parse(text: string): ts.SourceFile {
  return ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true)
}

function schluessel(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined
}

/** Schlüssel des Objektliterals `const FRISTEN = {…}`. */
export function fristNamen(text: string): string[] {
  const namen: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'FRISTEN' && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        const k = ts.isPropertyAssignment(p) ? schluessel(p.name) : undefined
        if (k) namen.push(k)
      }
    }
    ts.forEachChild(n, besuche)
  }
  besuche(parse(text))
  return namen
}

/** Erste Argumente aller `recordSource(…)`-Aufrufe; Nicht-Zeichenketten als '?'. */
export function schreiberNamen(text: string): string[] {
  const namen: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'recordSource') {
      const a = n.arguments[0]
      namen.push(a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) ? a.text : '?')
    }
    ts.forEachChild(n, besuche)
  }
  besuche(parse(text))
  return namen
}

/** Namen mit Frist, die kein Schreiber mit festem Namen bedient ('?' bedient keinen: der Wächter zählt sie getrennt und wird rot). */
export function ohneSchreiber(fristen: string[], schreiber: string[]): string[] {
  const da = new Set(schreiber)
  return fristen.filter((n) => !da.has(n))
}
