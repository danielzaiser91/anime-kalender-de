// Sperrt breite Dateisuchen über ganz C:\code\ai (find/grep -r/rg/ls -R), solange der Befehl nicht zeigt,
// dass ai_agent_tools.md zuerst gelesen wurde. Grund: zweimal (28.08. und 11.10.2026) die Laufstatus-App
// im Dateisystem gesucht, obwohl sie mit Pfad im Werkzeugkasten steht (Skill `werkzeugkasten-zuerst`).
const BREIT = /(?:^|[\s"'=])(?:\/c\/code\/ai|[Cc]:[\\/]+code[\\/]+ai)[\\/]*(?:\*)?(?=["'\s;|&)]|$)/
const SUCHE = /\b(?:find|rg|grep\s+-[a-zA-Z]*[rR][a-zA-Z]*|ls\s+-[a-zA-Z]*R[a-zA-Z]*|fd)\b/
const GELESEN = /ai_agent_tools\.md|werkzeugkasten-gelesen/

function pruefe(input) {
  if (input.tool_name !== 'Bash') return null
  const cmd = String(input.tool_input?.command ?? '')
  if (!SUCHE.test(cmd) || !BREIT.test(cmd) || GELESEN.test(cmd)) return null
  return 'Breite Suche über C:\\code\\ai: Werkzeug- oder Ortsfrage? Zuerst `grep -n -i <name> "C:/code/ai/ai helper files/ai_agent_tools.md"`. '
    + 'Steht es dort nicht und muss doch gesucht werden: Befehl mit dem Kommentar `# werkzeugkasten-gelesen` wiederholen und danach eintragen.'
}

module.exports = { pruefe }
