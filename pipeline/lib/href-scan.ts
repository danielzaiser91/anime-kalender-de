/**
 * Findet im Syntaxbaum jede Stelle, an der die Oberfläche einen `href` aus einem Ausdruck setzt (JSX-Attribut, Spread, Objekt-Eigenschaft).
 * Feste Zeichenketten und Vorlagen mit festem Anfang („#/news“, „https://…“, „mailto:…“) sind kein Befund; alles andere meldet sich
 * mit seinem Quelltext, im Zweifel als „?“ (Spread auf `<a>`). Gebraucht, damit keine neue Anzeigestelle eine Adresse
 * aus den Daten ungeprüft zum Klickziel macht (`check-beleg-href.ts`, Daniel, 19.10.2026: API-Adresse als Besucher-Link).
 */
import ts from 'typescript'

export interface HrefStelle {
  ausdruck: string
}

function nameVon(n: ts.PropertyName | ts.JsxAttributeName): string | undefined {
  return ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : undefined
}

/** Ein Ausdruck, der schon im Quelltext feststeht (Zeichenkette oder Vorlage mit festem Anfang). */
function istFest(e: ts.Expression): boolean {
  if (ts.isStringLiteralLike(e)) return true
  return ts.isTemplateExpression(e) && e.head.text !== ''
}

function pruefeAusdruck(e: ts.Expression, raus: HrefStelle[]): void {
  if (!istFest(e)) raus.push({ ausdruck: e.getText() })
}

/** Alle `href`-Stellen mit nicht festem Wert in `text`; `dateiname` bestimmt nur die Syntaxart (.tsx → JSX). */
export function findeHrefs(text: string, dateiname: string): HrefStelle[] {
  const quelle = ts.createSourceFile(dateiname, text, ts.ScriptTarget.Latest, true, dateiname.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const raus: HrefStelle[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isJsxAttribute(n) && nameVon(n.name) === 'href') {
      const wert = n.initializer
      if (wert && ts.isJsxExpression(wert) && wert.expression) pruefeAusdruck(wert.expression, raus)
    } else if (ts.isJsxSpreadAttribute(n) && ts.isJsxOpeningLikeElement(n.parent.parent) && n.parent.parent.tagName.getText() === 'a') {
      raus.push({ ausdruck: `?${n.getText()}` })
    } else if (ts.isPropertyAssignment(n) && nameVon(n.name) === 'href') {
      pruefeAusdruck(n.initializer, raus)
    } else if (ts.isShorthandPropertyAssignment(n) && n.name.text === 'href') {
      raus.push({ ausdruck: 'href' })
    }
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return raus
}
