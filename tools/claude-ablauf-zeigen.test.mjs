/** `tools/claude-ablauf-zeigen.mjs`: Fälle leer, kaputt, kein Array, Datei fehlt, normaler Ablauf mit Werkzeugaufruf, Fehlerergebnis und Ende. */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { parse } from 'yaml'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ablaufZeilen } from './claude-ablauf-zeigen.mjs'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const ablauf = [
  { type: 'system', subtype: 'init' },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'Ich löse\n die Konflikte.' }, { type: 'tool_use', name: 'Bash', input: { command: 'git merge origin/main' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', is_error: true, content: 'CONFLICT (content): data/crunchyroll.json' }] } },
  { type: 'result', subtype: 'success', num_turns: 8, result: 'PR 1556 bleibt offen.' },
]
const z = ablaufZeilen(JSON.stringify(ablauf))
pruefe('Text wird einzeilig gezeigt', z[0] === 'Claude: Ich löse die Konflikte.', z)
pruefe('Werkzeugaufruf mit Befehl', z[1] === 'Aufruf Bash: git merge origin/main', z)
pruefe('Fehlerergebnis ist als Fehler gekennzeichnet', z[2] === 'Ergebnis (Fehler): CONFLICT (content): data/crunchyroll.json', z)
pruefe('Ende mit Untertyp, Zügen und Ergebnis', z[3] === 'Ende (success, 8 Züge): PR 1556 bleibt offen.' && z.length === 4, z)
pruefe('lange Ausgabe wird auf 300 Zeichen gekürzt', ablaufZeilen(JSON.stringify([{ type: 'assistant', message: { content: [{ type: 'text', text: 'x'.repeat(301) }] } }]))[0] === `Claude: ${'x'.repeat(300)}…`, 0)
pruefe('genau 300 Zeichen bleiben ganz', ablaufZeilen(JSON.stringify([{ type: 'assistant', message: { content: [{ type: 'text', text: 'y'.repeat(300) }] } }]))[0] === `Claude: ${'y'.repeat(300)}`, 0)
pruefe('leeres Array: „Ablauf leer.“', ablaufZeilen('[]')[0] === 'Ablauf leer.', ablaufZeilen('[]'))
pruefe('kaputtes JSON: Hinweis statt Absturz', ablaufZeilen('{[')[0] === 'Ablauf nicht lesbar: kein gültiges JSON.', 0)
pruefe('Objekt statt Array: Hinweis', ablaufZeilen('{}')[0] === 'Ablauf nicht lesbar: kein Array.', 0)
pruefe('fremde Einträge (null, Zahl) stören nicht', ablaufZeilen('[null, 5, {"type":"result","subtype":"error_max_turns","num_turns":60}]')[0] === 'Ende (error_max_turns, 60 Züge): ', 0)

const dir = mkdtempSync(join(tmpdir(), 'claude-ablauf-'))
try {
  const skript = join(dirname(fileURLToPath(import.meta.url)), 'claude-ablauf-zeigen.mjs')
  const lauf = (datei) => spawnSync(process.execPath, [skript, datei], { encoding: 'utf8', windowsHide: true })
  const fehlt = lauf(join(dir, 'gibt-es-nicht.json'))
  pruefe('Datei fehlt: Exit 0 und Zeile', fehlt.status === 0 && /fehlt\./.test(fehlt.stdout), fehlt)
  writeFileSync(join(dir, 'a.json'), JSON.stringify(ablauf))
  const echt = lauf(join(dir, 'a.json'))
  pruefe('als Prozess: Exit 0 und Ende-Zeile im Protokoll', echt.status === 0 && /Ende \(success, 8 Züge\)/.test(echt.stdout), echt)
  writeFileSync(join(dir, 'k.json'), '{[')
  const kaputt = lauf(join(dir, 'k.json'))
  pruefe('als Prozess mit kaputter Datei: Exit 0', kaputt.status === 0 && /nicht lesbar/.test(kaputt.stdout), kaputt)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
// Verdrahtung: im Workflow steht der Schritt hinter der Claude-Action, vor dem Mergen, läuft immer und färbt den Lauf nicht.
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const schritte = parse(readFileSync(join(wurzel, '.github/workflows/claude-daten-merge.yml'), 'utf8')).jobs.zusammenfuehren.steps
const claude = schritte.findIndex((x) => String(x.uses ?? '').startsWith('anthropics/claude-code-action'))
const zeigen = schritte.findIndex((x) => x.run === 'node tools/claude-ablauf-zeigen.mjs "$RUNNER_TEMP/claude-execution-output.json"')
const mergen = schritte.findIndex((x) => /daten-pr-mergen\.sh/.test(x.run ?? ''))
pruefe('Workflow: Ablauf-Schritt direkt hinter Claude, vor dem Mergen', claude >= 0 && zeigen === claude + 1 && mergen > zeigen, { claude, zeigen, mergen })
pruefe('Workflow: Ablauf-Schritt läuft immer und ist nicht fehlerfärbend', schritte[zeigen]?.if === 'always()' && schritte[zeigen]?.['continue-on-error'] === true, schritte[zeigen])
if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('claude-ablauf-zeigen: alle Zusicherungen gehalten.')
