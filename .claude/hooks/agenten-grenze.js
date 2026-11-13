// PreToolUse(Agent): verweigert den Start eines Agenten, wenn schon GRENZE Agenten dieser Sitzung laufen (Prüfer zählen nicht).
// Daniel 13.10.2026: „5 max“ war nur Vorsatz, sechs liefen gleichzeitig — jetzt greift die Grenze technisch.
// Laufend = Transkript unter <sitzung>/subagents/ endet nicht mit end_turn/Abbruch und wurde in der letzten Stunde geschrieben.
const fs = require('node:fs')
const path = require('node:path')

// Daniel 13.11.2026: „lokal max 2“, „ohne zeit bereich“, mehr nur als Cloud-Sitzung, „nur wenn sinnvoll parallel“
// (Last auf seinem PC; Arbeitszeit-Probe mit 5 und Ruhemodus damit aufgehoben).
const GRENZE = 2
const FRISCH_MS = 60 * 60 * 1000
const AUSGENOMMEN = new Set(['pruefer'])
const grenze = () => GRENZE

function letzteZeile(datei) {
  const groesse = fs.statSync(datei).size
  const fd = fs.openSync(datei, 'r')
  const n = Math.min(groesse, 256 * 1024)
  const puffer = Buffer.alloc(n)
  fs.readSync(fd, puffer, 0, n, groesse - n)
  fs.closeSync(fd)
  const zeilen = puffer.toString('utf8').trim().split('\n')
  return JSON.parse(zeilen[zeilen.length - 1])
}

function beendet(eintrag) {
  const m = eintrag.message || {}
  // end_turn ohne Bericht = Agent wartet auf eigene Hintergrundarbeit und belegt den Platz weiter (27.10.2026: Fable
  // galt als frei, der Vorrat-Hook verlangte einen dritten Agenten); hängt er wirklich, nimmt ihn FRISCH_MS heraus.
  const text = JSON.stringify(m.content || '')
  // Bericht per SubagentHandback abgegeben (letzte Zeile ist dessen tool_result) oder per TaskStop abgebrochen.
  return eintrag.type === 'user' && (text.includes('Report delivered to your caller') || text.includes('interrupted'))
}

/** Laufende Agenten der Sitzung: [{ id, typ, beschreibung }]. */
function laufendeAgenten(ordner, jetzt = Date.now()) {
  let dateien
  try {
    dateien = fs.readdirSync(ordner).filter((d) => /^agent-.*\.jsonl$/.test(d))
  } catch {
    return []
  }
  const laufend = []
  for (const d of dateien) {
    const datei = path.join(ordner, d)
    try {
      if (jetzt - fs.statSync(datei).mtimeMs > FRISCH_MS) continue
      if (beendet(letzteZeile(datei))) continue
      let meta = {}
      try {
        meta = JSON.parse(fs.readFileSync(datei.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
        // Bericht als Schlusstext statt SubagentHandback: die Meta-Datei trägt dann finished (27.10.2026).
        if (meta.finished) continue
      } catch {}
      laufend.push({ id: d.slice(6, -6), typ: meta.agentType || '?', beschreibung: meta.description || '' })
    } catch {}
  }
  return laufend
}

function pruefe(input, jetzt = Date.now()) {
  const typ = (input.tool_input && input.tool_input.subagent_type) || 'general-purpose'
  // Ohne effort erbt Opus das medium aus der Agentendefinition; Tier careful heißt Opus high (Daniel, 18.10.2026: Savvy zeigte „Opus 5.5 · medium“).
  if (input.tool_input && input.tool_input.model === 'opus' && !input.tool_input.effort) return 'Opus ohne effort startet mit dem medium der Agentendefinition. Tier careful = effort "high" (heavy = "xhigh") ausdrücklich mitgeben. Skill delegieren-und-parallelisieren, Modell je Tier.'
  if (AUSGENOMMEN.has(typ) || !input.transcript_path) return null
  const ordner = path.join(input.transcript_path.replace(/\.jsonl$/, ''), 'subagents')
  const gezaehlt = laufendeAgenten(ordner, jetzt).filter((a) => !AUSGENOMMEN.has(a.typ))
  const g = grenze()
  if (gezaehlt.length < g) return null
  return `Agenten-Grenze: ${gezaehlt.length} von ${g} lokal laufen schon (${gezaehlt.map((a) => a.beschreibung).join(' · ')}). Erst starten, wenn einer fertig ist, oder als Cloud-Sitzung (bis 5 insgesamt, nur wenn sinnvoll parallel); Prüfer (pruefer) zählen nicht. Daniel 13.11.2026, Hook .claude/hooks/agenten-grenze.js.`
}

module.exports = { laufendeAgenten, pruefe, GRENZE, grenze }

if (require.main === module) {
  let s = ''
  process.stdin.on('data', (d) => (s += d)).on('end', () => {
    let grund = null
    try {
      grund = pruefe(JSON.parse(s))
    } catch {}
    if (grund) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } }))
    process.exit(0)
  })
}
