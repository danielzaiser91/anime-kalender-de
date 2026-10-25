// Zusicherung: Eine Adresse mit 5xx (oder unklar) ist beim nächsten Link-Lauf wieder fällig, 404/200/403/Netzfehler erst nach 30 Tagen.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { istFaellig } from '../pipeline/lib/link-befund.ts'

/* --- Regel, Werte fest: Stichtag 2026-10-01, Befund vom 2026-10-20 (frisch) bzw. 2026-08-01 (alt) --- */
const GRENZE = '2026-10-01'
const FRISCH = '2026-10-20'
const ALT = '2026-08-01'
const tabelle: [string, unknown, boolean][] = [
  ['500', 500, true], ['503', 503, true], ['599', 599, true], ['499', 499, false],
  ['404', 404, false], ['200', 200, false], ['403', 403, false], ['429', 429, false],
  ['region', 'region', false], ['timeout', 'timeout', false], ['fehler', 'fehler', false], ['unklar', 'unklar', true],
]
for (const [name, status, soll] of tabelle) {
  assert.equal(istFaellig({ status: status as number, geprueftAm: FRISCH }, GRENZE), soll, `frisch ${name}`)
  assert.equal(istFaellig({ status: status as number, geprueftAm: ALT }, GRENZE), true, `alt ${name}: nach der Frist immer fällig`)
}
assert.equal(istFaellig(undefined, GRENZE), true, 'nie geprüft')
assert.equal(istFaellig({ status: 200, geprueftAm: GRENZE }, GRENZE), false, 'Datum genau an der Grenze: noch nicht fällig')
assert.equal(istFaellig({ status: 200, geprueftAm: '2026-09-30' }, GRENZE), true, 'einen Tag vor der Grenze: fällig')

/* --- Echter Lauf (Kreislauf): Bestand mit frischem Befund, danach läuft check-links; fällig heißt: Abruf gemacht --- */
const wurzel = resolve(import.meta.dirname, '..')
const wurzelOrdner = process.argv[2] ?? tmpdir()
const URL1 = 'https://www.netflix.com/title/1'
function geprueft(status: number | string, datum = '2999-12-31'): number {
  const tmp = mkdtempSync(join(wurzelOrdner, 'link-faelligkeit-'))
  mkdirSync(join(tmp, 'public', 'data'), { recursive: true })
  mkdirSync(join(tmp, 'data'), { recursive: true })
  writeFileSync(join(tmp, 'public', 'data', 'titles.json'), JSON.stringify([{ streams: [{ platform: 'netflix', url: URL1 }] }]))
  writeFileSync(join(tmp, 'data', 'link-check.json'), JSON.stringify({ [URL1]: { status, geprueftAm: datum } }))
  const stub = join(tmp, 'fetch-stub.mjs')
  writeFileSync(stub, 'globalThis.fetch = async () => new Response("", { status: 200 })')
  const r = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--sperrpause', '1'],
    { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60000 },
  )
  assert.equal(r.status, 0, `Lauf endet mit 0:\n${r.stdout}${r.stderr}`)
  rmSync(tmp, { recursive: true, force: true })
  return Number(/Verweise: 1 bekannt, ([0-9]+) fällig/.exec(r.stdout)?.[1])
}
for (const [status, soll] of [[503, 1], [500, 1], ['unklar', 1], [404, 0], [200, 0], [403, 0], ['timeout', 0], ['fehler', 0]] as [number | string, number][]) {
  assert.equal(geprueft(status), soll, `Lauf: frischer Befund ${status} -> neu abgerufen ${soll}`)
}
assert.equal(geprueft(200, '2000-01-01'), 1, 'Lauf: alter 200er ist nach 30 Tagen wieder fällig')
assert.equal(geprueft(404, '2000-01-01'), 1, 'Lauf: alter 404 ist nach 30 Tagen wieder fällig')
console.log('link-faelligkeit: 5xx und unklar sofort fällig, 404/200/403/timeout/fehler erst nach der Frist (Tabelle + Lauf): ok')
