// PostToolUse + PostToolUseFailure (Matcher Bash, async): ergänzt die Pre-Zeile des Befehls-Registers um Ende, Dauer, Exit und
// „ins Hintergrund verschoben“ (backgroundTaskId/timedOutAfterMs). Speichert nur Kennungen und Zahlen, nie stdout/stderr.
// Räumt einmal täglich Tagesdateien über 14 Tage ab. Scheitert nie (Exit 0). Skill: hintergrundprozesse.
const { schreibe, rotiere } = require('./befehlsregister.js')

/** Schlanke Post-Zeile aus der Hook-Eingabe oder null (kein Bash). Agent und Sitzung stehen in der Pre-Zeile derselben id;
 *  unterbrochen, bgTask und zeitlimitMs nur, wenn gesetzt. */
function postZeile(i, jetzt = new Date()) {
  if (i.tool_name !== 'Bash') return null
  let r = i.tool_response
  if (typeof r === 'string') {
    try { r = JSON.parse(r) } catch { r = {} }
  }
  r = r || {}
  const fehler = i.hook_event_name === 'PostToolUseFailure' ? String(i.error || '') : ''
  const code = /Exit code (\d+)/.exec(fehler)
  const zeile = { t: jetzt.toISOString(), ev: 'post', id: i.tool_use_id, dur: i.duration_ms ?? null, exit: fehler ? (code ? Number(code[1]) : -1) : 0 }
  if (r.interrupted || i.is_interrupt) zeile.unterbrochen = true
  if (r.backgroundTaskId) zeile.bgTask = r.backgroundTaskId
  if (r.timedOutAfterMs) zeile.zeitlimitMs = r.timedOutAfterMs
  return zeile
}

module.exports = { postZeile }

if (require.main === module) {
  let roh = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { roh += c })
  process.stdin.on('end', () => {
    try {
      const zeile = postZeile(JSON.parse(roh || '{}'))
      if (zeile) schreibe(zeile)
      rotiere()
    } catch {
      // Protokoll ist Komfort, nie kritisch
    }
    process.exit(0)
  })
}
