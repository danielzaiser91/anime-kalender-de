/**
 * `check:logic` in zwei Teilen (18.11.2026, `--teil k/n` in tools/check-logic-alle.mjs): Jede Prüfung der Liste läuft in genau einem Teil.
 * 1. Lauf von `check-logic-alle.mjs` über eine Wegwerf-Liste (jede Prüfung legt eine Marke ab): Teil 1 und Teil 2 zusammen = alle, nie doppelt, beide nicht leer.
 * 2. Verdrahtung: package.json (`check:logic-1` = Teil 1/2, `check:logic-2` = Teil 2/2, beide in `check:vor-commit`) und die Jobs der PR-Kette führen genau diese Skripte aus.
 * Aufruf: node tools/check-logic-teil.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'

const WURZEL = resolve(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'logic-teil-'))
const posix = (p) => p.replace(/\\/g, '/')
const NAMEN = Array.from({ length: 7 }, (_, i) => `p${i}`)

/** Wegwerf-Liste: jede Prüfung legt eine Datei `<Marken-Ordner>/<name>` ab. */
function schreibeListe(marken) {
  const pfade = NAMEN.map((n) => posix(join(ordner, `${n}.mjs`)))
  NAMEN.forEach((n, i) => writeFileSync(pfade[i], `import { writeFileSync } from 'node:fs'\nwriteFileSync('${posix(join(marken, n))}', 'ja')\n`))
  const liste = join(ordner, 'liste.txt')
  writeFileSync(liste, `${pfade.join('\n')}\n`)
  return liste
}

/** Läuft Teil k/2 über die Liste und gibt zurück, welche Prüfungen gelaufen sind (Exit 0 verlangt). */
function lauf(liste, marken, teil, teilVorn = false) {
  rmSync(marken, { recursive: true, force: true })
  mkdirSync(marken, { recursive: true })
  const option = teil ? ['--teil', teil] : []
  const args = [join(WURZEL, 'tools/check-logic-alle.mjs'), ...(teilVorn ? option : []), liste, 'wegwerf', ...(teilVorn ? [] : option)]
  const r = spawnSync(process.execPath, args, { cwd: WURZEL, encoding: 'utf8', timeout: 120000 })
  assert.equal(r.status, 0, `Teil ${teil ?? 'alle'} endet mit Exit 0: ${r.stdout}\n${r.stderr}`)
  return readdirSync(marken).sort()
}

try {
  const marken = join(ordner, 'marken')
  const liste = schreibeListe(marken)
  const alle = lauf(liste, marken, undefined)
  assert.deepEqual(alle, NAMEN, 'ohne --teil laufen alle sieben Prüfungen')
  const eins = lauf(liste, marken, '1/2')
  const zwei = lauf(liste, marken, '2/2')
  assert.ok(eins.length > 0 && zwei.length > 0, `beide Teile haben Prüfungen (${eins.length}/${zwei.length})`)
  assert.deepEqual([...eins, ...zwei].sort(), NAMEN, 'Teil 1 und Teil 2 zusammen sind genau alle Prüfungen, keine doppelt, keine fehlt')
  assert.deepEqual([eins.length, zwei.length].sort(), [3, 4], 'Teile gleich groß (7 = 4 + 3)')
  assert.deepEqual(lauf(liste, marken, '1/2', true), eins, '`--teil 1/2` vor Liste und Name: dieselbe Auswahl (der Wert von --teil ist kein Listenpfad)')
  assert.deepEqual(lauf(liste, marken, '2/2', true), zwei, '`--teil 2/2` vor Liste und Name: dieselbe Auswahl')

  const paket = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')).scripts
  assert.equal(paket['check:logic-1'], 'node tools/check-logic-alle.mjs --teil 1/2', 'check:logic-1 fährt Teil 1/2')
  assert.equal(paket['check:logic-2'], 'node tools/check-logic-alle.mjs --teil 2/2', 'check:logic-2 fährt Teil 2/2')
  const vorCommit = paket['check:vor-commit'].split(' && ')
  assert.equal(vorCommit.filter((s) => s === 'npm run check:logic-1').length, 1, 'check:vor-commit enthält check:logic-1 genau einmal')
  assert.equal(vorCommit.filter((s) => s === 'npm run check:logic-2').length, 1, 'check:vor-commit enthält check:logic-2 genau einmal')

  const jobs = parse(readFileSync(join(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8')).jobs
  const laeufe = (id) => jobs[id].steps.map((s) => s.run).filter((r) => String(r).startsWith('npm run check:logic'))
  assert.deepEqual(laeufe('logik'), ['npm run check:logic-1'], 'Job logik fährt Teil 1')
  assert.deepEqual(laeufe('logik2'), ['npm run check:logic-2'], 'Job logik2 fährt Teil 2')
  assert.ok(jobs.kette.needs.includes('logik') && jobs.kette.needs.includes('logik2'), 'Sammeljob wartet auf beide Logik-Jobs')
  console.log('check-logic-teil: 7 Prüfungen = 4 + 3, jede in genau einem Teil; Skripte, vor-commit und Jobs verdrahtet.')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
