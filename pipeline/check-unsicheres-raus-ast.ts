/**
 * Zusicherung (Syntaxbaum): **`rolleTermineAus` faltet die Releases nur über `kalenderTermine` auf** (nicht über `expandEvents`).
 * Der Bau selbst liest Bestandsdateien und läuft nicht in `check:logic`; deshalb wird sein Quelltext geprüft.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

/** Namen, die als Argument von `.flatMap(...)` im Quelltext stehen. */
export function flatMapArgumente(quelltext: string): string[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const namen: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'flatMap') {
      namen.push(n.arguments.map((a) => a.getText(datei)).join(','))
    }
    ts.forEachChild(n, besuche)
  }
  besuche(datei)
  return namen
}

/** Wie oft `observedEpisodes(ohneWocheUeberAnzahl(...))` im Quelltext steht. */
export function gekappteBeobachtungen(quelltext: string): number {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  let zahl = 0
  const besuche = (n: ts.Node): void => {
    const arg = ts.isCallExpression(n) && n.expression.getText(datei) === 'observedEpisodes' ? n.arguments[0] : undefined
    if (arg && ts.isCallExpression(arg) && arg.expression.getText(datei) === 'ohneWocheUeberAnzahl') zahl++
    ts.forEachChild(n, besuche)
  }
  besuche(datei)
  return zahl
}

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const quelle = readFileSync(new URL('./bau/10-termine.ts', import.meta.url), 'utf8')
pruefe('10-termine: genau ein flatMap(kalenderTermine)', flatMapArgumente(quelle).filter((a) => a === 'kalenderTermine').length === 1, flatMapArgumente(quelle))
pruefe('10-termine: kein flatMap(expandEvents)', !flatMapArgumente(quelle).includes('expandEvents'))
pruefe('Sonde: expandEvents wird erkannt', flatMapArgumente(quelle.replace('flatMap(kalenderTermine)', 'flatMap(expandEvents)')).includes('expandEvents'))
pruefe('Sonde: ohne Aufruf keiner gezählt', flatMapArgumente(quelle.replace('flatMap(kalenderTermine)', 'map(kalenderTermine)')).filter((a) => a === 'kalenderTermine').length === 0)

const bau05 = readFileSync(new URL('./bau/05-releases.ts', import.meta.url), 'utf8')
pruefe('05-releases: observedEpisodes bekommt den gekappten Eintrag, genau einmal', gekappteBeobachtungen(bau05) === 1, gekappteBeobachtungen(bau05))
pruefe('Sonde: ohne Kappung erkannt', gekappteBeobachtungen(bau05.replace('observedEpisodes(ohneWocheUeberAnzahl(slot, schedule, entry.slug))', 'observedEpisodes(slot)')) === 0)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('rolleTermineAus faltet über kalenderTermine auf')
