/**
 * Kettenschritt `check:mod-tests`: fährt `claude plugin test` für die Mod `arbeitsliste` (.claude/mods/arbeitsliste).
 * Im PR-Ereignis nur, wenn der PR etwas unter `.claude/mods/` ändert (Basis = erster Elternteil des Merge-Commits,
 * siehe tools/pr-basis.mjs); sonst (lokal, anderes Ereignis) immer. Ein Pfadfilter auf Workflow-Ebene ginge nicht: der Pflicht-Check
 * meldete sich nie. Ohne `claude` im PATH holt `npx` die auf VERSION festgelegte CLI (Messung 09.11.2026: 18 s inklusive Abruf).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ladeBasis } from './pr-basis.mjs'

export const MOD_ORDNER = '.claude/mods/'
export const MOD = '.claude/mods/arbeitsliste'
export const VERSION = '2.1.319'

/** Berührt die Dateiliste die Mods? */
export function betrifftMods(dateien) {
  return dateien.some((d) => d.startsWith(MOD_ORDNER))
}

/** Befehl und Argumente: `claude` aus dem PATH, wenn vorhanden, sonst die festgelegte CLI-Version über npx. */
export function testBefehl(claudeVorhanden, ordner) {
  return claudeVorhanden
    ? { cmd: 'claude', args: ['plugin', 'test', ordner] }
    : { cmd: 'npx', args: ['--yes', `@anthropic-ai/claude-code@${VERSION}`, 'plugin', 'test', ordner] }
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true, timeout: 60000 })
}

function geaenderteDateien(env) {
  if (env.GITHUB_EVENT_NAME !== 'pull_request') return null
  const basis = ladeBasis(git)
  return git('diff', '--name-only', '--no-renames', basis, 'HEAD').split('\n').filter(Boolean)
}

function main(env, wurzel) {
  const dateien = geaenderteDateien(env)
  if (dateien !== null && !betrifftMods(dateien)) {
    console.log(`✔ mod-tests: übersprungen (PR ändert nichts unter ${MOD_ORDNER}, ${dateien.length} Dateien)`)
    return 0
  }
  const win = process.platform === 'win32'
  const vorhanden = spawnSync('claude', ['--version'], { windowsHide: true, shell: win, timeout: 60000 }).status === 0
  const { cmd, args } = testBefehl(vorhanden, resolve(wurzel, MOD))
  const lauf = spawnSync(cmd, args, { stdio: 'inherit', windowsHide: true, shell: win, timeout: 240000 })
  if (lauf.status !== 0) {
    console.error(`✖ mod-tests: \`claude plugin test\` endete mit ${lauf.status ?? lauf.signal} (${cmd})`)
    return 1
  }
  console.log('✔ mod-tests: claude plugin test grün')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.env, resolve(dirname(fileURLToPath(import.meta.url)), '..')))
}
