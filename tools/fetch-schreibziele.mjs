/**
 * Die Dateien, die `data:fetch` (`pipeline/fetch.ts`) schreibt, aus dem Syntaxbaum von `fetch.ts` und allen Modulen, die es
 * relativ einbindet: jeder Aufruf von `writeJson`/`writeText`/`writeFileSync`/`appendFileSync`, dessen Ziel ein fester Pfad ist (Text oder `const` derselben Datei).
 * Ein Ziel, das sich so nicht auflösen lässt, steht als `?` mit Fundort in der Liste — die Vollständigkeitsprobe
 * (`tools/commit-data-test-verworfen.sh`) scheitert dann, statt es zu übersehen.
 *
 * Aufruf: node tools/fetch-schreibziele.mjs   → je Ziel eine Zeile `pfad<TAB>datei:zeile`
 */
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'

const WURZEL = resolve(import.meta.dirname, '..')
const SCHREIBER = new Set(['writeJson', 'writeText', 'writeFileSync', 'appendFileSync'])

/** Feste Texte der `const`-Bindungen auf oberster Ebene einer Datei. */
function konstanten(quelle) {
  const werte = new Map()
  for (const satz of quelle.statements) {
    if (!ts.isVariableStatement(satz) || !(satz.declarationList.flags & ts.NodeFlags.Const)) continue
    for (const d of satz.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer && ts.isStringLiteralLike(d.initializer)) werte.set(d.name.text, d.initializer.text)
    }
  }
  return werte
}

/** Ziel und Fundort jedes Schreibaufrufs einer Datei, dazu die relativ eingebundenen Module. */
function untersuche(datei) {
  const quelle = ts.createSourceFile(datei, readFileSync(datei, 'utf8'), ts.ScriptTarget.Latest, true)
  const werte = konstanten(quelle)
  const ziele = []
  const besuche = (knoten) => {
    // Die Helfer selbst (`writeJson`, `writeText` in `util.ts`) schreiben nur, was ihr Aufrufer nennt; der steht in der Liste.
    if (ts.isFunctionDeclaration(knoten) && knoten.name && SCHREIBER.has(knoten.name.text)) return
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && SCHREIBER.has(knoten.expression.text)) {
      const arg = knoten.arguments[0]
      const pfad = arg && ts.isStringLiteralLike(arg) ? arg.text : arg && ts.isIdentifier(arg) ? werte.get(arg.text) : undefined
      const zeile = quelle.getLineAndCharacterOfPosition(knoten.getStart()).line + 1
      ziele.push({ pfad: pfad ?? '?', ort: `${relative(WURZEL, datei).replace(/\\/g, '/')}:${zeile}` })
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  const module = quelle.statements
    .filter((s) => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text.startsWith('.'))
    .map((s) => resolve(dirname(datei), s.moduleSpecifier.text))
  return { ziele, module }
}

/** Alle Schreibziele von `pipeline/fetch.ts` samt der Module, die es (auch mittelbar) relativ einbindet. */
function fetchSchreibziele() {
  const gesehen = new Set()
  const offen = [resolve(WURZEL, 'pipeline/fetch.ts')]
  const ziele = []
  while (offen.length) {
    const datei = offen.pop()
    if (gesehen.has(datei)) continue
    gesehen.add(datei)
    const ergebnis = untersuche(datei)
    ziele.push(...ergebnis.ziele)
    offen.push(...ergebnis.module)
  }
  return ziele
}

for (const z of fetchSchreibziele()) console.log(`${z.pfad}\t${z.ort}`)
