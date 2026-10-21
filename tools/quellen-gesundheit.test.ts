// Zusicherung: Quellen-Gesundheit (Wächter Frist↔Schreiber, link-check-Zwischenstand, Abbruch in der Amazon-Pause).
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fristNamen, ohneSchreiber, schreiberNamen } from '../pipeline/lib/quellen-schreiber.ts'
import { fortschritt, meldeLinkCheckZwischenstand, pauseMitStand } from '../pipeline/lib/link-check-gesundheit.ts'

/* --- Syntaxbaum-Leser --- */
const fristen = fristNamen(`
  // FRISTEN = { 'kommentar': 1 }
  const ANDERE = { 'nein': 1 }
  const FRISTEN: Record<string, number> = { 'a-b': 9, c: 4, 'd': 21 }
`)
assert.deepEqual(fristen, ['a-b', 'c', 'd'], 'Schlüssel nur aus FRISTEN, in Anführungszeichen oder bloß')
assert.deepEqual(fristNamen('const x = 1'), [], 'ohne FRISTEN leer')

const schreiber = schreiberNamen(`
  // recordSource('im-kommentar', 1)
  const s = "recordSource('im-text', 1)"
  recordSource('a-b', 3)
  recordSource(
    'd',
    0,
    'Fehler',
  )
  health.recordSource('c', 1)
`)
assert.deepEqual(schreiber, ['a-b', 'd'], 'nur echte Aufrufe, auch mehrzeilig; Kommentar, Text und Methode zählen nicht')
assert.deepEqual(schreiberNamen('recordSource(name, 1)'), ['?'], 'Variable als Name ist „?“')
assert.deepEqual(schreiberNamen('recordSource(`x-${n}`, 1)'), ['?'], 'Vorlage mit Platzhalter ist „?“')
assert.deepEqual(schreiberNamen('recordSource(`fest`, 1)'), ['fest'], 'Vorlage ohne Platzhalter ist ein Name')

assert.deepEqual(ohneSchreiber(['a-b', 'c', 'd'], ['a-b', 'd']), ['c'], 'Frist ohne Schreiber wird genannt')
assert.deepEqual(ohneSchreiber(['a'], ['a']), [], 'alle bedient')
assert.deepEqual(ohneSchreiber(['a', 'b'], ['a', '?']), ['b'], 'ein „?“-Schreiber bedient keine Frist')
assert.deepEqual(ohneSchreiber(['a', 'b'], []), ['a', 'b'], 'ohne Schreiber alle')

/* --- Wächter als eigener Prozess gegen eine Kulisse (AK_ROOT) --- */
function waechter(quelle: string): { status: number | null; aus: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'quellen-waechter-'))
  for (const d of ['pipeline', 'tools', 'shared', 'worker/src']) mkdirSync(join(kulisse, d), { recursive: true })
  writeFileSync(join(kulisse, 'pipeline', 'check-sources.ts'), "const FRISTEN: Record<string, number> = { 'a': 9, 'b': 9 }\n")
  writeFileSync(join(kulisse, 'pipeline', 'x.ts'), quelle)
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(resolve(import.meta.dirname, '..', 'node_modules/tsx/dist/esm/index.mjs')).href, resolve(import.meta.dirname, '..', 'pipeline/check-quellen-schreiber.ts')], {
    env: { ...process.env, AK_ROOT: kulisse },
    encoding: 'utf8',
    windowsHide: true,
  })
  rmSync(kulisse, { recursive: true, force: true })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}
const gruen = waechter("recordSource('a', 1)\nrecordSource('b', 1)\n")
assert.equal(gruen.status, 0, `alle bedient: grün\n${gruen.aus}`)
assert.ok(gruen.aus.includes('2 Fristen, 2 Schreiber (0 mit unlesbarem Namen), 0 ohne Schreiber'), 'Ergebniszeile mit Zahlen')
const fehlt = waechter("recordSource('a', 1)\n")
assert.equal(fehlt.status, 1, 'Frist b ohne Schreiber: rot')
assert.ok(fehlt.aus.includes('1 ohne Schreiber: b'), 'nennt die Quelle')
const blind = waechter("recordSource('a', 1)\nrecordSource('b', 1)\nrecordSource(name, 1)\n")
assert.equal(blind.status, 1, 'ein Name als Variable: rot, nicht still grün')
assert.ok(blind.aus.includes('(1 mit unlesbarem Namen)'), 'Zahl der unlesbaren Namen steht in der Zeile')

/* --- Zwischenstand: nur echte Auskünfte von heute zählen --- */
function lauf(bestand: Parameters<typeof meldeLinkCheckZwischenstand>[0]) {
  const aufrufe: unknown[][] = []
  const n = meldeLinkCheckZwischenstand(bestand, '2026-10-19', (...a: unknown[]) => void aufrufe.push(a))
  return { n, aufrufe }
}
const gemischt = lauf({
  'u1': { status: 404, geprueftAm: '2026-10-19' },
  'u2': { status: 'unklar', geprueftAm: '2026-10-19' },
  'u3': { status: 200, geprueftAm: '2026-10-19' },
  'u4': { status: 200, geprueftAm: '2026-10-18' },
  'u5': { status: 'region' },
})
assert.equal(gemischt.n, 2, 'zählt nur heutige Nicht-unklar-Befunde')
assert.deepEqual(gemischt.aufrufe[0], ['link-check', 2, undefined, undefined, false], 'Zahl ohne Fehler, leerIstOk aus')
const eins = lauf({ u1: { status: 200, geprueftAm: '2026-10-19' } })
assert.equal(eins.n, 1, 'genau eine Auskunft zählt')
assert.equal(eins.aufrufe[0][2], undefined, 'eine Auskunft ist Erfolg')
const nurUnklar = lauf({ u1: { status: 'unklar', geprueftAm: '2026-10-19' } })
assert.deepEqual(nurUnklar.aufrufe[0], ['link-check', 0, 'bisher nur Nichtauskünfte', undefined, false], 'nur Nichtauskünfte: Fehlertext, kein Erfolg')
const nurTimeout = lauf({ u1: { status: 'timeout', geprueftAm: '2026-10-19' }, u2: { status: 'fehler', geprueftAm: '2026-10-19' }, u3: { status: 'unklar', geprueftAm: '2026-10-19' } })
assert.equal(nurTimeout.n, 0, 'timeout, fehler und unklar sind keine Auskunft')
assert.deepEqual(nurTimeout.aufrufe[0], ['link-check', 0, 'bisher nur Nichtauskünfte', undefined, false], 'ohne Auskunft Fehlertext')
const abwehr = lauf({ u1: { status: 403, geprueftAm: '2026-10-19' }, u2: { status: 429, geprueftAm: '2026-10-19' }, u3: { status: 404, geprueftAm: '2026-10-19' }, u4: { status: 'region', geprueftAm: '2026-10-19' } })
assert.equal(abwehr.n, 2, '403/429 sind Abwehr; 404 und region sind Auskunft')

/* Fortschritt und Pause mit festem Tag (letztes Argument). */
const TAG = '2026-10-19'
const heuteBefund = { status: 200, geprueftAm: TAG }
const zeilen: string[] = []
const gemeldet: unknown[][] = []
const spion = (...a: unknown[]) => void gemeldet.push(a)
let gesichert = 0
const sichere = () => void gesichert++
fortschritt(99, 300, 4, { u: heuteBefund }, (s) => zeilen.push(s), sichere, spion, TAG)
fortschritt(101, 300, 4, { u: heuteBefund }, (s) => zeilen.push(s), sichere, spion, TAG)
assert.equal(zeilen.length + gemeldet.length + gesichert, 0, 'bei 99 und 101 weder Zeile noch Meldung noch Sicherung')
fortschritt(100, 300, 4, { u: heuteBefund }, (s) => zeilen.push(s), sichere, spion, TAG)
assert.equal(gesichert, 1, 'bei 100 werden die Befunde gesichert')
assert.deepEqual(zeilen, ['  100/300 — 4 unbrauchbar'], 'bei 100 die Fortschrittszeile mit den übergebenen Zahlen')
assert.deepEqual(gemeldet[0], ['link-check', 1, undefined, undefined, false], 'bei 100 der Zwischenstand')
const reihenfolge: string[] = []
await pauseMitStand(7, { u: heuteBefund }, async (ms) => void reihenfolge.push(`warte ${ms}`), () => void reihenfolge.push('sichere'), (...a: unknown[]) => void reihenfolge.push(`melde ${a[1]}`), TAG)
assert.deepEqual(reihenfolge, ['sichere', 'melde 1', 'warte 7'], 'erst sichern und melden, dann warten')

/* --- Abbruch in der Amazon-Pause: der echte Lauf wird getötet, die Gesundheit muss stehen --- */
const wurzel = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'quellen-gesundheit-'))
mkdirSync(join(tmp, 'public', 'data'), { recursive: true })
const titel = [{ streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1' }, { platform: 'netflix', url: 'https://www.netflix.com/title/2' }] }]
for (let i = 0; i < 25; i++) titel.push({ streams: [{ platform: 'primevideo', url: `https://www.amazon.de/gp/video/detail/B${i}` }] })
writeFileSync(join(tmp, 'public', 'data', 'titles.json'), JSON.stringify(titel))
/* Ein alter, in diesem Lauf nicht neu geprüfter Befund darf im Zwischenstand nicht fehlen. */
mkdirSync(join(tmp, 'data'), { recursive: true })
const ALT = 'https://www.disneyplus.com/alt'
writeFileSync(join(tmp, 'data', 'link-check.json'), JSON.stringify({ [ALT]: { status: 404, geprueftAm: '2999-12-31' } }))
/* Netflix antwortet 404 (echte Auskunft), Amazon liefert 200 ohne Produktseite (unklar → Sperre nach 20). */
const stub = join(tmp, 'fetch-stub.mjs')
writeFileSync(stub, `globalThis.fetch = async (u) => String(u).includes('netflix') ? new Response('', { status: 404 }) : new Response('<html></html>', { status: 200 })\n`)
const child = spawn(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--sperrpause', '3600', '--zeitbudget', '0'],
  { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
)
let ausgabe = ''
child.stdout.on('data', (d) => (ausgabe += d))
child.stderr.on('data', (d) => (ausgabe += d))
const beendet = new Promise<void>((res) => child.on('exit', () => res()))
for (let i = 0; i < 600 && !ausgabe.includes('min Pause') && child.exitCode === null; i++) await new Promise((r) => setTimeout(r, 100))
const inDerPause = ausgabe.includes('min Pause')
child.kill()
await beendet
assert.ok(inDerPause, `Lauf kam nicht in die Pause:\n${ausgabe}`)
const gesundheit = join(tmp, 'data', 'source-health.json')
assert.ok(existsSync(gesundheit), 'nach Abbruch in der Pause steht eine Gesundheit')
const eintrag = (JSON.parse(readFileSync(gesundheit, 'utf8')) as Record<string, { lastOk?: string; lastCount: number }>)['link-check']
assert.ok(eintrag, 'link-check ist eingetragen')
assert.equal(eintrag.lastCount, 2, 'gezählt werden die zwei Netflix-Auskünfte, nicht die 20 Nichtauskünfte')
assert.ok(eintrag.lastOk, 'mit echten Auskünften ist lastOk gesetzt')
const zwischen = JSON.parse(readFileSync(join(tmp, 'data', 'link-check.json'), 'utf8')) as Record<string, { status: unknown; geprueftAm?: string }>
const adressen = Object.keys(zwischen).sort()
const erwartet = [ALT, 'https://www.netflix.com/title/1', 'https://www.netflix.com/title/2', ...Array.from({ length: 20 }, (_, i) => `https://www.amazon.de/gp/video/detail/B${i}`)].sort()
assert.deepEqual(adressen, erwartet, 'nach Abbruch stehen die 22 Befunde vor der Pause plus der alte Befund')
assert.equal(zwischen[ALT].geprueftAm, '2999-12-31', 'alter Befund unverändert')
assert.equal(zwischen['https://www.netflix.com/title/1'].status, 404, 'Netflix-Befund steht')
assert.equal(zwischen['https://www.amazon.de/gp/video/detail/B0'].status, 'unklar', 'Amazon-Nichtauskunft steht')
rmSync(tmp, { recursive: true, force: true })

/* --- 100er-Takt im echten Lauf: 150 Adressen, ab der 101. hängt die Attrappe; nach Adresse 100 muss der Stand stehen --- */
const tmp2 = mkdtempSync(join(tmpdir(), 'quellen-gesundheit-'))
mkdirSync(join(tmp2, 'public', 'data'), { recursive: true })
mkdirSync(join(tmp2, 'data'))
const viele = Array.from({ length: 150 }, (_, i) => ({ streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/${i}` }] }))
writeFileSync(join(tmp2, 'public', 'data', 'titles.json'), JSON.stringify(viele))
const stub2 = join(tmp2, 'fetch-stub.mjs')
/* Bei Abruf 50 schreibt die Attrappe wie ein zweiter Lauf: neuerer Eintrag für die 1. Adresse, älterer für die 2., dazu ein fremder. */
const zweiterLauf = [
  'if (gesehen.size === 50) {',
  '  const a = [...gesehen]',
  "  fs.writeFileSync('data/link-check.json', JSON.stringify({ [a[0]]: { status: 404, geprueftAm: '2999-12-31' }, [a[1]]: { status: 404, geprueftAm: '2000-01-01' }, 'https://fremd.example/x': { status: 404, geprueftAm: '2999-12-31' } }))",
  "  fs.writeFileSync('seen.json', JSON.stringify(a.slice(0, 3)))",
  '}',
].join('\n')
writeFileSync(stub2, `import fs from 'node:fs'\nconst gesehen = new Set()\nglobalThis.fetch = async (u) => {\n  gesehen.add(String(u))\n  ${zweiterLauf}\n  if (gesehen.size > 100) return new Promise(() => {})\n  return new Response('', { status: 200 })\n}\n`)
const child2 = spawn(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub2).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1'],
  { cwd: tmp2, env: { ...process.env, AK_ROOT: tmp2 }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
)
let ausgabe2 = ''
child2.stdout.on('data', (d) => (ausgabe2 += d))
child2.stderr.on('data', (d) => (ausgabe2 += d))
const beendet2 = new Promise<void>((res) => child2.on('exit', () => res()))
const gesundheit2 = join(tmp2, 'data', 'source-health.json')
for (let i = 0; i < 600 && !existsSync(gesundheit2) && child2.exitCode === null; i++) await new Promise((r) => setTimeout(r, 100))
child2.kill()
await beendet2
assert.ok(existsSync(gesundheit2), `nach Adresse 100 steht eine Gesundheit:\n${ausgabe2}`)
const eintrag2 = (JSON.parse(readFileSync(gesundheit2, 'utf8')) as Record<string, { lastCount: number }>)['link-check']
assert.equal(eintrag2.lastCount, 99, 'Zwischenstand: 100 Auskünfte, eine durch den neueren Datei-Eintrag (Datum 2999) ersetzt')
const befunde2 = JSON.parse(readFileSync(join(tmp2, 'data', 'link-check.json'), 'utf8')) as Record<string, unknown>
assert.equal(Object.keys(befunde2).length, 101, 'nach Adresse 100 stehen 100 eigene Befunde plus der fremde')
/* A1: Zusammenführung in schreibeBestand — neuere Datei-Einträge bleiben, eigene neuere bleiben, Fremdes bleibt. */
const [neuerInDatei, aelterInDatei, nurEigen] = JSON.parse(readFileSync(join(tmp2, 'seen.json'), 'utf8')) as string[]
const b2 = befunde2 as Record<string, { status: unknown; geprueftAm?: string }>
assert.deepEqual(b2[neuerInDatei], { status: 404, geprueftAm: '2999-12-31' }, 'neuerer Eintrag aus der Datei bleibt')
assert.equal(b2[aelterInDatei].status, 200, 'älterer Datei-Eintrag überschreibt den eigenen nicht')
assert.notEqual(b2[aelterInDatei].geprueftAm, '2000-01-01', 'eigener Eintrag behält sein Datum')
assert.equal(b2[nurEigen].status, 200, 'eigener Eintrag ohne Datei-Gegenstück bleibt')
assert.equal(b2['https://fremd.example/x'].status, 404, 'fremder Eintrag aus der Datei bleibt')
rmSync(tmp2, { recursive: true, force: true })
/* --- A2: Lauf ohne Abbruch (< 100 Adressen, keine Sperre): die Schlussschreibung legt alle Befunde samt Altbefund ab --- */
const tmp3 = mkdtempSync(join(tmpdir(), 'quellen-gesundheit-'))
mkdirSync(join(tmp3, 'public', 'data'), { recursive: true })
mkdirSync(join(tmp3, 'data'))
const dreissig = Array.from({ length: 30 }, (_, i) => ({ streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/${i}` }] }))
writeFileSync(join(tmp3, 'public', 'data', 'titles.json'), JSON.stringify(dreissig))
writeFileSync(join(tmp3, 'data', 'link-check.json'), JSON.stringify({ 'https://www.disneyplus.com/alt': { status: 404, geprueftAm: '2999-12-31' } }))
const stub3 = join(tmp3, 'fetch-stub.mjs')
writeFileSync(stub3, "globalThis.fetch = async () => new Response('', { status: 200 })\n")
const voll = spawnSync(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub3).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1'],
  { cwd: tmp3, env: { ...process.env, AK_ROOT: tmp3 }, windowsHide: true, encoding: 'utf8' },
)
assert.equal(voll.status, 0, `Lauf ohne Abbruch endet mit 0:\n${voll.stdout}${voll.stderr}`)
const befunde3 = JSON.parse(readFileSync(join(tmp3, 'data', 'link-check.json'), 'utf8')) as Record<string, { status: unknown }>
assert.equal(Object.keys(befunde3).length, 31, 'nach dem Lauf: 30 Befunde plus Altbefund')
assert.equal(befunde3['https://www.netflix.com/title/29'].status, 200, 'letzter Befund steht')
assert.equal(befunde3['https://www.disneyplus.com/alt'].status, 404, 'Altbefund steht')
rmSync(tmp3, { recursive: true, force: true })
console.log('quellen-gesundheit.test: grün (Leser, Zwischenstand, Abbruch in der Pause)')
