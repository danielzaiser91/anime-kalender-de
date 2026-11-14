// Test für wrapup-sperre.js: node .claude/hooks/wrapup-sperre-test.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const { pruefe } = createRequire(import.meta.url)('./wrapup-sperre.js')
const w = (tool_input) => pruefe({ tool_name: 'mcp__ccd_turn__wrap_up', tool_input })

assert.equal(w({ recap: 'Gemergt.' }), null, 'nur recap: erlaubt')
assert.equal(w({ recap: 'x', ask: '  ', actions: [] }), null, 'leere Frage, leere Knöpfe: erlaubt')
assert.match(w({ recap: 'x', ask: 'Mergen?' }), /keine Frage/, 'Frage: gesperrt')
assert.match(w({ recap: 'x', actions: [{ label: 'Ja' }] }), /keine Knöpfe/, 'Knöpfe: gesperrt')
assert.match(w({ recap: 'x', ask: 'Mergen?', actions: [{ action: 'commit' }], blocked: true }), /stand\.md/, 'beides: gesperrt, mit Weg')
assert.equal(pruefe({ tool_name: 'Bash', tool_input: { ask: 'x' } }), null, 'anderes Werkzeug: unberührt')
console.log('wrapup-sperre-test: ok')
