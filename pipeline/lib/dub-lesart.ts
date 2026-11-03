/**
 * Liest per Syntaxbaum, wo Code `x.dub` (auch `x['dub']`, geklammert) mit `=== true` oder
 * `== true` als „deutsch bestätigt“ liest. Ein Weg mit `dub: true` kann nur abgeleitet sein (`dubAbgeleitet`).
 * In Ordnung ist eine Stelle, wenn der Bezeichner `dubAbgeleitet` oder `istLautAnbieter` in ihrer benannten Funktion
 * (sonst: ihrer Anweisung) vorkommt, oder wenn sie eine Marke `// dub-lesart: <Grund>` trägt: im Kommentar ihrer
 * eigenen Zeile oder als reine Kommentarzeile direkt davor. Ohne Grund gilt die Marke nicht.
 * Nicht gesehen (bewusst eng): `if (s.dub)`, `!!s.dub`, `Boolean(s.dub)`, Destrukturierung (`const { dub } = s`),
 * `!== false`, `switch (s.dub)`, Zugriff über Variablen-Schlüssel; Bezeichner in Kommentaren und Zeichenketten zählen nie.
 */
import ts from 'typescript'

export interface DubLesung {
  zeile: number
  /** Beachtet die Funktion die Abgeleitet-Frage? */
  beachtet: boolean
  /** Ausnahme mit Marke samt Grund. */
  marke: boolean
}

export interface DubLesart {
  lesungen: DubLesung[]
  /** Marken im Text (Kommentare mit `dub-lesart:`), auch ohne Grund. */
  marken: number
  /** Marken, die keine Lesung decken (tot, ohne Grund oder falsch platziert). */
  tote: number
}

const BEZEICHNER = new Set(['dubAbgeleitet', 'istLautAnbieter'])
const MARKE_ZEILE = /\/\/\s*dub-lesart:/
const MARKE_MIT_GRUND = /\/\/\s*dub-lesart:\s*\S/
const REINE_MARKE = /^\s*\/\/\s*dub-lesart:\s*\S/

function istDubZugriff(e: ts.Expression): boolean {
  const n = ts.skipParentheses(e)
  if (ts.isPropertyAccessExpression(n)) return n.name.text === 'dub'
  return ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === 'dub'
}

function istLiteral(e: ts.Expression, art: ts.SyntaxKind): boolean {
  return ts.skipParentheses(e).kind === art
}

/** Liest der Ausdruck `x.dub` als Ja? (`=== true`, `== true`, auch vertauscht) */
function liestAlsJa(n: ts.BinaryExpression): boolean {
  const k = n.operatorToken.kind
  if (k !== ts.SyntaxKind.EqualsEqualsEqualsToken && k !== ts.SyntaxKind.EqualsEqualsToken) return false
  const wahr = ts.SyntaxKind.TrueKeyword
  return (istDubZugriff(n.left) && istLiteral(n.right, wahr)) || (istLiteral(n.left, wahr) && istDubZugriff(n.right))
}

/** Benannte umschließende Funktion (Deklaration, Methode, `const f = () =>`), sonst die Anweisung der Dateiebene; kleine Lambdas zählen nicht. */
function umfeld(n: ts.Node): ts.Node {
  let p: ts.Node = n
  while (p.parent && !ts.isSourceFile(p.parent)) {
    p = p.parent
    if (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) return p
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) return p.parent
  }
  return p
}

/** Kommt einer der Bezeichner als Bezeichner-Knoten vor (nicht in Kommentar oder Zeichenkette)? */
function hatBezeichner(wurzel: ts.Node): boolean {
  if (ts.isIdentifier(wurzel) && BEZEICHNER.has(wurzel.text)) return true
  return ts.forEachChild(wurzel, (k) => (hatBezeichner(k) ? true : undefined)) === true
}

/** Zeile (0-basiert) der Marke mit Grund, die diese Lesezeile deckt: eigene Zeile oder reine Kommentarzeile davor. */
function deckendeMarke(zeilen: string[], zeile0: number): number | undefined {
  if (MARKE_MIT_GRUND.test(zeilen[zeile0] ?? '')) return zeile0
  if (REINE_MARKE.test(zeilen[zeile0 - 1] ?? '')) return zeile0 - 1
  return undefined
}

/** Alle Lesungen im Text samt Markenzahl und toten Marken. */
export function dubLesart(text: string): DubLesart {
  const quelle = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true)
  const zeilen = text.split('\n')
  const lesungen: DubLesung[] = []
  const genutzt = new Set<number>()
  const besuche = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && liestAlsJa(n)) {
      const zeile = quelle.getLineAndCharacterOfPosition(n.getStart(quelle)).line
      const marke = deckendeMarke(zeilen, zeile)
      if (marke !== undefined) genutzt.add(marke)
      lesungen.push({ zeile: zeile + 1, beachtet: hatBezeichner(umfeld(n)), marke: marke !== undefined })
    }
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  const markenZeilen = zeilen.flatMap((z, i) => (MARKE_ZEILE.test(z) ? [i] : []))
  return { lesungen, marken: markenZeilen.length, tote: markenZeilen.filter((i) => !genutzt.has(i)).length }
}

/** Alle Lesungen `x.dub === true` u. ä. im Text. */
export function dubLesungen(text: string): DubLesung[] {
  return dubLesart(text).lesungen
}

/** Lesungen, die weder die Frage beachten noch eine Marke mit Grund tragen. */
export function offeneLesungen(text: string): DubLesung[] {
  return dubLesungen(text).filter((l) => !l.beachtet && !l.marke)
}
