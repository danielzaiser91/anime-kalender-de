// Zusicherungen für tools/zugangs-waechter.mjs: Kontingent-Erkennung und Register gegen die Workflows.
import assert from 'node:assert/strict'
import { kontingentFunde, registerBefunde, vomWecker, wachePlanBefunde } from './zugangs-waechter.mjs'

const schritt = (name, conclusion, von, bis) => ({ name, conclusion, started_at: von, completed_at: bis })

// Echter Fall 02.10.2026 (Lauf 37035218875): Claude-Schritt scheitert nach 16 s.
assert.equal(kontingentFunde([schritt('Recherche', 'failure', '2026-10-02T16:38:18Z', '2026-10-02T16:38:34Z')]).length, 1)
assert.equal(kontingentFunde([schritt('Run anthropics/claude-code-action@v1', 'failure', '2026-10-02T16:38:18Z', '2026-10-02T16:38:25Z')]).length, 1)
// Ein langer Fehlschlag ist ein anderer Fehler, ein schneller Erfolg kein Befund, ein fremder Schritt auch nicht.
assert.equal(kontingentFunde([schritt('Recherche', 'failure', '2026-10-08T11:01:34Z', '2026-10-08T11:03:45Z')]).length, 0)
assert.equal(kontingentFunde([schritt('Recherche', 'success', '2026-10-08T11:01:34Z', '2026-10-08T11:01:36Z')]).length, 0)
assert.equal(kontingentFunde([schritt('npm ci', 'failure', '2026-10-08T11:01:34Z', '2026-10-08T11:01:36Z')]).length, 0)

// Register: unbekanntes Secret und falsche Workflow-Liste werden gemeldet.
const reg = { laeufe: {}, zugaenge: [{ id: 'A', ort: 'github-secret', wofuer: 'x', gueltig: {}, erneuerung: {}, folge: 'y', workflows: ['a.yml'] }] }
assert.deepEqual(registerBefunde(reg, { A: new Set(['a.yml']) }, ['a.yml']), [])
assert.equal(registerBefunde(reg, { A: new Set(['a.yml']), B: new Set(['a.yml']) }, ['a.yml']).length, 1)
assert.equal(registerBefunde(reg, { A: new Set(['a.yml', 'b.yml']) }, ['a.yml', 'b.yml']).length, 1)

// Wecker (PAT, Nutzer) zählt, Wecker-Wache (github-actions[bot]) und Zeitplan-Starts nicht. Gemessen 11.10.2026: Probe-Dispatch der Wache aus einem GITHUB_TOKEN-Lauf (Lauf 38131257307 startete wecker-wache.yml) erschien mit actor und triggering_actor github-actions[bot].
assert.equal(vomWecker({ event: 'workflow_dispatch', actor: { login: 'danielzaiser91' } }), true)
assert.equal(vomWecker({ event: 'workflow_dispatch', actor: { login: 'github-actions[bot]' } }), false)
assert.equal(vomWecker({ event: 'schedule', actor: { login: 'danielzaiser91' } }), false)

// Wache muss jeden Workflow des Weckplans kennen.
assert.deepEqual(wachePlanBefunde("{ workflow: 'a.yml' }, { workflow: 'b-c.yml' }", 'PLAN="a.yml:3 b-c.yml:30:ohne-abbruch"'), [])
assert.equal(wachePlanBefunde("{ workflow: 'a.yml' }, { workflow: 'neu.yml' }", 'PLAN="a.yml:3"').length, 1)

console.log('zugangs-waechter: Zusicherungen ok')
