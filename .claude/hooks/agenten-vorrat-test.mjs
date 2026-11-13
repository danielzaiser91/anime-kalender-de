// Test: node .claude/hooks/agenten-vorrat-test.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vorrat-'))
const { pruefe, markerVon } = createRequire(import.meta.url)('./agenten-vorrat.js')
// Grenze aus dem Grenz-Hook lesen, damit eine geänderte Zahl den Test nicht rot macht.
const { GRENZE, pruefe: grenzePruefe } = createRequire(import.meta.url)('./agenten-grenze.js')

const projekt = path.join(tmp, 'projekt')
const vorrat = path.join(projekt, 'daniel-zum-abarbeiten', 'vorrat')
fs.mkdirSync(vorrat, { recursive: true })
fs.mkdirSync(path.join(projekt, '_wt-x'))
const transcript = path.join(tmp, 'sitzung.jsonl')
const sub = path.join(tmp, 'sitzung', 'subagents')
fs.mkdirSync(sub, { recursive: true })
const laeuft = (id, typ) => {
  fs.writeFileSync(path.join(sub, `agent-${id}.jsonl`), JSON.stringify({ type: 'assistant', message: { stop_reason: 'tool_use' } }) + '\n')
  fs.writeFileSync(path.join(sub, `agent-${id}.meta.json`), JSON.stringify({ agentType: typ, description: id }))
}
const sitzung = 'test-' + process.pid
const marker = markerVon(sitzung)
fs.mkdirSync(path.dirname(marker), { recursive: true })
fs.writeFileSync(marker, '2099-01-01T00:00:00+01:00')
let fehler = 0
const pruef = (name, ok) => { if (!ok) { fehler++; console.log('ROT', name) } }
const ein = { transcript_path: transcript, cwd: path.join(projekt, '_wt-x'), session_id: sitzung }

{
  pruef('leerer Vorrat meldet', /leer/.test(pruefe(ein) || ''))
  fs.writeFileSync(path.join(vorrat, 'z-blockiert.md'), '# Auftrag Z\nText')
  fs.writeFileSync(path.join(vorrat, 'erledigt-alt.md'), '# Auftrag E\nText')
  fs.writeFileSync(path.join(vorrat, '05-pr.md'), '# Auftrag P\nText\n\n**Vergeben:** PR 1\n')
  pruef('Blockiertes, Erledigtes und per PR Vergebenes zählt als leer', /leer/.test(pruefe(ein) || '') && !/Auftrag [ZEP]/.test(pruefe(ein) || ''))
  fs.writeFileSync(path.join(vorrat, '10-a.md'), '# Auftrag A\nText')
  fs.writeFileSync(path.join(vorrat, '20-b.md'), '# Auftrag B\nText')
  for (let i = 1; i < GRENZE; i++) laeuft(`b${i}`, 'bauer')
  laeuft('p1', 'pruefer')
  const r = pruefe(ein) || ''
  pruef('ein Platz frei nennt nur A', r.includes(`1 von ${GRENZE}`) && /Auftrag A/.test(r) && !/Auftrag B/.test(r))
  // A liest schon ein laufender Agent: nicht noch einmal vorschlagen, B rückt nach.
  const kopf = JSON.stringify({ type: 'user', message: { content: 'Lies und führe aus: …/vorrat/10-a.md' } }) + '\n'
  fs.writeFileSync(path.join(sub, 'agent-b1.jsonl'), kopf + JSON.stringify({ type: 'assistant', message: { stop_reason: 'tool_use' } }) + '\n')
  const v = pruefe(ein) || ''
  pruef('vergebener Auftrag rückt nicht nach', /Auftrag B/.test(v) && !/Auftrag A/.test(v))
  // Wartet ein Agent auf eigene Hintergrundarbeit (end_turn ohne Bericht), belegt er den Platz weiter.
  fs.writeFileSync(path.join(sub, `agent-b${GRENZE}.jsonl`), JSON.stringify({ type: 'assistant', message: { stop_reason: 'end_turn' } }) + '\n')
  fs.writeFileSync(path.join(sub, `agent-b${GRENZE}.meta.json`), JSON.stringify({ agentType: 'bauer', description: 'wartet' }))
  pruef('wartender Agent belegt den Platz', pruefe(ein) === null)
  laeuft(`b${GRENZE}`, 'bauer')
  pruef('alle belegt schweigt', pruefe(ein) === null)
  pruef('stop_hook_active schweigt', pruefe({ ...ein, stop_hook_active: true }) === null)
}
{
  // Grenz-Hook: lokal höchstens GRENZE Nicht-Prüfer, Prüfer starten immer.
  for (const f of fs.readdirSync(sub)) fs.rmSync(path.join(sub, f))
  const start = (typ) => grenzePruefe({ transcript_path: transcript, tool_input: { subagent_type: typ } })
  pruef('lokale Grenze ist 2', GRENZE === 2)
  for (let i = 1; i < GRENZE; i++) laeuft(`g${i}`, 'bauer')
  laeuft('p2', 'pruefer')
  pruef('unter der Grenze startet Bauer', start('bauer') === null)
  laeuft(`g${GRENZE}`, 'bauer')
  pruef('volle Grenze sperrt weiteren Bauer und nennt Cloud', /Cloud-Sitzung/.test(start('bauer') || ''))
  pruef('volle Grenze lässt Prüfer starten', start('pruefer') === null)
}
pruef('ohne Vorrat-Ordner schweigt', pruefe({ ...ein, cwd: os.tmpdir() }) === null)
pruef('nach Ende des Modus schweigt', pruefe(ein, Date.parse('2100-01-01')) === null)
pruef('20 min vor Ende schweigt', pruefe(ein, Date.parse('2099-01-01T00:00:00+01:00') - 20 * 60 * 1000) === null)
pruef('fremde Sitzung schweigt', pruefe({ ...ein, session_id: 'andere' }) === null)
fs.rmSync(tmp, { recursive: true, force: true })
fs.rmSync(marker)
console.log(fehler ? `${fehler} rot` : 'agenten-vorrat: alle Fälle grün')
process.exit(fehler ? 1 : 0)
