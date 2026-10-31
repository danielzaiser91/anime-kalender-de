/**
 * Handwerkzeug-Erkennung für tools/pr-stufe.mjs: ein Werkzeug unter tools/, das nur von Hand läuft, ist Stufe 1 statt 2.
 * Mechanisch aus dem Quelltext: Handwerkzeug ist, was weder in .github, package.json, einer Prüfliste noch in einer anderen
 * Quelle (tools, pipeline, shared, web, worker, extension, .claude, Wurzeldateien wie vite.config.ts) vorkommt und einen eigenen Test hat.
 * Fremde Tests zählen als Aufrufer (tests-alle führt sie aus); nur der eigene <name>.test.* nicht.
 * Im Zweifel bleibt es Stufe 2: Name irgendwo genannt, Glob oder Template-Pfad (tools/*bild*, tools/${x}.mjs) in .github oder package.json.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WERKZEUG = /^tools\/([^/]+)\.(mjs|cjs|js|ts)$/
const TOOLS_TEST = /^tools\/([^/]+)\.(test|spec)\.[cm]?[jt]sx?$/
const TEST = /\.(test|spec)\./
const QUELL_ENDUNG = /\.(mjs|cjs|js|ts|tsx|sh|yml|yaml|json|txt)$/
// Die Ausnahmeliste nennt Werkzeuge ohne Aufrufer, ist also selbst keiner.
const KEINE_AUFRUFE = new Set(['tools/skript-aufrufer-ausnahmen.txt'])
const GRENZE_BYTES = 2_000_000

const ORDNER = ['.github', 'tools', 'pipeline', 'shared', 'web', 'worker', 'extension', '.claude']
const OHNE_ORDNER = new Set(['node_modules', 'archiv', 'dist', '.git', '.wrangler'])

function sammle(wurzel, ordner, aus) {
  const pfad = join(wurzel, ordner)
  if (!existsSync(pfad)) return
  for (const e of readdirSync(pfad, { withFileTypes: true })) {
    const rel = `${ordner}/${e.name}`
    if (e.isDirectory()) {
      if (!OHNE_ORDNER.has(e.name)) sammle(wurzel, rel, aus)
    } else if (QUELL_ENDUNG.test(e.name) && !KEINE_AUFRUFE.has(rel) && statSync(join(wurzel, rel)).size < GRENZE_BYTES) {
      aus.push({ pfad: rel, text: readFileSync(join(wurzel, rel), 'utf8') })
    }
  }
}

/** Liest alle Quellen, in denen ein Aufruf stehen könnte, und die Namen aller Tests unter tools/. */
export function leseKette(wurzel) {
  const quellen = []
  for (const o of ORDNER) sammle(wurzel, o, quellen)
  for (const e of existsSync(wurzel) ? readdirSync(wurzel, { withFileTypes: true }) : []) {
    if (e.isFile() && QUELL_ENDUNG.test(e.name) && e.name !== 'package-lock.json' && statSync(join(wurzel, e.name)).size < GRENZE_BYTES) {
      quellen.push({ pfad: e.name, text: readFileSync(join(wurzel, e.name), 'utf8') })
    }
  }
  const tests = existsSync(join(wurzel, 'tools')) ? readdirSync(join(wurzel, 'tools')).filter((n) => TEST.test(n)) : []
  return { quellen, tests }
}

const maskiere = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const PLATZHALTER = /\$\{\{.*?\}\}|\$\{.*?\}|\*+/
const WERKZEUG_PFAD = /tools\/(?:\$\{\{.*?\}\}|\$\{.*?\}|[^\s'"`)])+/g

/** Zweifel: ein Glob oder Template-Pfad (tools/*bild*, tools/${x}.mjs) in .github oder package.json kann `stamm` treffen. */
function globTrifft(q, stamm) {
  if (!q.pfad.startsWith('.github/') && q.pfad !== 'package.json') return false
  return (q.text.match(WERKZEUG_PFAD) || []).some((t) => {
    if (!/[*$]/.test(t)) return false
    const re = new RegExp(`^${t.split(PLATZHALTER).map(maskiere).join('.*')}$`)
    return ['mjs', 'cjs', 'js', 'ts'].some((x) => re.test(`tools/${stamm}.${x}`))
  })
}

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
  const eigen = (q) => q.pfad === pfad || (TOOLS_TEST.exec(q.pfad) || WERKZEUG.exec(q.pfad))?.[1] === stamm
  const muster = new RegExp(`(?<![\\w-])${maskiere(stamm)}(?![\\w-])`)
  return !kette.quellen.some((q) => !eigen(q) && (muster.test(q.text) || globTrifft(q, stamm)))
}
