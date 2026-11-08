/**
 * Zusicherung (Syntaxbaum): **kein `process.exit()` im try- oder catch-Block eines `try` mit `finally`** in den Prüfskripten
 * (`pipeline/check-*.ts`, `tools/check-*.mjs`). `process.exit` beendet den Prozess sofort, das `finally` (Aufräumen) liefe nie.
 * Richtig: `process.exitCode = n` setzen und den Block verlassen. Exit außerhalb eines solchen `try` und in der
 * `finally`-Klausel selbst bleibt erlaubt; Funktionsgrenzen unterbrechen die Suche (eine Hilfsfunktion im try wäre ein anderer Fall).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/** Zeilen (1-basiert) jedes `process.exit(...)`, das ein `finally` überspringen würde. */
export function exitImTry(quelltext: string): number[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const zeilen: number[] = []
  const istExit = (n: ts.Node): boolean =>
    ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'exit' && n.expression.expression.getText(datei) === 'process'
  const besuche = (n: ts.Node, imTry: boolean): void => {
    if (imTry && istExit(n)) zeilen.push(datei.getLineAndCharacterOfPosition(n.getStart(datei)).line + 1)
    if (ts.isTryStatement(n) && n.finallyBlock) {
      besuche(n.tryBlock, true)
      if (n.catchClause) besuche(n.catchClause.block, true)
      besuche(n.finallyBlock, imTry)
      return
    }
    const innen = ts.isFunctionLike(n) ? false : imTry
    ts.forEachChild(n, (k) => besuche(k, innen))
  }
  besuche(datei, false)
  return zeilen
}

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const t = (s: string): string => exitImTry(s).join(',')
pruefe('Gegenfall: exit im try mit finally wird gemeldet', t('try {\n  process.exit(1)\n} finally {\n  x()\n}') === '2')
pruefe('exit im catch eines try mit finally wird gemeldet', t('try {\n  a()\n} catch {\n  process.exit(2)\n} finally {\n  x()\n}') === '4')
pruefe('exit tief verschachtelt (if im try) wird gemeldet', t('try {\n  if (a) {\n    process.exit(1)\n  }\n} finally {}') === '3')
pruefe('exit außerhalb jedes try bleibt grün', t('process.exit(1)') === '')
pruefe('exit nach dem try mit finally bleibt grün', t('try { a() } finally { b() }\nprocess.exit(1)') === '')
pruefe('exit im try ohne finally bleibt grün', t('try { process.exit(1) } catch { b() }') === '')
pruefe('exit in der finally-Klausel selbst bleibt grün', t('try { a() } finally { process.exit(1) }') === '')
pruefe('exit in einer Funktion im try bleibt grün (Funktionsgrenze)', t('try {\n  const f = () => process.exit(1)\n} finally {}') === '')
pruefe('exit im try mit finally in einer äußeren Schleife wird gemeldet', t('for (const a of b) {\n  try {\n    process.exit(1)\n  } finally {}\n}') === '3')
pruefe('anderes exit (app.exit) wird nicht gemeldet', t('try { app.exit(1) } finally {}') === '')
pruefe('zwei exit im try werden beide gemeldet', t('try {\n  process.exit(1)\n  process.exit(2)\n} finally {}') === '2,3')

const wurzel = fileURLToPath(new URL('..', import.meta.url))
const pruefDateien = [
  ...readdirSync(join(wurzel, 'pipeline')).filter((f) => /^check-.*\.ts$/.test(f)).map((f) => join('pipeline', f)),
  ...readdirSync(join(wurzel, 'tools')).filter((f) => /^check-.*\.mjs$/.test(f)).map((f) => join('tools', f)),
]
pruefe('Wächter findet Prüfdateien (nicht 0)', pruefDateien.length > 100, pruefDateien.length)
for (const rel of pruefDateien) {
  const zeilen = exitImTry(readFileSync(join(wurzel, rel), 'utf8'))
  pruefe(`${rel}: process.exit im try mit finally (Zeile ${zeilen.join(',')}) — process.exitCode setzen und den Block verlassen`, zeilen.length === 0)
}

if (fehler) process.exit(1)
console.log(`check-process-exit-im-try: ok (${pruefDateien.length} Prüfdateien, 11 Fälle)`)
