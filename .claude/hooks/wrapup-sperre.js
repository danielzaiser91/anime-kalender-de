// PreToolUse(mcp__ccd_turn__wrap_up): ein Abschluss mit Frage (`ask`) oder Knöpfen (`actions`) wird abgewiesen, nur `recap` geht.
// Warum: Fragen blockieren nie (Regel 20-arbeitsweise); Frage und Knöpfe im Abschlusskasten wurden trotz Regel mehrfach gestellt
// (zuletzt 14.11.2026). Fragen gehören als F-/E-Zeile nach daniel-zum-abarbeiten/stand.md, „### Jetzt“.
const WERKZEUG = 'mcp__ccd_turn__wrap_up'

// Unklare Formen (Zahl, Objekt, String bei actions) zählen als Frage/Knopf: sperren ist sicherer als durchlassen.
function nichtLeer(w) {
  if (w == null || w === false) return false
  if (typeof w === 'string') return w.trim() !== ''
  if (Array.isArray(w)) return w.length > 0
  return true
}

/** Grund für die Ablehnung oder null. */
function pruefe(input) {
  if (input?.tool_name !== WERKZEUG) return null
  const e = input.tool_input || {}
  const frage = nichtLeer(e.ask)
  const knoepfe = nichtLeer(e.actions)
  if (!frage && !knoepfe) return null
  return 'wrap_up nur mit recap: keine Frage (ask), keine Knöpfe (actions). Fragen kommen als F-/E-Zeile in daniel-zum-abarbeiten/stand.md unter „### Jetzt“ (Regel „Fragen blockieren nie“).'
}

module.exports = { pruefe }
