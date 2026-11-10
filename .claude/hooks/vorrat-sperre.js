// PreToolUse(Bash): Vorratsdateien (daniel-zum-abarbeiten/vorrat/*.md) nicht gleich nach dem Agentenstart löschen oder verschieben —
// der gestartete Bauer liest sie erst danach (14.10., 23.10. und zweimal 25.10.2026: Datei weg, bevor der Bauer sie las).
// Erlaubt nur mit der Marke `# nach-bericht` im Befehl: Sie bestätigt, dass der lesende Agent berichtet hat.
// PreToolUse(Write): Ein neuer Auftrag braucht die Zeile „Vorab geprüft: <Befehl> → <Ergebnis>“ — die Regel „vorher greppen“
// stand im Skill und wurde trotzdem übersprungen (13.10., 21.10., 23.10., 28.10.2026 vorrat/57: Mutationsläufer längst fertig).
// Einbindung in dispatch-pretooluse.js (Feld PRUEFER), ohne Änderung an settings.json.
const DATEI = /\b(rm|mv|git\s+rm|git\s+mv)\b[^;&|\n]*vorrat\/[^\s;&|]*\.md/
const NEUER_AUFTRAG = /daniel-zum-abarbeiten[/\x5c]vorrat[/\x5c][^/\x5c]+\.md$/i

function pruefeAuftrag(input) {
  const pfad = String((input.tool_input && input.tool_input.file_path) || '')
  const inhalt = String((input.tool_input && input.tool_input.content) || '')
  // „gh pr list“ Pflicht: a-22 (05.11.2026) war Dublette eines offenen PR, die Vorab-Zeile prüfte nur Code.
  if (!NEUER_AUFTRAG.test(pfad) || (/^Vorab geprüft:/m.test(inhalt) && /gh pr list/.test(inhalt))) return null
  return 'Vorrats-Auftrag ohne „Vorab geprüft:“-Zeile samt `gh pr list --search` (offener PR zum selben Thema?). Erst belegen, dass es das noch nicht gibt (git log origin/main -S/--grep, ' +
    'gh pr list --state all --search, grep im Code und in stand.md), dann die Zeile „Vorab geprüft: <Befehl> → <Ergebnis>“ in den Auftrag schreiben.'
}

function pruefe(input) {
  if (input && input.tool_name === 'Write') return pruefeAuftrag(input)
  if (!input || input.tool_name !== 'Bash') return null
  const befehl = String((input.tool_input && input.tool_input.command) || '')
  if (!DATEI.test(befehl) || /#\s*nach-bericht\b/.test(befehl)) return null
  return 'Vorrats-Sperre: Eine Vorratsdatei wird erst verschoben, wenn der Agent, der sie liest, berichtet hat (Skill delegieren-und-parallelisieren). ' +
    'Ist das so, hänge `# nach-bericht` an den Befehl.'
}

module.exports = { pruefe }
