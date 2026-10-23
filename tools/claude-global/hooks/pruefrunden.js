// PreToolUse(Agent): verweigert den Start eines Agent-Prüfers (subagent_type "pruefer"), wenn der PR schon die erlaubten Urteile hat.
// Daniel 21.10.2026 04:09/04:20: eine Prüfrunde, nur bei Prüfstufe 2 eine zweite, letzte (vorher 18.10.: „höchstens 3“, PR 1427 und
// 1389 liefen bis Runde 9 bzw. 6). Die Stufe steht im CI-Kommentar „<!-- pr-stufe --> **Prüfstufe N**“ (pr-pruefer.yml); fehlt er,
// gilt Stufe 2 (eine Sperre aus Versehen ist schlimmer).
// Ein Urteil des Agent-Prüfers ist ein PR-Kommentar, dessen erste Zeile mit „Prüfer:“ oder „Prüfer Runde N:“ beginnt (5 PRs gemessen:
// 1427, 1442, 1454, 1389, 1433). Das CI-Urteil beginnt mit „**Prüfer-Review**“ und zählt nicht.
// Ausweg: „[runde-ausnahme: <Grund>]“ im Auftrag (Grund ab 8 Zeichen, nicht der Platzhalter); greift er wirklich (Urteile an der Grenze),
// steht der Grund mit PR in ~/.claude/logs/pruefrunden-ausnahmen.jsonl, damit der Prüftisch sieht, wie oft er greift. Scheitert gh, fehlt die PR-Nummer oder nennt der Auftrag
// mehrere Repos, läuft der Start durch (Sperre aus Versehen ist schlimmer).
// Eintrag in ~/.claude/settings.json unter hooks.PreToolUse (timeout über den 20 s von gh, der Nachbar agenten-grenze hat 10):
//   { "matcher": "Agent|Task", "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/pruefrunden.js"], "timeout": 30 }] }
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const GRENZE_STUFE_2 = 2
const GRENZE_SONST = 1
const STUFE_KOMMENTAR = /^<!-- pr-stufe -->\s*\*\*Prüfstufe (\d)\*\*/
const STANDARD_REPO = 'danielzaiser91/anime-kalender-de'
const GH_WINDOWS = 'C:/Program Files/GitHub CLI/gh.exe'
const URTEIL = /^[\s*_#>]*Prüfer(?: Runde \d+)?:/
// Grund: mindestens 8 Zeichen und nicht der Platzhalter „<Grund>“ aus der Verweigerung.
const AUSNAHME = /\[runde-ausnahme:\s*(?!<)(\S[^\]]{6,}\S)\]/
const PR_IM_AUFTRAG = /\bPR\s*#?(\d{2,5})\b|github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d{1,5})\b/i
const REPO_ADRESSEN = [
  /github\.com\/([\w.-]+\/[\w.-]+)\/pull\//g,
  /\b(danielzaiser91\/[A-Za-z][\w-]*)/g,
  /\bRepo:?\s+C:\/code\/ai\/([A-Za-z][\w-]*)/gi,
]

/** Repos, die der Auftrag nennt (Adresse, `danielzaiser91/<name>` oder „Repo C:/code/ai/<name>“); ohne Nennung das Standard-Repo. */
function nenneRepos(prompt) {
  const repos = new Set()
  for (const muster of REPO_ADRESSEN) {
    for (const m of prompt.matchAll(muster)) repos.add(m[1].includes('/') ? m[1] : `danielzaiser91/${m[1]}`)
  }
  return repos.size ? [...repos] : [STANDARD_REPO]
}

/** { nummer, repo } aus dem ersten PR-Treffer im Auftrag; `repo` null, wenn der Auftrag mehrere Repos nennt; null ohne PR-Nummer. */
function findePr(prompt) {
  const m = PR_IM_AUFTRAG.exec(prompt)
  if (!m) return null
  const repos = nenneRepos(prompt)
  return { nummer: m[1] || m[3], repo: repos.length === 1 ? repos[0] : null }
}

// PRUEFRUNDEN_GH_SKRIPT: Node-Skript statt gh, nur für den Prozesstest.
function ghAufruf(args) {
  const skript = process.env.PRUEFRUNDEN_GH_SKRIPT
  const gh = skript ? process.execPath : fs.existsSync(GH_WINDOWS) ? GH_WINDOWS : 'gh'
  return execFileSync(gh, skript ? [skript, ...args] : args, { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * Anzahl der Runden des Agent-Prüfers. Ein Urteil gleich nach einem Urteil (nur CI-Kommentare dazwischen) ist ein Nachtrag
 * derselben Runde (PR 1407, 1435, 1440); zwischen zwei Runden steht immer ein Kommentar des Bauers.
 */
function zaehleUrteile(kommentare) {
  let n = 0
  let vorherUrteil = false
  for (const k of kommentare) {
    if (k.author && k.author.login === 'github-actions') continue
    const urteil = URTEIL.test(k.body)
    if (urteil && !vorherUrteil) n++
    vorherUrteil = urteil
  }
  return n
}

/** Prüfstufe aus dem jüngsten Stufen-Kommentar des CI (github-actions); ohne ihn 2. */
function leseStufe(kommentare) {
  const treffer = kommentare
    .filter((k) => k.author && k.author.login === 'github-actions')
    .map((k) => STUFE_KOMMENTAR.exec(String(k.body ?? '')))
    .filter(Boolean)
  return treffer.length ? Number(treffer.at(-1)[1]) : 2
}

/** Erlaubte Urteile des Agent-Prüfers: bei Stufe 2 zwei, sonst eines. */
function grenzeFuer(stufe) {
  return stufe === 2 ? GRENZE_STUFE_2 : GRENZE_SONST
}

// PRUEFRUNDEN_AUSNAHME_LOG: Ablage der Ausnahmen, nur für den Prozesstest. Ein Fehler beim Schreiben sperrt nie.
function schreibeAusnahme(eintrag) {
  try {
    const datei = process.env.PRUEFRUNDEN_AUSNAHME_LOG || path.join(os.homedir(), '.claude', 'logs', 'pruefrunden-ausnahmen.jsonl')
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.appendFileSync(datei, `${JSON.stringify({ zeit: new Date().toISOString(), ...eintrag })}\n`)
  } catch {}
}

/**
 * Verweigerungstext oder null. `gh(args)` liefert stdout oder wirft; `warne(text)` schreibt nach stderr;
 * `ausnahme(eintrag)` hält eine wirksame Ausnahme fest.
 */
function pruefe(input, { gh = ghAufruf, warne = (t) => process.stderr.write(`${t}\n`), ausnahme = schreibeAusnahme } = {}) {
  const ti = input.tool_input || {}
  if (ti.subagent_type !== 'pruefer') return null
  const prompt = String(ti.prompt || '')
  const pr = findePr(prompt)
  if (!pr) {
    warne('pruefrunden: keine PR-Nummer im Auftrag, Start nicht geprüft')
    return null
  }
  if (!pr.repo) {
    warne(`pruefrunden: Auftrag nennt mehrere Repos, PR ${pr.nummer} nicht geprüft`)
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
  const stufe = leseStufe(kommentare)
  if (n < grenzeFuer(stufe)) return null
  const grund = AUSNAHME.exec(prompt)
  if (grund) {
    ausnahme({ pr: pr.nummer, repo: pr.repo, urteile: n, stufe, grund: grund[1] })
    return null
  }
  return `Eine Prüfrunde (Stufe 2: zwei). PR ${pr.nummer} hat schon ${n} Prüfer-Urteil(e) bei Stufe ${stufe}. Nachbesserung nimmt der Dirigent gegen die Auflagenliste ab. Ausnahme nur mit [runde-ausnahme: <Grund>] im Prüferauftrag (wird protokolliert); Teilmerge nur mit Prüfer-Urteil, keine Selbstfreigabe.`
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

module.exports = { pruefe, antwort, findePr, zaehleUrteile, leseStufe, grenzeFuer }

if (require.main === module) {
  let s = ''
  process.stdin.on('data', (d) => (s += d)).on('end', () => {
    process.stdout.write(antwort(s))
    process.exit(0)
  })
}
