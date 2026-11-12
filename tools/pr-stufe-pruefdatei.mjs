/**
 * Prüfdatei-Erkennung für tools/pr-stufe.mjs: pipeline/check-*.ts, die in keiner Kette läuft, ist Stufe 1 statt 2.
 * Stufe 1 nur, wenn alle Bedingungen gelten (sonst 2, im Zweifel auch):
 *  - der Name `check-<x>` steht in keiner fremden Quelle (package.json, .github, Listen wie tools/check-logic-liste.txt,
 *    Importe, spawn/exec-Aufrufe, Workflow-`run:`) — die Aufrufer-Suche ist dieselbe wie bei Handwerkzeugen (`nameWirdGenannt`);
 *  - keine Quelle baut Prüfdateinamen dynamisch oder per Glob zusammen (`check-${…}`, `check-*`, `'check-' + …`);
 *  - die Datei schreibt nichts (writeFile*, appendFile*, writeJson, rm/unlink/rename/copy/cp/mkdir/createWriteStream);
 *  - die Datei liegt in der gelesenen Kette (sonst Zweifel).
 * Eigene Tests (`pipeline/check-<x>.test.*`) zählen nicht als Aufrufer.
 */
import { nameWirdGenannt } from './pr-stufe-kette.mjs'

const PRUEFDATEI = /^pipeline\/check-((?![^/]*\.(?:test|spec)\.)[^/]+)\.ts$/
const TEST = /\.(test|spec)\./
const SCHREIBT = /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|writeJson|rmSync|unlinkSync|renameSync|copyFileSync|cpSync|mkdirSync|createWriteStream)\b/
// Prüfdateinamen aus Teilen gebaut: Template, Glob oder Verkettung.
const DYNAMISCH = /check-(?:\$\{|\*|['"`]\s*\+)/

const istCheckOderTest = (pfad) => /(^|\/)check-[^/]+\.[cm]?[jt]sx?$/.test(pfad) || TEST.test(pfad)
const dynamischeCache = new WeakMap()

function baueDynamisch(kette) {
  if (!dynamischeCache.has(kette)) {
    dynamischeCache.set(kette, kette.quellen.some((q) => !istCheckOderTest(q.pfad) && DYNAMISCH.test(q.text)))
  }
  return dynamischeCache.get(kette)
}

/** true, wenn `pfad` eine pipeline/check-*.ts ist, die nirgends aufgerufen wird, nichts schreibt und in der Kette liegt. */
export function istPruefdatei(pfad, kette) {
  const m = PRUEFDATEI.exec(pfad)
  if (!m || !kette) return false
  const eigenerText = kette.quellen.find((q) => q.pfad === pfad)?.text
  if (eigenerText === undefined || SCHREIBT.test(eigenerText)) return false
  if (baueDynamisch(kette)) return false
  const eigen = (q) => q.pfad === pfad || q.pfad.startsWith(`pipeline/check-${m[1]}.test.`)
  return !nameWirdGenannt(`check-${m[1]}`, eigen, kette)
}
