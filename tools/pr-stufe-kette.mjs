/**
 * Handwerkzeug-Erkennung für tools/pr-stufe.mjs: ein Werkzeug unter tools/, das nur von Hand läuft, ist Stufe 1 statt 2.
 * Mechanisch aus dem Quelltext: Handwerkzeug ist, was weder in .github, package.json, einer Prüfliste noch in einer anderen
 * Nicht-Test-Quelle (tools, pipeline, shared) vorkommt und einen eigenen Test hat. Im Zweifel (Name kommt irgendwo vor) bleibt es Stufe 2.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WERKZEUG = /^tools\/([^/]+)\.(mjs|cjs|js|ts)$/
const TOOLS_TEST = /^tools\/([^/]+)\.(test|spec)\.[cm]?[jt]sx?$/
const TEST =/\.(test|spec)\./
const QUELL_ENDUNG = /\.(mjs|cjs|js|ts|tsx|sh|yml|yaml|json|txt)$/
// Die Ausnahmeliste nennt Werkzeuge ohne Aufrufer, ist also selbst keiner.
const KEINE_AUFRUFE = new Set(['tools/skript-aufrufer-ausnahmen.txt'])
const GRENZE_BYTES = 2_000_000

function sammle(wurzel, ordner, aus) {
  const pfad = join(wurzel, ordner)
  if (!existsSync(pfad)) return
  for (const e of readdirSync(pfad, { withFileTypes: true })) {
    const rel = `${ordner}/${e.name}`
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'archiv') sammle(wurzel, rel, aus)
    } else if (QUELL_ENDUNG.test(e.name) && !KEINE_AUFRUFE.has(rel) && !TEST.test(e.name) && statSync(join(wurzel, rel)).size < GRENZE_BYTES) {
      aus.push({ pfad: rel, text: readFileSync(join(wurzel, rel), 'utf8') })
    }
  }
}

/** Liest alle Quellen, in denen ein Aufruf stehen könnte, und die Namen aller Tests unter tools/. */
export function leseKette(wurzel) {
  const quellen = []
  for (const o of ['.github', 'tools', 'pipeline', 'shared']) sammle(wurzel, o, quellen)
  const pj = join(wurzel, 'package.json')
  if (existsSync(pj)) quellen.push({ pfad: 'package.json', text: readFileSync(pj, 'utf8') })
  const tests = existsSync(join(wurzel, 'tools')) ? readdirSync(join(wurzel, 'tools')).filter((n) => TEST.test(n)) : []
  return { quellen, tests }
}

const maskiere = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * true, wenn `pfad` ein Handwerkzeug oder dessen Test ist; kette stammt aus leseKette.
 * `diffPfade`: Dateien desselben PR, damit ein im PR neuer Test das neue Werkzeug als getestet zeigt.
 */
export function istHandwerkzeug(pfad, kette, diffPfade = []) {
  if (!kette) return false
  const test = TOOLS_TEST.exec(pfad)
  const m = test || (TEST.test(pfad) ? null : WERKZEUG.exec(pfad))
  if (!m) return false
  const stamm = m[1]
  const alleTests = [...kette.tests, ...diffPfade.filter((p) => TOOLS_TEST.test(p)).map((p) => p.slice(6))]
  const eigenerTest = test || alleTests.some((t) => t.startsWith(`${stamm}.test.`) || t.startsWith(`${stamm}.spec.`))
  if (!eigenerTest) return false
  const eigen = (q) => q.pfad === pfad || WERKZEUG.exec(q.pfad)?.[1] === stamm
  const muster = new RegExp(`(?<![\\w-])${maskiere(stamm)}(?![\\w-])`)
  return !kette.quellen.some((q) => !eigen(q) && muster.test(q.text))
}
