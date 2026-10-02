#!/usr/bin/env node
/**
 * **Beweist, dass sich gegenüber HEAD nur Kommentare geändert haben** — das Gegenstück zu
 * `bau-vergleich.mjs` für reine Kommentar-Umbauten (Chronik kürzen, Zuschreibungen entfernen).
 *
 * Jede geänderte Code-Datei wird vorher und nachher mit `ts.transpileModule` und
 * `removeComments` übersetzt; die Ausgaben müssen gleich sein. esbuild taugt dafür nicht: Es behält
 * Kommentare an manchen Stellen (z. B. in Objektliteralen). CSS prüft das Werkzeug nicht.
 *
 * Aufruf: node tools/nur-kommentare.mjs   Exit 0 = nur Kommentare, 1 = Code geändert.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(process.cwd() + '/package.json')
const ts = require('typescript')
const ENDUNGEN = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx']
const dateien = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' })
  .split('\n')
  .filter((d) => d && ENDUNGEN.some((e) => d.endsWith(e)))
let abweichend = 0
for (const d of dateien) {
  const alt = execFileSync('git', ['show', `HEAD:${d}`], { encoding: 'utf8', maxBuffer: 64 << 20 })
  const neu = readFileSync(d, 'utf8')
  const ueb = (code) => ts.transpileModule(code, { fileName: d, reportDiagnostics: false, compilerOptions: { removeComments: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, allowJs: true } }).outputText
  let a, b
  try {
    a = ueb(alt)
    b = ueb(neu)
  } catch (e) {
    console.log(`✖ ${d}: übersetzt nicht — ${String(e.message).split('\n')[0]}`)
    abweichend++
    continue
  }
  if (a !== b) {
    abweichend++
    const i = [...a].findIndex((z, k) => z !== b[k])
    console.log(`✖ ${d}: Code verschieden ab Zeichen ${i}: …${a.slice(i - 40, i + 40)}… / …${b.slice(i - 40, i + 40)}…`)
  }
}
console.log(`${dateien.length} Dateien geprüft, ${abweichend} mit Codeänderung.`)
process.exitCode = abweichend ? 1 : 0
