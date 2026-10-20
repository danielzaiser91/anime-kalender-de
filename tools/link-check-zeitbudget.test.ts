// Zusicherung: Die Link-Prüfung bleibt in ihrem Zeitbudget (Schritt-Grenze 45 min) und rotiert: ältester Befund zuerst, Rest rückt nach.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { drosselNachVorlauf, GEDROSSELT_JE_LAUF, passtInsBudget, waehleArbeit, ZEITBUDGET_SEKUNDEN } from '../pipeline/lib/link-check-gesundheit.ts'

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
/* Gedrosselter Host: ältere Amazon-Adressen belegen höchstens 2 Plätze, der Rest geht an andere. */
const amStand: Record<string, string> = { a1: '2000-01-01', a2: '2000-01-02', a3: '2000-01-03', n1: '2000-06-01', n2: '2000-06-02' }
const istA = (u: string) => u.startsWith('a')
assert.deepEqual(waehleArbeit(['a1', 'a2', 'a3', 'n1', 'n2'], (u) => amStand[u], new Set(), 4, istA, 2), ['a1', 'a2', 'n1', 'n2'], 'Drossel 2 lässt Platz für n1 und n2')
assert.deepEqual(waehleArbeit(['a1', 'a2', 'a3', 'n1', 'n2'], (u) => amStand[u], new Set(), 4, istA, 1), ['a1', 'n1', 'n2'], 'Drossel 1')
assert.deepEqual(waehleArbeit(['a1', 'a2', 'a3', 'n1', 'n2'], (u) => amStand[u], new Set(), 4), ['a1', 'a2', 'a3', 'n1'], 'ohne Drossel hungern n2')
assert.equal(GEDROSSELT_JE_LAUF, 60, 'Standarddrossel')
assert.equal(drosselNachVorlauf(true), 60, 'Vorlauf gesperrt: Drossel 60')
assert.equal(drosselNachVorlauf(false), Number.POSITIVE_INFINITY, 'Vorlauf frei: keine Drossel')
assert.equal(drosselNachVorlauf(undefined), Number.POSITIVE_INFINITY, 'kein Vorlauf bekannt: keine Drossel')

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
assert.ok(ausgabe.includes('5 Amazon-Adressen wegen der Sperre übersprungen'), `5 von 25 Amazon-Adressen übersprungen (Sperre nach 20):\n${ausgabe}`)
const gesundheit = JSON.parse(readFileSync(join(tmp, 'data', 'source-health.json'), 'utf8')) as Record<string, { lastOk?: string; lastCount: number; gesperrt?: boolean }>
assert.ok(gesundheit['link-check']?.lastOk, 'nach Amazon-Skip steht der Stempel „ok“ (gewollt)')
assert.equal(gesundheit['link-check'].lastCount, 1, 'nur die Netflix-Auskunft zählt, 20 unklare Amazon-Abrufe nicht (#1684)')
assert.equal(gesundheit['link-check'].gesperrt, true, 'Sperre im Lauf: Zustand für den Folgelauf abgelegt')
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

/* Aushungern (PR-Prüfer A1): 70 alte Amazon-Nichtauskünfte vor 10 Netflix-Adressen, Limit 70, zwei Läufe hintereinander. */
const tmp3 = mkdtempSync(join(tmpdir(), 'link-hunger-'))
mkdirSync(join(tmp3, 'public', 'data'), { recursive: true })
mkdirSync(join(tmp3, 'data'))
const amazonUrl = (i: number) => `https://www.amazon.de/gp/video/detail/B${i}`
const netflixUrl = (i: number) => `https://www.netflix.com/title/${i}`
const bestand3: Record<string, { status: unknown; geprueftAm: string }> = {}
for (let i = 0; i < 70; i++) bestand3[amazonUrl(i)] = { status: 'unklar', geprueftAm: '2000-01-01' }
for (let i = 0; i < 10; i++) bestand3[netflixUrl(i)] = { status: 200, geprueftAm: '2000-06-01' }
for (let i = 10; i < 20; i++) bestand3[netflixUrl(i)] = { status: 200, geprueftAm: '2000-07-01' }
writeFileSync(join(tmp3, 'data', 'link-check.json'), JSON.stringify(bestand3))
/* Der Vorlauf hat gesperrt: nur dann gilt die Drossel. */
writeFileSync(join(tmp3, 'data', 'source-health.json'), JSON.stringify({ 'link-check': { lastOk: '2000-01-01T00:00:00.000Z', lastRun: '2000-01-01T00:00:00.000Z', lastCount: 5, gesperrt: true } }))
const stub3 = join(tmp3, 'fetch-stub.mjs')
writeFileSync(stub3, `globalThis.fetch = async (u) => String(u).includes('netflix') ? new Response('', { status: 404 }) : new Response('<html></html>', { status: 200 })\n`)
const lauf3 = (): string => {
  const r = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub3).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--limit', '70', '--zeitbudget', '0', '--sperrpause', '0.01'],
    { cwd: tmp3, env: { ...process.env, AK_ROOT: tmp3 }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
  )
  return `${r.stdout}${r.stderr}`
}
const netflixGeprueft = (): number => {
  const stand = JSON.parse(readFileSync(join(tmp3, 'data', 'link-check.json'), 'utf8')) as Record<string, { status: unknown }>
  return Object.keys(stand).filter((u) => u.includes('netflix') && stand[u].status === 404).length
}
writeFileSync(join(tmp3, 'public', 'data', 'titles.json'), JSON.stringify([...Array(10).keys()].map((i) => ({ streams: [{ platform: 'netflix', url: netflixUrl(i) }] })).concat([...Array(70).keys()].map((i) => ({ streams: [{ platform: 'primevideo', url: amazonUrl(i) }] })))))
lauf3()
assert.equal(netflixGeprueft(), 10, 'Lauf 1: alle 10 Netflix-Adressen kommen dran, obwohl 70 ältere Amazon-Adressen fällig sind')
writeFileSync(join(tmp3, 'public', 'data', 'titles.json'), JSON.stringify([...Array(20).keys()].map((i) => ({ streams: [{ platform: 'netflix', url: netflixUrl(i) }] })).concat([...Array(70).keys()].map((i) => ({ streams: [{ platform: 'primevideo', url: amazonUrl(i) }] })))))
lauf3()
assert.equal(netflixGeprueft(), 20, 'Lauf 2: auch die zweiten 10 Netflix-Adressen kommen dran')
/* Nur noch die 70 Amazon-Adressen sind fällig: der Zustand des Vorlaufs entscheidet über die Drossel. */
const setzeVorlauf = (gesperrt: boolean): void =>
  writeFileSync(join(tmp3, 'data', 'source-health.json'), JSON.stringify({ 'link-check': { lastOk: '2000-01-01T00:00:00.000Z', lastRun: '2000-01-01T00:00:00.000Z', lastCount: 5, gesperrt } }))
setzeVorlauf(true)
assert.ok(lauf3().includes('70 fällig, 60 in diesem Lauf'), 'Vorlauf gesperrt: Amazon auf 60 gedrosselt')
setzeVorlauf(false)
const frei = lauf3()
assert.ok(frei.includes('70 fällig, 70 in diesem Lauf'), `Vorlauf frei: keine Drossel:\n${frei}`)
/* Lauf ohne Sperre (nur Netflix fällig) löscht den Zustand des Vorlaufs. */
writeFileSync(join(tmp3, 'data', 'link-check.json'), JSON.stringify({ ...bestand3, ...Object.fromEntries([...Array(70).keys()].map((i) => [amazonUrl(i), { status: 404, geprueftAm: '2999-12-31' }])) }))
setzeVorlauf(true)
lauf3()
const nachFrei = JSON.parse(readFileSync(join(tmp3, 'data', 'source-health.json'), 'utf8')) as Record<string, { gesperrt?: boolean }>
assert.equal(nachFrei['link-check'].gesperrt, false, 'Lauf ohne Sperre: Zustand zurückgesetzt')
rmSync(tmp3, { recursive: true, force: true })

/* Ein Zwischenstand (recordSource ohne Zustand) lässt den abgelegten Zustand stehen. */
const tmp4 = mkdtempSync(join(tmpdir(), 'link-zustand-'))
mkdirSync(join(tmp4, 'data'))
writeFileSync(join(tmp4, 'data', 'source-health.json'), JSON.stringify({ 'link-check': { lastRun: '2000-01-01T00:00:00.000Z', lastCount: 1, gesperrt: true } }))
const skript = join(tmp4, 'zwischen.mts')
writeFileSync(skript, `import { recordSource } from ${JSON.stringify(pathToFileURL(join(wurzel, 'pipeline/lib/health.ts')).href)}\nrecordSource('link-check', 3)\n`)
const zw = spawnSync(process.execPath, ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, skript], { cwd: tmp4, env: { ...process.env, AK_ROOT: tmp4 }, windowsHide: true, encoding: 'utf8', timeout: 60_000 })
const nachZwischen = JSON.parse(readFileSync(join(tmp4, 'data', 'source-health.json'), 'utf8')) as Record<string, { gesperrt?: boolean; lastCount: number }>
assert.equal(nachZwischen['link-check'].lastCount, 3, `Zwischenstand geschrieben: ${zw.stderr}`)
assert.equal(nachZwischen['link-check'].gesperrt, true, 'Zwischenstand lässt den Zustand des Vorlaufs stehen')
rmSync(tmp4, { recursive: true, force: true })
console.log('link-check-zeitbudget.test: grün (Budget-Grenze, Auswahl mit Rotation, Lauf ohne 60-min-Pause)')
