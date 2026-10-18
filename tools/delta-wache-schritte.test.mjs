/**
 * Ablauftest der drei Prüfschritte aus delta-wache.yml (`run` und `shell` aus der YAML, `node` als Attrappe): Ein roter
 * Prüfer muss den Schritt rot machen, sonst schreibt die Wache „unauffällig“. Anlass (18.10.2026): Ohne `shell: bash` lief
 * `node … | tee` ohne pipefail, und Lauf 39125734203 meldete „⚠ 1 von 884 Adressen …“ als Erfolg.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const tools = dirname(fileURLToPath(import.meta.url))
const wf = parse(readFileSync(join(tools, '../.github/workflows/delta-wache.yml'), 'utf8'))
const IDS = ['delta', 'kasten', 'zugaenge']

/** Shell wie GitHub sie für `run` unter Linux aufruft (docs: „Defaults for shell“). */
function shellArgs(schritt) {
  if (schritt.shell === undefined) return ['-e']
  assert.equal(schritt.shell, 'bash', `${schritt.id}: unbekannte Shell`)
  return ['--noprofile', '--norc', '-eo', 'pipefail']
}

const ordner = mkdtempSync(join(tmpdir(), 'delta-wache-'))
try {
  const bin = join(ordner, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\necho "⚠  Befund"\nexit "${NODE_EXIT:-0}"\n')
  chmodSync(join(bin, 'node'), 0o755)
  const schritte = wf.jobs.wache.steps.filter((s) => IDS.includes(s.id))
  assert.deepEqual(schritte.map((s) => s.id), IDS, 'genau die drei Prüfschritte')
  for (const schritt of schritte) {
    for (const exit of ['3', '0']) {
      const env = { ...process.env, NODE_EXIT: exit, PATH: `${bin}${delimiter}${process.env.PATH}` }
      const r = spawnSync('bash', [...shellArgs(schritt), '-c', schritt.run], { cwd: ordner, encoding: 'utf8', env })
      assert.equal(r.status === 0, exit === '0', `${schritt.id}: Prüfer endet mit ${exit}, Schritt mit ${r.status}`)
      assert.match(r.stdout, /^⚠ {2}Befund$/m, `${schritt.id}: die Ausgabe steht im Schrittlog`)
    }
  }
  console.log(`delta-wache-schritte.test: ${schritte.length} Schritte melden einen roten Prüfer als rot.`)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
