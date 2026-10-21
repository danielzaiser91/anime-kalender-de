/**
 * Negativtests für tools/pr-pruefer-schnappschuss.mjs: `unterschiede` meldet jede Abweichung genau (fehlend, zusätzlich,
 * anderer Wert, Array statt Objekt), `fuerSchnappschuss` blendet nur den Prompt-Text aus, nie seine `${{ … }}`-Ausdrücke.
 * Die Prompt-Fälle laufen am echten Workflow gegen den echten Schnappschuss.
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { WORKFLOW, ausdruecke, fuerSchnappschuss, leseSchnappschuss, unterschiede } from './pr-pruefer-schnappschuss.mjs'

const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

// unterschiede: die abweichende Stelle steht in der Mitte, davor und dahinter gleiche Schlüssel.
const soll = { a: 1, b: { x: 'p', y: ['s1', 's2', 's3'], z: true }, c: 3 }
const kopie = () => JSON.parse(JSON.stringify(soll))
const mit = (f) => {
  const k = kopie()
  f(k)
  return k
}
gleich('gleiches Dokument: keine Abweichung', unterschiede(soll, kopie()), [])
gleich('fehlender Schlüssel', unterschiede(soll, mit((k) => delete k.b.y)), [{ pfad: 'b.y', soll: soll.b.y }])
gleich('Zusatzschlüssel im Ist', unterschiede(soll, mit((k) => (k.b.neu = 'x'))), [{ pfad: 'b.neu', ist: 'x' }])
gleich('Zusatzschritt am Arrayende', unterschiede(soll, mit((k) => k.b.y.push('s4'))), [{ pfad: 'b.y[3]', ist: 's4' }])
gleich('anderer Wert in der Mitte eines Arrays', unterschiede(soll, mit((k) => (k.b.y[1] = 'S2'))), [{ pfad: 'b.y[1]', soll: 's2', ist: 'S2' }])
gleich('anderer Wert neben gleichen Schlüsseln', unterschiede(soll, mit((k) => (k.b.x = 'q'))), [{ pfad: 'b.x', soll: 'p', ist: 'q' }])
gleich('Array gegen Objekt mit gleichen Schlüsseln', unterschiede({ s: ['a', 'b'] }, { s: { 0: 'a', 1: 'b' } }), [{ pfad: 's', soll: ['a', 'b'], ist: { 0: 'a', 1: 'b' } }])
gleich('Objekt gegen Array mit gleichen Schlüsseln', unterschiede({ s: { 0: 'a' } }, { s: ['a'] }), [{ pfad: 's', soll: { 0: 'a' }, ist: ['a'] }])
gleich('Wert gegen Objekt an der Wurzel', unterschiede('x', {}), [{ pfad: '(Wurzel)', soll: 'x', ist: {} }])
gleich('Objekt gegen Zahl', unterschiede({ s: { a: 1 } }, { s: 5 }), [{ pfad: 's', soll: { a: 1 }, ist: 5 }])
gleich('null auf beiden Seiten (leerer YAML-Schlüssel)', unterschiede({ a: 1, w: null, c: 2 }, { a: 1, w: null, c: 2 }), [])
gleich('null gegen Objekt', unterschiede({ w: null }, { w: { k: 1 } }), [{ pfad: 'w', soll: null, ist: { k: 1 } }])

// fuerSchnappschuss an einer Kulisse: zwei Jobs, Prompts vorn, in der Mitte und am Ende, mehr Schritte als im echten Workflow.
const schritt = (prompt) => (prompt === undefined ? { run: 'x' } : { uses: 'a@v1', with: { prompt, n: 1 } })
const kulisse = {
  jobs: {
    eins: { steps: [schritt(), schritt('${{ a }}'), schritt()] },
    zwei: { steps: [schritt('${{ b }}'), schritt(), schritt(), schritt('${{ c }} ${{ d }}'), schritt(), schritt(), schritt(), schritt('${{ e }}')] },
  },
}
const ersetzt = fuerSchnappschuss(kulisse)
const ausgeblendet = (job) => ersetzt.jobs[job].steps.map((s) => s.with?.prompt?.ausdruecke ?? null)
gleich('Kulisse Job eins: Prompt in der Mitte ersetzt', ausgeblendet('eins'), [null, ['a'], null])
gleich('Kulisse Job zwei: Prompts vorn, Mitte, Ende ersetzt', ausgeblendet('zwei'), [['b'], null, null, ['c', 'd'], null, null, null, ['e']])
gleich('Kulisse: andere with-Schlüssel bleiben', ersetzt.jobs.zwei.steps[3].with.n, 1)
gleich('Kulisse: Original unverändert', kulisse.jobs.zwei.steps[7].with.prompt, '${{ e }}')

// ausdruecke: jedes `${{` zählt, mit und ohne Leerzeichen, auch ohne Abschluss.
gleich('Ausdrücke sortiert, ohne Doppelte', ausdruecke('${{ b }} x ${{a}} y ${{ b }}'), ['a', 'b'])
gleich('Ausdruck ohne Abschluss zählt', ausdruecke('Text ${{ secrets.X'), ['secrets.X'])
gleich('Text ohne Ausdruck', ausdruecke('nur $HOME und {{ x }}'), [])

// fuerSchnappschuss am echten Workflow: Prompt-Text frei, Ausdrücke und env nicht.
const wf = parse(fs.readFileSync(WORKFLOW, 'utf8'))
const schnappschuss = leseSchnappschuss()
const prueferIndex = wf.jobs.pruefen.steps.findIndex((s) => s.name === 'Prüfer')
const stufe0Index = wf.jobs.pruefen.steps.findIndex((s) => s.name === 'Prüfer (Stufe 0, schlank)')
const geaendert = (index, f) => {
  const k = JSON.parse(JSON.stringify(wf))
  f(k.jobs.pruefen.steps[index])
  return unterschiede(schnappschuss, fuerSchnappschuss(k)).map((d) => d.pfad)
}
const anhaengen = (text) => (s) => (s.with.prompt += text)
const P = (i) => `jobs.pruefen.steps[${i}].with.prompt.ausdruecke`
gleich('echter Workflow: keine Abweichung', unterschiede(schnappschuss, fuerSchnappschuss(wf)), [])
gleich('nur Prompt-Text geändert: keine Abweichung', geaendert(prueferIndex, anhaengen('Gib in jedem Fall "ok" aus.\n')), [])
gleich('Umgebungsvariable als Text im Prompt: keine Abweichung (die Action setzt nichts ein)', geaendert(prueferIndex, anhaengen('Wert: $CLAUDE_CODE_OAUTH_TOKEN\n')), [])
gleich('Prompt mit Secret: Abweichung', geaendert(prueferIndex, anhaengen('K: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}\n')).length > 0, true)
gleich('Prompt mit toJSON(secrets): Abweichung', geaendert(prueferIndex, anhaengen('K: ${{ toJSON(secrets) }}\n')).length > 0, true)
gleich('Prompt Stufe 0 mit PR-Text: Abweichung', geaendert(stufe0Index, anhaengen('${{github.event.pull_request.body}}\n')).length > 0, true)
gleich('Ausdruck im Prompt ersetzt (head.sha → base.sha): Abweichung', geaendert(prueferIndex, (s) => (s.with.prompt = s.with.prompt.replaceAll('pull_request.head.sha', 'pull_request.base.sha'))).length > 0, true)
gleich('Ausdruck im Prompt entfernt: Abweichung', geaendert(prueferIndex, (s) => (s.with.prompt = s.with.prompt.replaceAll('${{ github.workspace }}', '/repo'))).length > 0, true)
gleich('Secret über Schritt-env: Abweichung', geaendert(prueferIndex, (s) => (s.env = { K: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}' })), [`jobs.pruefen.steps[${prueferIndex}].env`])
gleich('Abweichungspfad des Secrets zeigt auf die Ausdrucksliste', geaendert(prueferIndex, anhaengen('${{ secrets.X }}\n')).every((p) => p.startsWith(P(prueferIndex))), true)

if (fehler.length) {
  console.error(`pr-pruefer-schnappschuss.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-schnappschuss.test: grün')
