/**
 * Zusicherung: **`schreibeZusatzdateien()` (`13-4-zusatzdateien.ts`) speist `franchises.json` mit den Staffelnummern aus
 * `alleStaffelQuellen()`** — aniSearch-Sprachblock plus `data/staffel-von-hand.yaml`. Fiele der Aufruf auf
 * `staffelQuellenAusAnisearch()` zurück, blieben alle Funktionstests grün, und Villainess hieße wieder „Teil 1/Teil 2"
 * (Prüfer-Review PR 1499). Prüft den Syntaxbaum des Bau-Schritts; das Ergebnis im Bestand prüft
 * `check-staffel-von-hand-bestand.ts`. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const FUNKTION = 'schreibeZusatzdateien'

/** Alle Abweichungen von der Verdrahtung `const staffelQuellen = alleStaffelQuellen()` → `staffelQuelle: staffelQuellen.get(t.id)`. */
export function verdrahtungsFehler(quelltext: string): string[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const rumpf = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === FUNKTION)?.body
  if (!rumpf) return [`${FUNKTION} nicht gefunden`]
  const fehler: string[] = []

  const bindungen = rumpf.statements.filter(
    (s): s is ts.VariableStatement =>
      ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'staffelQuellen'),
  )
  const bindung = bindungen[0]?.declarationList
  const wert = bindung?.declarations[0]?.initializer
  if (bindungen.length !== 1) fehler.push(`staffelQuellen muss genau einmal direkt im Rumpf gebunden sein (gefunden: ${bindungen.length})`)
  if (bindung && !(bindung.flags & ts.NodeFlags.Const)) fehler.push('staffelQuellen muss `const` sein')
  if (wert && !(ts.isCallExpression(wert) && ts.isIdentifier(wert.expression) && wert.expression.text === 'alleStaffelQuellen' && wert.arguments.length === 0)) {
    fehler.push(`staffelQuellen muss aus alleStaffelQuellen() ohne Argumente kommen (gefunden: ${wert.getText(datei)})`)
  }

  const verwendungen: string[] = []
  const zuweisungen: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isPropertyAssignment(n) && n.name.getText(datei) === 'staffelQuelle') verwendungen.push(n.initializer.getText(datei))
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(datei) === 'staffelQuellen') zuweisungen.push(n.getText(datei))
    ts.forEachChild(n, besuche)
  }
  besuche(rumpf)
  if (verwendungen.length !== 1 || verwendungen[0] !== 'staffelQuellen.get(t.id)') {
    fehler.push(`staffelQuelle muss genau einmal als staffelQuellen.get(t.id) gesetzt werden (gefunden: ${verwendungen.join(' | ') || 'nichts'})`)
  }
  if (zuweisungen.length) fehler.push(`staffelQuellen wird neu zugewiesen: ${zuweisungen.join(' | ')}`)
  return fehler
}

let fehlerZahl = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehlerZahl++
  console.error(`FEHLER: ${name} ${info}`)
}

const quelle = readFileSync(new URL('./bau/13-4-zusatzdateien.ts', import.meta.url), 'utf8')
pruefe('Bau-Schritt ist verdrahtet', verdrahtungsFehler(quelle).length === 0, verdrahtungsFehler(quelle).join('; '))

/* Jede Abweichung wird erkannt (Negativtests auf dem echten Quelltext). */
const AUFRUF = 'const staffelQuellen = alleStaffelQuellen()'
const NUTZUNG = 'staffelQuelle: staffelQuellen.get(t.id)'
pruefe('Vorlage enthält Aufruf und Nutzung genau einmal', quelle.split(AUFRUF).length === 2 && quelle.split(NUTZUNG).length === 2)
const abweichungen: [string, string][] = [
  ['Rückfall auf aniSearch allein', quelle.replace(AUFRUF, 'const staffelQuellen = staffelQuellenAusAnisearch()')],
  ['leere Zuordnung', quelle.replace(AUFRUF, 'const staffelQuellen = new Map<number, number>()')],
  ['Aufruf hinter `0 &&`', quelle.replace(AUFRUF, 'const staffelQuellen = 0 && alleStaffelQuellen()')],
  ['Aufruf mit Argument', quelle.replace(AUFRUF, 'const staffelQuellen = alleStaffelQuellen([])')],
  ['`let` statt `const`', quelle.replace(AUFRUF, 'let staffelQuellen = alleStaffelQuellen()')],
  ['Aufruf entfernt', quelle.replace(AUFRUF, 'const unbenutzt = alleStaffelQuellen()')],
  ['zweite Bindung desselben Namens', quelle.replace(AUFRUF, `${AUFRUF}\n  const staffelQuellen = new Map<number, number>()`)],
  ['Neuzuweisung (Typfehler ignoriert, Text zählt)', quelle.replace(AUFRUF, `${AUFRUF}\n  staffelQuellen = new Map()`)],
  ['falscher Schlüssel', quelle.replace(NUTZUNG, 'staffelQuelle: staffelQuellen.get(t.id + 1)')],
  ['Nutzung entfernt', quelle.replace(NUTZUNG, 'staffelQuelle: undefined')],
  ['zweite Nutzung nach der richtigen', quelle.replace(NUTZUNG, `${NUTZUNG}, staffelQuelle: undefined`)],
  ['zweite Nutzung vor der richtigen', quelle.replace(NUTZUNG, `staffelQuelle: undefined, ${NUTZUNG}`)],
]
pruefe('Jede Abweichung ändert den Quelltext wirklich', abweichungen.every(([, text]) => text !== quelle))
for (const [name, text] of abweichungen) pruefe(`Abweichung erkannt: ${name}`, verdrahtungsFehler(text).length > 0)

/* Was die Verdrahtung nicht berührt, ist kein Fehler: eine Abfrage der Zuordnung ist keine Zuweisung. */
const abfrage = quelle.replace(AUFRUF, `${AUFRUF}\n  const leer = staffelQuellen === undefined\n  void leer`)
pruefe('Lesende Verwendung bleibt ohne Befund', abfrage !== quelle && verdrahtungsFehler(abfrage).length === 0, verdrahtungsFehler(abfrage).join('; '))
pruefe('Fehlende Funktion: Befund statt Absturz', verdrahtungsFehler('export const x = 1').length === 1)

if (fehlerZahl) {
  console.error(`${fehlerZahl} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Staffel-Verdrahtung: 13-4 nutzt alleStaffelQuellen(), alle Abweichungen erkannt')
