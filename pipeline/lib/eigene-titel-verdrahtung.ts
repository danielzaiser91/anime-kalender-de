import ts from 'typescript'

/**
 * Prüft am Syntaxbaum, dass `funktion` den Aufruf `aufruf(args)` als **eigene Anweisung** auf oberster Ebene des Rumpfes trägt (kein `0 &&`, kein `if`),
 * und — wenn `davor` gesetzt ist — dass die Anweisung unmittelbar nach der liegt, die `davor(` aufruft. Gibt die Fehler zurück, leer heißt in Ordnung.
 */
export function pruefeAufrufAnweisung(quelltext: string, funktion: string, aufruf: string, args: string, davor?: string): string[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const fn = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === funktion)
  if (!fn?.body) return [`Funktion ${funktion} fehlt`]
  const anweisungen = fn.body.statements
  const ist = (s: ts.Statement) => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === aufruf
  const i = anweisungen.findIndex(ist)
  if (i < 0) return [`${funktion}: ${aufruf}(…) steht nicht als eigene Anweisung im Rumpf`]
  const fehler: string[] = []
  const gelesen = (anweisungen[i] as ts.ExpressionStatement).expression as ts.CallExpression
  if (gelesen.arguments.map((a) => a.getText()).join(', ') !== args) fehler.push(`${funktion}: ${aufruf} bekommt (${gelesen.arguments.map((a) => a.getText()).join(', ')}) statt (${args})`)
  if (davor && !anweisungen[i - 1]?.getText().includes(`${davor}(`)) fehler.push(`${funktion}: ${aufruf} steht nicht unmittelbar nach ${davor}`)
  return fehler
}

/** Prüft am Syntaxbaum, dass die Datei irgendwo `const name = aufruf(args)` bindet (für Skripte ohne Funktion, die sich nicht aufrufen lassen). */
export function pruefeBindung(quelltext: string, name: string, aufruf: string, args: string): string[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  let gefunden = false
  const besuche = (n: ts.Node): void => {
    const i = ts.isVariableDeclaration(n) ? n.initializer : undefined
    if (i && ts.isVariableDeclaration(n) && n.name.getText() === name && ts.isCallExpression(i) && i.expression.getText() === aufruf && i.arguments.map((a) => a.getText()).join(', ') === args) gefunden = true
    ts.forEachChild(n, besuche)
  }
  besuche(datei)
  return gefunden ? [] : [`${name} = ${aufruf}(${args}) steht nicht in der Datei`]
}
