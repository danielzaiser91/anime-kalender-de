// UserPromptSubmit-Bündel: führt die bisher einzeln gestarteten Hooks in einem Node-Prozess aus
// (Systemzeit, watch, posteingang, kontext-stand, daniel-dateien, prozess-waechter) und gibt EINEN
// additionalContext aus. Ein Fehler in einem Modul stoppt die anderen nicht. Rückfall: settings.json.bak-hooks-bundle.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const H = dirname(fileURLToPath(import.meta.url))

const pad = (n) => String(n).padStart(2, '0')
const systemzeit = () => {
  const d = new Date()
  return `[Systemzeit: ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr]`
}

/** Reihenfolge wie vorher in settings.json. */
const MODULE = [
  ['systemzeit', async () => systemzeit()],
  ['watch.js', async (i) => require(join(H, 'watch.js')).lauf(i, 'UserPromptSubmit')],
  ['posteingang.js', async () => require(join(H, 'posteingang.js')).lauf()],
  ['kontext-stand.js', async (i) => (await import('./kontext-stand.mjs')).lauf(i)],
  ['daniel-dateien.mjs', async (i) => (await import('./daniel-dateien.mjs')).lauf(i)],
  ['prozess-waechter.js', async () => require(join(H, 'prozess-waechter.js')).meldung()],
  ['ende-termin.mjs', async () => (await import('./ende-termin.mjs')).meldung()],
  ['software-updates.js', async () => (await import('./software-updates.mjs')).meldung()],
]

async function main(roh) {
  let input = {}
  try {
    input = JSON.parse(roh || '{}')
  } catch {
    /* ohne Eingabe trotzdem arbeiten */
  }
  const texte = []
  for (const [name, f] of MODULE) {
    try {
      const t = await f(input)
      if (t) texte.push(String(t).replace(/\n+$/, ''))
    } catch (err) {
      process.stderr.write(`${name}: ${err.message}\n`)
    }
  }
  if (texte.length) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: texte.join('\n') } }))
  }
}

let roh = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { roh += c })
process.stdin.on('end', async () => {
  try {
    await main(roh)
  } catch (err) {
    process.stderr.write(`dispatch-userpromptsubmit: ${err.message}\n`)
  }
  process.exit(0)
})
