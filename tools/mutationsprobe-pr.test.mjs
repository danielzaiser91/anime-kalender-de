// Test für tools/mutationsprobe-pr.mjs (Mutationsprobe bei Prüfstufe 2): reine Entscheidungen, Start und Warten
// über eine gh-Attrappe mit fester Uhr, und der Kreislauf Start -> Warten -> Datei für den Prüfer.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnMitLimit } from './kind-mit-limit.mjs'
import { baueBericht, findeLauf, geaenderteListen, starte, urteilListe, warte, zustandText } from './mutationsprobe-pr.mjs'

const KOPF = 'c'.repeat(40)
const ALT = 'd'.repeat(40)
const L1 = 'tools/mutationen/eins.json'
const L2 = 'tools/mutationen/zwei.json'
const mit = JSON.stringify([{ name: 'a', tests: ['t'], aenderungen: [{ datei: 'x', suche: 'a', ersetze: 'b' }] }, { name: 'Kontrolle', aenderungen: [] }])
const ohne = JSON.stringify([{ name: 'a', tests: ['t'] }, { name: 'b' }])

// --- Entscheidungen ---
assert.deepEqual(geaenderteListen([
  { filename: L1, status: 'modified' }, { filename: L2, status: 'added' }, { filename: 'tools/mutationen/weg.json', status: 'removed' },
  { filename: 'tools/mutationen/unter/x.json', status: 'added' }, { filename: 'tools/mutationen/x.md', status: 'added' }, { filename: 'tools/mutationen/a b.json', status: 'added' },
  { filename: 'tools/andere.json', status: 'added' },
]), [L1, L2])

assert.deepEqual(urteilListe(mit), { laufbar: true, grund: '' }, 'Kontrolle ohne tests zählt nicht')
assert.equal(urteilListe(ohne).laufbar, false)
assert.match(urteilListe(ohne).grund, /^1 von 2 Mutanten ohne eigenes „tests“/)
assert.equal(urteilListe(JSON.stringify([{ name: 'a', tests: [] }])).laufbar, false, 'leeres tests zählt nicht')
assert.equal(urteilListe(JSON.stringify([{ name: 'Kontrolle', aenderungen: [] }])).grund, 'keine Mutanten')
assert.equal(urteilListe('[]').grund, 'keine Mutanten')
assert.equal(urteilListe('{').grund, 'Liste nicht lesbar (kein JSON)')
assert.equal(urteilListe('{}').grund, 'Liste ist kein Array')

const lauf = (id, titel, extra = {}) => ({ databaseId: id, displayTitle: titel, status: 'completed', conclusion: 'success', createdAt: `2026-11-12T10:0${id}:00Z`, url: `u${id}`, ...extra })
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L1} @ ${KOPF}`), lauf(3, `Mutationsprobe ${L1} @ ${KOPF}`), lauf(2, `Mutationsprobe ${L1} @ ${KOPF}`)], KOPF, L1).databaseId, 3, 'neuester')
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L1} @ ${ALT}`)], KOPF, L1), null, 'anderer Kopf zählt nicht')
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L2} @ ${KOPF}`)], KOPF, L1), null, 'andere Liste zählt nicht')
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L2} @ ${KOPF}`)], KOPF, L2).databaseId, 1, 'die zweite Liste wird gefunden')

assert.match(zustandText(null), /^nicht beurteilt: Lauf nicht gefunden/)
assert.match(zustandText({ status: 'in_progress' }), /^nicht beurteilt: Lauf läuft noch \(in_progress\)/)
assert.match(zustandText({ status: 'completed', conclusion: 'success' }), /^alle Mutanten rot/)
assert.match(zustandText({ status: 'completed', conclusion: 'failure' }), /^Lauf failure: Überlebende/)
assert.match(zustandText({ status: 'completed', conclusion: '' }), /^Lauf ohne Ergebnis/)

const bericht = baueBericht({ kopf: KOPF, ergebnisse: [{ liste: L1, lauf: lauf(1, 'x'), tabelle: 'Tabelle\u0001Zeile' }], uebersprungen: [{ liste: L2, grund: 'weil' }] })
assert.ok(bericht.startsWith(`Mutationsprobe zum Kopf ${KOPF}`))
assert.ok(bericht.includes(`- ${L2}: übersprungen, weil`) && bericht.includes(`- ${L1}: alle Mutanten rot (Lauf grün) (u1)`))
assert.ok(bericht.includes('UNVERTRAUENSWÜRDIGE DATEN') && bericht.indexOf('UNVERTRAUENSWÜRDIGE DATEN') < bericht.indexOf('Tabelle Zeile'), 'Tabelle steht hinter dem Hinweis, Steuerzeichen raus')
const lang = baueBericht({ kopf: KOPF, ergebnisse: [{ liste: L1, lauf: lauf(1, 'x'), tabelle: 'x'.repeat(5999) + 'ab' }], uebersprungen: [] })
assert.ok(lang.endsWith(`${'x'.repeat(5999)}a\n`), 'Ergebnistext wird bei genau 6000 Zeichen gekappt')
assert.ok(!baueBericht({ kopf: KOPF, ergebnisse: [{ liste: L1, lauf: null, tabelle: '' }], uebersprungen: [] }).includes('UNVERTRAUENSWÜRDIGE'), 'ohne Tabelle kein Hinweis nötig')

// --- Start und Warten mit Attrappe ---
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutprobe-pr-'))
try {
  const dateien = (namen) => JSON.stringify(namen.map(([filename, status]) => ({ filename, status }))) + '\n'
  const baueGh = ({ listen, inhalte, laeufe = () => [], kaputt = {} }) => {
    const aufrufe = []
    const gh = (args) => {
      aufrufe.push(args)
      if (args[0] === 'api' && args.some((a) => a.includes('/pulls/12/files'))) return listen
      if (args[0] === 'api') {
        const pfad = args.at(-1).replace(/^repos\/o\/r\/contents\//, '').replace(/\?ref=.*/, '')
        if (kaputt[pfad]) throw new Error(`HTTP 404 ${pfad}\nzweite Zeile`)
        return inhalte[pfad]
      }
      if (args[0] === 'workflow') {
        if (kaputt.dispatch === args.find((a) => a.startsWith('liste='))) throw new Error('HTTP 422')
        return ''
      }
      // Mehr als ein Lauf je Kopf und Liste liegt in den letzten 60: bei kleinerem Limit fände der Prüfer nichts.
      if (args[0] === 'run' && args[1] === 'list' && args[args.indexOf('--limit') + 1] !== '60') return '[]'
      if (args[0] === 'run' && args[1] === 'list') return JSON.stringify(laeufe(aufrufe.filter((a) => a[1] === 'list').length))
      if (args[0] === 'run' && args[1] === 'download') throw new Error('kein Artefakt')
      throw new Error(`unerwartet ${args}`)
    }
    return { gh, aufrufe }
  }
  const stuetz = { pr: '12', kopf: KOPF, zweig: 'fix/x', repo: 'o/r', jetzt: () => 1000 }

  // zwei Listen laufbar, eine ohne tests, eine gelöscht, eine nicht abrufbar, eine Fremddatei
  {
    const o = path.join(dir, 'start1')
    const { gh, aufrufe } = baueGh({
      listen: dateien([[L1, 'modified'], [L2, 'added'], ['tools/mutationen/ohne.json', 'added'], ['tools/mutationen/weg.json', 'removed'], ['tools/mutationen/fehlt.json', 'added'], ['tools/x.mjs', 'added']]),
      inhalte: { [L1]: mit, [L2]: mit, 'tools/mutationen/ohne.json': ohne },
      kaputt: { 'tools/mutationen/fehlt.json': true },
    })
    const s = starte({ ...stuetz, ordner: o, gh })
    assert.deepEqual(s.gestartet, [L1, L2])
    assert.deepEqual(s.uebersprungen.map((u) => u.liste), ['tools/mutationen/ohne.json', 'tools/mutationen/fehlt.json'])
    assert.match(s.uebersprungen[1].grund, /^Liste nicht abrufbar \(HTTP 404 tools\/mutationen\/fehlt\.json\)$/, 'nur die erste Fehlerzeile')
    const dispatch = aufrufe.filter((a) => a[0] === 'workflow')
    assert.deepEqual(dispatch[0], ['workflow', 'run', 'mutationsprobe.yml', '--repo', 'o/r', '--ref', 'main', '-f', 'zweig=fix/x', '-f', `kopf=${KOPF}`, '-f', `liste=${L1}`, '-f', 'pr=12'])
    assert.equal(dispatch.length, 2)
    assert.ok(aufrufe.filter((a) => a[0] === 'api' && a[3]?.includes('contents')).every((a) => a.at(-1).endsWith(`?ref=${KOPF}`)), 'Liste wird am Kopf gelesen, nicht am Zweig')
    assert.equal(JSON.parse(fs.readFileSync(path.join(o, 'mutationsprobe-start.json'), 'utf8')).t0, 1000)
    assert.equal(starte({ ...stuetz, ordner: path.join(dir, 'start-ref'), gh, ref: 'feat/y' }) && aufrufe.filter((a) => a[0] === 'workflow').at(-1)[6], 'feat/y', 'ref ist einstellbar')
  }

  // Obergrenze: fünf starten, der Rest steht mit Grund da; mehrere Seiten der API ("][" zwischen den Seiten)
  {
    const namen = Array.from({ length: 7 }, (_, i) => `tools/mutationen/l${i}.json`)
    const inhalte = Object.fromEntries(namen.map((n) => [n, mit]))
    const seiten = dateien(namen.slice(0, 4).map((n) => [n, 'added'])) + dateien(namen.slice(4).map((n) => [n, 'added']))
    const { gh, aufrufe } = baueGh({ listen: seiten, inhalte })
    const s = starte({ ...stuetz, ordner: path.join(dir, 'start2'), gh })
    assert.equal(s.gestartet.length, 5)
    assert.deepEqual(s.uebersprungen.map((u) => u.liste), namen.slice(5))
    assert.match(s.uebersprungen[0].grund, /^Obergrenze 5 Listen/)
    assert.equal(aufrufe.filter((a) => a[0] === 'workflow').length, 5)
  }

  // Dispatch scheitert (422): übersprungen mit Grund, nächste Liste läuft trotzdem
  {
    const { gh } = baueGh({ listen: dateien([[L1, 'added'], [L2, 'added']]), inhalte: { [L1]: mit, [L2]: mit }, kaputt: { dispatch: `liste=${L1}` } })
    const s = starte({ ...stuetz, ordner: path.join(dir, 'start3'), gh })
    assert.deepEqual(s.gestartet, [L2])
    assert.match(s.uebersprungen[0].grund, /^Lauf nicht gestartet \(HTTP 422\)$/)
  }

  // Keine Liste im Diff: nichts gestartet, Stand trotzdem geschrieben, Warten endet sofort ohne gh-Aufruf zu Läufen
  {
    const o = path.join(dir, 'start4')
    const { gh, aufrufe } = baueGh({ listen: dateien([['a.ts', 'modified']]), inhalte: {} })
    starte({ ...stuetz, ordner: o, gh })
    let schlaf = 0
    const text = await warte({ ordner: o, repo: 'o/r', gh, jetzt: () => 1000, schlafen: async () => { schlaf++ }, hole: () => '' })
    assert.equal(schlaf, 0)
    assert.equal(aufrufe.filter((a) => a[0] === 'run').length, 0)
    assert.equal(text, `Mutationsprobe zum Kopf ${KOPF} (Prüfstufe 2, Mutantenliste im Diff)\n`)
  }

  // Warten: läuft zweimal, dann fertig; die Tabelle kommt hinter den Hinweis; Datei liegt im Ordner
  {
    const o = path.join(dir, 'warte1')
    const titel = `Mutationsprobe ${L1} @ ${KOPF}`
    const { gh, aufrufe } = baueGh({
      listen: dateien([[L1, 'added']]),
      inhalte: { [L1]: mit },
      laeufe: (n) => [lauf(1, `Mutationsprobe ${L1} @ ${ALT}`, { conclusion: 'failure' }), n < 3 ? lauf(2, titel, { status: 'in_progress', conclusion: '' }) : lauf(2, titel, { conclusion: 'failure' })],
    })
    starte({ ...stuetz, ordner: o, gh })
    let jetzt = 1000
    const schlafe = []
    const text = await warte({ ordner: o, repo: 'o/r', gh, jetzt: () => jetzt, schlafen: async (ms) => { schlafe.push(ms); jetzt += ms }, hole: (id) => `Tabelle von ${id}` })
    assert.deepEqual(schlafe, [15000, 15000], 'wartet im 15-s-Takt bis zum Ende des Laufs')
    assert.equal(aufrufe.filter((a) => a[0] === 'run').length, 3)
    assert.ok(text.includes(`- ${L1}: Lauf failure`) && text.includes('Tabelle von 2'), text)
    assert.equal(fs.readFileSync(path.join(o, 'mutationsprobe.txt'), 'utf8'), text)
  }

  // Frist: ein Lauf, der nie endet, wird nach genau 480 s (32 Takte) als „läuft noch“ gemeldet; kein Fehler
  {
    const o = path.join(dir, 'warte2')
    const { gh } = baueGh({ listen: dateien([[L1, 'added']]), inhalte: { [L1]: mit }, laeufe: () => [lauf(5, `Mutationsprobe ${L1} @ ${KOPF}`, { status: 'in_progress', conclusion: '' })] })
    starte({ ...stuetz, ordner: o, gh })
    let jetzt = 1000
    let takte = 0
    const text = await warte({ ordner: o, repo: 'o/r', gh, jetzt: () => jetzt, schlafen: async (ms) => { takte++; jetzt += ms }, hole: () => 'TABELLE' })
    assert.equal(takte, 32)
    assert.match(text, /nicht beurteilt: Lauf läuft noch \(in_progress\)/)
    assert.ok(!text.includes('TABELLE'), 'für einen offenen Lauf wird kein Ergebnis geholt')
    // Kettenlog hat die Frist schon verbraucht (Uhr bei t0 + 480 s): kein Takt mehr, aber ein Urteil aus einer einzigen Abfrage
    takte = 0
    jetzt = 1000 + 480_000
    await warte({ ordner: o, repo: 'o/r', gh, jetzt: () => jetzt, schlafen: async () => { takte++ }, hole: () => '' })
    assert.equal(takte, 0)
    jetzt = 1000 + 479_999
    await warte({ ordner: o, repo: 'o/r', gh, jetzt: () => jetzt, schlafen: async () => { takte++; jetzt += 15_000 }, hole: () => '' })
    assert.equal(takte, 1, 'eine Millisekunde vor der Frist gibt es noch einen Takt')
  }

  // Lauf nie gefunden: „nicht beurteilt“, Datei trotzdem da
  {
    const o = path.join(dir, 'warte3')
    const { gh } = baueGh({ listen: dateien([[L1, 'added']]), inhalte: { [L1]: mit }, laeufe: () => [] })
    starte({ ...stuetz, ordner: o, gh })
    let jetzt = 1000
    const text = await warte({ ordner: o, repo: 'o/r', gh, jetzt: () => jetzt, schlafen: async (ms) => { jetzt += ms }, hole: () => '' })
    assert.match(text, /nicht beurteilt: Lauf nicht gefunden/)
  }

  // --- Prozess: ohne gültige Eingabe immer Exit 0 (fail-soft), nie ein Aufruf nach außen ---
  const lauf2 = (args, env = {}) => spawnMitLimit(process.execPath, [path.join(import.meta.dirname, 'mutationsprobe-pr.mjs'), ...args], { encoding: 'utf8', windowsHide: true, env: { ...process.env, GITHUB_REPOSITORY: 'o/r', ...env } })
  const ohneArgs = lauf2([])
  assert.equal(ohneArgs.status, 0)
  assert.match(ohneArgs.stdout, /^Aufruf: start/)
  const schlecht = lauf2(['start', '12; rm', KOPF, 'z', path.join(dir, 'p1')])
  assert.equal(schlecht.status, 0)
  assert.match(schlecht.stdout, /Eingabe unbrauchbar/)
  assert.ok(!fs.existsSync(path.join(dir, 'p1')), 'bei unbrauchbarer Eingabe entsteht kein Stand')
  const kurz = lauf2(['start', '12', 'abc', 'z', path.join(dir, 'p2')])
  assert.match(kurz.stdout, /Eingabe unbrauchbar/)
  // Kaputter Start-Stand wirft im Lauf: Meldung, Exit trotzdem 0 (der Prüfer läuft ohne Datei weiter)
  fs.mkdirSync(path.join(dir, 'p4'))
  fs.writeFileSync(path.join(dir, 'p4', 'mutationsprobe-start.json'), '{kaputt')
  const kaputt = lauf2(['warte', path.join(dir, 'p4')])
  assert.equal(kaputt.status, 0)
  assert.match(kaputt.stdout, /^mutationsprobe-pr: Fehler /)
  const keinStand = lauf2(['warte', path.join(dir, 'p3')])
  assert.equal(keinStand.status, 0)
  assert.match(keinStand.stdout, /kein Start-Stand/)
} finally {
  fs.rmSync(dir, { recursive: true, force: true })
}
console.log('mutationsprobe-pr.test: ok (Entscheidungen, Start mit 6 Fällen, Warten mit fester Uhr an der Frist, Prozess fail-soft)')
