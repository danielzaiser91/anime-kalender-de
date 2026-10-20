// Zusicherung: Die Link-Prüfung bleibt in ihrem Zeitbudget (Schritt-Grenze 45 min) und rotiert: ältester Befund zuerst, Rest rückt nach.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { passtInsBudget, waehleArbeit, ZEITBUDGET_SEKUNDEN } from '../pipeline/lib/link-check-gesundheit.ts'

/* Erwartete Werte fest eingetragen: 45 min Grenze, 25 % Puffer = 33,75 min. */
assert.equal(ZEITBUDGET_SEKUNDEN, 2025, 'Budget = 75 % von 45 min')

/* --- passtInsBudget: genau an der Grenze, eins drüber, deutlich drüber, ohne Budget --- */
assert.equal(passtInsBudget(1000, 1000 + 100_000, 100, 0), true, 'genau an der Grenze passt')
assert.equal(passtInsBudget(1000, 1000 + 100_001, 100, 0), false, 'eine ms drüber passt nicht')
assert.equal(passtInsBudget(0, 10_000, 100, 91_000), false, 'Wartezeit zählt mit')
assert.equal(passtInsBudget(0, 10_000, 100, 90_000), true, 'Wartezeit genau an der Grenze')
assert.equal(passtInsBudget(0, 9_999_999_999, 0, 3_600_000), true, 'Budget 0 = ohne Grenze')
assert.equal(passtInsBudget(0, 0, 2025, 3_600_000), false, 'die 60-min-Sperrpause passt nie ins Standardbudget')

/* --- waehleArbeit: Grenze und Rotation --- */
const stand: Record<string, string | undefined> = { a: '2026-09-10', b: undefined, c: '2026-08-01', d: '2026-09-01', e: '2026-07-01' }
const alter = (u: string) => stand[u]
const offen = ['a', 'b', 'c', 'd', 'e']
assert.deepEqual(waehleArbeit(offen, alter, new Set(), 3), ['b', 'e', 'c'], 'Nie-Geprüftes, dann ältester Befund zuerst; Limit 3 hält ein')
assert.deepEqual(waehleArbeit(offen, alter, new Set(), 1), ['b'], 'Limit genau 1')
assert.deepEqual(waehleArbeit(offen, alter, new Set(), 0), ['b', 'e', 'c', 'd', 'a'], 'Limit 0 = alle')
assert.deepEqual(waehleArbeit(offen, alter, new Set(['a']), 2), ['a', 'b'], 'Vorrang schlägt das Alter')
/* Rotation: die Geprüften verlassen die Fälligen, der Rest ist im nächsten Lauf vorn. */
const lauf1 = waehleArbeit(offen, alter, new Set(), 2)
const rest = offen.filter((u) => !lauf1.includes(u))
assert.deepEqual(waehleArbeit(rest, alter, new Set(), 2), ['c', 'd'], 'zweiter Lauf nimmt die nächsten, nichts bleibt hinten')
assert.deepEqual(offen, ['a', 'b', 'c', 'd', 'e'], 'Eingabe bleibt unverändert')

/* --- Prozess: Amazon sperrt; ohne Budget für die 60-min-Pause geht der Lauf weiter ohne Amazon und endet --- */
const wurzel = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'link-zeitbudget-'))
mkdirSync(join(tmp, 'public', 'data'), { recursive: true })
mkdirSync(join(tmp, 'data'))
const titel = [{ streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1' }] }]
for (let i = 0; i < 25; i++) titel.push({ streams: [{ platform: 'primevideo', url: `https://www.amazon.de/gp/video/detail/B${i}` }] })
writeFileSync(join(tmp, 'public', 'data', 'titles.json'), JSON.stringify(titel))
const stub = join(tmp, 'fetch-stub.mjs')
writeFileSync(stub, `globalThis.fetch = async (u) => String(u).includes('netflix') ? new Response('', { status: 404 }) : new Response('<html></html>', { status: 200 })\n`)
const lauf = spawnSync(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1'],
  { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
)
const ausgabe = `${lauf.stdout}${lauf.stderr}`
assert.equal(lauf.status, 0, `Lauf endet (kein Warten in der 60-min-Pause):\n${ausgabe}`)
assert.ok(!ausgabe.includes('min Pause'), `keine Pause, die das Budget sprengt:\n${ausgabe}`)
assert.ok(ausgabe.includes('weiter ohne Amazon'), `Amazon wird übersprungen:\n${ausgabe}`)
/* Budget aufgebraucht (1 ms): es beginnt nichts Neues, alles bleibt fällig. */
const knapp = spawnSync(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--zeitbudget', '0.001'],
  { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
)
assert.ok(`${knapp.stdout}${knapp.stderr}`.includes('Verweise: 0 geprüft'), `Budget leer: nichts geprüft:\n${knapp.stdout}${knapp.stderr}`)
rmSync(tmp, { recursive: true, force: true })

/* Verdrahtung der Auswahl im echten Lauf: Limit 2 von 3 Fälligen nimmt das Nie-Geprüfte und den ältesten, nicht die ersten zwei. */
const tmp2 = mkdtempSync(join(tmpdir(), 'link-rotation-'))
mkdirSync(join(tmp2, 'public', 'data'), { recursive: true })
mkdirSync(join(tmp2, 'data'))
const drei = [1, 2, 3].map((n) => ({ streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/${n}` }] }))
writeFileSync(join(tmp2, 'public', 'data', 'titles.json'), JSON.stringify(drei))
const eins = 'https://www.netflix.com/title/1'
const zwei = 'https://www.netflix.com/title/2'
const dreiUrl = 'https://www.netflix.com/title/3'
writeFileSync(join(tmp2, 'data', 'link-check.json'), JSON.stringify({ [eins]: { status: 200, geprueftAm: '2000-06-01' }, [zwei]: { status: 200, geprueftAm: '2000-01-01' } }))
const stub2 = join(tmp2, 'fetch-stub.mjs')
writeFileSync(stub2, `globalThis.fetch = async () => new Response('', { status: 404 })\n`)
spawnSync(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub2).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--limit', '2', '--zeitbudget', '0'],
  { cwd: tmp2, env: { ...process.env, AK_ROOT: tmp2 }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
)
const nach = JSON.parse(readFileSync(join(tmp2, 'data', 'link-check.json'), 'utf8')) as Record<string, { status: unknown; geprueftAm: string }>
assert.equal(nach[dreiUrl]?.status, 404, 'Nie-Geprüftes kommt dran')
assert.equal(nach[zwei].status, 404, 'ältester Befund kommt dran')
assert.equal(nach[eins].geprueftAm, '2000-06-01', 'der jüngere Befund bleibt für den nächsten Lauf')
rmSync(tmp2, { recursive: true, force: true })
console.log('link-check-zeitbudget.test: grün (Budget-Grenze, Auswahl mit Rotation, Lauf ohne 60-min-Pause)')
