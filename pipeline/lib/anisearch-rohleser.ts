/**
 * Findet per Syntaxbaum Stellen, die eine der drei aniSearch-Zuordnungsdateien roh lesen. Die Streichliste `data/anisearch-mal-verworfen.json` gilt nur dort, wo
 * der Leser durch `anisearch-verworfen.ts` geht (`ladeAnisearchAbruf`, `ladeAnisearchMal`, `ladeAnisearchKatalog`) oder selbst `ohneVerworfene*` aufruft;
 * ein roher Leser bindet eine verworfene Seite still wieder an den Titel (Prüfer 2614 R1).
 */
import ts from 'typescript'

const ROH = /^data\/(anisearch|anisearch-mal|anisearch-ids-katalog)\.json$/
const FILTER = new Set(['ohneVerworfene', 'ohneVerworfeneSeiten', 'ladeVerworfene'])

const aufruf = (n: ts.Node): boolean => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && FILTER.has(n.expression.text)

function enthaeltFilter(n: ts.Node): boolean {
  let gefunden = aufruf(n)
  ts.forEachChild(n, (k) => {
    gefunden ||= enthaeltFilter(k)
  })
  return gefunden
}

/** Nächste umgebende Funktion bzw. Schleife (Ort, an dem die Streichliste mitgelesen sein muss); ohne sie nur der unmittelbare Aufruf. */
function geschuetzt(literal: ts.Node): boolean {
  if (literal.parent && aufruf(literal.parent)) return true
  for (let n: ts.Node | undefined = literal.parent; n; n = n.parent) {
    if (aufruf(n)) return true
    if (ts.isFunctionLike(n)) return enthaeltFilter(n)
  }
  return false
}

/** Zeilennummern (ab 1) aller Zeichenketten der drei Dateien, die nicht durch die Streichliste laufen. */
export function rohLeser(text: string): number[] {
  const quelle = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true)
  const zeilen: number[] = []
  const besuche = (n: ts.Node): void => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && ROH.test(n.text) && !geschuetzt(n)) {
      zeilen.push(quelle.getLineAndCharacterOfPosition(n.getStart()).line + 1)
    }
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return zeilen
}
