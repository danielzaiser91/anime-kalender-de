// Wächter „Kopf ohne Urteil“ (19.11.2026): Tabellentest der reinen Funktionen, Ablauf mit eingespeistem gh, Abruffehler und die Verdrahtung in der Wachphase.
// Die Kommentartexte sind wörtlich die erste Zeile echter Urteile (Abruf 31.10.2026).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MARKE_OHNE_MODELL, hatUrteil, prueferZeilen, pruefpflichtig } from './pruefer-unfertig-wache.mjs'

const BOT = 'github-actions[bot]'
const KOPF = 'c'.repeat(40)
const ALT = 'a'.repeat(40)
const k = (titel, kopf = KOPF, login = BOT, extra = '') => ({ user: { login }, body: `**Prüfer-Review** für ${kopf.slice(0, 9)} - Urteil: **${titel}**\n\nProtokoll${extra}` })

let faelle = 0
const gleich = (name, ist, soll) => {
  assert.deepEqual(ist, soll, name)
  faelle++
}

// Urteil ja/nein
gleich('ok ist ein Urteil', hatUrteil([k('ok')], KOPF), true)
gleich('aendern ist ein Urteil', hatUrteil([k('aendern')], KOPF), true)
gleich('ok mit Zusatz „Checks rot“ ist ein Urteil', hatUrteil([k('ok, Checks rot: PR-Prüfkette')], KOPF), true)
gleich('„nicht beurteilt, Kette lief noch“ ist keins', hatUrteil([k('nicht beurteilt, Kette lief noch')], KOPF), false)
gleich('„nicht beurteilt, Diff unvollständig“ ist keins', hatUrteil([k('nicht beurteilt, Diff unvollständig')], KOPF), false)
gleich('„nicht beurteilt, Basis offen“ gilt (gewolltes Warten)', hatUrteil([k('nicht beurteilt, Basis offen')], KOPF), true)
gleich('Urteil zu altem Kopf zählt nicht', hatUrteil([k('ok', ALT)], KOPF), false)
gleich('fremder Autor zählt nicht', hatUrteil([k('ok', KOPF, 'fremder')], KOPF), false)
gleich('Lauf ohne Modell (Altbestand) zählt nicht', hatUrteil([k('ok', KOPF, BOT, `\n${MARKE_OHNE_MODELL}`)], KOPF), false)
gleich('Zeile muss am Textanfang stehen', hatUrteil([{ user: { login: BOT }, body: `Hallo\n${k('ok').body}` }], KOPF), false)
gleich('keine Kommentare', hatUrteil([], KOPF), false)
gleich('kein Text, kein Nutzer', hatUrteil([{}, { user: { login: BOT } }], KOPF), false)
gleich('Marke steht im Workflow', fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8').includes(MARKE_OHNE_MODELL), true)

// Prüfpflicht: genau die Bedingung der Job-Zeile `pruefen` in pr-pruefer.yml
const pr = (a = {}) => ({ number: 7, state: 'open', draft: false, head: { sha: KOPF, ref: 'claude/x', repo: { full_name: 'o/r' } }, base: { ref: 'main', repo: { full_name: 'o/r' } }, ...a })
gleich('Normalfall prüfpflichtig', pruefpflichtig([pr()]).length, 1)
gleich('Entwurf nicht', pruefpflichtig([pr({ draft: true })]).length, 0)
gleich('Fork nicht', pruefpflichtig([pr({ head: { sha: KOPF, ref: 'x', repo: { full_name: 'f/r' } } })]).length, 0)
gleich('Datenzweig nicht', pruefpflichtig([pr({ head: { sha: KOPF, ref: 'daten/neu', repo: { full_name: 'o/r' } } })]).length, 0)
gleich('zug-fahrt und zug-probe nicht', pruefpflichtig(['zug-fahrt', 'zug-probe'].map((ref) => pr({ head: { sha: KOPF, ref, repo: { full_name: 'o/r' } } }))).length, 0)
gleich('andere Basis nicht', pruefpflichtig([pr({ base: { ref: 'dev', repo: { full_name: 'o/r' } } })]).length, 0)
gleich('Basis zug ja', pruefpflichtig([pr({ base: { ref: 'zug', repo: { full_name: 'o/r' } } })]).length, 1)
const wf = fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8')
gleich('Workflow nennt dieselben Ausnahmen', ["startsWith(github.head_ref, 'daten/')", "github.head_ref != 'zug-fahrt'", "github.head_ref != 'zug-probe'", 'branches: [main, zug]'].every((t) => wf.includes(t)), true)

// Ablauf mit eingespeistem gh
const JETZT = Date.parse('2026-11-19T12:00:00Z')
const vor = (min) => new Date(JETZT - min * 60_000).toISOString()
function ablauf({ pulls = [pr()], laeufe = [{ status: 'completed', conclusion: 'success', created_at: vor(90) }], kommentare = [], commitMin = 90, fehler = null } = {}) {
  const aufrufe = []
  const gh = (...a) => {
    aufrufe.push(a.join(' '))
    if (fehler) throw new Error(fehler)
    const url = a.at(-1)
    if (url.includes('/pulls?state=open')) return JSON.stringify(pulls)
    if (url.includes('/workflows/pr-pruefer.yml/runs')) return JSON.stringify({ workflow_runs: laeufe })
    if (url.includes('/commits/')) return JSON.stringify({ commit: { committer: { date: vor(commitMin) } } })
    // Alle Seiten, als ein Feld je Seite: ohne --paginate/--slurp (oder mit vertauschter Reihenfolge) fehlen Kommentare hinter Seite 1.
    if (url.includes('/issues/7/comments')) {
      if (a.slice(0, 3).join(' ') !== 'api --paginate --slurp') throw new Error('Kommentare ohne --paginate --slurp: ' + a.join(' '))
      return JSON.stringify([kommentare])
    }
    throw new Error('unerwartet ' + url)
  }
  return { zeilen: prueferZeilen(gh, 'o/r', JETZT), aufrufe }
}
const MELDUNG = 'PRUEFER: PR #7 Kopf ccccccccc ohne Urteil seit 90 min (Grenze 60 min): Neustart nach Kettenende ausgefallen? pr-pruefer-nachtrag.yml, Job nach-kette'
gleich('Kopf 90 min ohne Urteil: Meldung', ablauf().zeilen, [MELDUNG])
gleich('Kopf mit Urteil: still', ablauf({ kommentare: [k('ok')] }).zeilen, [])
gleich('Kopf nur mit „nicht beurteilt, Kette lief noch“ (Altbestand): Meldung', ablauf({ kommentare: [k('nicht beurteilt, Kette lief noch')] }).zeilen, [MELDUNG])
gleich('Kopf 59 min alt: still, ohne Kommentarabruf', (() => { const r = ablauf({ laeufe: [{ status: 'completed', conclusion: 'success', created_at: vor(59) }] }); return [r.zeilen, r.aufrufe.some((a) => a.includes('/comments'))] })(), [[], false])
gleich('Kopf genau 60 min alt: still (Grenze ist „mehr als“)', ablauf({ laeufe: [{ status: 'completed', conclusion: 'success', created_at: vor(60) }] }).zeilen, [])
gleich('Prüfer-Lauf läuft noch: still', ablauf({ laeufe: [{ status: 'in_progress', created_at: vor(90) }] }).zeilen, [])
gleich('Prüfer-Lauf übersprungen: still', ablauf({ laeufe: [{ status: 'completed', conclusion: 'skipped', created_at: vor(90) }] }).zeilen, [])
gleich('ältester Lauf zählt als Push-Zeit (Neustart ändert sie nicht)', ablauf({ laeufe: [{ status: 'completed', conclusion: 'success', created_at: vor(5) }, { status: 'completed', conclusion: 'success', created_at: vor(90) }] }).zeilen, [MELDUNG])
gleich('ohne Lauf: Commit-Datum entscheidet', ablauf({ laeufe: [] }).zeilen, [MELDUNG])
gleich('ohne Lauf, junger Commit: still', ablauf({ laeufe: [], commitMin: 10 }).zeilen, [])
gleich('Entwurf und Datenzweig: still, kein Abruf je PR', (() => { const r = ablauf({ pulls: [pr({ draft: true }), pr({ head: { sha: KOPF, ref: 'daten/x', repo: { full_name: 'o/r' } } })] }); return [r.zeilen, r.aufrufe.length] })(), [[], 1])
gleich('zwei PRs, einer ohne Urteil: genau eine Zeile', ablauf({ pulls: [pr(), pr({ number: 8, head: { sha: ALT, ref: 'claude/y', repo: { full_name: 'o/r' } } })], kommentare: [] }).zeilen.length, 1)
gleich('Normalbetrieb ohne offene PRs: ein Aufruf, keine Zeile', (() => { const r = ablauf({ pulls: [] }); return [r.zeilen, r.aufrufe.length] })(), [[], 1])

// Abruffehler
gleich('Abruffehler: eigene Zeile, nur die erste Fehlerzeile', ablauf({ fehler: 'gh: HTTP 503\nzweite Zeile' }).zeilen, ['PRUEFER? Prüfer-Urteile nicht lesbar: gh: HTTP 503'])
gleich('kaputtes JSON: beginnt mit PRUEFER?', prueferZeilen(() => 'kein json', 'o/r', JETZT)[0].startsWith('PRUEFER? '), true)
gleich('Antwort ist kein Array (Fehlerobjekt): eigene Zeile', prueferZeilen(() => '{"message":"Not Found"}', 'o/r', JETZT)[0].startsWith('PRUEFER? '), true)

// Verdrahtung: die Wachphase ruft die Funktion wirklich auf (Prozess mit gh-Attrappe, die den Kopf-Hash des Tests liefert)
const { spawnSync } = await import('node:child_process')
const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
const { pathToFileURL } = await import('node:url')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
const ordner = mkdtempSync(join(tmpdir(), 'pruefer-unfertig-'))
const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
const abruf = join(ordner, 'abruf-abgelehnt.mjs')
writeFileSync(abruf, "globalThis.fetch = async () => { throw new Error('offline') }\n")
const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
const SCHLUESSEL = 'api repos/danielzaiser91/anime-kalender-de/pulls?state=open&per_page=100'
const starte = (antwort, mehr = {}) => {
  writeFileSync(join(ordner, 'daten.json'), JSON.stringify({ [SCHLUESSEL]: antwort, ...mehr }))
  const env = { ...process.env, ATTRAPPE_LOG: join(ordner, 'log.txt'), ATTRAPPE_DATEN: join(ordner, 'daten.json'), LAUF_TOKEN: '' }
  const args = ['--import', vorlader, '--import', pathToFileURL(abruf).href, werkzeug, '--trocken', '--wurzel', ordner, '--gesundheit', join(ordner, 'fehlt.json')]
  return spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, timeout: 60_000, env })
}
const ruhig = starte({ aus: '[]' })
gleich('Prozess: keine offenen PRs, keine PRUEFER-Zeile', /^PRUEFER/m.test(ruhig.stdout), false)
const kaputt = starte({ fehler: 'HTTP 502' })
gleich('Prozess: Abruffehler als PRUEFER?-Zeile', /^PRUEFER\? Prüfer-Urteile nicht lesbar: HTTP 502$/m.test(kaputt.stdout), true)
// Positiver Prozessfall: offener PR, Kopf seit 2020 ohne Urteil -> die Zeile erreicht die Ausgabe der Wachphase.
const repoApi = 'api repos/danielzaiser91/anime-kalender-de/'
const warnt = starte(
  { aus: JSON.stringify([pr()]) },
  {
    [`${repoApi}actions/workflows/pr-pruefer.yml/runs?head_sha=${KOPF}&per_page=10`]: { aus: JSON.stringify({ workflow_runs: [{ status: 'completed', conclusion: 'success', created_at: '2020-01-01T00:00:00Z' }] }) },
    'api --paginate --slurp repos/danielzaiser91/anime-kalender-de/issues/7/comments': { aus: '[[]]' },
  },
)
gleich('Prozess: Kopf ohne Urteil steht als PRUEFER-Zeile in der Ausgabe', /^PRUEFER: PR #7 Kopf ccccccccc ohne Urteil seit \d+ min/m.test(warnt.stdout), true)
rmSync(ordner, { recursive: true, force: true })

console.log(`pruefer-unfertig-wache: ${faelle} Fälle grün (Urteil, Prüfpflicht, Ablauf, Abruffehler, Prozess)`)
