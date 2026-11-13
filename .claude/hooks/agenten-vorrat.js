// Stop (Hauptsitzung): Im autonomen Modus endet kein Turn, solange Agenten-Plätze frei sind und der Vorrat
// startfertige Aufträge hat (oder leer ist). Daniel 13.10.2026: „wieso sind nicht automatisch immer 5 belegt?“
// Vorrat = <projekt>/daniel-zum-abarbeiten/vorrat/*.md, je Datei ein vollständiger Auftrag; erste Zeile = Titel.
const fs = require('node:fs')
const path = require('node:path')
const { laufendeAgenten, grenze } = require('./agenten-grenze.js')

// Je Sitzung ein Marker (Daniel, 14.10.2026): Routinen und andere Sitzungen sollen nicht mitlaufen.
const markerVon = (sitzung) => require('path').join(require('os').homedir(), '.claude', 'autonomer-modus', `${sitzung}.txt`)

function autonomBis(jetzt, sitzung) {
  try {
    const bis = Date.parse(fs.readFileSync(markerVon(sitzung), 'utf8').trim())
    // In den letzten 30 min kein neuer Start mehr: Bericht und Prüfer kämen erst nach dem Ende an (19.10.2026).
    return bis - jetzt > 30 * 60 * 1000
  } catch {
    return false
  }
}

function vorratOrdner(cwd) {
  for (let d = cwd; d && d !== path.dirname(d); d = path.dirname(d)) {
    const o = path.join(d, 'daniel-zum-abarbeiten', 'vorrat')
    if (fs.existsSync(o)) return o
  }
  return null
}

function titel(datei) {
  const erste = fs.readFileSync(datei, 'utf8').split('\n').find((z) => z.trim()) || ''
  return erste.replace(/^#+\s*/, '').trim()
}

// Eine Vorratsdatei, die ein laufender Agent schon liest, ist vergeben: verschieben darf man sie erst nach
// dem Bericht (vorrat-sperre.js), also darf dieser Hook sie nicht erneut zum Start vorschlagen (31.10.2026).
function vergeben(subagents, laufend, dateien) {
  const koepfe = laufend.map((a) => {
    try {
      const fd = fs.openSync(path.join(subagents, `agent-${a.id}.jsonl`), 'r')
      const puffer = Buffer.alloc(16384)
      const n = fs.readSync(fd, puffer, 0, puffer.length, 0)
      fs.closeSync(fd)
      return puffer.toString('utf8', 0, n)
    } catch {
      return ''
    }
  })
  return new Set(dateien.filter((d) => koepfe.some((k) => k.includes(d))))
}

function pruefe(input, jetzt = Date.now()) {
  if (input.stop_hook_active || !input.transcript_path || !autonomBis(jetzt, input.session_id)) return null
  const ordner = vorratOrdner(input.cwd || process.cwd())
  if (!ordner) return null
  const subagents = path.join(input.transcript_path.replace(/\.jsonl$/, ''), 'subagents')
  const laufend = laufendeAgenten(subagents, jetzt).filter((a) => a.typ !== 'pruefer')
  const GRENZE = grenze()
  const frei = GRENZE - laufend.length
  if (frei <= 0) return null
  // `z-…` = blockiert (Grund steht in der Datei), `erledigt-…` = abgeschlossen; nie zum Start vorschlagen.
  const alle = fs.readdirSync(ordner).filter((d) => d.endsWith('.md') && !d.startsWith('z-') && !d.startsWith('erledigt-')).sort()
  const besetzt = vergeben(subagents, laufend, alle)
  // Zeile `**Vergeben:** <PR-Link>` = ein PR trägt den Auftrag schon (Doppelvergabe 3200, 08.11.2026).
  const dateien = alle.filter((d) => !besetzt.has(d) && !/^\*\*Vergeben:\*\*/m.test(fs.readFileSync(path.join(ordner, d), 'utf8')))
  if (!dateien.length) return `Agenten-Vorrat: ${frei} von ${GRENZE} Plätzen frei und ${ordner} ist leer. Schreibe startfertige Aufträge aus stand.md „Als Nächstes“ hinein (eine Datei je Auftrag, erste Zeile Titel) und starte sie.`
  const naechste = dateien.slice(0, frei).map((d) => `${path.join(ordner, d)} (${titel(path.join(ordner, d))})`)
  return `Agenten-Vorrat: ${frei} von ${GRENZE} lokalen Plätzen frei. Starte, was sinnvoll parallel läuft (kein gegenseitiges Ausbremsen, Daniel 13.11.2026; mehr als 2 nur als Cloud-Sitzung):${naechste.join(' · ')}. Den Dateipfad in den Auftragstext schreiben (dann gilt sie als vergeben), sobald ein PR steht, die Zeile „**Vergeben:** <PR-Link>“ in die Datei, erst nach dem Merge löschen; vorher die stand.md-Zeile zum Thema greppen (der Stand im Plan kann veraltet sein); ist ein Auftrag blockiert, Grund in die Datei schreiben, nach hinten umbenennen (mv) und Links in stand.md nachziehen.`
}

module.exports = { pruefe, markerVon }

if (require.main === module) {
  let s = ''
  process.stdin.on('data', (d) => (s += d)).on('end', () => {
    let grund = null
    try {
      grund = pruefe(JSON.parse(s))
    } catch {}
    if (grund) process.stdout.write(JSON.stringify({ decision: 'block', reason: grund }))
    process.exit(0)
  })
}
