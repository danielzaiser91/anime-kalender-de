import ts from 'typescript'

const AUFRUFER: Record<string, number> = { sendungNeuZuordnen: 3, releasesAusTvProgramm: 4, sendungenAnhaengen: 4 }

/** Bindung `const X = folgenListen(titles)` in der Funktion: Name der Bindung oder ein Fehler. */
function bindung(rumpf: ts.Node, fehler: string[]): string | undefined {
  const gefunden: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText() === 'folgenListen') {
      const args = n.initializer.arguments
      if (args.length !== 1 || args[0]!.getText() !== 'titles') fehler.push(`folgenListen bekommt nicht genau (titles): ${n.initializer.getText()}`)
      else if (!ts.isIdentifier(n.name)) fehler.push('Bindung der Folgenlisten ist kein Name')
      else gefunden.push(n.name.text)
    }
    ts.forEachChild(n, besuche)
  }
  besuche(rumpf)
  if (gefunden.length !== 1) fehler.push(`genau eine Bindung folgenListen(titles) erwartet, gefunden ${gefunden.length}`)
  return gefunden[0]
}

/** Prüft am Syntaxbaum von `ergaenzeTermineAusNewsUndTv`: die TV-Folgenlisten kommen aus `folgenListen(titles)` und gehen an jeden der drei Aufrufer als letztes Argument. */
export function pruefeFolgenlistenVerdrahtung(quelltext: string): string[] {
  const fehler: string[] = []
  const datei = ts.createSourceFile('08-news-tv.ts', quelltext, ts.ScriptTarget.Latest, true)
  const fn = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'ergaenzeTermineAusNewsUndTv')
  if (!fn?.body) return ['Funktion ergaenzeTermineAusNewsUndTv fehlt']
  const name = bindung(fn.body, fehler)
  const zahl: Record<string, number> = {}
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text in AUFRUFER) {
      const aufrufer = n.expression.text
      zahl[aufrufer] = (zahl[aufrufer] ?? 0) + 1
      const letztes = n.arguments[n.arguments.length - 1]
      if (n.arguments.length !== AUFRUFER[aufrufer] || !letztes || !ts.isIdentifier(letztes) || letztes.text !== name) {
        fehler.push(`${aufrufer} bekommt die Folgenlisten nicht als letztes von ${AUFRUFER[aufrufer]} Argumenten: ${n.getText()}`)
      }
    }
    ts.forEachChild(n, besuche)
  }
  besuche(fn.body)
  for (const aufrufer of Object.keys(AUFRUFER)) if (zahl[aufrufer] !== 1) fehler.push(`${aufrufer} genau einmal erwartet, gefunden ${zahl[aufrufer] ?? 0}`)
  return fehler
}
