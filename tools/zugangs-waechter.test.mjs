// Zusicherungen für tools/zugangs-waechter.mjs: Kontingent-Erkennung und Register gegen die Workflows.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { ausloeser, kontingentFunde, registerBefunde, vomWecker, wachePlanBefunde, weckplanLuecken } from './zugangs-waechter.mjs'

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

// Abruf-Workflows: im Weckplan oder auf der Ausnahmeliste. Anlass 13.10.2026: offizielle-news.yml fehlte im Plan und lief nie.
const abruf = 'name: x\n\non:\n  workflow_dispatch:\n    inputs:\n      a:\n\npermissions:\n  contents: read\n'
const zeitplan = 'on:\n  schedule:\n    - cron: "0 1 * * *"\n  workflow_dispatch:\n'
assert.deepEqual(ausloeser(abruf), ['workflow_dispatch'])
assert.deepEqual(ausloeser(zeitplan), ['schedule', 'workflow_dispatch'])
assert.deepEqual(ausloeser('on: [push, workflow_dispatch]\n'), ['push', 'workflow_dispatch'])
assert.deepEqual(weckplanLuecken("{ workflow: 'a.yml' }", { 'a.yml': abruf }, {}), [])
assert.equal(weckplanLuecken("{ workflow: 'a.yml' }", { 'a.yml': abruf, 'neu.yml': abruf }, {}).length, 1)
assert.deepEqual(weckplanLuecken("{ workflow: 'a.yml' }", { 'a.yml': abruf, 'neu.yml': abruf }, { 'neu.yml': 'Grund' }), [])
assert.deepEqual(weckplanLuecken('', { 'z.yml': zeitplan }, {}), [])
assert.equal(weckplanLuecken('', { 'a.yml': abruf }, { 'a.yml': 'Grund', 'weg.yml': 'Grund' }).length, 1)
assert.equal(weckplanLuecken("{ workflow: 'a.yml' }", { 'a.yml': abruf }, { 'a.yml': 'Grund' }).length, 1)
assert.equal(weckplanLuecken('', { 'a.yml': 'name: x\n' }, {}).length, 1)
// Fremdes Repo im Plan: der Workflow liegt nicht hier, die Wache muss ihn nicht nachholen, und er deckt keinen gleichnamigen Workflow hier.
const fremd = "{ workflow: 'f.yml', repo: 'o/r', abstandMin: 40 },\n{ workflow: 'h.yml', abstandMin: 40 }"
assert.equal(wachePlanBefunde(fremd, 'h.yml:5').length, 0)
assert.equal(wachePlanBefunde(fremd, 'f.yml:5').length, 1)
assert.equal(weckplanLuecken(fremd, { 'f.yml': abruf }, {}).length, 1)
// `repo: '` in einem Kommentar (auch in der Zeile davor) lässt keinen Hauptrepo-Eintrag fallen.
const kommentar = "// Nativ: repo: 'o/r'\n{ workflow: 'h.yml', abstandMin: 40 }, // repo: 'x'\n// repo: 'y'\n{ workflow: 'g.yml', abstandMin: 40 }"
assert.equal(wachePlanBefunde(kommentar, '').length, 2)
assert.equal(weckplanLuecken(kommentar, { 'h.yml': abruf, 'g.yml': abruf }, {}).length, 0)
// Gegenprobe am echten Bestand: ohne offizielle-news.yml im Plan wird die Prüfung rot, mit ihm grün.
const wurzel = new URL('..', import.meta.url)
const planText = readFileSync(new URL('shared/weckplan.ts', wurzel), 'utf8')
const verz = new URL('.github/workflows/', wurzel)
const echt = Object.fromEntries(readdirSync(verz).filter((d) => d.endsWith('.yml')).map((d) => [d, readFileSync(new URL(d, verz), 'utf8')]))
assert.deepEqual(weckplanLuecken(planText, echt), [])
const ohneNews = weckplanLuecken(planText.replace("workflow: 'offizielle-news.yml'", "workflow: 'x'"), echt)
assert.equal(ohneNews.length, 1)
assert.match(ohneNews[0], /offizielle-news\.yml/)

console.log('zugangs-waechter: Zusicherungen ok')
