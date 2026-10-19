/**
 * Findet im Syntaxbaum jede Stelle, an der die Oberfläche einen `href` aus einem Ausdruck setzt (JSX-Attribut, Spread, Objekt-Eigenschaft
 * auch mit berechnetem Schlüssel, Zuweisung `x.href =`, `setAttribute('href', …)`). Feste Zeichenketten und Vorlagen, deren fester Anfang
 * das Ziel schon festlegt („#…“, „/pfad…“, „mailto:…“, „https://host/…“), sind kein Befund; alles andere meldet sich mit seinem
 * Quelltext, im Zweifel als „?“ (Spread auf `<a>`, `setAttribute` mit berechnetem Namen). Gebraucht, damit keine neue Anzeigestelle eine
 * Adresse aus den Daten ungeprüft zum Klickziel macht (`check-beleg-href.ts`, Daniel, 19.10.2026: API-Adresse als Besucher-Link).
 */
import ts from 'typescript'

export interface HrefStelle {
  ausdruck: string
}

function nameVon(n: ts.PropertyName | ts.JsxAttributeName): string | undefined {
  if (ts.isComputedPropertyName(n)) return ts.isStringLiteralLike(n.expression) ? n.expression.text : undefined
  return ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : undefined
}

/**
 * Fester Anfang, der das Ziel festlegt: Sprungmarke, Pfad der eigenen Seite (nicht „//“, das wäre ein fremder Host), `mailto:` oder
 * Schema mit vollständigem Host (danach `/`, `?` oder `#`). Ein Leerzeichen am Anfang schneidet der Browser ab — es zählt nicht als fest.
 */
const FESTER_ANFANG = /^(?:#|\/(?!\/)|mailto:|https?:\/\/[^/?#]+[/?#])/

/** Ein Ausdruck, der schon im Quelltext feststeht (Zeichenkette oder Vorlage mit festem Anfang). */
function istFest(e: ts.Expression): boolean {
  if (ts.isStringLiteralLike(e)) return true
  return ts.isTemplateExpression(e) && FESTER_ANFANG.test(e.head.text)
}

function pruefeAusdruck(e: ts.Expression, raus: HrefStelle[]): void {
  if (!istFest(e)) raus.push({ ausdruck: e.getText() })
}

/** `x.href = …` und `x['href'] = …`. */
function istHrefZiel(e: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(e)) return e.name.text === 'href'
  return ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression) && e.argumentExpression.text === 'href'
}

/** `el.setAttribute('href', wert)`; ein berechneter Attributname meldet sich als „?“. */
function pruefeSetAttribute(n: ts.CallExpression, raus: HrefStelle[]): void {
  const [name, wert] = n.arguments
  if (!ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== 'setAttribute' || !name || !wert) return
  if (!ts.isStringLiteralLike(name)) raus.push({ ausdruck: `?${n.getText()}` })
  else if (name.text.toLowerCase() === 'href') pruefeAusdruck(wert, raus)
}

/** Alle `href`-Stellen mit nicht festem Wert in `text`; `dateiname` bestimmt nur die Syntaxart (.tsx → JSX, sonst `<T>x` als Typzusicherung). */
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
    } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && istHrefZiel(n.left)) {
      pruefeAusdruck(n.right, raus)
    } else if (ts.isCallExpression(n)) {
      pruefeSetAttribute(n, raus)
    }
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return raus
}
