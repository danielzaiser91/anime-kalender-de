import ts from 'typescript'

export interface Aufruf {
  name: string
  /** Quelltext der Argumente, in Reihenfolge. */
  args: string[]
  /** Platz unter den Anweisungen des Funktionsrumpfs. */
  stelle: number
}

/**
 * Die Aufrufe, die eine Funktion unbedingt als eigene Anweisung ausführt (`f(…)` oder `const x = f(…)` direkt im Rumpf), geparst.
 * `0 && f()`, `if (false) f()` und `cond ? f() : g()` zählen nicht: Sie sind keine eigene Anweisung mit dem Aufruf als Wert.
 * Grenze: Ein frühes `return` vor dem Aufruf und ein lokal überschatteter Name werden nicht erkannt.
 * Prüfungen vergleichen damit Name, Argumente und Reihenfolge im Bau, statt ein Textstück zu suchen.
 */
export function unbedingteAufrufe(quelltext: string, funktion: string): Aufruf[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const rumpf = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === funktion)?.body
  const out: Aufruf[] = []
  rumpf?.statements.forEach((anweisung, stelle) => {
    const wert = ts.isExpressionStatement(anweisung)
      ? anweisung.expression
      : ts.isVariableStatement(anweisung)
        ? anweisung.declarationList.declarations[0]?.initializer
        : undefined
    if (wert && ts.isCallExpression(wert) && ts.isIdentifier(wert.expression)) {
      out.push({ name: wert.expression.text, args: wert.arguments.map((a) => a.getText(datei)), stelle })
    }
  })
  return out
}
