// PreToolUse-Bündel (Edit|Write|NotebookEdit|MultiEdit|Bash|preview_start): alle Sperren in einem Prozess.
// Jedes Modul prüft das Werkzeug selbst. Ausgabe: deny eines Moduls gewinnt (mehrere Gründe untereinander), sonst die Eskalation
// von guard; sonst nichts. `rtk hook claude` und pruefrunden.js (Matcher Agent) bleiben eigene Einträge in settings.json.
// Module, die nur lokal liegen (nicht im öffentlichen Repo), sind über require erreichbar; fehlt eine Datei, wird sie mit einer
// Zeile auf stderr übersprungen. Ein neues Sperr-Modul mit `pruefe` braucht hier eine Zeile (tools/dispatch-pretooluse.test.mjs).
const path = require('path')
const H = __dirname

const deny = (grund) => (grund ? { permissionDecision: 'deny', permissionDecisionReason: grund } : null)

// Art: 'grund' = pruefe liefert Text oder null (→ deny), 'objekt' = pruefe liefert schon die Entscheidung,
// 'decide' = decide liefert die Entscheidung.
const MODULE = [
  ['snapshot-path-reparatur.js', 'objekt'],
  ['guard.js', 'decide'],
  ['werkzeug-zuerst.js', 'grund'],
  ['schleifen-sperre.js', 'grund'],
  // D1-Sperre (14.10.2026): Ausführung an der echten D1 nur mit Plan und unter dem Tageskontingent.
  ['d1-sperre.js', 'grund'],
  // Hauptordner-Sperre (18.10.2026, PR 1492): im Hauptordner nur Lesen und git pull --ff-only.
  ['hauptordner-sperre.js', 'grund'],
  // No-verify-Sperre (01.11.2026, PR 2594): git commit/push ohne --no-verify und ohne core.hooksPath.
  ['no-verify-sperre.js', 'grund'],
  // Merge-Riegel (09.11.2026, PR 3266): gh pr merge nur mit node tools/pr-nachrechnen.mjs davor.
  ['merge-riegel.js', 'grund'],
  // Subagenten-Schreibsperre (PR 2942): bauer, pruefer, analyst schreiben nie im Hauptordner.
  ['subagent-schreibsperre.js', 'grund'],
  // Vorrat-Sperre (25.10.2026, F63): vorrat/*.md erst nach Bericht löschen oder verschieben (Marke `# nach-bericht`).
  ['vorrat-sperre.js', 'grund'],
  // Befehls-Register (13.10.2026): liefert nur updatedInput (Marke), nie eine Entscheidung.
  ['befehlsregister.js', 'objekt'],
]

/** Lädt ein Modul; fehlt genau diese Datei, null mit einer Zeile auf stderr, jeder andere Fehler wird geworfen. */
function lade(name) {
  try {
    return require(path.join(H, name))
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && String(err.message).includes(name)) {
      process.stderr.write(`dispatch-pretooluse: ${name} fehlt, übersprungen\n`)
      return null
    }
    throw err
  }
}

function pruefeModul(name, art, input) {
  const m = lade(name)
  if (!m) return null
  if (art === 'decide') return m.decide(input)
  const r = m.pruefe(input)
  return art === 'grund' ? deny(r) : r
}

function entscheide(input) {
  const funde = []
  for (const [name, art] of MODULE) {
    try {
      const d = pruefeModul(name, art, input)
      if (d) funde.push(d)
    } catch (err) {
      process.stderr.write(`${name}: ${err.message}\n`)
    }
  }
  const denies = funde.filter((d) => d.permissionDecision === 'deny')
  if (denies.length) {
    const grund = denies.map((d) => d.permissionDecisionReason).join('\n')
    try { lade('befehlsregister.js')?.abgelehnt(input, grund) } catch (err) { process.stderr.write(`befehlsregister: ${err.message}\n`) }
    return { permissionDecision: 'deny', permissionDecisionReason: grund }
  }
  // updatedInput bleibt neben der Entscheidung eines anderen Moduls (z. B. guard) erhalten.
  const umschrieben = funde.find((d) => d.updatedInput)
  const entscheidung = funde.find((d) => d.permissionDecision)
  if (!umschrieben) return entscheidung || null
  return { ...entscheidung, updatedInput: umschrieben.updatedInput }
}

module.exports = { entscheide, MODULE }

if (require.main === module) {
  let roh = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { roh += c })
  process.stdin.on('end', () => {
    try {
      const d = entscheide(JSON.parse(roh || '{}'))
      if (d) process.stdout.write(JSON.stringify({ hookSpecificOutput: Object.assign({ hookEventName: 'PreToolUse' }, d) }))
    } catch (err) {
      process.stderr.write(`dispatch-pretooluse: ${err.message}\n`)
    }
    process.exit(0)
  })
}
