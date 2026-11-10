// Befehls-Register (13.10.2026): PreToolUse-Modul im Bündel dispatch-pretooluse.js und gemeinsame Bausteine für Post-Hook,
// nach-agent.mjs und tools/befehlsregister.mjs. Je Bash-Befehl (Hauptsitzung und Subagenten) eine Zeile in
// state/befehle/<Tag>.jsonl (voll: <Tag>.2.jsonl …); setzt dem Befehl `# br:<tool_use_id>\n` voran, damit der Prozess über seine
// Kommandozeile findbar ist. Bewusst OHNE permissionDecision (nur updatedInput): das Berechtigungssystem bleibt zuständig.
// Skill: hintergrundprozesse.
const fs = require('fs')
const os = require('os')
const path = require('path')

const DIR = process.env.BR_DIR || path.join(os.homedir(), '.claude', 'hooks', 'state', 'befehle')
// Schlanke Zeilen (14.10.2026): am 13.10. war die Tagesdatei mit 2000 Zeichen je Befehl um 16:58 voll und das Register danach blind.
const MAX_CMD = 200
const MAX_TAGESDATEI = 5 * 1024 * 1024
const MAX_FOLGEDATEIEN = 10 // je Tag höchstens 10 x 5 MB; danach Grenzmarke <Tag>.grenze, die `kandidaten` (Wächter) meldet
const AUFBEWAHREN_TAGE = 14
const DAY_MS = 24 * 3600 * 1000

// [Muster, Ersatz]: Treffer werden durch *** ersetzt, ein Präfix (Schlüsselwort) bleibt lesbar. Ergänzt der Wächter nicht,
// gilt: Musterabgleich, keine Garantie; Werte aus my_secrets.md werden zusätzlich gegen die Logs geprüft (Skill hintergrundprozesse).
const WERT = `("[^"]*"|'[^']*'|\\S+)`
const MASKEN = [
  [new RegExp(`(authorization:\\s*)(?:bearer\\s+|basic\\s+|token\\s+)?${WERT}`, 'gi'), '$1***'],
  [/\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer ***'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, '***'],
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, '***'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '***'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '***'],
  [/\bnpm_[A-Za-z0-9]{30,}/g, '***'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, '***'],
  [/(:\/\/[^\s:/@]+:)[^\s@/]+(?=@)/g, '$1***'],
  [new RegExp(`(--?(?:token|api-?key|password|passwd|secret|auth)(?:=|\\s+))${WERT}`, 'gi'), '$1***'],
  [new RegExp(`(\\b[A-Za-z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD)[A-Za-z0-9_]*=)${WERT}`, 'g'), '$1***'],
  [new RegExp(`(-H\\s+["']?[A-Za-z-]*(?:key|token|auth|secret)[A-Za-z-]*:\\s*)[^"'\\s]+`, 'gi'), '$1***'],
]

function maskiere(text) {
  return MASKEN.reduce((s, [re, ersatz]) => s.replace(re, ersatz), String(text))
}

function tagesdatei(jetzt = new Date()) {
  return path.join(DIR, jetzt.toISOString().slice(0, 10) + '.jsonl')
}

/** Name einer Register-Datei (Tagesdatei, Folgedatei oder Grenzmarke) → Tag `JJJJ-MM-TT`, sonst null. */
function tagAusName(name) {
  return /^(\d{4}-\d{2}-\d{2})(?:\.\d+)?\.(?:jsonl|grenze)$/.exec(name)?.[1] ?? null
}

/** Erste Datei des Tages unter der Größengrenze (`<Tag>.jsonl`, dann `<Tag>.2.jsonl` …); null, wenn alle voll sind. */
function zieldatei(jetzt = new Date()) {
  const basis = tagesdatei(jetzt)
  for (let n = 1; n <= MAX_FOLGEDATEIEN; n++) {
    const datei = n === 1 ? basis : basis.replace(/\.jsonl$/, `.${n}.jsonl`)
    if ((fs.statSync(datei, { throwIfNoEntry: false })?.size ?? 0) <= MAX_TAGESDATEI) return datei
  }
  return null
}

/** Hängt eine Zeile an (Folgedatei, wenn die Tagesdatei voll ist); sind alle voll, entsteht die Grenzmarke. Wirft nie. */
function schreibe(zeile, jetzt = new Date()) {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    const datei = zieldatei(jetzt)
    if (!datei) {
      fs.writeFileSync(tagesdatei(jetzt).replace(/\.jsonl$/, '.grenze'), `${MAX_FOLGEDATEIEN} Dateien je ${MAX_TAGESDATEI} Byte voll\n`)
      return false
    }
    fs.appendFileSync(datei, JSON.stringify(zeile) + '\n')
    return true
  } catch (err) {
    process.stderr.write(`befehlsregister: ${err.message}\n`)
    return false
  }
}

/** Löscht Tagesdateien, die älter als AUFBEWAHREN_TAGE sind; höchstens einmal je Tag (Stempel). Gibt die gelöschten Namen zurück. */
function rotiere(jetzt = Date.now()) {
  const stempel = path.join(DIR, '.rotation')
  try {
    if (jetzt - fs.statSync(stempel).mtimeMs < DAY_MS) return []
  } catch {
    // kein Stempel: fällig
  }
  const geloescht = []
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(stempel, String(jetzt))
    for (const name of fs.readdirSync(DIR)) {
      const tag = tagAusName(name)
      if (tag && jetzt - Date.parse(tag) > AUFBEWAHREN_TAGE * DAY_MS) {
        fs.rmSync(path.join(DIR, name), { force: true })
        geloescht.push(name)
      }
    }
  } catch (err) {
    process.stderr.write(`befehlsregister rotiere: ${err.message}\n`)
  }
  return geloescht
}

/** Kennung des Auslösers: Subagent oder `haupt` (in der Hauptsitzung fehlen agent_id und agent_type). */
function ausloeser(input) {
  return { agent: input.agent_id || 'haupt', typ: input.agent_type || 'haupt' }
}

/** Schlanke Pre-Zeile: bg und to nur, wenn gesetzt; Befehl maskiert, dann auf MAX_CMD Zeichen gekürzt. */
function preZeile(input, jetzt = new Date()) {
  const ti = input.tool_input || {}
  const zeile = { t: jetzt.toISOString(), ev: 'pre', sid: input.session_id, id: input.tool_use_id, ...ausloeser(input) }
  if (ti.run_in_background) zeile.bg = true
  if (ti.timeout) zeile.to = ti.timeout
  zeile.cmd = maskiere(String(ti.command || '')).slice(0, MAX_CMD)
  return zeile
}

function pruefe(input) {
  if (input.tool_name !== 'Bash') return null
  const ti = input.tool_input || {}
  const cmd = String(ti.command || '')
  const aendern = Boolean(input.tool_use_id) && !cmd.includes('# br:')
  schreibe(aendern ? { ...preZeile(input), mod: true } : preZeile(input))
  if (!aendern) return null
  // Präfix statt Suffix: Befehle, die auf `&&`, `|` oder `\` enden, blieben mit angehängter Kommentarzeile kaputt (10.11.2026).
  // Offen: die Änderung nach der Auto-Modus-Prüfung kann parallele Aufrufe ablehnen („changed after auto mode reviewed it“).
  return { updatedInput: { ...ti, command: `# br:${input.tool_use_id}\n${cmd}` } }
}

/** Vom Bündel gerufen, wenn ein anderes Modul den Befehl sperrt: dann folgt kein Post-Ereignis. */
function abgelehnt(input, grund) {
  if (input.tool_name !== 'Bash') return
  schreibe({ t: new Date().toISOString(), ev: 'deny', sid: input.session_id, id: input.tool_use_id, ...ausloeser(input), grund: maskiere(String(grund || '')).slice(0, 300) })
}

module.exports = { pruefe, preZeile, abgelehnt, maskiere, schreibe, rotiere, tagesdatei, tagAusName, ausloeser, DIR, MAX_TAGESDATEI, MAX_FOLGEDATEIEN, AUFBEWAHREN_TAGE }
