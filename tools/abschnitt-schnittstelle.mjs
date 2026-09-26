#!/usr/bin/env node
/**
 * Was braucht ein Abschnitt einer großen Funktion, und was liefert er? — die Vorarbeit, um ihn als
 * eigene Funktion herauszulösen.
 *
 * Für die Zeilen <von>–<bis> einer Datei nennt es, bezogen auf die umschließende Funktion:
 *   ein   — dort vorher deklarierte Namen, die der Abschnitt liest   → Parameter
 *   ändert — davon die, die er neu zuweist (`x = …`, `x++`)           → Rückgabe oder Objekt
 *   aus   — im Abschnitt deklarierte Namen, die danach gebraucht werden → Rückgabe
 * Aufgelöst wird über den Typprüfer, also ohne Verwechslung gleichnamiger Variablen.
 *
 * Aufruf: node tools/abschnitt-schnittstelle.mjs pipeline/build.ts 3098 3200
 */
import { resolve } from 'node:path'
import ts from 'typescript'

const [datei, vonText, bisText] = process.argv.slice(2)
if (!datei || !vonText || !bisText) {
  console.error('Aufruf: node tools/abschnitt-schnittstelle.mjs <datei> <von> <bis>')
  process.exit(2)
}
const pfad = resolve(datei)
const programm = ts.createProgram([pfad], {
  allowImportingTsExtensions: true,
  noEmit: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
})
const pruefer = programm.getTypeChecker()
const quelle = programm.getSourceFile(pfad)
const zeile = (pos) => quelle.getLineAndCharacterOfPosition(pos).line + 1
const von = Number(vonText)
const bis = Number(bisText)

// Die innerste Funktion, die den ganzen Abschnitt umschließt.
let huelle
const suche = (knoten) => {
  if (ts.isFunctionLike(knoten) && knoten.body && zeile(knoten.getStart(quelle)) < von && zeile(knoten.end) > bis) huelle = knoten
  ts.forEachChild(knoten, suche)
}
suche(quelle)
if (!huelle) {
  console.error('Keine Funktion umschließt diesen Abschnitt.')
  process.exit(2)
}

const deklariertIn = (symbol) => symbol?.declarations?.[0]
const liegtInHuelle = (d) => d && d.getStart(quelle) >= huelle.getStart(quelle) && d.end <= huelle.end && d.getSourceFile() === quelle
const ein = new Map()
const aendert = new Set()
const aus = new Map()

function istSchreibend(bezeichner) {
  const p = bezeichner.parent
  if (ts.isBinaryExpression(p) && p.left === bezeichner && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return true
  if ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(p.operator)) return true
  return false
}

const besuche = (knoten) => {
  if (ts.isIdentifier(knoten)) {
    // `{ x }` verweist über die Kurzschreibweise auf die Variable, nicht auf die Eigenschaft.
    const symbol = ts.isShorthandPropertyAssignment(knoten.parent)
      ? pruefer.getShorthandAssignmentValueSymbol(knoten.parent)
      : pruefer.getSymbolAtLocation(knoten)
    const d = deklariertIn(symbol)
    const z = zeile(knoten.getStart(quelle))
    const istVariable = d && (ts.isVariableDeclaration(d) || ts.isParameter(d) || ts.isBindingElement(d) || ts.isFunctionDeclaration(d))
    if (istVariable && d !== huelle && liegtInHuelle(d)) {
      const dz = zeile(d.getStart(quelle))
      if (z >= von && z <= bis && (dz < von || dz > bis)) {
        ein.set(symbol.name, dz)
        if (istSchreibend(knoten)) aendert.add(symbol.name)
      }
      if (z > bis && dz >= von && dz <= bis) aus.set(symbol.name, dz)
    }
  }
  ts.forEachChild(knoten, besuche)
}
besuche(huelle.body)

const liste = (m) => [...m].sort((a, b) => a[1] - b[1]).map(([n, z]) => `${n} (Z. ${z})`).join(', ') || '—'
console.log(`Abschnitt ${datei}:${von}-${bis} in ${huelle.name?.getText(quelle) ?? '(anonym)'}`)
console.log(`ein    (${ein.size}): ${liste(ein)}`)
console.log(`ändert (${aendert.size}): ${[...aendert].join(', ') || '—'}`)
console.log(`aus    (${aus.size}): ${liste(aus)}`)
