/**
 * Ketten: Anweisungen, Typ-Felder oder Objekt-Einträge, die in der Zeile beginnen, in der der
 * Vorgänger endet (`a(); b()`, `x?: A; y?: B`, `...(a), ...(b)`).
 *
 * Anlass (10.10.2026): Die Zeilenzählung von `check:umfang` ließ sich umgehen, indem Code mit `;`
 * oder in zusammengezogenen Literalen an bestehende Zeilen gehängt wurde — zweimal passiert
 * (`pipeline/build.ts`, PR 681). Gezählt wird je Eltern-Liste, die über mehrere Zeilen geht; eine
 * Liste in einer Zeile (`{ a, b }`, `{ x: A; y: B }`) ist bewusst erlaubt.
 */
import ts from 'typescript'

/** Listen, deren Einträge gezählt werden: Eigenschaft des Elternknotens je Knotenart. */
function eintraege(knoten) {
  if (ts.isBlock(knoten) || ts.isModuleBlock(knoten) || ts.isSourceFile(knoten) || ts.isCaseOrDefaultClause(knoten)) return knoten.statements
  if (ts.isInterfaceDeclaration(knoten) || ts.isTypeLiteralNode(knoten) || ts.isClassLike(knoten)) return knoten.members
  if (ts.isObjectLiteralExpression(knoten)) return knoten.properties
  return undefined
}

/** Zeilennummern (1-basiert) aller Kettenglieder einer Datei; ein Glied je Eintrag ab dem zweiten in der Zeile. */
export function findeKetten(pfad, quelltext) {
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : /\.[mc]?js$/.test(pfad) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const quelle = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
  const zeile = (pos) => quelle.getLineAndCharacterOfPosition(pos).line
  const gefunden = []
  const besuche = (knoten) => {
    const liste = eintraege(knoten)
    if (liste && zeile(knoten.getStart(quelle)) !== zeile(knoten.end)) {
      for (let i = 1; i < liste.length; i++) {
        if (zeile(liste[i].getStart(quelle)) === zeile(liste[i - 1].end)) gefunden.push(zeile(liste[i].getStart(quelle)) + 1)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return gefunden
}
