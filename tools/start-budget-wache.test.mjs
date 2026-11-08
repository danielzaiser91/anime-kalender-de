// Wachzeile „Start-Budget wenig Luft“: Annotation lesen, Läufe ohne build-Job überspringen, Abruffehler, Verdrahtung in der Wachphase.
// Die Annotationstexte sind wörtlich die des Deploy-Laufs 42209025225 (Abruf 06.11.2026).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { luftAusAnnotationen, startBudgetZeilen } from './start-budget-wache.mjs'

let faelle = 0
const gleich = (name, ist, soll) => {
  assert.deepEqual(ist, soll, name)
  faelle++
}

const NODE20 = { annotation_level: 'warning', message: 'Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24' }
const BUDGET = { annotation_level: 'warning', message: 'start-budget: nur noch 0.3 KB Luft (Warnung unter 3.0 KB) – Startdateien verkleinern, bevor der nächste Datenlauf die Grenze reißt' }
const HOOK = { annotation_level: 'warning', message: "React Hook useEffect has missing dependencies: 'ersetze', 'ohne', and 'staffeln'." }

// Auswahl aus den Annotationen
gleich('Warnung mit Zahl', luftAusAnnotationen([NODE20, BUDGET, HOOK]), 0.3)
gleich('ganze Zahl', luftAusAnnotationen([{ ...BUDGET, message: 'start-budget: nur noch 2 KB Luft (Warnung unter 3.0 KB)' }]), 2)
gleich('zweistellig mit Nachkomma', luftAusAnnotationen([{ ...BUDGET, message: 'start-budget: nur noch 12.5 KB Luft' }]), 12.5)
gleich('ohne Warnung: null', luftAusAnnotationen([NODE20, HOOK]), null)
gleich('leere Liste: null', luftAusAnnotationen([]), null)
gleich('Stufe notice zählt nicht', luftAusAnnotationen([{ ...BUDGET, annotation_level: 'notice' }]), null)
gleich('Text mitten in der Zeile zählt nicht', luftAusAnnotationen([{ ...BUDGET, message: 'x start-budget: nur noch 0.3 KB Luft' }]), null)
gleich('Eintrag ohne Text', luftAusAnnotationen([{}, undefined, BUDGET]), 0.3)

// Abruf: Reihenfolge, erster build-Job, übersprungene Läufe
const REPO = 'o/r'
const gh = (tabelle, log = []) => (a) => {
  log.push(a.join(' '))
  const antwort = tabelle[a.join(' ')]
  if (antwort === undefined) throw new Error(`HTTP 404: ${a.join(' ')}`)
  if (antwort instanceof Error) throw antwort
  return JSON.stringify(antwort)
}
const LISTE = 'run list --repo o/r --workflow deploy.yml --branch main --status success --limit 6 --json databaseId'
const jobs = (...j) => ({ jobs: j })
const bau = (id, conclusion = 'success') => ({ id, name: 'build', conclusion })

const log1 = []
const zeilen = startBudgetZeilen(gh({ [LISTE]: [{ databaseId: 10 }, { databaseId: 20 }], 'api repos/o/r/actions/runs/10/jobs': jobs({ id: 1, name: 'herkunft', conclusion: 'success' }, bau(2, 'skipped')), 'api repos/o/r/actions/runs/20/jobs': jobs(bau(21)), 'api repos/o/r/check-runs/21/annotations': [NODE20, BUDGET] }, log1), REPO)
gleich('Warnzeile mit Luft und Lauf', zeilen, ['WARNUNG start-budget: 0.3 KB Luft (Deploy-Lauf 20); Startdateien verkleinern, bevor der nächste Datenlauf die Grenze reißt'])
gleich('übersprungener build-Job: nächster Lauf, 4 Abrufe', log1.length, 4)
gleich('Annotation des gefundenen Jobs, nicht des übersprungenen', log1.at(-1), 'api repos/o/r/check-runs/21/annotations')

const log2 = []
gleich('Lauf mit build-Job ohne Warnung: keine Zeile, kein weiterer Lauf', startBudgetZeilen(gh({ [LISTE]: [{ databaseId: 10 }, { databaseId: 20 }], 'api repos/o/r/actions/runs/10/jobs': jobs(bau(2)), 'api repos/o/r/actions/runs/20/jobs': jobs(bau(21)), 'api repos/o/r/check-runs/2/annotations': [NODE20], 'api repos/o/r/check-runs/21/annotations': [BUDGET] }, log2), REPO), [])
gleich('nur der jüngste Lauf wird gelesen', log2.length, 3)
gleich('kein erfolgreicher build-Job: eigene Zeile', startBudgetZeilen(gh({ [LISTE]: [{ databaseId: 10 }], 'api repos/o/r/actions/runs/10/jobs': jobs(bau(2, 'failure')) }), REPO), ['START-BUDGET? kein erfolgreicher build-Job in den letzten 6 Deploy-Läufen auf main'])
gleich('keine Läufe: eigene Zeile', startBudgetZeilen(gh({ [LISTE]: [] }), REPO)[0].startsWith('START-BUDGET? '), true)
gleich('Abruffehler: nur die erste Fehlerzeile', startBudgetZeilen(gh({ [LISTE]: new Error('gh: HTTP 503\nzweite Zeile') }), REPO), ['START-BUDGET? Messung nicht lesbar: gh: HTTP 503'])
gleich('Annotationen nicht abrufbar: eigene Zeile', startBudgetZeilen(gh({ [LISTE]: [{ databaseId: 10 }], 'api repos/o/r/actions/runs/10/jobs': jobs(bau(2)) }), REPO)[0].startsWith('START-BUDGET? Messung nicht lesbar'), true)
gleich('kaputtes JSON: eigene Zeile', startBudgetZeilen(() => 'kein json', REPO)[0].startsWith('START-BUDGET? '), true)

// Verdrahtung: die Wachphase ruft die Funktion wirklich auf (Prozess mit gh-Attrappe)
const ordner = mkdtempSync(join(tmpdir(), 'start-budget-wache-'))
const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
const abruf = join(ordner, 'abruf-abgelehnt.mjs')
writeFileSync(abruf, "globalThis.fetch = async () => { throw new Error('offline') }\n")
const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
const ECHT = 'danielzaiser91/anime-kalender-de'
const starte = (daten) => {
  writeFileSync(join(ordner, 'daten.json'), JSON.stringify(daten))
  const env = { ...process.env, ATTRAPPE_LOG: join(ordner, 'log.txt'), ATTRAPPE_DATEN: join(ordner, 'daten.json'), LAUF_TOKEN: '' }
  const args = ['--import', vorlader, '--import', pathToFileURL(abruf).href, werkzeug, '--trocken', '--wurzel', ordner, '--gesundheit', join(ordner, 'fehlt.json')]
  return spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, timeout: 60_000, env })
}
const kette = (annotationen) => ({
  [`run list --repo ${ECHT} --workflow deploy.yml --branch main --status success --limit 6 --json databaseId`]: { aus: JSON.stringify([{ databaseId: 77 }]) },
  [`api repos/${ECHT}/actions/runs/77/jobs`]: { aus: JSON.stringify(jobs(bau(78))) },
  [`api repos/${ECHT}/check-runs/78/annotations`]: { aus: JSON.stringify(annotationen) },
})
const warnt = starte(kette([BUDGET]))
gleich('Prozess: Warnzeile steht in der Ausgabe der Wachphase', /^WARNUNG start-budget: 0\.3 KB Luft \(Deploy-Lauf 77\)/m.test(warnt.stdout), true)
const ruhig = starte(kette([NODE20]))
gleich('Prozess: ohne Budget-Warnung keine Zeile', /WARNUNG start-budget|^START-BUDGET/m.test(ruhig.stdout), false)
const kaputt = starte({})
gleich('Prozess: Abruffehler als START-BUDGET?-Zeile', /^START-BUDGET\? Messung nicht lesbar/m.test(kaputt.stdout), true)
rmSync(ordner, { recursive: true, force: true })

console.log(`start-budget-wache: ${faelle} Fälle grün (Annotation, Läufe ohne build-Job, Abruffehler, Prozess in der Wachphase)`)
