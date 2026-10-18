// SessionStart: setzt den Claude-Code-Prozess auf „Niedriger als normal“. Windows vererbt diese Klasse an jeden Kindprozess
// (Bash, node, tsx, Playwright, Agenten), so behalten Daniels Programme Vorrang, wenn Prüfungen alle Kerne belegen
// (Daniel 18.10.2026: „pc soll weiterhin nutzbar sein“; gemessen 77–88 % von 24 Kernen in Spitzen, RAM und Platte frei).
// Gesucht wird der nächste Vorfahr, dessen Programm unter `claude-code` liegt — nie die Desktop-App (WindowsApps), deren
// Oberfläche bliebe sonst hinter der Last zurück. Scheitert etwas, endet der Hook still mit 0.
// Eintrag in ~/.claude/settings.json unter hooks.SessionStart:
//   { "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/prioritaet-niedrig.js"], "timeout": 15 }] }
const { execFileSync } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const { constants, setPriority, tmpdir } = require('node:os')
const { join } = require('node:path')

/** Prozesstabelle als Map pid → { ppid, pfad } über WMI (wmic ist entfernt, PowerShell tabu). */
function prozesse() {
  const vbs = join(tmpdir(), 'prioritaet-niedrig.vbs')
  writeFileSync(vbs, [
    'Set w = GetObject("winmgmts:\\\\.\\root\\cimv2")',
    'For Each p In w.ExecQuery("SELECT ProcessId,ParentProcessId,ExecutablePath FROM Win32_Process")',
    '  e = p.ExecutablePath',
    '  If IsNull(e) Then e = ""',
    '  WScript.Echo p.ProcessId & "|" & p.ParentProcessId & "|" & e',
    'Next',
  ].join('\r\n'))
  const m = new Map()
  for (const z of execFileSync('cscript', ['//nologo', vbs], { encoding: 'latin1', timeout: 10000 }).split(/\r?\n/)) {
    const [pid, ppid, pfad] = z.split('|')
    if (pid) m.set(Number(pid), { ppid: Number(ppid), pfad: pfad ?? '' })
  }
  return m
}

/** Nächster Vorfahr von `start`, dessen Programm unter `claude-code` liegt; höchstens fünf Stufen. */
function claudeCodeVorfahr(tabelle, start) {
  let pid = start
  for (let i = 0; i < 5 && pid; i++) {
    const p = tabelle.get(pid)
    if (!p) return undefined
    if (/[\\/]claude-code[\\/]/i.test(p.pfad)) return pid
    pid = p.ppid
  }
  return undefined
}

if (require.main === module) {
  try {
    if (process.platform === 'win32') {
      const ziel = claudeCodeVorfahr(prozesse(), process.ppid)
      if (ziel) setPriority(ziel, constants.priority.PRIORITY_BELOW_NORMAL)
    }
  } catch {}
  process.exit(0)
}

module.exports = { claudeCodeVorfahr }
