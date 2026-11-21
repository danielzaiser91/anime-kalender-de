// PreToolUse(Agent): verweigert den Start eines Agenten, wenn schon GRENZE Agenten dieser Sitzung laufen (Prüfer zählen nicht).
// Daniel 13.10.2026: „5 max“ war nur Vorsatz, sechs liefen gleichzeitig — jetzt greift die Grenze technisch; seit 13.11.2026 lokal 2.
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

/** Laufende Agenten der Sitzung: [{ id, typ, beschreibung }]. Die Mod arbeitsliste zählt für die Leiste nach (mods/arbeitsliste/hooks/agenten.ts): Regeländerung dort nachführen. */
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

// Parallelstart (15.11.2026): Mehrere Agent-Aufrufe einer Nachricht lassen ihre Hooks binnen ~10 ms laufen, bevor eine
// agent-*.jsonl existiert. Jeder Start belegt deshalb atomar (link) einen von GRENZE Platzdateien; sie verfällt nach
// RESERVIERUNG_MS oder sobald eine nach ihr entstandene Agentendatei sie ersetzt.
const RESERVIERUNG_MS = 120 * 1000
const platzOrdner = (ordner) => path.join(path.dirname(ordner), 'agent-plaetze')

// Ohne birthtime (ctime springt bei jedem Anhängen) ersetzt keine Datei einen Platz; er verfällt dann nach RESERVIERUNG_MS.
function geburt(datei) {
  return fs.statSync(datei).birthtimeMs || -Infinity
}

// Prüfer reservieren nie, ihre Dateien dürfen auch keinen Platz ersetzen.
function istPruefer(datei) {
  try {
    return AUSGENOMMEN.has(JSON.parse(fs.readFileSync(datei.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType)
  } catch {
    return false
  }
}

// Leere oder unlesbare Platzdatei = belegt und frisch (mtime), nie "uralt": sonst würde sie gelöscht und neu vergeben.
function platzZeit(datei) {
  const ts = Number(fs.readFileSync(datei, 'utf8'))
  return ts > 0 ? ts : fs.statSync(datei).mtimeMs
}

/** Platzdateien aufräumen (verfallene, durch Agentendatei ersetzte); gibt die verbleibenden Plätze zurück. */
function offeneReservierungen(ordner, jetzt) {
  const pdir = platzOrdner(ordner)
  let plaetze = []
  try {
    plaetze = fs.readdirSync(pdir).filter((d) => d.startsWith('platz-')).map((d) => {
      try { return { datei: path.join(pdir, d), ts: platzZeit(path.join(pdir, d)) } } catch { return null }
    }).filter(Boolean).sort((a, b) => a.ts - b.ts)
  } catch {}
  let geboren = []
  try {
    geboren = fs.readdirSync(ordner).filter((d) => /^agent-.*\.jsonl$/.test(d) && !istPruefer(path.join(ordner, d))).map((d) => geburt(path.join(ordner, d)))
  } catch {}
  const offen = []
  for (const p of plaetze) {
    // Jede Platzdatei wird von höchstens einer später entstandenen Agentendatei ersetzt (älteste zuerst).
    const i = geboren.findIndex((g) => g >= p.ts - 1000)
    if (i >= 0) geboren.splice(i, 1)
    if (i >= 0 || jetzt - p.ts > RESERVIERUNG_MS) {
      try { fs.unlinkSync(p.datei) } catch {}
    } else offen.push(p)
  }
  return offen
}

/** Belegt einen freien Platz für den neuen Start; false = Grenze erreicht. */
function reserviere(ordner, laufend, jetzt) {
  const pdir = platzOrdner(ordner)
  fs.mkdirSync(pdir, { recursive: true })
  const g = grenze()
  if (laufend + offeneReservierungen(ordner, jetzt).length >= g) return false
  for (let k = 0; k < g - laufend; k++) {
    const datei = path.join(pdir, `platz-${k}`)
    // Inhalt erst in eine Temp-Datei, dann per link (schlägt bei vorhandenem Platz fehl): kein Leser sieht eine leere Platzdatei.
    const tmp = path.join(pdir, `.tmp-${process.pid}-${k}`)
    try {
      fs.writeFileSync(tmp, String(jetzt))
      fs.linkSync(tmp, datei)
    } catch { continue } finally { try { fs.unlinkSync(tmp) } catch {} }
    // Gleichzeitig angelegte Plätze: ein überzähliger gibt seinen sofort wieder frei.
    if (laufend + offeneReservierungen(ordner, jetzt).length > g) {
      try { fs.unlinkSync(datei) } catch {}
      return false
    }
    return true
  }
  return false
}

// Daniel 21.11.2026: „lokal nur was nur lokal erledigt werden kann“ — zwei lokale Bauer taten Cloud-fähige Arbeit.
// Schwere Typen brauchen deshalb im Auftrag eine Zeile „Lokal nötig: <Grund>“; leichte Lese-Agenten und die Cloud selbst nicht.
const LEICHT = new Set(['pruefer', 'Explore', 'Plan', 'web-fetch', 'claude-code-guide', 'statusline-setup'])
const LOKAL_NOETIG = /^[ \t]*Lokal nötig:[ \t]*\S.{5,}/m

function lokalUngenannt(typ, toolInput, env) {
  if (LEICHT.has(typ) || env.CLAUDE_CODE_REMOTE === 'true' || toolInput.isolation === 'remote') return null
  if (LOKAL_NOETIG.test(toolInput.prompt || '')) return null
  return `Remote zuerst (Daniel 13.11./21.11.2026): ${typ} lokal nur mit einer Zeile „Lokal nötig: <Grund>“ im Auftrag (Edge-Login, lokale Mods/Hooks, Meldungskopie, Dateien außerhalb des Repos). Sonst als Cloud-Sitzung (start_session target "cloud") bzw. Routine. Hook .claude/hooks/agenten-grenze.js.`
}

function pruefe(input, jetzt = Date.now()) {
  const typ = (input.tool_input && input.tool_input.subagent_type) || 'general-purpose'
  // Ohne effort erbt Opus das medium aus der Agentendefinition; Tier careful heißt Opus high (Daniel, 18.10.2026: die Anzeige zeigte „Opus 5.5 · medium“).
  if (input.tool_input && input.tool_input.model === 'opus' && !input.tool_input.effort) return 'Opus ohne effort startet mit dem medium der Agentendefinition. Tier careful = effort "high" (heavy = "xhigh") ausdrücklich mitgeben. Skill delegieren-und-parallelisieren, Modell je Tier.'
  const grund = lokalUngenannt(typ, input.tool_input || {}, process.env)
  if (grund) return grund
  if (AUSGENOMMEN.has(typ) || !input.transcript_path) return null
  const ordner = path.join(input.transcript_path.replace(/\.jsonl$/, ''), 'subagents')
  const gezaehlt = laufendeAgenten(ordner, jetzt).filter((a) => !AUSGENOMMEN.has(a.typ))
  const g = grenze()
  if (reserviere(ordner, gezaehlt.length, jetzt)) return null
  const namen = gezaehlt.map((a) => a.beschreibung)
  return `Agenten-Grenze: ${g} von ${g} lokal laufen oder starten schon (${namen.concat('gerade gestartete').join(' · ')}). Erst starten, wenn einer fertig ist, oder als Cloud-Sitzung (bis 5 insgesamt, nur wenn sinnvoll parallel); Prüfer (pruefer) zählen nicht. Daniel 13.11.2026, Hook .claude/hooks/agenten-grenze.js.`
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
