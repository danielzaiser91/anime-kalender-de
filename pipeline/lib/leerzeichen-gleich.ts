import ts from 'typescript'

export interface Fund {
  zeile: number
  text: string
  /** Hinter welchem Zeichen das Leerzeichen fehlt: `=` oder `,`. */
  zeichen: '=' | ','
}

/**
 * Findet jedes `=` (Zuweisung, Deklaration, Standardwert), vor dem Leerraum steht und nach dem keiner folgt
 * („const x =y“, PR 2194), und jedes `,` ohne folgenden Leerraum („f(a,b)“, PR 2360). Der Syntaxbaum grenzt
 * Zeichenketten, Regex, Kommentare, `==`, `=>` und `+=` ab, die der Scanner als eigene Token liefert; JSX-Attribute in der Form
 * `a="x"` haben keinen Leerraum davor; `<div a ="1"/>` wird gemeldet. Ein Komma vor einer schließenden Klammer (`[1,]`) bleibt frei.
 */
export function findeVerschluckte(text: string, dateiname: string): Fund[] {
  const quelle = ts.createSourceFile(dateiname, text, ts.ScriptTarget.Latest, true, dateiname.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Fund[] = []
  const besuche = (knoten: ts.Node): void => {
    if (knoten.kind === ts.SyntaxKind.EqualsToken) pruefeGleich(knoten)
    if (knoten.kind === ts.SyntaxKind.CommaToken) pruefeKomma(knoten)
    for (const kind of knoten.getChildren(quelle)) besuche(kind)
  }
  const melde = (start: number, zeichen: Fund['zeichen']): void => {
    const zeile = quelle.getLineAndCharacterOfPosition(start).line
    funde.push({ zeile: zeile + 1, text: text.split('\n')[zeile].trim(), zeichen })
  }
  const pruefeGleich = (token: ts.Node): void => {
    const start = token.getStart(quelle)
    const davor = text[start - 1] ?? ''
    const danach = text[start + 1] ?? ''
    if (!/\s/.test(davor) || danach === '' || /\s/.test(danach)) return
    melde(start, '=')
  }
  const pruefeKomma = (token: ts.Node): void => {
    const start = token.getStart(quelle)
    const danach = text[start + 1] ?? ''
    if (danach === '' || /[\s)\]}>]/.test(danach)) return
    melde(start, ',')
  }
  besuche(quelle)
  return funde
}
