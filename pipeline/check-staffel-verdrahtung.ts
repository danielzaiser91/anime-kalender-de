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

type Bindung = { name: string; aufruf: string; feld: string }
const STAFFEL_QUELLE: Bindung = { name: 'staffelQuellen', aufruf: 'alleStaffelQuellen()', feld: 'staffelQuelle' }
const STAFFEL_BIS: Bindung = { name: 'staffelBisse', aufruf: 'staffelEnden(ladeStaffelGrenzen())', feld: 'staffelBis' }

/** Alle Abweichungen von einer Verdrahtung `const <name> = <aufruf>` → `<feld>: <name>.get(t.id)`. */
function bindungsFehler(rumpf: ts.Block, datei: ts.SourceFile, b: Bindung): string[] {
  const fehler: string[] = []
  const bindungen = rumpf.statements.filter(
    (s): s is ts.VariableStatement =>
      ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === b.name),
  )
  const bindung = bindungen[0]?.declarationList
  const wert = bindung?.declarations[0]?.initializer
  if (bindungen.length !== 1) fehler.push(`${b.name} muss genau einmal direkt im Rumpf gebunden sein (gefunden: ${bindungen.length})`)
  if (bindung && !(bindung.flags & ts.NodeFlags.Const)) fehler.push(`${b.name} muss const sein`)
  if (wert && wert.getText(datei) !== b.aufruf) fehler.push(`${b.name} muss aus ${b.aufruf} kommen (gefunden: ${wert.getText(datei)})`)

  const verwendungen: string[] = []
  const zuweisungen: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isPropertyAssignment(n) && n.name.getText(datei) === b.feld) verwendungen.push(n.initializer.getText(datei))
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(datei) === b.name) zuweisungen.push(n.getText(datei))
    ts.forEachChild(n, besuche)
  }
  besuche(rumpf)
  if (verwendungen.length !== 1 || verwendungen[0] !== `${b.name}.get(t.id)`) {
    fehler.push(`${b.feld} muss genau einmal als ${b.name}.get(t.id) gesetzt werden (gefunden: ${verwendungen.join(' | ') || 'nichts'})`)
  }
  if (zuweisungen.length) fehler.push(`${b.name} wird neu zugewiesen: ${zuweisungen.join(' | ')}`)
  return fehler
}

/** Alle Abweichungen von den Verdrahtungen `staffelQuelle` (alleStaffelQuellen) und `staffelBis` (staffelEnden) in `schreibeZusatzdateien`. */
export function verdrahtungsFehler(quelltext: string): string[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const rumpf = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === FUNKTION)?.body
  if (!rumpf) return [`${FUNKTION} nicht gefunden`]
  return [...bindungsFehler(rumpf, datei, STAFFEL_QUELLE), ...bindungsFehler(rumpf, datei, STAFFEL_BIS)]
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
const BIS_AUFRUF = 'const staffelBisse = staffelEnden(ladeStaffelGrenzen())'
const BIS_NUTZUNG = 'staffelBis: staffelBisse.get(t.id)'
pruefe('Vorlage enthält staffelBis-Aufruf und -Nutzung genau einmal', quelle.split(BIS_AUFRUF).length === 2 && quelle.split(BIS_NUTZUNG).length === 2)
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
  ['staffelBis: zweite Nutzung nach der richtigen', quelle.replace(BIS_NUTZUNG, `${BIS_NUTZUNG}, staffelBis: undefined`)],
  ['staffelBis: falscher Schlüssel', quelle.replace(BIS_NUTZUNG, 'staffelBis: staffelBisse.get(t.id + 1)')],
  ['staffelBis: leere Zuordnung', quelle.replace(BIS_AUFRUF, 'const staffelBisse = new Map<number, number>() ?? staffelEnden(ladeStaffelGrenzen())')],
  ['staffelBis: Aufruf hinter `0 &&`', quelle.replace(BIS_AUFRUF, 'const staffelBisse = 0 && staffelEnden(ladeStaffelGrenzen()) || new Map<number, number>()')],
  ['staffelBis: Nutzung durch Kommentar ersetzt', quelle.replace(BIS_NUTZUNG, '/* staffelBis: staffelBisse.get(t.id), */ staffelBis: undefined, void staffelBisse.get(t.id),')],
  ['staffelBis: `let` statt `const`', quelle.replace(BIS_AUFRUF, 'let staffelBisse = staffelEnden(ladeStaffelGrenzen())')],
  ['staffelBis: zweite Bindung', quelle.replace(BIS_AUFRUF, `${BIS_AUFRUF}\n  const staffelBisse = new Map<number, number>()`)],
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
