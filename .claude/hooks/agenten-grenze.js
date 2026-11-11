// PreToolUse(Agent): verweigert den Start eines Agenten, wenn schon GRENZE Agenten dieser Sitzung laufen (Prüfer zählen nicht).
// Daniel 13.10.2026: „5 max“ war nur Vorsatz, sechs liefen gleichzeitig — jetzt greift die Grenze technisch.
// Laufend = Transkript unter <sitzung>/subagents/ endet nicht mit end_turn/Abbruch und wurde in der letzten Stunde geschrieben.
const fs = require('node:fs')
const path = require('node:path')

const GRENZE = 3 // Daniel 18.10.2026 10:17: „max agents 3“ (vorher 5)
const RUHE_GRENZE = 2
const FRISCH_MS = 60 * 60 * 1000
const AUSGENOMMEN = new Set(['pruefer'])
// Ruhemodus (Daniel, 10.10.2026; Prüfer zählen auch dort nicht, 14.10.2026; auf 2 angehoben 14.10.2026 18:00, wieder 1 seit 22:31, 2 seit 17.10.2026 22:49): Markerdatei da → höchstens RUHE_GRENZE Agenten.
const RUHE_MARKER = require('path').join(require('os').homedir(), '.claude', 'ruhemodus.txt')
// Probe bis einschließlich Do 19.11.2026 (Daniel, 11.11.2026 21:58): Mo–Fr 8–16 Uhr arbeitet er selbst, dann dürfen 5 laufen.
const ARBEITSZEIT_GRENZE = 5
const PROBE_ENDE = '2026-11-19'
function inArbeitszeit(jetzt) {
  const teile = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(jetzt).map((t) => [t.type, t.value]))
  const tag = `${teile.year}-${teile.month}-${teile.day}`
  return tag <= PROBE_ENDE && !['Sat', 'Sun'].includes(teile.weekday) && Number(teile.hour) >= 8 && Number(teile.hour) < 16
}
// AGENTEN_JETZT (ISO) nur für Tests, damit sie nicht von der Uhrzeit abhängen.
const jetztStandard = () => new Date(process.env.AGENTEN_JETZT || Date.now())
const grenze = (marker = process.env.RUHE_MARKER || RUHE_MARKER, jetzt = jetztStandard()) => (inArbeitszeit(jetzt) ? ARBEITSZEIT_GRENZE : fs.existsSync(marker) ? RUHE_GRENZE : GRENZE)

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
  return `Agenten-Grenze${g === RUHE_GRENZE ? ' (Ruhemodus)' : ''}: ${gezaehlt.length} von ${g} laufen schon (${gezaehlt.map((a) => a.beschreibung).join(' · ')}). Erst starten, wenn einer fertig ist; Prüfer (pruefer) zählen nicht. Daniel 13.10.2026, Hook .claude/hooks/agenten-grenze.js.`
}

module.exports = { laufendeAgenten, pruefe, GRENZE, grenze, inArbeitszeit }

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
