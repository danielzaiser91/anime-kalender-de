import ts from 'typescript'

export interface Fund {
  zeile: number
  text: string
}

/**
 * Findet jedes `=` (Zuweisung, Deklaration, Standardwert), vor dem Leerraum steht und nach dem keiner folgt
 * („const x =y“, PR 2194). Der Syntaxbaum grenzt Zeichenketten, Regex, Kommentare, `==`, `=>` und `+=` ab,
 * die der Scanner als eigene Token liefert; JSX-Attribute (`a="x"`) haben keinen Leerraum davor.
 */
export function findeVerschluckte(text: string, dateiname: string): Fund[] {
  const quelle = ts.createSourceFile(dateiname, text, ts.ScriptTarget.Latest, true, dateiname.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Fund[] = []
  const besuche = (knoten: ts.Node): void => {
    if (knoten.kind === ts.SyntaxKind.EqualsToken) pruefe(knoten)
    for (const kind of knoten.getChildren(quelle)) besuche(kind)
  }
  const pruefe = (token: ts.Node): void => {
    const start = token.getStart(quelle)
    const davor = text[start - 1] ?? ''
    const danach = text[start + 1] ?? ''
    if (!/\s/.test(davor) || danach === '' || /\s/.test(danach)) return
    const zeile = quelle.getLineAndCharacterOfPosition(start).line
    funde.push({ zeile: zeile + 1, text: text.split('\n')[zeile].trim() })
  }
  besuche(quelle)
  return funde
}
