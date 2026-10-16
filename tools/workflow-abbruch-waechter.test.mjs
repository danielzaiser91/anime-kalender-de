/**
 * Fixture-Test für tools/workflow-abbruch-waechter.mjs: Der alte Concurrency-Block von deploy.yml (Stand vor 16.10.2026)
 * muss genau zwei Fehler liefern, der neue keinen; ohne Treffer bliebe eine leere Fehlerliste unbemerkt.
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { parse } from 'yaml'
import { pruefeAlle, pruefeWorkflow } from './workflow-abbruch-waechter.mjs'

const KOPF = 'on:\n  workflow_run:\n    workflows: [Bestandsbau]\n    types: [completed]\n  push:\nconcurrency:\n'
const GRUPPE_ALT = "${{ (github.event_name == 'push' && github.actor == 'x') && format('app-push-{0}', github.run_id) || 'pages' }}"
const GRUPPE_NEU = "${{ (github.event_name == 'push' && github.actor == 'x') && format('app-push-{0}', github.run_id) || (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion != 'success') && format('uebersprungen-{0}', github.run_id) || 'pages' }}"
const ALT = `${KOPF}  group: ${GRUPPE_ALT}\n  cancel-in-progress: true\n`
const NEU = `${KOPF}  group: ${GRUPPE_NEU}\n  cancel-in-progress: \${{ github.event_name != 'workflow_run' }}\n`
const OHNE_AUSLOESER = 'on: push\nconcurrency:\n  group: pages\n  cancel-in-progress: true\n'

assert.equal(pruefeWorkflow('alt.yml', parse(ALT)).length, 2)
assert.deepEqual(pruefeWorkflow('neu.yml', parse(NEU)), [])
assert.deepEqual(pruefeWorkflow('push.yml', parse(OHNE_AUSLOESER)), [])
assert.deepEqual(pruefeAlle(join(import.meta.dirname, '..', '.github', 'workflows')), [])
console.log('workflow-abbruch-waechter.test: ok')
