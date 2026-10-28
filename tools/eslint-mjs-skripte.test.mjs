// Die Skript-Lint-Config darf nicht wieder auf ganz globals.browser aufweichen.
import { ESLint } from 'eslint'
import assert from 'node:assert/strict'

const eslint = new ESLint({ overrideConfigFile: 'eslint.mjs-skripte.config.js' })

async function fehler(code) {
  const [r] = await eslint.lintText(code, { filePath: 'tools/probe.mjs' })
  return r.messages.map((m) => m.message)
}

assert.deepEqual(await fehler('console.log(window, document)\n'), [], 'genutzte Browser-Namen')
assert.deepEqual(await fehler('console.log(process.argv)\n'), [], 'Node-Global')
for (const name of ['status', 'name', 'close']) {
  const f = await fehler(`console.log(${name})\n`)
  assert.equal(f.length, 1, `${name} muss rot sein`)
}
console.log('eslint-mjs-skripte: 5 Fälle ok')
