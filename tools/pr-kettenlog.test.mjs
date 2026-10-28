/** Tests für tools/pr-kettenlog.mjs: Filter echter Logzeilen, Kopf (kein/unfertiger Lauf), Warteschleife, gh-Aufrufe, Dateien, Verdrahtung. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import {
  HINWEIS, JE_JOB_ERGEBNIS, LOG_VERSUCHE, baueDateien, bereinige, ergebniszeilen, ermittleLauf, holeJobs, holeLauf, kopfZeilen, mitLogs, schreibeKettenlog,
} from './pr-kettenlog.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
const gleich = (name, ist, soll) => pruefe(name, JSON.stringify(ist) === JSON.stringify(soll), { ist, soll })

const SHA = 'cc5f0a969037601701855016bba3acb43d4e062e'
// Echter Ausschnitt aus dem Job "Kette – Logik" (Lauf 40671805293, Kopf cc5f0a969): BOM, Zeitstempel, Gruppen, Befehle, Wächterzeilen.
const ECHT = [
  '﻿2026-10-28T10:24:05.0857656Z Current runner version: \'2.338.0\'',
  '2026-10-28T10:24:06.0142340Z ##[group]Getting Git version info',
  '2026-10-28T10:24:06.0145279Z [command]/usr/bin/git version',
  '2026-10-28T10:24:06.0155638Z ##[endgroup]',
  '2026-10-28T10:24:41.9058210Z ',
  '2026-10-28T10:25:37.6724080Z   ✓ Reihe ganz erschienen: eine Kachel mit Staffel 1 und beiden Mitgliedern',
  '2026-10-28T10:25:37.6724996Z Datenbank-Kacheln: alles in Ordnung.',
  '2026-10-28T10:25:37.6725761Z [check:logic 87/377] pipeline/check-detektiv-funde.ts',
  '2026-10-28T10:28:49.7574572Z quittung-nach-commit-waechter: ok',
  '2026-10-28T10:28:49.7576770Z sammler-pruefschritt-waechter: ok (31 Workflows, App-Token nur in den Jobs aus tools/app-token-sperre.mjs)',
  '2026-10-28T10:29:00.8279857Z check:logic: 377 von 377 Prüfungen grün.',
].join('\r\n')

// Bereinigung
const sauber = bereinige(ECHT)
gleich('Zeitstempel, BOM, [command], Gruppen, Leerzeilen und CR fallen weg', sauber, [
  "Current runner version: '2.338.0'",
  '  ✓ Reihe ganz erschienen: eine Kachel mit Staffel 1 und beiden Mitgliedern',
  'Datenbank-Kacheln: alles in Ordnung.',
  '[check:logic 87/377] pipeline/check-detektiv-funde.ts',
  'quittung-nach-commit-waechter: ok',
  'sammler-pruefschritt-waechter: ok (31 Workflows, App-Token nur in den Jobs aus tools/app-token-sperre.mjs)',
  'check:logic: 377 von 377 Prüfungen grün.',
])
pruefe('ANSI-Farben fallen weg', bereinige('\u001b[31mrot\u001b[0m')[0] === 'rot')
pruefe('lange Zeile wird gekürzt', bereinige('x'.repeat(5000))[0].length < 400)

// Ergebniszeilen
gleich('Ergebniszeilen: Schlusszeilen ja, ✓-Einzelfälle und Fortschrittszeile nein', ergebniszeilen(sauber), [
  'Datenbank-Kacheln: alles in Ordnung.',
  'quittung-nach-commit-waechter: ok',
  'sammler-pruefschritt-waechter: ok (31 Workflows, App-Token nur in den Jobs aus tools/app-token-sperre.mjs)',
  'check:logic: 377 von 377 Prüfungen grün.',
])
gleich('doppelte Zeile nur einmal', ergebniszeilen(['a: ok', 'a: ok']), ['a: ok'])
const FEHLERFORMEN = ['##[error]boom', 'Process completed with exit code 2.', '✖ 2 problems', '✕ rot', '✗ rot', 'Wächter: FEHL', 'x: 3 Fehler']
const GUTFORMEN = ['a: ok', 'a: grün', 'b: alles in Ordnung', 'c: 3 von 4 geprüft', 'Nur Prüfungen grün']
for (const z of [...FEHLERFORMEN, ...GUTFORMEN]) {
  pruefe(`Ergebnisform zählt: ${z}`, ergebniszeilen([z]).length === 1)
}
pruefe('gewöhnliche Zeilen zählen nicht', ergebniszeilen(['  ✓ ok', 'Das fehlt noch', 'ok']).length === 0)
for (const z of FEHLERFORMEN) {
  const g = ergebniszeilen([...Array.from({ length: 600 }, (_, i) => `w${i}: ok`), z])
  pruefe(`bei Überlauf bleibt die Fehlerform vorn: ${z}`, g.length === JE_JOB_ERGEBNIS && g[0] === z && g.at(-1) === 'w599: ok', g.slice(0, 2))
}
pruefe('mehr Fehlerzeilen als die Obergrenze: auch sie werden gekappt', ergebniszeilen(Array.from({ length: 3 * JE_JOB_ERGEBNIS }, (_, i) => `##[error]e${i}`)).length === JE_JOB_ERGEBNIS)
pruefe('genau Obergrenze: nichts fällt weg', ergebniszeilen(Array.from({ length: JE_JOB_ERGEBNIS }, (_, i) => `w${i}: ok`)).length === JE_JOB_ERGEBNIS)

// Kopf
const lauf = { id: 7, status: 'completed', conclusion: 'success' }
const job = (name, status = 'completed', conclusion = 'success', log = '') => ({ id: name.length, name, status, conclusion, log })
pruefe('kein Lauf: ausdrücklicher Satz mit Kopf', kopfZeilen({ kopf: SHA, lauf: null, jobs: [] })[0].startsWith(`Kein abgeschlossener Kettenlauf für ${SHA}`))
const unfertig = kopfZeilen({ kopf: SHA, lauf: { id: 7, status: 'in_progress', conclusion: '' }, jobs: [job('A', 'in_progress', ''), job('B')] }).join('\n')
pruefe('unfertiger Lauf: sagt NOCH NICHT ABGESCHLOSSEN und nennt den offenen Job', /NOCH NICHT ABGESCHLOSSEN/.test(unfertig) && /1 Job\(s\) liefen/.test(unfertig) && /- A: läuft noch/.test(unfertig), unfertig)
const rot = kopfZeilen({ kopf: SHA, lauf: { id: 7, status: 'completed', conclusion: 'failure' }, jobs: [job('A', 'completed', 'failure')] }).join('\n')
pruefe('roter Lauf und roter Job stehen im Kopf', /abgeschlossen \(failure\)/.test(rot) && /- A: failure/.test(rot))

// Dateien
const d = baueDateien({ kopf: SHA, lauf, jobs: [job('Kette – Logik', 'completed', 'success', ECHT), job('Offen', 'in_progress', '', 'nie lesen: ok')] })
pruefe('Übersicht zitiert die Schlusszeile', d.uebersicht.includes('check:logic: 377 von 377 Prüfungen grün.'))
pruefe('Übersicht enthält keine ✓-Einzelzeile, voll schon', !d.uebersicht.includes('✓ Reihe') && d.voll.includes('✓ Reihe'))
pruefe('Job mit Namen und Ergebnis als Abschnitt', d.uebersicht.includes('=== Kette – Logik (success) ==='))
pruefe('laufender Job: kein Abschnitt, kein Log', !d.voll.includes('nie lesen') && !d.voll.includes('=== Offen'))
const keiner = baueDateien({ kopf: SHA, lauf: null, jobs: [] })
pruefe('kein Lauf: beide Dateien sagen es', /Kein abgeschlossener Kettenlauf/.test(keiner.uebersicht) && /Kein abgeschlossener Kettenlauf/.test(keiner.voll))
pruefe('Jobname mit Steuerzeichen wird einzeilig', !baueDateien({ kopf: SHA, lauf, jobs: [job('A\nB')] }).uebersicht.includes('A\nB'))

// Warteschleife (Attrappe-Uhr)
const uhr = (start = 0) => {
  const z = { t: start, wartet: 0 }
  return { z, jetzt: () => z.t, warte: async (ms) => { z.t += ms; z.wartet++ } }
}
{
  const u = uhr()
  let n = 0
  const r = await ermittleLauf({
    holeLauf: () => ({ id: 1, status: ++n < 3 ? 'in_progress' : 'completed', conclusion: '' }),
    holeJobs: () => [],
    warte: u.warte,
    jetzt: u.jetzt,
    frist: 600_000,
    takt: 1000,
  })
  pruefe('wartet bis der Lauf abgeschlossen ist (2 Pausen)', r.lauf.status === 'completed' && u.z.wartet === 2, u.z)
}
{
  const u = uhr()
  const r = await ermittleLauf({ holeLauf: () => ({ id: 1, status: 'in_progress' }), holeJobs: () => [job('A')], warte: u.warte, jetzt: u.jetzt, frist: 5000, takt: 1000 })
  pruefe('Frist: gibt den unfertigen Lauf zurück, nach höchstens Frist Wartezeit', r.lauf.status === 'in_progress' && u.z.t === 5000 && r.jobs.length === 1, u.z)
}
{
  const u = uhr()
  const r = await ermittleLauf({ holeLauf: () => null, holeJobs: () => [], warte: u.warte, jetzt: u.jetzt, frist: 3000, takt: 1000 })
  pruefe('Lauf nie gefunden: null nach der Frist', r.lauf === null && u.z.wartet > 0)
  const r2 = await ermittleLauf({ holeLauf: () => null, holeJobs: () => [job('Fremd')], warte: u.warte, jetzt: u.jetzt, frist: 0, takt: 1000 })
  pruefe('ohne Lauf werden keine Jobs abgefragt', r2.jobs.length === 0)
}
{
  const u = uhr()
  let n = 0
  const r = await ermittleLauf({ holeLauf: () => { if (++n < 2) throw new Error('API'); return { id: 1, status: 'completed' } }, holeJobs: () => [], warte: u.warte, jetzt: u.jetzt, frist: 60_000, takt: 1000 })
  pruefe('API-Fehler beim Lauf wird wiederholt', r.lauf?.id === 1)
}
{
  const u = uhr()
  let n = 0
  const r = await ermittleLauf({
    holeLauf: () => ({ id: 1, status: 'completed' }),
    holeJobs: () => { if (++n < 2) throw new Error('API'); return [job('A')] },
    warte: u.warte,
    jetzt: u.jetzt,
    frist: 60_000,
    takt: 1000,
  })
  pruefe('API-Fehler bei den Jobs: wiederholt, nie ein fertiger Lauf mit leerer Jobliste', r.jobs.length === 1 && u.z.wartet === 1, u.z)
}
{
  const u = uhr()
  const r = await ermittleLauf({ holeLauf: () => ({ id: 1, status: 'completed' }), holeJobs: () => [], warte: u.warte, jetzt: u.jetzt, frist: 0, takt: 1000 })
  pruefe('Frist 0 und fertiger Lauf: sofort, ohne Pause', r.lauf.id === 1 && u.z.wartet === 0)
}

// gh-Aufrufe
const aufrufe = []
const gh = (args) => {
  aufrufe.push(args)
  const url = args.find((a) => a.startsWith('repos/')) ?? ''
  if (url.includes('/workflows/pr-pruefung.yml/runs')) return '5\tcompleted\tsuccess\n9\tcompleted\tfailure\n7\tin_progress\t\n'
  if (url.includes('/runs/9/jobs')) return '11\tKette – Logik\tcompleted\tsuccess\n12\tKette – Bau\tin_progress\t\n13\tKette – Typen\tcompleted\tfailure\n'
  if (url.includes('/jobs/11/logs')) return ECHT
  if (url.includes('/jobs/13/logs')) throw new Error('403')
  return ''
}
const l = holeLauf('o/r', SHA, gh)
pruefe('neuester Lauf = höchste Kennung, nicht der erste', l.id === 9 && l.conclusion === 'failure', l)
pruefe('Abruf filtert auf Kopf und pull_request', aufrufe[0].some((a) => a.includes(`head_sha=${SHA}`) && a.includes('event=pull_request')), aufrufe[0])
gleich('kein Lauf: null', holeLauf('o/r', SHA, () => ''), null)
const js = holeJobs('o/r', 9, gh)
pruefe('Jobs gelesen', js.length === 3 && js[1].status === 'in_progress' && js[1].conclusion === '')
const uMit = uhr()
const mit = await mitLogs('o/r', js, gh, uMit.warte)
pruefe('Log nur für abgeschlossene Jobs', mit[0].log === ECHT && mit[1].log === undefined)
pruefe('nicht abrufbares Log wird zur Fehlzeile', mit[2].log.startsWith('##[error]Log nicht abrufbar: 403'))
pruefe('nicht abrufbares Log: genau LOG_VERSUCHE Versuche mit Pause dazwischen', aufrufe.filter((a) => a.some((x) => x.includes('/jobs/13/logs'))).length === LOG_VERSUCHE && uMit.z.wartet === LOG_VERSUCHE - 1, uMit.z)
{
  let n = 0
  const spaet = (args) => { if (++n < 3) throw new Error('404'); return ECHT }
  const u2 = uhr()
  const r = await mitLogs('o/r', [{ id: 1, name: 'x', status: 'completed', conclusion: 'success' }], spaet, u2.warte)
  pruefe('Log erst im dritten Versuch da: wird übernommen', r[0].log === ECHT && n === 3, r)
}

// Gesamtlauf mit Dateien (Ordner unter os.tmpdir)
{
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'kettenlog-'))
  const u = uhr()
  const meldung = await schreibeKettenlog({ repo: 'o/r', sha: SHA, ordner, frist: 0, gh, warte: u.warte, jetzt: u.jetzt })
  const ue = fs.readFileSync(path.join(ordner, 'kettenlog.txt'), 'utf8')
  pruefe('Gesamtlauf: Übersicht mit Schlusszeile, roter Job sichtbar', ue.includes('377 von 377') && ue.includes('- Kette – Typen: failure') && ue.includes('Log nicht abrufbar'))
  const vo = fs.readFileSync(path.join(ordner, 'kettenlog-voll.txt'), 'utf8')
  pruefe('Gesamtlauf: voll hat die ✓-Zeilen, Übersicht nicht', vo.includes('✓ Reihe ganz erschienen') && !ue.includes('✓ Reihe ganz erschienen'))
  pruefe('Jobname wird auf 80 Zeichen gekürzt', !baueDateien({ kopf: SHA, lauf, jobs: [job('N'.repeat(200))] }).uebersicht.includes('N'.repeat(81)))
  pruefe('Gesamtlauf: voll-Datei da, Meldung nennt den Lauf', fs.existsSync(path.join(ordner, 'kettenlog-voll.txt')) && /Lauf 9/.test(meldung), meldung)
  const leer = fs.mkdtempSync(path.join(os.tmpdir(), 'kettenlog-'))
  await schreibeKettenlog({ repo: 'o/r', sha: SHA, ordner: leer, frist: 0, gh: () => '', warte: u.warte, jetzt: u.jetzt })
  pruefe('Gesamtlauf ohne Lauf: Datei sagt es ausdrücklich', /Kein abgeschlossener Kettenlauf/.test(fs.readFileSync(path.join(leer, 'kettenlog.txt'), 'utf8')))
  fs.rmSync(ordner, { recursive: true, force: true })
  fs.rmSync(leer, { recursive: true, force: true })
}

// Verdrahtung im Workflow (geparstes Dokument)
const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
const schritte = wf.jobs.pruefen.steps
const iLog = schritte.findIndex((s) => /pr-kettenlog\.mjs/.test(s.run ?? ''))
const iPruefer = schritte.findIndex((s) => String(s.uses ?? '').startsWith('anthropics/claude-code-action'))
pruefe('Kettenlog-Schritt steht vor dem ersten Prüfer', iLog > 0 && iLog < iPruefer, { iLog, iPruefer })
const frist = Number(/pr-kettenlog\.mjs "\$HEAD_SHA" "\$RUNNER_TEMP\/pruefer" (\d+) \|\| echo/.exec(schritte[iLog]?.run ?? '')?.[1])
pruefe('Schritt: Kopf, Ordner und Frist als Argumente, fail-soft, Token gesetzt', frist > 0 && schritte[iLog]?.env?.GH_TOKEN !== undefined, schritte[iLog])
// Die Kette braucht 4-5 min (Aussehen-Jobs länger); der Prüfer-Job hat 30 min Zeit, danach wartet noch "Check-Stand" 12 min.
pruefe('Frist: lang genug für die Kette, kurz genug für den Job', frist >= 300 && frist <= 600, frist)
pruefe('Berechtigung actions: read vorhanden, Bash im Prüfer weiter verboten', wf.permissions.actions === 'read' && schritte.filter((s) => s.with?.settings).every((s) => JSON.parse(s.with.settings).permissions.deny.includes('Bash')))
const prompts = schritte.filter((s) => s.with?.prompt).map((s) => s.with.prompt)
pruefe('alle drei Prüfer-Prompts nennen das Kettenlog', prompts.length === 3 && prompts.every((p) => p.includes('/pruefer/kettenlog.txt')), prompts.length)
pruefe('kein Prompt verlangt mehr "ohne Lesezugriff … nicht beurteilt"', !prompts.some((p) => /ohne Lesezugriff auf das\s+Log/.test(p)))
// Das Log enthält Ausgaben des PR-Codes (Injektionskanal): jeder Absatz um den Dateipfad markiert es als Daten und bindet Zeilen an den messenden Job.
const absatz = (p) => p.replace(/\s+/g, ' ').slice(p.replace(/\s+/g, ' ').indexOf('/pruefer/kettenlog.txt'), p.replace(/\s+/g, ' ').indexOf('/pruefer/kettenlog.txt') + 900)
pruefe('jeder Prompt markiert das Kettenlog als UNVERTRAUENSWÜRDIGE DATEN', prompts.every((p) => absatz(p).includes('UNVERTRAUENSWÜRDIGE DATEN')), prompts.map(absatz))
pruefe('jeder Prompt bindet eine Ergebniszeile an den Job, dessen Schritt sie misst', prompts.every((p) => absatz(p).includes('nur unter einem Job, dessen Schritt diese Messung ausführt')), prompts.map(absatz))
pruefe('jeder Prompt sagt, wann "nicht beurteilt" gilt (Datei fehlt oder meldet keinen Lauf)', prompts.every((p) => /nicht beurteilt/i.test(p.replace(/\s+/g, ' ')) && /fehlt die Datei|wenn die Datei fehlt|Fehlt die Datei/.test(p.replace(/\s+/g, ' '))))
const text = d.uebersicht + d.voll
pruefe('beide Dateien beginnen mit dem Hinweis auf unvertrauenswürdige Daten', d.uebersicht.startsWith(HINWEIS) && d.voll.startsWith(HINWEIS) && keiner.uebersicht.startsWith(HINWEIS) && text.includes('UNVERTRAUENSWÜRDIGE DATEN'))

if (fehler.length) {
  console.error(`pr-kettenlog.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-kettenlog.test: grün')
