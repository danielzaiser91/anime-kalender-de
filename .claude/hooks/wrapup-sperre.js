// PreToolUse(mcp__ccd_turn__wrap_up): ein Abschluss mit Frage (`ask`) oder Knöpfen (`actions`) wird abgewiesen, nur `recap` geht.
// Warum: Fragen blockieren nie (Regel 20-arbeitsweise); Frage und Knöpfe im Abschlusskasten wurden trotz Regel mehrfach gestellt
// (zuletzt 14.11.2026). Fragen gehören als F-/E-Zeile nach daniel-zum-abarbeiten/stand.md, „### Jetzt“.
const WERKZEUG = 'mcp__ccd_turn__wrap_up'

/** Grund für die Ablehnung oder null. */
function pruefe(input) {
  if (input?.tool_name !== WERKZEUG) return null
  const e = input.tool_input || {}
  const frage = typeof e.ask === 'string' && e.ask.trim() !== ''
  const knoepfe = Array.isArray(e.actions) && e.actions.length > 0
  if (!frage && !knoepfe) return null
  return 'wrap_up nur mit recap: keine Frage (ask), keine Knöpfe (actions). Fragen kommen als F-/E-Zeile in daniel-zum-abarbeiten/stand.md unter „### Jetzt“ (Regel „Fragen blockieren nie“).'
}

module.exports = { pruefe }
