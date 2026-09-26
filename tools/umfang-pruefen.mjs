#!/usr/bin/env node
/**
 * Sperrklinke gegen übergroße Funktionen und Dateien: Die Überlänge darf nur sinken.
 *
 * Anlass (26.09.2026): Eine Durchsicht fand `main()` in `pipeline/build.ts` mit 7.809 Zeilen,
 * `DetailPanel` mit 3.125, `handlePruefung` im Worker mit 1.244 — gewachsen Zeile um Zeile, weil
 * jede einzelne Ergänzung klein war. Eine Regel im Text hält das nicht auf, eine Zahl schon.
 *
 * Gemessen wird je Bereich (`pipeline`, `web`, …) die **Überlänge**: für jede Funktion die Zeilen
 * über GRENZE_FUNKTION, für jede Datei die Zeilen über GRENZE_DATEI, aufsummiert. Die Summe steht
 * in `tools/umfang-grenzen.json` und darf nicht steigen. Wer eine zu große Funktion um zehn
 * Zeilen verlängert, muss also zehn Zeilen woanders herauslösen — der übliche Weg ist, das Neue
 * gleich als eigene, kleine Funktion zu schreiben. Wer Code nur verschiebt, bleibt gleich.
 *
 * Aufruf:
 *   node tools/umfang-pruefen.mjs                 prüfen (Exit 1 bei Wachstum)
 *   node tools/umfang-pruefen.mjs --festschreiben gesunkene Werte übernehmen (erhöht nie)
 *   node tools/umfang-pruefen.mjs --liste         die größten Funktionen und Dateien zeigen
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

export const GRENZE_FUNKTION = 80
export const GRENZE_DATEI = 800
const WURZEL = resolve(import.meta.dirname, '..')
const GRENZEN = resolve(WURZEL, 'tools/umfang-grenzen.json')
const BEREICHE = ['pipeline', 'shared', 'web/src', 'worker/src', 'extension', 'tools']
// Prüfsätze wachsen mit jedem Fehlerfall — bei ihnen zählt nur die Funktionslänge, nicht die Datei.
const PRUEFSATZ = /(^pipeline\/check-|\.test\.|-pruefen)/

function dateien() {
  return execFileSync('git', ['-C', WURZEL, 'ls-files', ...BEREICHE], { encoding: 'utf8' })
    .split('\n')
    .filter((p) => /\.(ts|tsx|js|mjs|cjs|mts)$/.test(p) && !p.endsWith('.d.ts'))
}

function funktionen(pfad, quelltext) {
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : /\.[mc]?js$/.test(pfad) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const quelle = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
  const zeile = (pos) => quelle.getLineAndCharacterOfPosition(pos).line
  const gefunden = []
  // `;(() => { … })()` um eine ganze Datei ist eine Modulhülle, keine Funktion — gezählt wird ihr Inhalt.
  const istHuelle = (knoten) => {
    let p = knoten.parent
    while (p && (ts.isParenthesizedExpression(p) || ts.isCallExpression(p) || ts.isPrefixUnaryExpression(p))) p = p.parent
    return ts.isExpressionStatement(p) && ts.isSourceFile(p.parent)
  }
  const besuche = (knoten, pfadname) => {
    let name = pfadname
    if (
      (ts.isArrowFunction(knoten) || ts.isFunctionExpression(knoten)) && istHuelle(knoten)
    ) {
      // weiter unten mit leerem Namen
    } else if (
      (ts.isFunctionDeclaration(knoten) ||
        ts.isArrowFunction(knoten) ||
        ts.isFunctionExpression(knoten) ||
        ts.isMethodDeclaration(knoten)) &&
      knoten.body
    ) {
      const eigen =
        knoten.name?.getText(quelle) ??
        (ts.isVariableDeclaration(knoten.parent) ? knoten.parent.name.getText(quelle) : '(anonym)')
      name = pfadname ? `${pfadname} › ${eigen}` : eigen
      gefunden.push({ name, zeilen: zeile(knoten.end) - zeile(knoten.getStart(quelle)) + 1, ab: zeile(knoten.getStart(quelle)) + 1 })
    }
    ts.forEachChild(knoten, (kind) => besuche(kind, name))
  }
  besuche(quelle, '')
  return gefunden
}

export function vermessen() {
  const stand = {}
  const einzeln = []
  for (const pfad of dateien()) {
    const bereich = BEREICHE.find((b) => pfad.startsWith(`${b}/`))
    const text = readFileSync(resolve(WURZEL, pfad), 'utf8')
    const zeilen = text.split('\n').length
    stand[bereich] ??= { funktionen: 0, dateien: 0 }
    if (!PRUEFSATZ.test(pfad) && zeilen > GRENZE_DATEI) {
      stand[bereich].dateien += zeilen - GRENZE_DATEI
      einzeln.push({ art: 'Datei', ort: pfad, zeilen })
    }
    for (const f of funktionen(pfad, text)) {
      if (f.zeilen <= GRENZE_FUNKTION) continue
      stand[bereich].funktionen += f.zeilen - GRENZE_FUNKTION
      einzeln.push({ art: 'Funktion', ort: `${pfad}:${f.ab} ${f.name}`, zeilen: f.zeilen })
    }
  }
  return { stand, einzeln }
}

const { stand, einzeln } = vermessen()
const erlaubt = JSON.parse(readFileSync(GRENZEN, 'utf8'))

if (process.argv.includes('--liste')) {
  for (const e of einzeln.sort((a, b) => b.zeilen - a.zeilen).slice(0, 40)) console.log(`${String(e.zeilen).padStart(6)}  ${e.art.padEnd(8)} ${e.ort}`)
  process.exit(0)
}

const zuViel = []
const neu = structuredClone(erlaubt)
for (const [bereich, werte] of Object.entries(stand)) {
  for (const art of ['funktionen', 'dateien']) {
    const grenze = erlaubt.ueberlaenge[bereich]?.[art] ?? 0
    if (werte[art] > grenze) zuViel.push(`${bereich}: Überlänge der ${art} ${werte[art]} statt höchstens ${grenze}`)
    else if (werte[art] < grenze) (neu.ueberlaenge[bereich] ??= {})[art] = werte[art]
  }
}

if (process.argv.includes('--festschreiben')) {
  if (zuViel.length) {
    console.error('Festschreiben erhöht nie. Erst die Überlänge abbauen:\n  ' + zuViel.join('\n  '))
    process.exit(1)
  }
  writeFileSync(GRENZEN, JSON.stringify(neu, null, 2) + '\n')
  console.log('Gesunkene Werte übernommen.')
  process.exit(0)
}

if (zuViel.length) {
  console.error(
    `✖ Code ist über die Grenzen gewachsen (Funktion > ${GRENZE_FUNKTION}, Datei > ${GRENZE_DATEI} Zeilen):\n  ` +
      zuViel.join('\n  ') +
      '\n\nNeues nicht in eine übergroße Funktion oder Datei schreiben, sondern als eigene Funktion' +
      '\n(eigenes Modul) herauslösen. Die größten Stellen: node tools/umfang-pruefen.mjs --liste' +
      '\nDie Grenzen werden nicht angehoben — siehe CLAUDE.md, „Codegestalt".',
  )
  process.exit(1)
}
const gesunken = JSON.stringify(neu) !== JSON.stringify(erlaubt)
console.log(`Umfang in Ordnung.${gesunken ? ' Überlänge gesunken — `node tools/umfang-pruefen.mjs --festschreiben` übernimmt das.' : ''}`)
