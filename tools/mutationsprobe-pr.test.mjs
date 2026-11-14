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
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L1} @ ${KOPF}`), lauf(3, `Mutationsprobe ${L1} @ ${KOPF}`), lauf(2, `Mutationsprobe ${L1} @ ${KOPF}`)], KOPF, L1, 0).databaseId, 3, 'neuester')
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L1} @ ${ALT}`)], KOPF, L1, 0), null, 'anderer Kopf zählt nicht')
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L2} @ ${KOPF}`)], KOPF, L1, 0), null, 'andere Liste zählt nicht')
assert.equal(findeLauf([lauf(1, `Mutationsprobe ${L2} @ ${KOPF}`)], KOPF, L2, 0).databaseId, 1, 'die zweite Liste wird gefunden')

// A3: ein alter, fertiger Lauf mit gleichem Titel (Rerun, zweiter Prüferlauf) ist keine Antwort auf den Dispatch von jetzt.
{
  const titel = `Mutationsprobe ${L1} @ ${KOPF}`
  const seit = Date.parse('2026-11-12T10:30:00Z')
  const alt = lauf(1, titel, { createdAt: '2026-11-12T09:00:00Z' })
  const neu = lauf(2, titel, { createdAt: '2026-11-12T10:30:20Z', status: 'in_progress', conclusion: '' })
  assert.equal(findeLauf([alt, neu], KOPF, L1, seit).databaseId, 2, 'alter fertiger und neuer laufender Lauf: der neue')
  assert.equal(findeLauf([alt], KOPF, L1, seit), null, 'nur der alte, fertige Lauf: noch keine Antwort (nicht „grün“ aus dem Altlauf)')
  assert.equal(findeLauf([lauf(3, titel, { createdAt: '2026-11-12T10:29:50Z' })], KOPF, L1, seit).databaseId, 3, 'genau 10 s vor dem Start (Uhrabweichung) zählt noch')
  assert.equal(findeLauf([lauf(3, titel, { createdAt: '2026-11-12T10:29:49.999Z' })], KOPF, L1, seit), null, 'eine Millisekunde früher nicht mehr')
}

assert.match(zustandText(null), /^nicht beurteilt: Lauf nicht gefunden/)
assert.match(zustandText({ status: 'in_progress' }), /^nicht beurteilt: Lauf läuft noch \(in_progress\)/)
assert.match(zustandText({ status: 'completed', conclusion: 'success' }), /^alle Mutanten rot/)
assert.match(zustandText({ status: 'completed', conclusion: 'failure' }), /^Lauf failure: Überlebende/)
assert.match(zustandText({ status: 'completed', conclusion: '' }), /^nicht beurteilt: Lauf ohne Ergebnis/)
assert.match(zustandText({ status: 'completed', conclusion: 'cancelled' }), /^nicht beurteilt: Lauf cancelled/, 'A4: ein durch concurrency ersetzter Lauf ist kein Urteil über die Mutanten')
assert.match(zustandText({ status: 'completed', conclusion: 'timed_out' }), /^nicht beurteilt: Lauf timed_out/)

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
  const baueGh = ({ listen, inhalte, laeufe = () => [], kaputt = {}, ausfaelle = {} }) => {
    const aufrufe = []
    const gh = (args) => {
      aufrufe.push(args)
      if (args[0] === 'api' && args.some((a) => a.includes('/pulls/12/files'))) {
        if (ausfaelle.dateiliste-- > 0) throw new Error('HTTP 502 Dateiliste')
        return listen
      }
      if (args[0] === 'api') {
        const pfad = args.at(-1).replace(/^repos\/o\/r\/contents\//, '').replace(/\?ref=.*/, '')
        if (ausfaelle.inhalt-- > 0) throw new Error('HTTP 502 Inhalt')
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
  const pausen = []
  const stuetz = { pr: '12', kopf: KOPF, zweig: 'fix/x', repo: 'o/r', jetzt: () => 1000, pause: (ms) => pausen.push(ms) }

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
    assert.deepEqual(dispatch[0], ['workflow', 'run', 'mutationsprobe.yml', '--repo', 'o/r', '--ref', 'main', '-f', 'zweig=fix/x', '-f', `kopf=${KOPF}`, '-f', `liste=${L1}`])
    assert.ok(dispatch.every((a) => !a.some((x) => x.startsWith('pr='))), 'A5: der Prüfer-Dispatch trägt kein pr= (sonst postet mutationsprobe.yml einen zweiten Kommentar am PR)')
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

  // A7a: ein Aussetzer der API bei Dateiliste oder Listeninhalt wird wiederholt (3 Versuche, Pause 5 s, 10 s); erst dann ist es ein Fehler, und der steht im Bericht
  {
    const z = (ausfaelle) => {
      const { gh, aufrufe } = baueGh({ listen: dateien([[L1, 'added']]), inhalte: { [L1]: mit }, ausfaelle })
      pausen.length = 0
      const s = starte({ ...stuetz, ordner: path.join(dir, 'wdh'), gh })
      return { s, n: aufrufe.filter((a) => a[0] === 'api' && a.some((x) => x.includes('/pulls/12/files'))).length, ni: aufrufe.filter((a) => a[0] === 'api' && a.at(-1).includes('/contents/')).length }
    }
    let r = z({ dateiliste: 1 })
    assert.deepEqual([r.s.gestartet, r.n, pausen, r.s.fehler], [[L1], 2, [5000], ''], 'Dateiliste: ein Aussetzer, zweiter Versuch genügt')
    r = z({ dateiliste: 2 })
    assert.deepEqual([r.s.gestartet, r.n, pausen], [[L1], 3, [5000, 10000]], 'Dateiliste: zwei Aussetzer, dritter Versuch genügt')
    r = z({ dateiliste: 3 })
    assert.deepEqual([r.s.gestartet, r.n, pausen], [[], 3, [5000, 10000]], 'Dateiliste: drei Aussetzer, kein Start, keine vierte Anfrage')
    assert.equal(r.s.fehler, 'HTTP 502 Dateiliste')
    assert.match(baueBericht({ kopf: KOPF, ergebnisse: [], uebersprungen: [], fehler: r.s.fehler }), /- Dateiliste des PR nicht lesbar nach 3 Versuchen \(HTTP 502 Dateiliste\): Probe nicht gestartet, nicht beurteilt/)
    r = z({ inhalt: 1 })
    assert.deepEqual([r.s.gestartet, r.ni, pausen], [[L1], 2, [5000]], 'Listeninhalt: ein Aussetzer, zweiter Versuch genügt')
    r = z({ inhalt: 3 })
    assert.deepEqual([r.s.gestartet, r.ni, r.s.uebersprungen.map((u) => u.grund)], [[], 3, ['Liste nicht abrufbar (HTTP 502 Inhalt)']], 'Listeninhalt: drei Aussetzer, übersprungen mit Grund')
    // Kreislauf: der Fehler überlebt den Weg über den Stand bis in die Datei für den Prüfer
    const { gh } = baueGh({ listen: '', inhalte: {}, ausfaelle: { dateiliste: 3 } })
    starte({ ...stuetz, ordner: path.join(dir, 'wdh-kreis'), gh })
    const text = await warte({ ordner: path.join(dir, 'wdh-kreis'), repo: 'o/r', gh, jetzt: () => 1000, schlafen: async () => {}, hole: () => '' })
    assert.match(text, /Dateiliste des PR nicht lesbar/)
    assert.ok(!text.includes('Läufer (tools/mutationslaeufer.mjs)'), 'ohne gestartete Probe kein Läufer-Hinweis')
  }

  // A3 im Kreislauf: nach dem Dispatch liegt ein alter, fertiger Lauf mit gleichem Titel vor; warte wartet auf den neuen und meldet nie „grün“ aus dem Altlauf
  {
    const o = path.join(dir, 'a3')
    const titel = `Mutationsprobe ${L1} @ ${KOPF}`
    const t0 = Date.parse('2026-11-12T10:30:00Z')
    const { gh } = baueGh({
      listen: dateien([[L1, 'added']]),
      inhalte: { [L1]: mit },
      laeufe: (n) => [lauf(1, titel, { createdAt: '2026-11-12T09:00:00Z' }), ...(n >= 2 ? [lauf(2, titel, { createdAt: '2026-11-12T10:30:30Z', conclusion: 'failure' })] : [])],
    })
    starte({ ...stuetz, jetzt: () => t0, ordner: o, gh })
    let jetzt = t0
    let takte = 0
    const text = await warte({ ordner: o, repo: 'o/r', gh, jetzt: () => jetzt, schlafen: async (ms) => { takte++; jetzt += ms }, hole: (id) => `Tabelle ${id}` })
    assert.equal(takte, 1, 'erster Abruf: nur der Altlauf, also warten; zweiter Abruf: der neue Lauf')
    assert.ok(text.includes('Lauf failure') && text.includes('Tabelle 2') && !text.includes('alle Mutanten rot'), text)
    assert.ok(text.includes('Läufer (tools/mutationslaeufer.mjs) aus main'), 'A2: der Bericht nennt, woher der Läufer stammt')
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
