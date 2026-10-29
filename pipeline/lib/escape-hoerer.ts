/**
 * Findet Tastenhörer im Syntaxbaum: jeden `addEventListener` für keydown/keyup/keypress oder mit einem Ereignisnamen, der sich nicht
 * auflösen lässt, jede `on…`-Zuweisung für Tasten und jeden Zugriff auf `addEventListener`, der kein Aufruf ist (Alias, `bind`,
 * Destrukturierung). Escape-Hörer auf `window`/`document` gehen über `useEscape` (`web/src/lib/escape.ts`); der Wächter fragt
 * bewusst nicht nach `'Escape'` im Handler (`keyCode`, Konstanten und Tabellen-Hörer umgingen das).
 */
import ts from 'typescript'

const TASTEN = new Set(['keydown', 'keyup', 'keypress'])
const TASTEN_ZUWEISUNG = new Set(['onkeydown', 'onkeyup', 'onkeypress'])
const GLOBALE = new Set(['window', 'document', 'globalThis', 'self'])

const istText = (n: ts.Node): n is ts.StringLiteralLike => ts.isStringLiteralLike(n)

function lies(text: string, datei: string): ts.SourceFile {
  return ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, datei.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

/** Name eines Zugriffs `x.name` oder `x['name']`; `undefined`, wenn er sich nicht statisch lesen lässt. */
function zugriffsName(n: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(n)) return n.name.text
  if (ts.isElementAccessExpression(n) && istText(n.argumentExpression)) return n.argumentExpression.text
  return undefined
}

/** Texte, die `const NAME = '…'` in dieser Quelle bindet (Name → Werte); damit lässt sich ein Ereignisname aus einer Konstante lesen. */
export function textKonstanten(text: string, datei: string): Map<string, Set<string>> {
  const aus = new Map<string, Set<string>>()
  const geh = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && istText(n.initializer)) {
      aus.set(n.name.text, (aus.get(n.name.text) ?? new Set()).add(n.initializer.text))
    }
    ts.forEachChild(n, geh)
  }
  geh(lies(text, datei))
  return aus
}

/** Ob der Ereignisname eine Taste ist oder sich nicht auflösen lässt (dann gilt er als Treffer). */
function istTastenName(arg: ts.Node, konstanten: Map<string, Set<string>>): boolean {
  if (istText(arg)) return TASTEN.has(arg.text)
  const werte = ts.isIdentifier(arg) ? konstanten.get(arg.text) : undefined
  return werte === undefined || [...werte].some((w) => TASTEN.has(w))
}

const istAufrufVon = (n: ts.Node): boolean => ts.isCallExpression(n.parent) && n.parent.expression === n

/** Ob `n` ein Tastenhörer ist: Aufruf mit Tastenname, Zugriff ohne Aufruf (Alias), Destrukturierung, `on…`-Zuweisung, dynamischer Zugriff auf eine Globale. */
function istHoerer(n: ts.Node, konstanten: Map<string, Set<string>>): boolean {
  const name = zugriffsName(n)
  if (name === 'addEventListener' && istAufrufVon(n)) {
    const aufruf = n.parent as ts.CallExpression
    return aufruf.arguments.length >= 1 && istTastenName(aufruf.arguments[0], konstanten)
  }
  if (name === 'addEventListener') return true
  if (ts.isBindingElement(n)) return (n.propertyName ?? n.name).getText() === 'addEventListener'
  if (name !== undefined) return TASTEN_ZUWEISUNG.has(name)
  return ts.isElementAccessExpression(n) && GLOBALE.has(n.expression.getText())
}

/** Zeilen (ab 1) aller Tastenhörer in `text`; `konstanten` sind die Textkonstanten des ganzen Baums (`textKonstanten`). */
export function findeTastenHoerer(text: string, datei: string, konstanten: Map<string, Set<string>> = new Map()): number[] {
  const quelle = lies(text, datei)
  const zeilen: number[] = []
  const geh = (n: ts.Node) => {
    if (istHoerer(n, konstanten)) zeilen.push(quelle.getLineAndCharacterOfPosition(n.getStart()).line + 1)
    ts.forEachChild(n, geh)
  }
  geh(quelle)
  return zeilen
}
