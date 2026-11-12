/**
 * Test für `.claude/hooks/vorrat-erledigt.js` und seine Verdrahtung in stand-prs.js (`aktualisiere`):
 * Vorrat-Dateien gemergter PRs werden zu `erledigt-…`, Links in stand.md ziehen mit. Wegwerf-Ordner unter os.tmpdir(),
 * feste Zeit, gh als Nachbau. Kennungen ab 910000.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const HOOKS = join(import.meta.dirname, '..', '.claude', 'hooks')
const v = require(join(HOOKS, 'vorrat-erledigt.js'))
const h = require(join(HOOKS, 'stand-prs.js'))

const JETZT = Date.parse('2999-12-31T12:00:00Z')
const ADR = 'https://github.com/danielzaiser91/anime-kalender-de/pull/'
const link = (n) => `[PR ${n}](${ADR}${n})`
const merge = (n) => ({ number: n, title: `fix: ${n}`, url: `${ADR}${n}`, mergedAt: new Date(JETZT - 60000).toISOString(), updatedAt: new Date(JETZT - 60000).toISOString() })
const gh = (nummern) => () => JSON.stringify({ data: { repository: { offen: { pageInfo: { hasNextPage: false }, nodes: [] }, gemergt: { pageInfo: { hasNextPage: false }, nodes: nummern.map(merge) } } } })

// --- neuerName: reine Fälle ---
const M = new Set([910001, 910002])
assert.equal(v.neuerName('z-wartet-merge-910001-thema.md', '', M), 'erledigt-910001-thema.md')
assert.equal(v.neuerName('z-wartet-merge-910009-thema.md', '', M), null, 'PR nicht gemergt (offen oder geschlossen)')
assert.equal(v.neuerName('z-wartet-merge-91000-thema.md', '', M), null, 'Nummer nur Präfix von 910001: kein Treffer')
assert.equal(v.neuerName('vergeben-thema.md', `x ${link(910001)}`, M), 'erledigt-thema.md')
assert.equal(v.neuerName('vergeben-thema.md', `${link(910001)} ${link(910002)}`, M), 'erledigt-thema.md', 'zwei Links, beide gemergt')
assert.equal(v.neuerName('vergeben-thema.md', `${link(910001)} ${link(910009)}`, M), null, 'zwei Links, einer offen')
assert.equal(v.neuerName('vergeben-thema.md', `${link(910009)} ${link(910001)}`, M), null, 'Reihenfolge egal')
assert.equal(v.neuerName('vergeben-thema.md', 'PR 910001 ohne Link', M), null, 'ohne PR-Link')
assert.equal(v.neuerName('vergeben-thema.md', '', M), null, 'leere Datei')
assert.equal(v.neuerName('erledigt-thema.md', `${link(910001)}`, M), null, 'schon erledigt')
assert.equal(v.neuerName('z-wartet-thema.md', '', M), null, 'z-wartet ohne merge-Nummer')

// --- vorratErledigt am Dateisystem ---
const wurzel = mkdtempSync(join(tmpdir(), 'vorrat-erledigt-'))
try {
  const vorrat = join(wurzel, 'vorrat')
  const schreibe = (name, text = '') => writeFileSync(join(vorrat, name), text)
  const neuerOrdner = () => {
    rmSync(vorrat, { recursive: true, force: true })
    mkdirSync(vorrat)
  }
  const stand = (...namen) => namen.map((n) => `- Zeile ([Auftrag](file:///C:/x/vorrat/${n}))`).join('\n')

  neuerOrdner()
  schreibe('z-wartet-merge-910001-a.md')
  schreibe('z-wartet-merge-910009-b.md')
  schreibe('vergeben-c.md', `Einer: ${link(910002)}`)
  schreibe('vergeben-d.md', `Zwei: ${link(910001)} ${link(910009)}`)
  schreibe('vergeben-e.md', 'ohne Link')
  schreibe('vergeben-f.md', `${link(910001)}`)
  schreibe('erledigt-f.md', 'schon da')
  const text = stand('z-wartet-merge-910001-a.md', 'vergeben-c.md', 'vergeben-d.md')
  const r = v.vorratErledigt({ ordner: vorrat, text, gemergt: M })
  assert.deepEqual(readdirSync(vorrat).sort(), ['erledigt-910001-a.md', 'erledigt-c.md', 'erledigt-f.md', 'vergeben-d.md', 'vergeben-e.md', 'vergeben-f.md', 'z-wartet-merge-910009-b.md'])
  assert.equal(readFileSync(join(vorrat, 'erledigt-f.md'), 'utf8'), 'schon da', 'vorhandene Zieldatei bleibt')
  assert.equal(r.text, stand('erledigt-910001-a.md', 'erledigt-c.md', 'vergeben-d.md'), 'Links nur der umbenannten nachgezogen')
  assert.deepEqual(r.zeilen, ['Vorrat: vergeben-c.md → erledigt-c.md', 'Vorrat: z-wartet-merge-910001-a.md → erledigt-910001-a.md'])
  assert.deepEqual(v.vorratErledigt({ ordner: vorrat, text: r.text, gemergt: M }).zeilen, [], 'zweiter Lauf: nichts mehr')
  assert.deepEqual(v.vorratErledigt({ ordner: join(wurzel, 'fehlt'), text: 'x', gemergt: M }), { text: 'x', zeilen: [] }, 'Ordner fehlt')
  assert.deepEqual(v.vorratErledigt({ ordner: vorrat, text: r.text, gemergt: new Set() }).zeilen, [], 'nichts gemergt: nichts')

  // --- Verdrahtung: aktualisiere (stand.md neben dem Ordner vorrat) ---
  const datei = join(wurzel, 'stand.md')
  const kopf = `## In Arbeit (Stand 31.12.2999 12:00)\n${h.AUF}\n${h.ZU}\n`
  const lauf = (nummern, erfolg = JETZT - 1000, jetzt = JETZT) => h.aktualisiere({ datei, gh: gh(nummern), jetzt, erfolg })
  neuerOrdner()
  schreibe('z-wartet-merge-910001-a.md')
  schreibe('vergeben-c.md', `${link(910002)}`)
  writeFileSync(datei, `${kopf}${stand('z-wartet-merge-910001-a.md', 'vergeben-c.md')}\r\n`.replace(/\n/g, '\r\n').replace(/\r\r/g, '\r'))
  const a = lauf([910001, 910002])
  assert.equal(a.erfolg, true, JSON.stringify(a))
  assert.deepEqual(a.umbenannt, ['Vorrat: vergeben-c.md → erledigt-c.md', 'Vorrat: z-wartet-merge-910001-a.md → erledigt-910001-a.md'])
  assert.ok(readFileSync(datei, 'utf8').includes('vorrat/erledigt-910001-a.md') && readFileSync(datei, 'utf8').includes('vorrat/erledigt-c.md'), 'stand.md nachgezogen')
  assert.ok(readFileSync(datei, 'utf8').includes('\r\n'), 'Zeilenenden bleiben')
  assert.deepEqual(JSON.parse(h.ausgabe(a).trim()).systemMessage.split('\n').filter((z) => z.startsWith('Vorrat:')), a.umbenannt, 'Hook-Ausgabe nennt je Umbenennung eine Zeile')
  assert.equal(lauf([910001, 910002]).umbenannt, undefined, 'zweiter Lauf: still')

  // PR nicht gemergt (offen/geschlossen: fehlt in der gemergt-Liste): Datei bleibt
  neuerOrdner()
  schreibe('z-wartet-merge-910001-a.md')
  writeFileSync(datei, `${kopf}${stand('z-wartet-merge-910001-a.md')}\n`)
  assert.equal(lauf([910002]).umbenannt, undefined)
  assert.ok(existsSync(join(vorrat, 'z-wartet-merge-910001-a.md')), 'geschlossen ohne Merge: nicht umbenannt')

  // Abruf scheitert (veraltet): nichts umbenennen
  const kaputt = () => {
    throw new Error('gh: 502')
  }
  const b = h.aktualisiere({ datei, gh: kaputt, jetzt: JETZT, erfolg: JETZT - 3600000 })
  assert.match(b.ergebnis, /^veraltet/)
  assert.equal(b.umbenannt, undefined)
  assert.ok(existsSync(join(vorrat, 'z-wartet-merge-910001-a.md')), 'Abruffehler: nicht umbenannt')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('vorrat-erledigt.test: ok (z-wartet-merge, vergeben mit einem/zwei Links, offen, geschlossen, ohne Link, Zieldatei da, zweiter Lauf, Ordner fehlt, Verdrahtung in aktualisiere, Abruffehler)')
