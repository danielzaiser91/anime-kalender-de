/**
 * Prozess-Test für tools/untersucher-vorab.mjs, soweit `untersucher-frist.test.mjs` es nicht deckt: Protokoll ohne
 * erkennbare Ursache, neues Issue anlegen (auch mit langer Ursache und fremdem Marker), `--trocken`, fehlendes
 * GITHUB_OUTPUT und ein scheiternder gh-Aufruf. gh ersetzt `untersucher-gh-attrappe.mjs` (GH_BIN), kein Netz.
 * Fehler hieße: roter Bestand ohne Untersucher oder zweimal dasselbe Issue.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { markerFuer, schluesselAusProtokoll } from './untersucher-logik.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const ordner = mkdtempSync(join(tmpdir(), 'untersucher-vorab-'))
const echtesProtokoll = join(tools, 'testdaten/untersucher/38233819404.log')
const echt = schluesselAusProtokoll(readFileSync(echtesProtokoll, 'utf8'))
const ohneUrsache = join(ordner, 'ohne.log')
writeFileSync(ohneUrsache, 'bauen\tUNKNOWN STEP\t2026-10-12T10:00:00.0000000Z alles ruhig\n')
const langesProtokoll = join(ordner, 'lang.log')
const LANG = `FEHLER: ${'x'.repeat(200)}`
writeFileSync(langesProtokoll, `${LANG}\n`)

let nr = 0
function vorab({ protokollDatei, issues = [], args = [], mitOutput = true, lauf = '777', antwortLauf = '777' }) {
  nr++
  const antworten = join(ordner, `antworten-${nr}.json`)
  const log = join(ordner, `gh-${nr}.txt`)
  const out = join(ordner, `out-${nr}.txt`)
  writeFileSync(log, '')
  writeFileSync(out, '')
  writeFileSync(antworten, JSON.stringify({ lauf: antwortLauf, protokollDatei, issueNr: 500, neuesIssue: 4711, issues, issueAnsicht: { body: '', comments: [] }, prs: [] }))
  const env = { ...process.env, GH_BIN: `${process.execPath}|${join(tools, 'untersucher-gh-attrappe.mjs')}`, ATTRAPPE_ANTWORTEN: antworten, ATTRAPPE_PROTOKOLL: log, GITHUB_REPOSITORY: 'danielzaiser91/anime-kalender-de' }
  if (mitOutput) env.GITHUB_OUTPUT = out
  else delete env.GITHUB_OUTPUT
  const r = spawnSync(process.execPath, [join(tools, 'untersucher-vorab.mjs'), lauf, ...args], { encoding: 'utf8', env, timeout: 30000 })
  assert.ok(r.status !== null, `Prozess lief nicht bis zum Ende: ${r.error ?? r.stderr}`)
  const ausgabe = Object.fromEntries(readFileSync(out, 'utf8').split('\n').filter(Boolean).map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1)]))
  return { r, ausgabe, gh: readFileSync(log, 'utf8').trim() }
}

try {
  // (1) Keine erkennbare Ursache: alles beim Alten, Untersucher läuft, nichts angelegt oder kommentiert.
  const a = vorab({ protokollDatei: ohneUrsache })
  assert.equal(a.r.status, 0, a.r.stderr)
  assert.deepEqual(a.ausgabe, { schluessel: '', issue: '', claude: 'ja', hinweis: '' })
  assert.equal(a.gh, '', 'ohne Ursache weder Issue noch Kommentar')

  // (2) Noch kein Issue: eines anlegen, Nummer aus der Adresse, Hinweis nennt Nummer und Schlüssel.
  const b = vorab({ protokollDatei: echtesProtokoll, issues: [{ number: 300, body: 'anderes' }] })
  assert.equal(b.r.status, 0, b.r.stderr)
  assert.equal(b.gh, `ANGELEGT Bestandsbau rot: ${echt.lesbar}`)
  assert.deepEqual(b.ausgabe.claude, 'ja')
  assert.equal(b.ausgabe.issue, '4711')
  assert.equal(b.ausgabe.schluessel, echt.schluessel)
  assert.match(b.ausgabe.hinweis, /Issue #4711 \(Schlüssel 846e8d5484\); lege kein weiteres an/)

  // (3) Ein Issue mit dem Marker eines anderen Schlüssels zählt nicht als vorhanden.
  const c = vorab({ protokollDatei: echtesProtokoll, issues: [{ number: 300, body: markerFuer('0000000000') }, { number: 301, body: markerFuer(`${echt.schluessel}x`) }] })
  assert.match(c.gh, /^ANGELEGT /)
  assert.ok(!c.gh.includes('KOMMENTAR'))

  // (4) Lange Ursache: Titel auf 120 Zeichen gekürzt.
  const d = vorab({ protokollDatei: langesProtokoll })
  const titel = d.gh.replace(/^ANGELEGT /, '')
  assert.equal(titel.length, 120)
  assert.ok(titel.startsWith('Bestandsbau rot: FEHLER: xxx'))

  // (5) --trocken legt nichts an und kommentiert nichts, schreibt aber das Ergebnis.
  const e = vorab({ protokollDatei: echtesProtokoll, args: ['--trocken'] })
  assert.equal(e.r.status, 0, e.r.stderr)
  assert.equal(e.gh, '', 'trocken: kein Anlegen')
  assert.match(e.r.stdout, new RegExp(`\\[trocken\\] Issue anlegen: Bestandsbau rot: ${echt.lesbar.slice(0, 20)}`))
  const f = vorab({ protokollDatei: echtesProtokoll, args: ['--trocken'], issues: [{ number: 500, body: markerFuer(echt.schluessel) }] })
  assert.equal(f.gh, '', 'trocken: kein Kommentar')
  assert.match(f.r.stdout, /\[trocken\] issue #500 kommentieren/)
  assert.equal(f.ausgabe.issue, '500')

  // (6) Ohne GITHUB_OUTPUT: trotzdem Exit 0 und das Ergebnis als JSON-Zeile.
  const g = vorab({ protokollDatei: ohneUrsache, mitOutput: false })
  assert.equal(g.r.status, 0, g.r.stderr)
  assert.deepEqual(JSON.parse(g.r.stdout.trim().split('\n').pop()), { schluessel: '', issue: '', claude: 'ja', hinweis: '' })

  // (7) gh scheitert (Attrappe lehnt den falschen Lauf ab): Exit ≠ 0, keine Ausgabe für den Workflow.
  const h = vorab({ protokollDatei: echtesProtokoll, lauf: '888', antwortLauf: '777' })
  assert.notEqual(h.r.status, 0)
  assert.deepEqual(h.ausgabe, {}, 'ein gescheiterter Abruf schreibt kein claude=ja ins Output')
  assert.match(h.gh, /FALSCH run view/)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log(`untersucher-vorab.test: ${nr} Läufe grün (ohne Ursache, neues Issue, fremder Marker, lange Ursache, trocken, ohne Output, gh-Fehler)`)
