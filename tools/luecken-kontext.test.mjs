/**
 * Verdrahtung von `ladeKontext` (`pipeline/lib/luecken-kontext.ts`): `staffel0` muss aus `data/tmdb-staffel0.json` kommen.
 * Läuft gegen eine Attrappe unter dem Temp-Ordner (`AK_WURZEL`, cwd), nicht gegen den gebauten Bestand, damit der Test in
 * `tests-alle` (vor-commit, PR-Prüfkette, Deploy) unter der Bestandssperre laufen kann. Aufruf: `node tools/luecken-kontext.test.mjs`
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const KONTEXT = pathToFileURL(join(import.meta.dirname, '..', 'pipeline', 'lib', 'luecken-kontext.ts')).href
const attrappe = mkdtempSync(join(tmpdir(), 'luecken-kontext-'))
try {
  mkdirSync(join(attrappe, 'data'))
  mkdirSync(join(attrappe, 'public', 'data', 'synopses'), { recursive: true })
  writeFileSync(join(attrappe, 'data', 'tmdb-staffel0.json'), JSON.stringify({ 7: { tmdbId: 5 }, 9: { tmdbId: 6 } }))
  const skript = `import(${JSON.stringify(KONTEXT)}).then((m) => console.log(JSON.stringify(Object.keys(m.ladeKontext('2026-10-14').staffel0))))`
  const r = spawnSync(process.execPath, ['-e', skript], { cwd: attrappe, encoding: 'utf8', env: { ...process.env, AK_WURZEL: attrappe } })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout.trim(), '["7","9"]', 'ladeKontext reicht data/tmdb-staffel0.json als staffel0 durch')
  console.log('luecken-kontext.test: ok')
} finally {
  rmSync(attrappe, { recursive: true, force: true })
}
