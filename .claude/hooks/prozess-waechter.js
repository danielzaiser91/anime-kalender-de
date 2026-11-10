// UserPromptSubmit: meldet verwaiste Prozesse (python, bash-Wartschleifen, node; ohne Registereintrag, >= 30 min CPU; je Fund
// Art, PID, CPU-Minuten, Kommandozeilen-Ausschnitt) und abgelaufene Register-Einträge.
// Stumm, wenn alles sauber ist; scheitert nie (Exit 0), damit kein Prompt blockiert wird. Skill: hintergrundprozesse.
// `verwaist` und `waisen` (verwaiste Ketten, nur Meldung; WMI über cscript, je ~0,3 s) laufen höchstens alle 5 min (Stempeldatei), `aufraeumen` bei jedem Prompt.
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const werkzeug = 'C:/code/ai/__assets/tools/prozess-register.mjs'
const befehlsregister = 'C:/code/ai/__assets/tools/befehlsregister.mjs'
const STATE = process.env.WAECHTER_STATE || path.join(require('os').homedir(), '.claude', 'hooks', 'state') // Umgebungsvariable nur für Tests
const STEMPEL = path.join(STATE, 'waechter-verwaist.stempel')
const STEMPEL_BEFEHLE = path.join(STATE, 'waechter-befehle.stempel')
const VERWAIST_ALLE_MS = 5 * 60 * 1000

// Fällig, wenn der Stempel fehlt oder älter als das Intervall ist; setzt den Stempel (auch bei späterem Fehlschlag, damit nicht jeder Prompt neu versucht).
function verwaistFaellig(stempel = STEMPEL, jetzt = Date.now()) {
  try {
    if (jetzt - fs.statSync(stempel).mtimeMs < VERWAIST_ALLE_MS) return false
  } catch {
    // kein Stempel: fällig
  }
  try {
    fs.mkdirSync(path.dirname(stempel), { recursive: true })
    fs.writeFileSync(stempel, String(jetzt))
  } catch {
    // Stempel nicht schreibbar: lieber jedes Mal prüfen als nie
  }
  return true
}

// Befehls-Register-Kandidaten (13.10.2026): gleiche Drossel wie `verwaist`, eigener Stempel.
const befehleFaellig = (stempel = STEMPEL_BEFEHLE, jetzt = Date.now()) => verwaistFaellig(stempel, jetzt)

const lauf = (args, skript = werkzeug) => {
  try {
    return execFileSync(process.execPath, [skript, ...args], { encoding: 'utf8', timeout: 8000, windowsHide: true }).trim()
  } catch {
    return ''
  }
}

/** Meldetext oder leer; der Bündel-Dispatcher ruft das im selben Prozess auf. */
function meldung() {
  const faellig = verwaistFaellig()
  const meldungen = [lauf(['aufraeumen', '--still']), faellig ? lauf(['verwaist', '--still']) : '', faellig ? lauf(['waisen', '--still']) : ''].filter(Boolean)
  const kandidaten = befehleFaellig() ? lauf(['kandidaten', '--still'], befehlsregister) : ''
  const text = meldungen.length ? `[Prozess-Wächter] ${meldungen.join(' · ')} — Skill hintergrundprozesse: ansehen, aufräumen.` : ''
  const befehle = kandidaten ? `[Befehls-Register] Kandidaten (nur melden; Ausnahmen möglich; Beenden mit dem genannten beenden-Befehl, er erreicht auch cat/sleep/tail; Skill hintergrundprozesse):\n${kandidaten}` : ''
  return [text, befehle].filter(Boolean).join('\n')
}

module.exports = { verwaistFaellig, befehleFaellig, meldung }

if (require.main === module) {
  const text = meldung()
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }))
  process.exit(0)
}
