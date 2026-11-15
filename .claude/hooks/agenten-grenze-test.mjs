// Test: node .claude/hooks/agenten-grenze-test.mjs
// Parallelstart (15.11.2026): fünf Hook-Prozesse gleichzeitig, ohne Agentendatei, dürfen genau 2 Starts durchlassen.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const hook = path.join(path.dirname(new URL(import.meta.url).pathname), 'agenten-grenze.js')
const { pruefe } = createRequire(import.meta.url)(hook)
let fehler = 0
const pruef = (name, ok) => { if (!ok) { fehler++; console.log('ROT', name) } else console.log('ok ', name) }

const neueSitzung = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grenze-'))
  fs.mkdirSync(path.join(tmp, 'sitzung', 'subagents'), { recursive: true })
  return { transcript: path.join(tmp, 'sitzung.jsonl'), sub: path.join(tmp, 'sitzung', 'subagents'), plaetze: path.join(tmp, 'sitzung', 'agent-plaetze') }
}
const eingabe = (s, typ) => ({ transcript_path: s.transcript, tool_input: { subagent_type: typ, description: 'x' } })

const lauf = (input) => new Promise((resolve) => {
  const k = spawn(process.execPath, [hook], { stdio: ['pipe', 'pipe', 'inherit'] })
  let aus = ''
  k.stdout.on('data', (d) => (aus += d))
  k.on('close', (code) => resolve({ code, verweigert: aus.includes('"deny"') }))
  k.stdin.end(JSON.stringify(input))
})
const parallel = (s, typ, n) => Promise.all(Array.from({ length: n }, () => lauf(eingabe(s, typ))))

// 1) Fünf gleichzeitige Bauer: genau 2 erlaubt, 3 verweigert (mehrfach wiederholt wegen des Rennens).
for (let runde = 0; runde < 10; runde++) {
  const s = neueSitzung()
  const r = await parallel(s, 'bauer', 5)
  const erlaubt = r.filter((x) => x.code === 0 && !x.verweigert).length
  pruef(`Runde ${runde}: 5 parallele Bauer → 2 erlaubt, 3 verweigert`, erlaubt === 2 && r.filter((x) => x.verweigert).length === 3)
}

// 2) Fünf parallele Prüfer: alle erlaubt, keine Platzdatei.
{
  const s = neueSitzung()
  const r = await parallel(s, 'pruefer', 5)
  pruef('5 parallele Prüfer → alle erlaubt', r.every((x) => !x.verweigert))
  pruef('Prüfer belegen keine Plätze', !fs.existsSync(s.plaetze) || fs.readdirSync(s.plaetze).length === 0)
}

// 3) Verfall: Plätze älter als 120 s zählen nicht mehr.
{
  const s = neueSitzung()
  const t0 = 1_000_000_000_000
  pruef('Start 1 erlaubt', pruefe(eingabe(s, 'bauer'), t0) === null)
  pruef('Start 2 erlaubt', pruefe(eingabe(s, 'bauer'), t0) === null)
  pruef('Start 3 nach 119 s verweigert', pruefe(eingabe(s, 'bauer'), t0 + 119_000) !== null)
  pruef('Start 3 nach 121 s erlaubt (Reservierung verfallen)', pruefe(eingabe(s, 'bauer'), t0 + 121_000) === null)
}

// 4) Ersetzung: echte Agentendatei ersetzt die Reservierung, kein Doppelzählen (2 laufend + 2 Reservierungen = 2, nicht 4).
{
  const s = neueSitzung()
  const jetzt = Date.now()
  pruef('Start 1', pruefe(eingabe(s, 'bauer'), jetzt) === null)
  pruef('Start 2', pruefe(eingabe(s, 'bauer'), jetzt) === null)
  await new Promise((r) => setTimeout(r, 20))
  for (const id of ['a', 'b']) {
    fs.writeFileSync(path.join(s.sub, `agent-${id}.jsonl`), JSON.stringify({ type: 'assistant', message: { stop_reason: 'tool_use' } }) + '\n')
    fs.writeFileSync(path.join(s.sub, `agent-${id}.meta.json`), JSON.stringify({ agentType: 'bauer', description: id }))
  }
  pruef('2 laufen, Reservierungen ersetzt → 3. verweigert', pruefe(eingabe(s, 'bauer'), jetzt + 1000) !== null)
  pruef('Platzdateien nach Ersetzung entfernt', fs.readdirSync(s.plaetze).length === 0)
  // Einer fertig → ein Platz frei, und die Ersetzung hat keinen Geist hinterlassen.
  fs.writeFileSync(path.join(s.sub, 'agent-a.meta.json'), JSON.stringify({ agentType: 'bauer', description: 'a', finished: true }))
  pruef('einer fertig → neuer Start erlaubt', pruefe(eingabe(s, 'bauer'), jetzt + 2000) === null)
}

console.log(fehler ? `${fehler} ROT` : 'agenten-grenze-test: alles grün (10 Parallelrunden, Prüfer, Verfall, Ersetzung)')
process.exit(fehler ? 1 : 0)
