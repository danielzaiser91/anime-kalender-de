/* Fährt die Mod-Tests (`.claude/mods/<mod>/hooks/*.test.ts`) mit `claude plugin test` in einer Kopie unter os.tmpdir().
 * Die Typen (`.claude-plugin/types`) braucht der Lauf nicht, sie schreibt Claude Code selbst; der Lauf braucht nur das CLI,
 * das hier über npx in genau der Version geholt wird, mit der die Tests geschrieben sind (Stand 11.11.2026).
 * Ohne CLI/Netz: in der PR-Prüfkette Fehler, sonst „übersprungen“ (Deploy-Job). Rot-Probe: eine Kopie mit absichtlich rotem Test muss durchfallen. */
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PFLICHT_WORKFLOW } from './browser-weiche.mjs'

const CLI = '@anthropic-ai/claude-code@2.1.321'
const FRIST_MS = 240_000
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 'gruen' | 'rot' | 'ohne-cli' — Exit 0 ist grün, eine Zeile „N fail“ mit N > 0 oder eine Testzeile „(fail)“ ist rot, alles andere (kein Lauf) heißt ohne CLI. */
export function urteil(status, ausgabe) {
  if (/^\s*[1-9]\d* fail\b/m.test(ausgabe) || /^\(fail\)/m.test(ausgabe)) return 'rot'
  if (status === 0 && /^\s*\d+ pass\b/m.test(ausgabe)) return 'gruen'
  return /\bRan \d+ tests\b/.test(ausgabe) ? 'rot' : 'ohne-cli'
}

function fahre(ordner) {
  const r = spawnSync('npx', ['--yes', CLI, 'plugin', 'test', '.'], {
    cwd: ordner,
    encoding: 'utf8',
    timeout: FRIST_MS,
    windowsHide: true,
    shell: process.platform === 'win32',
    env: { ...process.env, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' },
  })
  const ausgabe = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
  return { art: urteil(r.status, ausgabe), ausgabe }
}

function kopiere(mod, ziel) {
  cpSync(join(wurzel, '.claude', 'mods', mod), ziel, { recursive: true, filter: (p) => !p.includes('.claude-plugin/types') && !p.includes('.claude-plugin\\types') })
}

function main() {
  const mods = readdirSync(join(wurzel, '.claude', 'mods')).filter((m) => readdirSync(join(wurzel, '.claude', 'mods', m, 'hooks')).some((f) => f.endsWith('.test.ts')))
  if (mods.length === 0) {
    console.error('mod-tests: FEHLER (keine Mod mit Tests gefunden)')
    return 1
  }
  const temp = mkdtempSync(join(tmpdir(), 'mod-tests-'))
  try {
    for (const mod of mods) {
      const ziel = join(temp, mod)
      kopiere(mod, ziel)
      const { art, ausgabe } = fahre(ziel)
      if (art === 'ohne-cli') {
        const pflicht = process.env.GITHUB_WORKFLOW === PFLICHT_WORKFLOW
        console.log(`mod-tests: ${pflicht ? 'FEHLER' : 'übersprungen'} (claude plugin test nicht lauffähig)\n${ausgabe.slice(-600)}`)
        return pflicht ? 1 : 0
      }
      if (art === 'rot') {
        console.error(`mod-tests: ${mod} ROT\n${ausgabe.slice(-3000)}`)
        return 1
      }
      console.log(`mod-tests: ${mod} grün (${(ausgabe.match(/^\s*(\d+) pass/m) ?? [])[1]} Tests)`)
    }
    const probe = join(temp, 'rot-probe')
    kopiere(mods[0], probe)
    writeFileSync(join(probe, 'hooks', 'rot-probe.test.ts'), "import { test, expect } from 'claude-code/testing'\ntest('absichtlich rot', () => {\n  expect(1).toBe(2)\n})\n")
    if (fahre(probe).art !== 'rot') {
      console.error('mod-tests: FEHLER (Rot-Probe blieb grün)')
      return 1
    }
    console.log(`mod-tests: ${mods.length} Mods grün, Rot-Probe rot`)
    return 0
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

// Urteilsfälle (reine Funktion, ohne Netz)
function pruefeUrteil() {
  const faelle = [
    [0, ' 23 pass\n 0 fail\nRan 23 tests across 10 files.', 'gruen'],
    [1, ' 22 pass\n 1 fail\nRan 23 tests across 10 files.', 'rot'],
    [1, '(fail) x [1ms]\n 0 pass', 'rot'],
    [1, 'Ran 3 tests across 1 files.', 'rot'],
    [1, 'npm error 404', 'ohne-cli'],
    [0, '', 'ohne-cli'],
  ]
  for (const [s, a, soll] of faelle) {
    if (urteil(s, a) !== soll) {
      console.error(`mod-tests: Urteil falsch für ${JSON.stringify([s, a])}: ${urteil(s, a)} statt ${soll}`)
      return 1
    }
  }
  console.log(`mod-tests: ${faelle.length} Urteilsfälle grün`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const u = pruefeUrteil()
  process.exit(u !== 0 ? u : main())
}
