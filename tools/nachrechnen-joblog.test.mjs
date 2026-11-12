/**
 * Tests für tools/nachrechnen-joblog.mjs über den echten Ablauf `nachrechnen` (Wiederholung bei 5xx, Rückfall auf andere Jobs,
 * Exit 2 mit klarer Meldung). Die Checkout-Zeile steht wie am echten Lauf 43094051879 (11.11.2026) in jedem Job der Kette.
 */
import { nachrechnen } from './pr-nachrechnen.mjs'
import { fehlerKurz } from './nachrechnen-joblog.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const KOPF = '7cbe813219752b923a8c8ecf0ce8d40ece1136a1'
const BASIS = '86475eec47e38577af14e9c17a243b7eac9b094f'
const ECHT = `2026-11-11T20:11:21.3095650Z HEAD is now at 55f63739 Merge ${KOPF} into ${BASIS}\n`
const PR = { number: 7, state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: KOPF, headRefName: 'fix/x' }
const JOBS = [
  { name: 'Kette – Logik', databaseId: 91, status: 'completed' },
  { name: 'Kette – Workflows', databaseId: 92, status: 'completed' },
  { name: 'Kette – Offen', databaseId: 97, status: 'in_progress' },
  { name: 'Kette – Bau', databaseId: 93, status: 'completed' },
  { name: 'Kette – Typen', databaseId: 94, status: 'completed' },
  { name: 'Kette – Daten', databaseId: 95, status: 'completed' },
  { name: 'Kette – Offen', databaseId: 96, status: 'in_progress' },
]
const E502 = 'gh: HTTP 502: Bad Gateway (https://api.github.com/repos/o/r/actions/jobs/92/logs)'

/** logs: je Job-ID eine Liste von Antworten (Text = Log, { fehler } = Wurf); die letzte bleibt. */
function lauf(logs) {
  const aufrufe = []
  const meldungen = []
  const gewartet = []
  const gh = (args) => {
    const s = args.join(' ')
    aufrufe.push(s)
    const log = /actions\/jobs\/(\d+)\/logs/.exec(s)
    if (log) {
      const liste = logs[log[1]] ?? [{ fehler: 'HTTP 404: Not Found' }]
      const n = aufrufe.filter((a) => a === s).length
      const a = liste[Math.min(n, liste.length) - 1]
      if (typeof a === 'object') throw new Error(a.fehler)
      return a
    }
    if (s.startsWith('pr view')) return JSON.stringify(PR)
    if (s.startsWith('pr list')) return '[]'
    if (s.startsWith('run list')) return JSON.stringify([{ databaseId: 12, headSha: KOPF, createdAt: '2026-11-11T20:00:00Z', conclusion: 'success', status: 'completed' }])
    if (s.startsWith('run view')) return JSON.stringify({ jobs: JOBS })
    if (s.includes('git/ref/heads/main')) return `${BASIS}\n`
    throw new Error(`unerwartet: ${s}`)
  }
  const code = nachrechnen(7, gh, (t) => meldungen.push(t), (ms) => gewartet.push(ms))
  const logAufrufe = (id) => aufrufe.filter((a) => a.includes(`/jobs/${id}/logs`)).length
  return { code, meldungen, gewartet, logAufrufe }
}
const fehl = { fehler: E502 }

{
  const r = lauf({ 92: [ECHT] })
  pruefe('Log gleich lesbar -> 0, ein Abruf, keine Pause', r.code === 0 && r.logAufrufe(92) === 1 && r.gewartet.length === 0, r)
}
{
  const r = lauf({ 92: [fehl, ECHT] })
  pruefe('502, dann 200 am Hauptjob -> 0, zwei Abrufe, eine Pause', r.code === 0 && r.logAufrufe(92) === 2 && r.gewartet.join() === '3000' && r.logAufrufe(91) === 0, r)
}
{
  const r = lauf({ 92: [fehl, fehl, ECHT] })
  pruefe('zwei 502, dritter Versuch trägt -> 0, kein Rückfall', r.code === 0 && r.logAufrufe(92) === 3 && r.logAufrufe(91) === 0 && r.gewartet.length === 2, r)
}
{
  const r = lauf({ 92: [fehl], 91: [fehl], 93: [ECHT] })
  pruefe('Hauptjob dauerhaft 502 -> Rückfall: erster Ersatzjob kaputt, zweiter trägt -> 0', r.code === 0 && r.logAufrufe(92) === 3 && r.logAufrufe(91) === 1 && r.logAufrufe(93) === 1 && r.logAufrufe(94) === 0 && r.logAufrufe(97) === 0, r)
}
{
  const r = lauf({ 92: [fehl], 91: [fehl], 93: [fehl], 94: [fehl], 95: [ECHT] })
  pruefe(`Rückfall endet nach 3 Ersatzjobs (der vierte wird nicht mehr gefragt)`, r.code === 2 && r.logAufrufe(95) === 0 && r.logAufrufe(94) === 1, r)
}
{
  const r = lauf({ 92: [fehl], 91: [fehl], 93: [fehl], 94: [fehl] })
  pruefe('alles kaputt -> 2, Meldung „Log nicht lesbar (HTTP 502), später erneut“, kein Stacktrace', r.code === 2 && r.meldungen.join() === 'PR 7: Log nicht lesbar (HTTP 502), später erneut', r)
}
{
  const r = lauf({ 92: [fehl], 91: ['Job übersprungen'], 93: [ECHT] })
  pruefe('Ersatzjob liest, aber ohne Basiszeile -> weiter zum nächsten', r.code === 0, r)
}
{
  const r = lauf({ 92: [fehl], 91: ['Job übersprungen'], 93: ['Job übersprungen'], 94: ['x'] })
  pruefe('Ersatzlogs ohne Basis, Hauptlog nie lesbar -> 2 (kein „aktuell“ aus dem Nichts)', r.code === 2 && /nicht lesbar/.test(r.meldungen.join()), r)
}
{
  const r = lauf({ 92: ['kein Treffer'] })
  pruefe('Hauptlog lesbar ohne Basiszeile -> alte Meldung, kein Rückfall', r.code === 2 && /Basis nicht im Log/.test(r.meldungen.join()) && r.logAufrufe(91) === 0, r)
}
pruefe('fehlerKurz: HTTP-Status', fehlerKurz(new Error(E502)) === 'HTTP 502')
pruefe('fehlerKurz: ohne Status die erste Zeile', fehlerKurz(new Error('Zeitüberschreitung\nzweite')) === 'Zeitüberschreitung')

if (fehler.length > 0) {
  console.error(`nachrechnen-joblog.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('nachrechnen-joblog.test: grün')
