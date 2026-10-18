// PreToolUse(Agent): verweigert den Start eines Agent-Prüfers (subagent_type "pruefer"), wenn der PR schon GRENZE Urteile hat.
// Daniel 18.10.2026: „höchstens 3 Prüfrunden“ war Vorsatz, PR 1427 und 1389 liefen bis Runde 9 bzw. 6 — jetzt greift es technisch.
// Ein Urteil des Agent-Prüfers ist ein PR-Kommentar, dessen erste Zeile mit „Prüfer:“ oder „Prüfer Runde N:“ beginnt (5 PRs gemessen:
// 1427, 1442, 1454, 1389, 1433). Das CI-Urteil beginnt mit „**Prüfer-Review**“ und zählt nicht.
// Ausweg: „[runde-ausnahme: <Grund>]“ im Auftrag. Scheitert gh oder fehlt die PR-Nummer, läuft der Start durch (Sperre aus Versehen ist schlimmer).
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')

const GRENZE = 3
const STANDARD_REPO = 'danielzaiser91/anime-kalender-de'
const GH_WINDOWS = 'C:/Program Files/GitHub CLI/gh.exe'
const URTEIL = /^[\s*_#>]*Prüfer(?: Runde \d+)?:/
const AUSNAHME = /\[runde-ausnahme:\s*\S[^\]]*\]/
const PR_IM_AUFTRAG = /\bPR\s*#?(\d{2,5})\b|github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d{1,5})\b/i

/** { nummer, repo } aus dem ersten Treffer im Auftrag, sonst null. */
function findePr(prompt) {
  const m = PR_IM_AUFTRAG.exec(prompt)
  if (!m) return null
  return m[1] ? { nummer: m[1], repo: STANDARD_REPO } : { nummer: m[3], repo: m[2] }
}

// PRUEFRUNDEN_GH_SKRIPT: Node-Skript statt gh, nur für den Prozesstest.
function ghAufruf(args) {
  const skript = process.env.PRUEFRUNDEN_GH_SKRIPT
  const gh = skript ? process.execPath : fs.existsSync(GH_WINDOWS) ? GH_WINDOWS : 'gh'
  return execFileSync(gh, skript ? [skript, ...args] : args, { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] })
}

/** Anzahl der Agent-Prüfer-Urteile unter den Kommentaren. */
const zaehleUrteile = (kommentare) => kommentare.filter((k) => URTEIL.test(k.body)).length

/** Verweigerungstext oder null. `gh(args)` liefert stdout oder wirft; `warne(text)` schreibt nach stderr. */
function pruefe(input, { gh = ghAufruf, warne = (t) => process.stderr.write(`${t}\n`) } = {}) {
  const ti = input.tool_input || {}
  if (ti.subagent_type !== 'pruefer') return null
  const prompt = String(ti.prompt || '')
  if (AUSNAHME.test(prompt)) return null
  const pr = findePr(prompt)
  if (!pr) {
    warne('pruefrunden: keine PR-Nummer im Auftrag, Start nicht geprüft')
    return null
  }
  let kommentare
  try {
    kommentare = JSON.parse(gh(['pr', 'view', pr.nummer, '--repo', pr.repo, '--json', 'comments'])).comments
    if (!Array.isArray(kommentare)) throw new Error('Antwort ohne comments')
  } catch (e) {
    warne(`pruefrunden: gh nicht erreichbar für PR ${pr.nummer} (${e.message}), Start nicht geprüft`)
    return null
  }
  const n = zaehleUrteile(kommentare)
  if (n < GRENZE) return null
  return `R4 gibt es nicht (Daniel 18.10.2026). Dirigent entscheidet: Teilmerge mit Folgeauftrag oder neuer Schnitt. PR ${pr.nummer} hat schon ${n} Prüfer-Urteile. Ausnahme nur mit [runde-ausnahme: <Grund>] im Auftrag.`
}

/** Text für stdout: deny-JSON oder leer. Ungültige Eingabe lässt durch. */
function antwort(stdinText, optionen) {
  let grund = null
  try {
    grund = pruefe(JSON.parse(stdinText), optionen)
  } catch {}
  if (!grund) return ''
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } })
}

module.exports = { pruefe, antwort, findePr, zaehleUrteile, GRENZE }

if (require.main === module) {
  let s = ''
  process.stdin.on('data', (d) => (s += d)).on('end', () => {
    process.stdout.write(antwort(s))
    process.exit(0)
  })
}
