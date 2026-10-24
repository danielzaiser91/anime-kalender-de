/** Tests für tools/pr-checks-stand.mjs: Auswertung der Check-Runs, Warteschleife mit Frist, gh-Aufrufe und Ausgabezeile. */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { bewerte, ermittleStand, holeLaeufe, holePflicht, pflichtAusRegeln, zeile } from './pr-checks-stand.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const P = ['PR-Prüfkette']
let id = 100
const lauf = (name, status, conclusion = '') => ({ id: id++, name, status, conclusion })
const fertig = (name, conclusion = 'success') => lauf(name, 'completed', conclusion)
const GRUEN = [fertig('Kette – Logik'), fertig('Kette – Workflows'), fertig('PR-Prüfkette'), lauf('Prüfer-Review', 'in_progress')]
const z = (laeufe, pflicht = P) => zeile(bewerte(laeufe, pflicht))

// Auswertung
pruefe('alles grün, eigener Lauf läuft noch -> gruen', z(GRUEN) === 'gruen', z(GRUEN))
const teilRot = [fertig('Kette – Logik'), fertig('Kette – Workflows', 'failure'), lauf('PR-Prüfkette', 'queued')]
pruefe('Teiljob rot, Pflicht-Check noch offen -> sofort rot mit Namen', z(teilRot) === 'Checks rot: Kette – Workflows', z(teilRot))
const pflichtRot = [fertig('Kette – Logik'), fertig('PR-Prüfkette', 'failure'), fertig('Kette – Workflows', 'failure')]
pruefe('Pflicht-Check rot -> rot, Namen sortiert', z(pflichtRot) === 'Checks rot: Kette – Workflows, PR-Prüfkette', z(pflichtRot))
pruefe('Pflicht-Check fehlt noch -> laeuft (fehlt)', z([fertig('Kette – Logik')]) === 'Checks laufen noch: PR-Prüfkette (fehlt)', z([fertig('Kette – Logik')]))
const offen = [lauf('Kette – Logik', 'in_progress'), lauf('PR-Prüfkette', 'queued'), fertig('Kette – Workflows'), lauf('Prüfer-Review', 'in_progress')]
pruefe('Pflicht-Check offen -> laeuft mit offenen Läufen, ohne den eigenen',
  z(offen) === 'Checks laufen noch: Kette – Logik, PR-Prüfkette', z(offen))
pruefe('Pflicht-Check übersprungen (alter Entwurfslauf) -> nicht gruen',
  z([fertig('PR-Prüfkette', 'skipped')]) === 'Checks laufen noch: PR-Prüfkette', z([fertig('PR-Prüfkette', 'skipped')]))
pruefe('Pflicht-Check neutral -> nicht gruen', bewerte([fertig('PR-Prüfkette', 'neutral')], P).zustand === 'laeuft')
pruefe('anderer Check übersprungen oder neutral -> nicht rot',
  z([fertig('PR-Aussehen – Panel', 'skipped'), fertig('X', 'neutral'), fertig('PR-Prüfkette')]) === 'gruen')
for (const c of ['cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']) {
  pruefe(`Abschluss ${c} zählt als rot`, z([fertig('PR-Prüfkette'), fertig('Y', c)]) === 'Checks rot: Y', z([fertig('PR-Prüfkette'), fertig('Y', c)]))
}
pruefe('eigener Lauf abgeschlossen rot -> zählt (nur der laufende ist ausgenommen)',
  z([fertig('PR-Prüfkette'), fertig('Prüfer-Review', 'failure')]) === 'Checks rot: Prüfer-Review')
pruefe('fremder Lauf läuft noch, Pflicht grün -> gruen', z([fertig('PR-Prüfkette'), lauf('Sonstiges', 'in_progress')]) === 'gruen')
// Wiederholte Läufe desselben Namens: es zählt der jüngste (höchste id), egal wo er in der Liste steht.
const alt = { id: 1, name: 'PR-Prüfkette', status: 'completed', conclusion: 'failure' }
const neu = { id: 3, name: 'PR-Prüfkette', status: 'completed', conclusion: 'success' }
const mitte = { id: 2, name: 'PR-Prüfkette', status: 'completed', conclusion: 'failure' }
pruefe('Wiederholung grün nach rot (jüngster in der Mitte) -> gruen', z([alt, neu, mitte]) === 'gruen', z([alt, neu, mitte]))
pruefe('Wiederholung rot nach grün -> rot', z([{ ...neu, id: 1 }, { ...alt, id: 3 }, { ...mitte, conclusion: 'success' }]) === 'Checks rot: PR-Prüfkette')
pruefe('ohne Pflicht-Checks -> unbekannt', z(GRUEN, []) === 'Checks-Stand unbekannt: keine Pflicht-Checks im Ruleset', z(GRUEN, []))
pruefe('zwei Pflicht-Checks, einer fehlt -> laeuft', z(GRUEN, ['PR-Prüfkette', 'Zweiter']) === 'Checks laufen noch: Zweiter (fehlt)')
pruefe('Name mit Zeilenumbruch wird zu einer Zeile (kein zweiter Ausgabewert)',
  z([fertig('PR-Prüfkette'), fertig('a\nstand=gruen', 'failure')]) === 'Checks rot: a stand=gruen')

// Ruleset (Form gemessen am 18.10.2026 an repos/…/rules/branches/main)
const REGELN = [
  { type: 'deletion' },
  { type: 'pull_request', parameters: { required_approving_review_count: 1 } },
  { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'PR-Prüfkette', integration_id: 15368 }] } },
  { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Zweiter' }] } },
]
pruefe('Pflicht-Checks aus allen required_status_checks-Regeln', JSON.stringify(pflichtAusRegeln(REGELN)) === '["PR-Prüfkette","Zweiter"]', pflichtAusRegeln(REGELN))
pruefe('ohne Regel keine Pflicht', pflichtAusRegeln([{ type: 'deletion' }]).length === 0)

// gh-Aufrufe: genauer Pfad und genaue Argumente
const SHA = 'c'.repeat(40)
const aufrufe = []
const gh = (args) => {
  aufrufe.push(args.join(' '))
  if (args[1] === 'repos/o/r/rules/branches/main' && args.length === 2) return JSON.stringify(REGELN)
  if (args.join(' ') === `api --paginate repos/o/r/commits/${SHA}/check-runs?per_page=100 -q .check_runs[] | [.id, .name, .status, (.conclusion // "")] | @tsv`) {
    return '7\tPR-Prüfkette\tcompleted\tsuccess\n8\tKette – Logik\tin_progress\t\n'
  }
  throw new Error('unbekannter Aufruf')
}
pruefe('holePflicht liest das Ruleset von main', JSON.stringify(holePflicht('o/r', gh)) === '["PR-Prüfkette","Zweiter"]')
const gelesen = holeLaeufe('o/r', SHA, gh)
pruefe('holeLaeufe liest die Check-Runs des Kopfes und zerlegt die Zeilen',
  JSON.stringify(gelesen) === JSON.stringify([
    { id: 7, name: 'PR-Prüfkette', status: 'completed', conclusion: 'success' },
    { id: 8, name: 'Kette – Logik', status: 'in_progress', conclusion: '' },
  ]), gelesen)
pruefe('genau zwei gh-Aufrufe', aufrufe.length === 2, aufrufe)

// Warteschleife mit fester Uhr
async function schleife(antworten, { frist = 60_000, takt = 20_000, pflicht = () => P } = {}) {
  let uhr = 0
  let pflichtAufrufe = 0
  const warten = []
  const stand = await ermittleStand({
    holePflicht: () => {
      pflichtAufrufe++
      return pflicht()
    },
    holeLaeufe: () => {
      const a = antworten.shift()
      if (a instanceof Error) throw a
      return a ?? [lauf('PR-Prüfkette', 'in_progress')]
    },
    warte: async (ms) => {
      warten.push(ms)
      uhr += ms
    },
    jetzt: () => uhr,
    frist,
    takt,
  })
  return { text: zeile(stand), warten: warten.length, pflichtAufrufe }
}
const OFFEN = [lauf('PR-Prüfkette', 'in_progress')]
const s1 = await schleife([OFFEN, OFFEN, [fertig('PR-Prüfkette')]])
pruefe('wartet, bis der Pflicht-Check grün ist (zwei Takte)', s1.text === 'gruen' && s1.warten === 2, s1)
pruefe('Ruleset wird nur einmal gelesen', s1.pflichtAufrufe === 1, s1)
const s2 = await schleife([[fertig('Kette – Workflows', 'failure'), lauf('PR-Prüfkette', 'queued')]])
pruefe('rot: kein Warten', s2.text === 'Checks rot: Kette – Workflows' && s2.warten === 0, s2)
const s3 = await schleife([], { frist: 60_000, takt: 20_000 })
pruefe('Frist 60 s, Takt 20 s: drei Takte gewartet, dann Stand zum Zeitpunkt', s3.text === 'Checks laufen noch: PR-Prüfkette' && s3.warten === 3, s3)
const s4 = await schleife([], { frist: 0 })
pruefe('Frist 0: einmal fragen, nicht warten', s4.text === 'Checks laufen noch: PR-Prüfkette' && s4.warten === 0, s4)
const s5 = await schleife([new Error('HTTP 502'), [fertig('PR-Prüfkette')]])
pruefe('API-Fehler wird wiederholt', s5.text === 'gruen' && s5.warten === 1, s5)
const s6 = await schleife([new Error('HTTP 502'), new Error('HTTP 502'), new Error('HTTP 502'), new Error('HTTP 502')])
pruefe('API-Fehler bis zur Frist -> unbekannt', s6.text === 'Checks-Stand unbekannt: API: HTTP 502', s6)
let pflichtVersuch = 0
const s7 = await schleife([[fertig('PR-Prüfkette')]], { pflicht: () => (pflichtVersuch++ ? P : (() => { throw new Error('HTTP 503') })()) })
pruefe('Ruleset-Fehler wird wiederholt', s7.text === 'gruen' && s7.pflichtAufrufe === 2, s7)
const s8 = await schleife([GRUEN], { pflicht: () => [] })
pruefe('Ruleset ohne Pflicht-Checks: sofort unbekannt, kein Warten', s8.text.startsWith('Checks-Stand unbekannt') && s8.warten === 0, s8)

// Als eigener Prozess: Ausgabezeile und Exit 0, auch ohne gh (leeres PATH) und mit falschem Kopf.
const leer = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-checks-stand-'))
try {
  const skript = fileURLToPath(new URL('./pr-checks-stand.mjs', import.meta.url))
  const env = Object.fromEntries(Object.entries(process.env).filter(([s]) => !/^(GITHUB_|GH_)/.test(s)))
  env[Object.keys(env).find((s) => s.toUpperCase() === 'PATH') ?? 'PATH'] = leer
  env.GITHUB_REPOSITORY = 'o/r'
  const prozess = (args) => spawnSync(process.execPath, [skript, ...args], { cwd: leer, env, encoding: 'utf8', windowsHide: true })
  const ohneGh = prozess([SHA, '0'])
  pruefe('Prozess ohne gh: Exit 0, eine Zeile stand=Checks-Stand unbekannt',
    ohneGh.status === 0 && /^stand=Checks-Stand unbekannt: API: .+\n$/.test(ohneGh.stdout), { status: ohneGh.status, out: ohneGh.stdout, err: ohneGh.stderr })
  const falsch = prozess(['abc', '0'])
  pruefe('Prozess mit falschem Kopf: stand=Checks-Stand unbekannt: Kopf oder Repo fehlt',
    falsch.status === 0 && falsch.stdout === 'stand=Checks-Stand unbekannt: Kopf oder Repo fehlt\n', falsch.stdout)
  pruefe('Prozess: Ergebniszeile im Log (stderr)', /^Check-Stand abc: Checks-Stand unbekannt/m.test(falsch.stderr), falsch.stderr)
} finally {
  fs.rmSync(leer, { recursive: true, force: true })
}

// Der Schritt aus pr-pruefer.yml, wie er dasteht, mit bash und gh-Attrappe (gh = Node unter dem Namen gh, das das
// Skript `api` im Arbeitsordner lädt; Windows findet nur gh.exe). Ergebnis ist der Wert, den die Freigabe als CHECKS liest.
const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
const schritte = wf.jobs.pruefen.steps
const checksSchritt = schritte.find((s) => s.id === 'checks')
const freigabe = schritte.find((s) => s.name === 'Protokoll und Freigabe')
pruefe('Freigabe liest CHECKS aus dem Check-Schritt', freigabe?.env?.CHECKS === '${{ steps.checks.outputs.stand }}', freigabe?.env)
pruefe('Check-Schritt steht nach allen drei Prüfern und direkt vor der Freigabe',
  schritte.indexOf(checksSchritt) === schritte.indexOf(freigabe) - 1
  && schritte.filter((s, i) => String(s.uses ?? '').startsWith('anthropics/') && i < schritte.indexOf(checksSchritt)).length === 3)
const API = `const fs = require('node:fs')
const a = process.argv.slice(2)
fs.appendFileSync(process.env.ATTRAPPE_LOG, JSON.stringify(a) + '\\n')
if (a.join(' ') === 'repos/o/r/rules/branches/main') process.stdout.write(process.env.ATTRAPPE_REGELN)
else if (a.join(' ') === '--paginate repos/o/r/commits/${SHA}/check-runs?per_page=100 -q .check_runs[] | [.id, .name, .status, (.conclusion // "")] | @tsv') process.stdout.write(process.env.ATTRAPPE_LAEUFE)
else process.exit(1)
`
function laufeSchritt(laeufe) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-checks-schritt-'))
  try {
    const bin = path.join(ordner, 'bin')
    const ws = path.join(ordner, 'ws')
    fs.mkdirSync(bin)
    fs.mkdirSync(path.join(ws, 'tools'), { recursive: true })
    if (process.platform === 'win32') fs.copyFileSync(process.execPath, path.join(bin, 'gh.exe'))
    else fs.symlinkSync(process.execPath, path.join(bin, 'gh'))
    fs.writeFileSync(path.join(ws, 'api'), API)
    fs.copyFileSync(fileURLToPath(new URL('./pr-checks-stand.mjs', import.meta.url)), path.join(ws, 'tools', 'pr-checks-stand.mjs'))
    const env = Object.fromEntries(Object.entries(process.env).filter(([s]) => !/^(GITHUB_|RUNNER_|GH_)/.test(s)))
    const pfad = Object.keys(env).find((s) => s.toUpperCase() === 'PATH') ?? 'PATH'
    env[pfad] = bin + path.delimiter + env[pfad]
    const ausgabe = path.join(ordner, 'ausgabe.txt')
    const log = path.join(ordner, 'aufrufe.log')
    Object.assign(env, { HEAD_SHA: SHA, GITHUB_REPOSITORY: 'o/r', GITHUB_OUTPUT: ausgabe, GH_TOKEN: 'tok', ATTRAPPE_LOG: log })
    Object.assign(env, { ATTRAPPE_REGELN: JSON.stringify(REGELN.slice(0, 3)), ATTRAPPE_LAEUFE: laeufe })
    const skript = path.join(ordner, 'schritt.sh')
    fs.writeFileSync(skript, checksSchritt.run)
    const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
    const r = spawnSync(bash, ['-e', skript], { cwd: ws, env, encoding: 'utf8', windowsHide: true, timeout: 60_000 })
    const lies = (d) => (fs.existsSync(d) ? fs.readFileSync(d, 'utf8') : '')
    return { status: r.status, ausgabe: lies(ausgabe), aufrufe: lies(log).split('\n').filter(Boolean).length, err: r.stderr }
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true })
  }
}
const schrittGruen = laufeSchritt('7\tPR-Prüfkette\tcompleted\tsuccess\n8\tPrüfer-Review\tin_progress\t\n')
pruefe('Schritt: grüne Kette -> stand=gruen in $GITHUB_OUTPUT, zwei gh-Aufrufe',
  schrittGruen.status === 0 && schrittGruen.ausgabe === 'stand=gruen\n' && schrittGruen.aufrufe === 2, schrittGruen)
const schrittRot = laufeSchritt('7\tPR-Prüfkette\tin_progress\t\n9\tKette – Workflows\tcompleted\tfailure\n')
pruefe('Schritt: roter Teiljob -> stand=Checks rot: Kette – Workflows',
  schrittRot.status === 0 && schrittRot.ausgabe === 'stand=Checks rot: Kette – Workflows\n', schrittRot)

if (fehler.length) {
  console.error(`pr-checks-stand.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-checks-stand.test: grün')
