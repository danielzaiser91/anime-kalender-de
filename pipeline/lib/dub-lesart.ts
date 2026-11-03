/**
 * Liest per Syntaxbaum, wo Code `<x>.dub === true` als „deutsch bestätigt“ liest.
 * Ein Weg mit `dub: true` kann nur abgeleitet sein (`dubAbgeleitet`: Joyn pauschal, Prime-Kanal erbt).
 * Eine Lese-Stelle ist in Ordnung, wenn ihre Funktion `dubAbgeleitet` oder `istLautAnbieter` beachtet
 * oder eine Marke `dub-lesart: <Grund>` in derselben oder der Zeile davor steht (Ausnahme mit Begründung).
 */
import ts from 'typescript'

export interface DubLesung {
  zeile: number
  /** Beachtet die Funktion die Abgeleitet-Frage? */
  beachtet: boolean
  /** Ausnahme mit Marke im Kommentar. */
  marke: boolean
}

const BEACHTET = /\b(dubAbgeleitet|istLautAnbieter)\b/
const MARKE = /dub-lesart:/

function istTrue(n: ts.Expression): boolean {
  return n.kind === ts.SyntaxKind.TrueKeyword
}

function istDubZugriff(n: ts.Expression): boolean {
  return ts.isPropertyAccessExpression(n) && n.name.text === 'dub'
}

/** Benannte umschließende Funktion (Deklaration, Methode, `const f = () =>`), sonst die Datei; kleine Lambdas zählen nicht. */
function umfeld(n: ts.Node): ts.Node {
  let p: ts.Node = n
  while (p.parent) {
    p = p.parent
    if (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) return p
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) return p.parent
  }
  return p
}

/** Alle Lesungen `x.dub === true` (oder `true === x.dub`) im Text; Kommentare und Strings zählen nicht. */
export function dubLesungen(text: string): DubLesung[] {
  const quelle = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true)
  const zeilen = text.split('\n')
  const funde: DubLesung[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
      const gleich = (istDubZugriff(n.left) && istTrue(n.right)) || (istTrue(n.left) && istDubZugriff(n.right))
      if (gleich) {
        const zeile = quelle.getLineAndCharacterOfPosition(n.getStart(quelle)).line
        const nah = `${zeilen[zeile - 1] ?? ''}\n${zeilen[zeile] ?? ''}`
        funde.push({ zeile: zeile + 1, beachtet: BEACHTET.test(umfeld(n).getText(quelle)), marke: MARKE.test(nah) })
      }
    }
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return funde
}

/** Lesungen, die weder die Frage beachten noch eine Marke tragen. */
export function offeneLesungen(text: string): DubLesung[] {
  return dubLesungen(text).filter((l) => !l.beachtet && !l.marke)
}
