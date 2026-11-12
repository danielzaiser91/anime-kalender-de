/**
 * Test für `.claude/hooks/vorrat-erledigt.js` und seine Verdrahtung in stand-prs.js (`aktualisiere`):
 * Vorrat-Dateien gemergter PRs werden zu `erledigt-…`, Links in stand.md ziehen mit (auch selbstheilend nach einem
 * Fehlschlag). Wegwerf-Ordner unter os.tmpdir(), feste Zeit, gh als Nachbau. Kennungen ab 910000.
 */
import assert from 'node:assert/strict'
import fs, { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
const vergeben = (...n) => `**Vergeben:** ${n.map(link).join(' ')}\n`
const merge = (n) => ({ number: n, title: `fix: ${n}`, url: `${ADR}${n}`, mergedAt: new Date(JETZT - 60000).toISOString(), updatedAt: new Date(JETZT - 60000).toISOString() })
/** gh-Nachbau: GraphQL-Liste (24 h) und `pr view` (Zustand je Nummer aus `zustaende`). */
function gh(nummern, { offen = [], zustaende = {}, aufrufe = [] } = {}) {
  return (args) => {
    if (args[0] === 'pr') {
      aufrufe.push(args[2])
      assert.deepEqual([args[1], args[3], args[4], args[5]], ['view', '--repo', 'danielzaiser91/anime-kalender-de', '--json'])
      const z = zustaende[args[2]]
      if (z === 'fehler') throw new Error('gh: 502')
      return JSON.stringify({ state: z ?? 'OPEN' })
    }
    const nodes = offen.map((n) => ({ number: n, title: `fix: ${n}`, url: `${ADR}${n}`, isDraft: false, mergeable: 'MERGEABLE', headRefOid: 'abc', commits: { nodes: [] }, comments: { nodes: [] } }))
    return JSON.stringify({ data: { repository: { offen: { pageInfo: { hasNextPage: false }, nodes }, gemergt: { pageInfo: { hasNextPage: false }, nodes: nummern.map(merge) } } } })
  }
}

// --- neuerName: reine Fälle ---
const M = new Set([910001, 910002])
const ist = (n) => M.has(n)
assert.equal(v.neuerName('z-wartet-merge-910001-thema.md', '', ist), 'erledigt-910001-thema.md')
assert.equal(v.neuerName('z-wartet-merge-910009-thema.md', '', ist), null, 'PR nicht gemergt (offen oder geschlossen)')
assert.equal(v.neuerName('z-wartet-merge-91000-thema.md', '', ist), null, 'Nummer nur Präfix von 910001: kein Treffer')
assert.equal(v.neuerName('vergeben-thema.md', vergeben(910001), ist), 'erledigt-thema.md')
assert.equal(v.neuerName('vergeben-thema.md', vergeben(910001, 910002), ist), 'erledigt-thema.md', 'zwei Links, beide gemergt')
assert.equal(v.neuerName('vergeben-thema.md', vergeben(910001, 910009), ist), null, 'zwei Links, einer offen')
assert.equal(v.neuerName('vergeben-thema.md', vergeben(910009, 910001), ist), null, 'Reihenfolge egal')
assert.equal(v.neuerName('vergeben-thema.md', 'PR 910001 ohne Link', ist), null, 'ohne PR-Link')
assert.equal(v.neuerName('vergeben-thema.md', '', ist), null, 'leere Datei')
assert.equal(v.neuerName('erledigt-thema.md', vergeben(910001), ist), null, 'schon erledigt')
assert.equal(v.neuerName('z-wartet-thema.md', '', ist), null, 'z-wartet ohne merge-Nummer')
// A3: Verweise auf Fremd-PRs außerhalb der Vergeben-Zeile zählen nicht
assert.equal(v.neuerName('vergeben-thema.md', `Vorab geprüft: ${link(910001)} schon gemergt.\n${vergeben(910009)}`, ist), null, 'Verweis gemergt, eigener PR offen: bleibt')
assert.equal(v.neuerName('vergeben-thema.md', `Vorab geprüft: ${link(910001)} schon gemergt.\n`, ist), null, 'nur Verweis, keine Vergeben-Zeile: bleibt')
assert.equal(v.neuerName('vergeben-thema.md', `Vorab geprüft: ${link(910009)}\n${vergeben(910001)}`, ist), 'erledigt-thema.md', 'Verweis offen, eigener PR gemergt: erledigt')

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
  const verweistNurAufVorhandene = (text) => [...text.matchAll(/vorrat\/([^)\s]+)\)/g)].every((m) => existsSync(join(vorrat, m[1])))

  neuerOrdner()
  schreibe('z-wartet-merge-910001-a.md')
  schreibe('z-wartet-merge-910009-b.md')
  schreibe('vergeben-c.md', vergeben(910002))
  schreibe('vergeben-d.md', vergeben(910001, 910009))
  schreibe('vergeben-e.md', 'ohne Link')
  schreibe('vergeben-f.md', vergeben(910001))
  schreibe('erledigt-f.md', 'schon da')
  const text = stand('z-wartet-merge-910001-a.md', 'vergeben-c.md', 'vergeben-d.md')
  const r = v.vorratErledigt({ ordner: vorrat, text, istGemergt: ist })
  assert.deepEqual(readdirSync(vorrat).sort(), ['erledigt-910001-a.md', 'erledigt-c.md', 'erledigt-f.md', 'vergeben-d.md', 'vergeben-e.md', 'vergeben-f.md', 'z-wartet-merge-910009-b.md'])
  assert.equal(readFileSync(join(vorrat, 'erledigt-f.md'), 'utf8'), 'schon da', 'vorhandene Zieldatei bleibt')
  assert.equal(r.text, stand('erledigt-910001-a.md', 'erledigt-c.md', 'vergeben-d.md'), 'Links nur der umbenannten nachgezogen')
  assert.deepEqual(r.zeilen, ['Vorrat: vergeben-c.md → erledigt-c.md', 'Vorrat: z-wartet-merge-910001-a.md → erledigt-910001-a.md'])
  assert.deepEqual(v.vorratErledigt({ ordner: vorrat, text: r.text, istGemergt: ist }).zeilen, [], 'zweiter Lauf: nichts mehr')
  assert.deepEqual(v.vorratErledigt({ ordner: join(wurzel, 'fehlt'), text: 'x', istGemergt: ist }), { text: 'x', zeilen: [] }, 'Ordner fehlt')
  assert.deepEqual(v.vorratErledigt({ ordner: vorrat, text: r.text, istGemergt: () => false }).zeilen, [], 'nichts gemergt: nichts')

  // A1: scheiternder Rename (Windows: Datei offen) überspringt nur diese Datei; stand.md verweist weiter nur auf Vorhandenes
  neuerOrdner()
  for (const n of ['a', 'b', 'c']) schreibe(`vergeben-${n}.md`, vergeben(910001))
  const echt = fs.renameSync
  fs.renameSync = (von, nach) => {
    if (von.endsWith('vergeben-b.md')) throw Object.assign(new Error('gesperrt'), { code: 'EPERM' })
    return echt(von, nach)
  }
  let fehl
  try {
    fehl = v.vorratErledigt({ ordner: vorrat, text: stand('vergeben-a.md', 'vergeben-b.md', 'vergeben-c.md'), istGemergt: ist })
  } finally {
    fs.renameSync = echt
  }
  assert.deepEqual(readdirSync(vorrat).sort(), ['erledigt-a.md', 'erledigt-c.md', 'vergeben-b.md'], 'die übrigen werden umbenannt')
  assert.equal(fehl.text, stand('erledigt-a.md', 'vergeben-b.md', 'erledigt-c.md'))
  assert.ok(verweistNurAufVorhandene(fehl.text), 'stand.md verweist nur auf existierende Dateien')
  assert.deepEqual(fehl.zeilen, ['Vorrat: vergeben-a.md → erledigt-a.md', 'Vorrat: vergeben-b.md nicht umbenannt (EPERM)', 'Vorrat: vergeben-c.md → erledigt-c.md'])
  assert.deepEqual(v.vorratErledigt({ ordner: vorrat, text: fehl.text, istGemergt: ist }).zeilen, ['Vorrat: vergeben-b.md → erledigt-b.md'], 'nächster Lauf holt es nach')

  // A2: nicht lesbare vergeben-Datei (hier ein Ordner gleichen Namens: EISDIR) wird gemeldet und übersprungen, die übrigen laufen weiter
  neuerOrdner()
  mkdirSync(join(vorrat, 'vergeben-b.md'))
  schreibe('vergeben-a.md', vergeben(910001))
  schreibe('vergeben-c.md', vergeben(910001))
  const unles = v.vorratErledigt({ ordner: vorrat, text: stand('vergeben-a.md', 'vergeben-b.md', 'vergeben-c.md'), istGemergt: ist })
  assert.deepEqual(readdirSync(vorrat).sort(), ['erledigt-a.md', 'erledigt-c.md', 'vergeben-b.md'])
  assert.deepEqual(unles.zeilen, ['Vorrat: vergeben-a.md → erledigt-a.md', 'Vorrat: vergeben-b.md nicht gelesen (EISDIR)', 'Vorrat: vergeben-c.md → erledigt-c.md'])
  assert.equal(unles.text, stand('erledigt-a.md', 'vergeben-b.md', 'erledigt-c.md'))

  // A1: Selbstheilung (stand.md wurde nach dem Umbenennen nicht geschrieben: Link zeigt auf fehlende alte Datei)
  neuerOrdner()
  schreibe('erledigt-g.md')
  schreibe('erledigt-910001-h.md')
  schreibe('vergeben-i.md', vergeben(910009))
  const heil = v.vorratErledigt({ ordner: vorrat, text: stand('vergeben-g.md', 'z-wartet-merge-910001-h.md', 'vergeben-i.md'), istGemergt: ist })
  assert.equal(heil.text, stand('erledigt-g.md', 'erledigt-910001-h.md', 'vergeben-i.md'), 'alt fehlt, neu da: Link zieht nach; vorhandene alte Datei bleibt verlinkt')
  assert.deepEqual(heil.zeilen, [])
  assert.ok(verweistNurAufVorhandene(heil.text))
  schreibe('vergeben-g.md', vergeben(910009))
  assert.equal(v.vorratErledigt({ ordner: vorrat, text: stand('vergeben-g.md'), istGemergt: ist }).text, stand('vergeben-g.md'), 'alte Datei vorhanden: kein Nachziehen')

  // --- Verdrahtung: aktualisiere (stand.md neben dem Ordner vorrat) ---
  const datei = join(wurzel, 'stand.md')
  const kopf = `## In Arbeit (Stand 31.12.2999 12:00)\n${h.AUF}\n${h.ZU}\n`
  const lauf = (g, erfolg = JETZT - 1000) => h.aktualisiere({ datei, gh: g, jetzt: JETZT, erfolg })
  const lies = () => readFileSync(datei, 'utf8')
  neuerOrdner()
  schreibe('z-wartet-merge-910001-a.md')
  schreibe('vergeben-c.md', vergeben(910002))
  writeFileSync(datei, `${kopf}${stand('z-wartet-merge-910001-a.md', 'vergeben-c.md')}\n`.replace(/\n/g, '\r\n'))
  const a = lauf(gh([910001, 910002]))
  assert.equal(a.erfolg, true, JSON.stringify(a))
  assert.deepEqual(a.umbenannt, ['Vorrat: vergeben-c.md → erledigt-c.md', 'Vorrat: z-wartet-merge-910001-a.md → erledigt-910001-a.md'])
  assert.ok(lies().includes('vorrat/erledigt-910001-a.md') && lies().includes('vorrat/erledigt-c.md'), 'stand.md nachgezogen')
  assert.ok(lies().includes('\r\n'), 'Zeilenenden bleiben')
  assert.deepEqual(JSON.parse(h.ausgabe(a).trim()).systemMessage.split('\n').filter((z) => z.startsWith('Vorrat:')), a.umbenannt, 'Hook-Ausgabe nennt je Umbenennung eine Zeile')
  assert.equal(lauf(gh([910001, 910002])).umbenannt, undefined, 'zweiter Lauf: still')

  // PR nicht gemergt (offen/geschlossen): Datei bleibt
  neuerOrdner()
  schreibe('z-wartet-merge-910001-a.md')
  writeFileSync(datei, `${kopf}${stand('z-wartet-merge-910001-a.md')}\n`)
  assert.equal(lauf(gh([910002], { zustaende: { 910001: 'CLOSED' } })).umbenannt, undefined)
  assert.ok(existsSync(join(vorrat, 'z-wartet-merge-910001-a.md')), 'geschlossen ohne Merge: nicht umbenannt')

  // A2: älter als 24 h gemergt: gezielte Abfrage; offene PRs werden nicht abgefragt; Fehler und Limit heißen „nein“
  neuerOrdner()
  schreibe('z-wartet-merge-910050-alt.md')
  schreibe('z-wartet-merge-910051-offen.md')
  schreibe('z-wartet-merge-910052-zu.md')
  schreibe('z-wartet-merge-910053-fehler.md')
  schreibe('vergeben-v.md', vergeben(910050, 910054))
  writeFileSync(datei, `${kopf}${stand('z-wartet-merge-910050-alt.md', 'z-wartet-merge-910051-offen.md')}\n`)
  const aufrufe = []
  const e = lauf(gh([], { offen: [910051], aufrufe, zustaende: { 910050: 'MERGED', 910052: 'CLOSED', 910053: 'fehler', 910054: 'MERGED' } }))
  assert.deepEqual(readdirSync(vorrat).sort(), ['erledigt-910050-alt.md', 'erledigt-v.md', 'z-wartet-merge-910051-offen.md', 'z-wartet-merge-910052-zu.md', 'z-wartet-merge-910053-fehler.md'])
  assert.deepEqual([...aufrufe].sort(), ['910050', '910052', '910053', '910054'], 'je Nummer einmal, offene nicht')
  assert.deepEqual(e.umbenannt, ['Vorrat: vergeben-v.md → erledigt-v.md', 'Vorrat: z-wartet-merge-910050-alt.md → erledigt-910050-alt.md'])
  neuerOrdner()
  for (let i = 0; i < 12; i++) schreibe(`z-wartet-merge-${910100 + i}-x.md`)
  const viele = []
  lauf(gh([], { aufrufe: viele, zustaende: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [910100 + i, 'MERGED'])) }))
  assert.equal(viele.length, 10, 'höchstens 10 Einzelabfragen je Lauf')
  assert.equal(readdirSync(vorrat).filter((n) => n.startsWith('erledigt-')).length, 10, 'der Rest folgt im nächsten Lauf')

  // Abruf scheitert (veraltet): nichts umbenennen
  neuerOrdner()
  schreibe('z-wartet-merge-910001-a.md')
  writeFileSync(datei, `${kopf}${stand('z-wartet-merge-910001-a.md')}\n`)
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
console.log('vorrat-erledigt.test: ok (z-wartet-merge, vergeben mit einem/zwei Links, Verweis-PR ohne Zählung, offen, geschlossen, Rename scheitert, Selbstheilung, Zieldatei da, zweiter Lauf, Ordner fehlt, Einzelabfrage älter als 24 h samt Fehler und Limit 10, Verdrahtung in aktualisiere, Abruffehler)')
