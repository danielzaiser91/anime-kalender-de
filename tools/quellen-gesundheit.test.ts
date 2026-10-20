// Zusicherung: Quellen-Gesundheit (Wächter Frist↔Schreiber, link-check-Zwischenstand, Abbruch in der Amazon-Pause).
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
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
assert.deepEqual(ohneSchreiber(['a', 'b'], ['a', '?']), [], 'ein „?“-Schreiber: im Zweifel nicht rot')
assert.deepEqual(ohneSchreiber(['a', 'b'], []), ['a', 'b'], 'ohne Schreiber alle')

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

/* Fortschritt und Pause mit festem Tag (letztes Argument). */
const TAG = '2026-10-19'
const heuteBefund = { status: 200, geprueftAm: TAG }
const zeilen: string[] = []
const gemeldet: unknown[][] = []
const spion = (...a: unknown[]) => void gemeldet.push(a)
fortschritt(99, 300, 4, { u: heuteBefund }, (s) => zeilen.push(s), spion, TAG)
fortschritt(101, 300, 4, { u: heuteBefund }, (s) => zeilen.push(s), spion, TAG)
assert.equal(zeilen.length + gemeldet.length, 0, 'bei 99 und 101 weder Zeile noch Meldung')
fortschritt(100, 300, 4, { u: heuteBefund }, (s) => zeilen.push(s), spion, TAG)
assert.deepEqual(zeilen, ['  100/300 — 4 unbrauchbar'], 'bei 100 die Fortschrittszeile mit den übergebenen Zahlen')
assert.deepEqual(gemeldet[0], ['link-check', 1, undefined, undefined, false], 'bei 100 der Zwischenstand')
const reihenfolge: string[] = []
await pauseMitStand(7, { u: heuteBefund }, async (ms) => void reihenfolge.push(`warte ${ms}`), (...a: unknown[]) => void reihenfolge.push(`melde ${a[1]}`), TAG)
assert.deepEqual(reihenfolge, ['melde 1', 'warte 7'], 'erst melden, dann warten')

/* --- Abbruch in der Amazon-Pause: der echte Lauf wird getötet, die Gesundheit muss stehen --- */
const wurzel = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'quellen-gesundheit-'))
mkdirSync(join(tmp, 'public', 'data'), { recursive: true })
const titel = [{ streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1' }, { platform: 'netflix', url: 'https://www.netflix.com/title/2' }] }]
for (let i = 0; i < 25; i++) titel.push({ streams: [{ platform: 'primevideo', url: `https://www.amazon.de/gp/video/detail/B${i}` }] })
writeFileSync(join(tmp, 'public', 'data', 'titles.json'), JSON.stringify(titel))
/* Netflix antwortet 404 (echte Auskunft), Amazon liefert 200 ohne Produktseite (unklar → Sperre nach 20). */
const stub = join(tmp, 'fetch-stub.mjs')
writeFileSync(stub, `globalThis.fetch = async (u) => String(u).includes('netflix') ? new Response('', { status: 404 }) : new Response('<html></html>', { status: 200 })\n`)
const child = spawn(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--sperrpause', '3600'],
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
rmSync(tmp, { recursive: true, force: true })
console.log('quellen-gesundheit.test: grün (Leser, Zwischenstand, Abbruch in der Pause)')
