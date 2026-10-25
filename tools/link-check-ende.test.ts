// Zusicherung: Die Schlusszeile des Link-Checks zählt nur echte Auskunft (`istAuskunft`), jede Nichtauskunft als eigener Datenfall im echten Lauf.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { linkCheckEnde, meldeLinkCheckZwischenstand, zaehleBefund } from '../pipeline/lib/link-check-gesundheit.ts'
import { istAuskunft, istTot } from '../pipeline/lib/link-befund.ts'

/* --- Funktion: nichts fällig, nur Nichtauskünfte, genau eine Auskunft, mehrere --- */
assert.deepEqual(linkCheckEnde(0, 0, false), [0, undefined, undefined, true, false], 'nichts fällig: Normalfall')
assert.deepEqual(linkCheckEnde(5, 0, true), [0, 'nur Nichtauskünfte', undefined, false, true], 'geprüft ohne Auskunft: Misserfolg')
assert.deepEqual(linkCheckEnde(5, 1, true), [1, undefined, undefined, false, true], 'genau eine Auskunft: Erfolg')
assert.deepEqual(linkCheckEnde(7, 3, false), [3, undefined, undefined, false, false], 'gezählt werden Auskünfte, nicht Geprüfte')

/* tot (404/region) und Auskunft sind getrennte Zähler; 404 und region zählen für beide, 403 für keinen. */
const z = { tot: 0, auskuenfte: 0 }
for (const s of [404, 'region', 200, 403, 429, 'timeout', 'fehler', 'unklar']) zaehleBefund(z, s)
assert.deepEqual(z, { tot: 2, auskuenfte: 3 }, '404, region, 200 sind Auskunft; tot nur 404 und region')

/* Die Regel selbst, Werte fest eingetragen: unter 500 außer 403/429 und region; 5xx und Nichtauskünfte nicht. */
const erwartet: [unknown, boolean][] = [
  [200, true], [301, true], [404, true], [410, true], [499, true], [500, false], [503, false], [599, false],
  [403, false], [429, false], ['region', true], ['unklar', false], ['timeout', false], ['fehler', false], [undefined, false],
]
for (const [s, soll] of erwartet) assert.equal(istAuskunft(s), soll, `istAuskunft(${String(s)})`)
const nurFuenfhundert = { tot: 0, auskuenfte: 0 }
for (const s of [500, 503, 503]) zaehleBefund(nurFuenfhundert, s)
assert.deepEqual(nurFuenfhundert, { tot: 0, auskuenfte: 0 }, 'ein Lauf nur mit 5xx hat keine Auskunft')
assert.deepEqual(linkCheckEnde(3, nurFuenfhundert.auskuenfte, false), [0, 'nur Nichtauskünfte', undefined, false, false], 'nur 5xx: Misserfolg')
assert.equal(meldeLinkCheckZwischenstand({ a: { status: 503, geprueftAm: 'h' }, b: { status: 200, geprueftAm: 'h' } }, 'h', () => {}), 1, 'Zwischenstand: 503 zählt nicht')
assert.equal(istTot(404) && istTot('region') && !istTot(410) && !istTot(503) && !istTot(200), true, 'tot nur 404 und region')

/* --- Echter Lauf bis zum Ende, Abruf per Attrappe; Wurzelordner als Argument --- */
const wurzel = resolve(import.meta.dirname, '..')
const wurzelOrdner = process.argv[2] ?? tmpdir()
function lauf(url: string, abruf: string): { lastCount: number; lastOk?: string; lastError?: string } {
  const tmp = mkdtempSync(join(wurzelOrdner, 'link-check-ende-'))
  mkdirSync(join(tmp, 'public', 'data'), { recursive: true })
  mkdirSync(join(tmp, 'data'), { recursive: true })
  writeFileSync(join(tmp, 'public', 'data', 'titles.json'), JSON.stringify([{ streams: [{ platform: 'netflix', url }] }]))
  const stub = join(tmp, 'fetch-stub.mjs')
  writeFileSync(stub, `globalThis.fetch = async () => { ${abruf} }\n`)
  const r = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--sperrpause', '1'],
    { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60000 },
  )
  assert.equal(r.status, 0, `Lauf endet mit 0:\n${r.stdout}${r.stderr}`)
  const alle = JSON.parse(readFileSync(join(tmp, 'data', 'source-health.json'), 'utf8')) as Record<string, { lastCount: number; lastOk?: string; lastError?: string }>
  rmSync(tmp, { recursive: true, force: true })
  return alle['link-check']
}
const NETFLIX = 'https://www.netflix.com/title/1'
const AMAZON = 'https://www.amazon.de/gp/video/detail/B0TEST'
const nichtAuskunft: [string, string, string][] = [
  ['403', NETFLIX, 'return new Response("", { status: 403 })'],
  ['429', NETFLIX, 'return new Response("", { status: 429 })'],
  ['500', NETFLIX, 'return new Response("", { status: 500 })'],
  ['503', NETFLIX, 'return new Response("", { status: 503 })'],
  ['timeout', NETFLIX, 'throw Object.assign(new Error("t"), { name: "TimeoutError" })'],
  ['fehler', NETFLIX, 'throw new Error("netz")'],
  ['unklar', AMAZON, 'return new Response("<html></html>", { status: 200 })'],
]
for (const [name, url, abruf] of nichtAuskunft) {
  const e = lauf(url, abruf)
  assert.equal(e.lastCount, 0, `${name}: zählt nicht als Auskunft`)
  assert.equal(e.lastOk, undefined, `${name}: kein lastOk`)
  assert.equal(e.lastError, 'nur Nichtauskünfte', `${name}: Fehlertext`)
}
for (const [name, abruf] of [['404', 'return new Response("", { status: 404 })'], ['200', 'return new Response("", { status: 200 })']]) {
  const e = lauf(NETFLIX, abruf)
  assert.equal(e.lastCount, 1, `${name}: ist Auskunft`)
  assert.ok(e.lastOk, `${name}: lastOk gesetzt`)
}
console.log('link-check-ende: Nichtauskunft 403, 429, 500, 503, timeout, fehler, unklar -> 0; Auskunft 404, 200 -> 1: ok')
