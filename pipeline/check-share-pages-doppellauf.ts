/**
 * Anlassfall PR 2987: `build-share-pages.ts` auf einem schon verarbeiteten `dist/` (Wurzel-Element enthält bereits Inhalt)
 * endet mit Exit 1 und muss sagen, was zu tun ist. Läuft das ganze Skript als Prozess gegen eine Kulisse (`AK_ROOT`).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const kulisse = mkdtempSync(join(tmpdir(), 'share-doppel-'))

try {
  mkdirSync(join(kulisse, 'dist'), { recursive: true })
  mkdirSync(join(kulisse, 'data'), { recursive: true })
  writeFileSync(join(kulisse, 'data', 'kennungen.json'), JSON.stringify({ titel: [] }))
  writeFileSync(
    join(kulisse, 'dist/index.html'),
    '<html><!-- social:start --><meta><!-- social:end --><body><div id="root"><p>schon gerendert</p></div></body></html>',
  )
  const lauf = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/build-share-pages.ts')], {
    env: { ...process.env, AK_ROOT: kulisse },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  const fehler: string[] = []
  if (lauf.status !== 1) fehler.push(`Exit ${lauf.status}, erwartet 1 (${lauf.stderr.slice(-300)})`)
  if (!lauf.stderr.includes('dist/ ist schon verarbeitet')) fehler.push(`Meldung sagt nicht, was zu tun ist: ${lauf.stderr.slice(-300)}`)
  if (!lauf.stderr.includes('erst `vite build` neu')) fehler.push('Handlungsanweisung fehlt')
  if (fehler.length) {
    for (const f of fehler) console.error('✖ check-share-pages-doppellauf: ' + f)
    process.exitCode = 1 // nicht exit(): sonst übersprünge es das finally und die Kulisse bliebe liegen
  } else {
    console.log('✔ check-share-pages-doppellauf: schon verarbeitetes dist/ → Exit 1 mit Anweisung „erst vite build neu“ (1 Fall)')
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
