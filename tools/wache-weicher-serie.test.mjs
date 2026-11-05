// Weicher Schritt scheitert Lauf um Lauf: ein/zwei Fehlschläge bleiben still, der dritte in Folge gibt ALARM.
// Dazu Reihe (Länge, Rot, Alter), Schnittmenge, Zwischenspeicher, Abruffehler und laeufe-aufraeumen als Prozess.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stapelVon } from './wache-weicher-schritt.mjs'
import { gemeinsame, reihe, schluesselVon, serienWache, serienZeilen } from './wache-weicher-serie.mjs'

const JETZT = Date.parse('2026-11-05T12:00:00Z')
const TAG = 86_400_000
const iso = (ms) => new Date(ms).toISOString()
const lauf = (id, conclusion = 'success', alt = TAG) => ({ databaseId: id, conclusion, createdAt: iso(JETZT - alt), url: `https://github.com/x/actions/runs/${id}` })
const job = (name, ...schritte) => ({ id: 1, name, conclusion: 'success', steps: schritte.map(([n, c]) => ({ name: n, conclusion: c })) })
const ROT = [['Laufende Serien holen', 'failure']]
const GUT = [['Laufende Serien holen', 'success']]

// gh-Kulisse: `laeufe` (neueste zuerst) und je Lauf-ID die Jobs-Antwort.
function kulisse(laeufe, jobsJe, ausfaelle = {}) {
  const aufrufe = []
  const versuche = {}
  const gh = (...a) => {
    const k = a.join(' ')
    aufrufe.push(k)
    for (const [stueck, n] of Object.entries(ausfaelle)) if (k.includes(stueck) && (versuche[stueck] = (versuche[stueck] ?? 0) + 1) <= n) throw new Error('gh: Server Error (HTTP 502)\nzweite Zeile')
    if (k.startsWith('run list')) {
      assert.match(k, /--workflow \S+ --branch main --status completed --limit 3 /, 'die letzten drei fertigen Läufe auf main')
      return JSON.stringify(laeufe)
    }
    const m = k.match(/runs\/(\d+)\/jobs\?per_page=100$/)
    if (m && jobsJe[m[1]]) return JSON.stringify({ jobs: jobsJe[m[1]] })
    throw new Error(`gh unerwartet: ${k}`)
  }
  return { gh, aufrufe }
}
const wegwerf = mkdtempSync(join(tmpdir(), 'weicher-serie-'))
let zaehler = 0
const speicher = () => join(wegwerf, `s-${++zaehler}.json`)
const drei = [lauf(3), lauf(2), lauf(1)]
const jobsJe = (a, b, c) => ({ 3: [job('adn', ...a)], 2: [job('adn', ...b)], 1: [job('adn', ...c)] })
const z = (laeufe, je, datei = speicher()) => serienZeilen(stapelVon(kulisse(laeufe, je).gh), 'x/y', ['adn-laufende.yml'], JETZT, datei)
const ALARM = 'ALARM adn-laufende.yml / adn / Laufende Serien holen: 3 Läufe in Folge fehlgeschlagen, jüngster https://github.com/x/actions/runs/3'

try {
  // Kern: ein und zwei Fehlschläge bleiben gelb, der dritte in Folge ist ALARM.
  assert.deepEqual(z(drei, jobsJe(ROT, GUT, GUT)), [], 'ein Fehlschlag')
  assert.deepEqual(z(drei, jobsJe(ROT, ROT, GUT)), [], 'zwei Fehlschläge')
  assert.deepEqual(z(drei, jobsJe(ROT, ROT, ROT)), [ALARM], 'drei in Folge')
  assert.deepEqual(z(drei, jobsJe(ROT, GUT, ROT)), [], 'unterbrochen: die Reihe zählt nur lückenlos')
  assert.deepEqual(z(drei, jobsJe(GUT, ROT, ROT)), [], 'jüngster Lauf gelungen: Entwarnung')
  // Reihe: zu wenig Läufe, roter Lauf, zu alt (Grenze genau 14 Tage).
  assert.deepEqual(z(drei.slice(0, 2), jobsJe(ROT, ROT, ROT)), [], 'nur zwei Läufe')
  assert.deepEqual(z([lauf(3), lauf(2, 'failure'), lauf(1)], jobsJe(ROT, ROT, ROT)), [], 'roter Lauf bricht die Reihe ab')
  assert.deepEqual(z([lauf(3, 'cancelled'), lauf(2), lauf(1)], jobsJe(ROT, ROT, ROT)), [], 'abgebrochener Lauf ist kein Erfolg')
  assert.equal(z([lauf(3, 'success', 14 * TAG), lauf(2), lauf(1)], jobsJe(ROT, ROT, ROT)).length, 1, '14 Tage zählen noch')
  assert.deepEqual(z([lauf(3, 'success', 14 * TAG + 5000), lauf(2), lauf(1)], jobsJe(ROT, ROT, ROT)), [], 'älter als 14 Tage')
  assert.equal(reihe([], JETZT), undefined)
  assert.equal(reihe(undefined, JETZT), undefined)
  assert.equal(reihe([...drei, lauf(0)], JETZT).length, 3, 'nur die jüngsten drei')
  // Schnittmenge: gleicher Name in anderem Job oder anderer Name im selben Job zählt nicht; mehrere Schritte je einzeln.
  const anders = { 3: [job('adn', ...ROT)], 2: [job('adn', ...ROT)], 1: [job('news', ...ROT)] }
  assert.deepEqual(z(drei, anders), [], 'anderer Job im ältesten Lauf')
  const zweiSchritte = [['A', 'failure'], ['B', 'failure']]
  const eineVonZwei = { 3: [job('adn', ...zweiSchritte)], 2: [job('adn', ...zweiSchritte)], 1: [job('adn', ['A', 'failure'], ['B', 'success'])] }
  assert.deepEqual(z(drei, eineVonZwei), [ALARM.replace('Laufende Serien holen', 'A')], 'nur A scheitert in allen drei')
  assert.deepEqual(gemeinsame([['a', 'a', 'b'], ['a', 'b'], ['b', 'a']]), ['a', 'b'])
  assert.deepEqual(gemeinsame([]), [])
  assert.deepEqual(gemeinsame([[], ['a']]), [])
  assert.deepEqual(schluesselVon({ jobs: [job('adn', ...ROT)] }), ['adn / Laufende Serien holen'])
  // Mehrere Workflows: jeder einzeln.
  const zwei = serienZeilen(stapelVon(kulisse(drei, jobsJe(ROT, ROT, ROT)).gh), 'x/y', ['a.yml', 'b.yml'], JETZT, speicher())
  assert.deepEqual(zwei.map((l) => l.split(' ')[1]), ['a.yml', 'b.yml'])

  // Zwischenspeicher: warm nur die Liste; neue Lauf-ID wird abgerufen; kaputte Datei kostet nur Abrufe.
  const sp = speicher()
  const k1 = kulisse(drei, jobsJe(ROT, ROT, ROT))
  assert.deepEqual(serienZeilen(stapelVon(k1.gh), 'x/y', ['adn-laufende.yml'], JETZT, sp), [ALARM])
  assert.equal(k1.aufrufe.length, 4, 'kalt: Liste, drei Jobs-Abrufe')
  const k2 = kulisse(drei, {})
  assert.deepEqual(serienZeilen(stapelVon(k2.gh), 'x/y', ['adn-laufende.yml'], JETZT, sp), [ALARM], 'aus dem Speicher')
  assert.equal(k2.aufrufe.length, 1)
  const k3 = kulisse([lauf(4), lauf(3), lauf(2)], { 4: [job('adn', ...GUT)] })
  assert.deepEqual(serienZeilen(stapelVon(k3.gh), 'x/y', ['adn-laufende.yml'], JETZT, sp), [], 'neuer gelungener Lauf beendet die Reihe')
  assert.equal(k3.aufrufe.length, 2, 'nur der neue Lauf wird abgerufen')
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(sp, 'utf8'))).sort(), ['2', '3', '4'], 'Speicher hält nur die aktuelle Reihe')

  // Abruffehler: Sammelzeile statt Schweigen, kein ALARM auf Verdacht; genau eine Wiederholung.
  const aus = kulisse(drei, jobsJe(ROT, ROT, ROT), { 'runs/2/jobs': Infinity })
  const zeilen = serienZeilen(stapelVon(aus.gh), 'x/y', ['adn-laufende.yml'], JETZT, speicher())
  assert.deepEqual(zeilen, ['SERIE? Serienprüfung unvollständig: 1 Abrufe gescheitert, erster Grund: gh: Server Error (HTTP 502)'])
  assert.equal(aus.aufrufe.filter((a) => a.includes('runs/2/jobs')).length, 2)
  const einmal = kulisse(drei, jobsJe(ROT, ROT, ROT), { 'runs/2/jobs': 1, 'run list': 1 })
  assert.deepEqual(serienZeilen(stapelVon(einmal.gh), 'x/y', ['adn-laufende.yml'], JETZT, speicher()), [ALARM], 'einmal 502 wird wiederholt')
  const listeAus = serienZeilen(stapelVon(kulisse(drei, {}, { 'run list': Infinity }).gh), 'x/y', ['adn-laufende.yml'], JETZT, speicher())
  assert.match(listeAus[0], /^SERIE?\? Serienprüfung unvollständig/)
  assert.deepEqual(serienWache(stapelVon(kulisse(drei, {}).gh), 'x/y', join(wegwerf, 'fehlt'), JETZT, speicher()), [], 'fehlender Workflow-Ordner: Sache der Weich-Wache')

  // Verdrahtung: laeufe-aufraeumen --trocken gegen die Kulisse; Speicherort per Kommandozeile.
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const stubCode =
    'import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";' +
    'cp.execFileSync=(c,a,o)=>{const t=JSON.parse(process.env.GH_KULISSE);' +
    'if(o&&o.input)return JSON.stringify(JSON.parse(o.input).map((x)=>{const k=x.join(" ");for(const m of Object.keys(t))if(k.includes(m))return{ok:true,aus:t[m]};return{ok:false,fehler:"gh: "+k}}));' +
    'throw new Error("gh weg")};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})'
  const fahre = (je, cache) => {
    const tabelle = { '--workflow adn-laufende.yml': JSON.stringify([lauf(3, 'success', 0), lauf(2), lauf(1)].map((l) => ({ ...l, createdAt: '2999-12-31T00:00:00Z' }))) }
    for (const [id, jobs] of Object.entries(je)) tabelle[`runs/${id}/jobs`] = JSON.stringify({ jobs })
    return spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(stubCode)}`, aufraeumen, '--trocken', '--weich-speicher', join(wegwerf, cache)], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      env: { ...process.env, LAUF_TOKEN: '', GH_KULISSE: JSON.stringify(tabelle) },
    })
  }
  const rot3 = fahre(jobsJe(ROT, ROT, ROT), 'p1.json')
  assert.match(rot3.stdout, /^WACHE /m, `der Prozess lief bis zur Wache: ${rot3.stderr}`)
  assert.match(rot3.stdout, /^ALARM adn-laufende\.yml \/ adn \/ Laufende Serien holen: 3 Läufe in Folge fehlgeschlagen, jüngster /m, rot3.stdout)
  const rot2 = fahre(jobsJe(ROT, ROT, GUT), 'p2.json')
  assert.match(rot2.stdout, /^WACHE /m, rot2.stderr)
  assert.doesNotMatch(rot2.stdout, /^ALARM adn-laufende/m, 'zwei in Folge: kein ALARM')
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('wache-weicher-serie: ok (1 und 2 Fehlschläge still, 3 in Folge ALARM, Reihe/Rot/Alter, Schnittmenge, Speicher, Abruffehler, laeufe-aufraeumen als Prozess)')
