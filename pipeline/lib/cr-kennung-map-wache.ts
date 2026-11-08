import ts from 'typescript'

/** Eine Map, die nach Serienkennung schlüsselt: Name der Map und Zeile des ersten Schreibens. */
export interface KennungsMap {
  name: string
  zeile: number
}

const KENNUNG = /seriesid|serienkennung|crunchyrollseriesid\(/i

/**
 * Maps, die per `x.set(<Serienkennung>, …)` oder `new Map(….map(e => [<Serienkennung>, …]))` beschrieben werden.
 * Erkannt: Eigenschaft/Name/Aufruf mit seriesId, Serienkennung oder crunchyrollSeriesId(…); ein `const`-Alias darauf
 * (`const id = s.seriesId`) gilt mit. Nicht erkannt: Kennung über eine Hilfsfunktion mit anderem Namen.
 */
export function findeKennungsMaps(text: string): KennungsMap[] {
  const quelle = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true)
  const aliase = new Map<string, boolean>()
  const raus = new Map<string, KennungsMap>()
  const melde = (name: string, n: ts.Node): void => {
    if (!raus.has(name)) raus.set(name, { name, zeile: quelle.getLineAndCharacterOfPosition(n.getStart()).line + 1 })
  }
  const istKennung = (n: ts.Node): boolean => (ts.isIdentifier(n) && aliase.has(n.text) ? aliase.get(n.text)! : KENNUNG.test(n.getText(quelle)))
  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      aliase.set(n.name.text, istKennung(n.initializer))
    }
    if (ts.isNewExpression(n) && n.expression.getText(quelle) === 'Map') {
      const arg = n.arguments?.[0]
      const bindung = ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) ? n.parent.name.text : '(ohne Namen)'
      if (arg && erzeugtKennungsPaare(arg)) melde(bindung, n)
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'set' && n.arguments.length === 2) {
      if (istKennung(n.arguments[0]!)) melde(n.expression.expression.getText(quelle), n)
    }
    ts.forEachChild(n, besuche)
  }
  const erzeugtKennungsPaare = (arg: ts.Node): boolean => {
    let treffer = false
    const suche = (k: ts.Node): void => {
      if (ts.isArrayLiteralExpression(k) && k.elements.length === 2 && istKennung(k.elements[0]!)) treffer = true
      ts.forEachChild(k, suche)
    }
    suche(arg)
    return treffer
  }
  besuche(quelle)
  return [...raus.values()]
}
