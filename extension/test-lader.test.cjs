// Test für test-lader.cjs: Reihenfolge kommt aus dem Manifest, falsche Namen werden abgewiesen.
const assert = require('node:assert/strict')
const manifest = require('./manifest.json')
const { skripteBis } = require('./test-lader.cjs')

const gruppe = manifest.content_scripts.find((c) => c.js.includes('melder.js')).js
assert.deepEqual(skripteBis('melder.js'), gruppe.slice(0, gruppe.indexOf('melder.js') + 1))
// `nur` wählt aus, ändert aber die Reihenfolge nicht (auch wenn der Test sie anders nennt)
assert.deepEqual(skripteBis('melder.js', { nur: ['melder.js', 'box.js'] }), ['box.js', 'melder.js'])
assert.throws(() => skripteBis('melder.js', { nur: ['netflix-bericht.js'] }), /nicht vor melder\.js/)
assert.throws(() => skripteBis('gibt-es-nicht.js'), /keiner content_scripts-Gruppe/)
console.log('test-lader.test: ok')
