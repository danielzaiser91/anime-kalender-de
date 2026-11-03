// Schreibt `[Text](file:///C:/…)` in Daniels .md-Dateien (daniel-zum-abarbeiten/) zu relativen Links um: Die Markdown-Vorschau
// von VS Code (markdown-it) verwirft das Schema `file:` als unsicher und zeigt den Link als rohen Text; relative Links öffnen
// die Datei direkt in VS Code, `#L<zeile>` an der Stelle (Daniel, 03.11.2026). stand.md bleibt bei file:/// (liest die Mod).
// Auslöser: PostToolUse(Write|Edit) für die geschriebene Datei, PostToolUse(Bash) für .md-Dateien, die in den letzten
// 2 min geändert wurden (Skripte schreiben an Write vorbei). Eintrag in ~/.claude/settings.json als weiteres Element:
//   hooks.PostToolUse[]: { "matcher": "Write|Edit|Bash", "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/md-links-relativ.js"], "timeout": 15 }] }
const fs = require('node:fs')
const path = require('node:path')

const WURZEL = (process.env.DANIEL_ORDNER || 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten').replace(/\\/g, '/')
const FRISCH = 2 * 60000
const LINK = /\]\(file:\/\/\/([^)\s]+)\)/g

/** Relativer, URL-kodierter Link von `datei` auf das Ziel einer file:///-Adresse (Anker bleibt). */
function relativ(datei, adresse) {
  const [pfad, anker] = adresse.split('#')
  const ziel = decodeURIComponent(pfad)
  let rel = path.posix.relative(path.posix.dirname(datei), ziel.replace(/\\/g, '/'))
  if (pfad.endsWith('/') && !rel.endsWith('/')) rel += '/'
  const kodiert = rel.split('/').map((t) => encodeURIComponent(t).replace(/[()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/')
  return (kodiert || '.') + (anker === undefined ? '' : '#' + anker)
}

/** Text mit allen file:///-Links relativ zu `datei`; zählt die Ersetzungen. */
function umschreiben(datei, text) {
  let n = 0
  const neu = text.replace(LINK, (_, adresse) => {
    n++
    return '](' + relativ(datei, adresse) + ')'
  })
  return { text: neu, n }
}

/** Gehört die Datei zu Daniels Ordner (ohne stand.md an der Wurzel)? */
function betroffen(datei) {
  const d = datei.replace(/\\/g, '/')
  return d.toLowerCase().startsWith(WURZEL.toLowerCase() + '/') && d.endsWith('.md') && d.toLowerCase() !== (WURZEL + '/stand.md').toLowerCase()
}

/** Alle .md unter der Wurzel, die seit `seit` (ms) geändert wurden. */
function frische(ordner, seit, liste = []) {
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    const p = ordner + '/' + e.name
    if (e.isDirectory()) frische(p, seit, liste)
    else if (e.name.endsWith('.md') && fs.statSync(p).mtimeMs >= seit) liste.push(p)
  }
  return liste
}

/** Schreibt die Dateien um; Rückgabe: Liste „Datei: n“. */
function bearbeite(dateien) {
  const gemacht = []
  for (const datei of dateien.filter(betroffen)) {
    const alt = fs.readFileSync(datei, 'utf8')
    const { text, n } = umschreiben(datei.replace(/\\/g, '/'), alt)
    if (n === 0) continue
    fs.writeFileSync(datei, text)
    gemacht.push(path.basename(datei) + ': ' + n)
  }
  return gemacht
}

function main() {
  let e = {}
  try { e = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') } catch { return }
  const datei = e.tool_input && e.tool_input.file_path
  const dateien = e.tool_name === 'Bash' ? (fs.existsSync(WURZEL) ? frische(WURZEL, Date.now() - FRISCH) : []) : datei ? [datei] : []
  const gemacht = bearbeite(dateien)
  if (gemacht.length === 0) return
  const hinweis = 'md-links-relativ: file:///-Links in Daniels .md-Dateien relativ gemacht (VS-Code-Vorschau zeigt file: nicht als Link) — ' + gemacht.join(', ')
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: hinweis } }))
}

if (require.main === module) main()
module.exports = { relativ, umschreiben, betroffen }
