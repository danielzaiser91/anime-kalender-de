// Wachzeile „Startbudget wird eng“: Tabellentest der Auswertung, Abrufreihenfolge, Fehlerarten und Verdrahtung in der Wachphase.
// Die Budget-Zeilen sind wörtlich die Ausgabe von tools/start-budget.mjs (bewerte mit Grenze 187,4 KB am 06.11.2026), mit Log-Präfix wie im Job-Log.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { budgetZeile, startBudgetZeilen } from './start-budget-wache.mjs'

const PRAEFIX = 'build\tBauen\t2026-11-06T16:17:39.9903758Z '
const MESS_OK = `${PRAEFIX}start-budget: 186.7 KB gzip von 190.0 KB, 3.3 KB Luft (Code und Daten 186.7 KB)`
const MESS_ENG = `${PRAEFIX}start-budget: 185.1 KB gzip von 187.4 KB, 2.3 KB Luft (Code und Daten 185.1 KB)`
const WARN = `${PRAEFIX}##[warning]start-budget: nur noch 2.3 KB Luft (Warnung unter 3.0 KB) – Startdateien verkleinern, bevor der nächste Datenlauf die Grenze reißt`
const WARN_ROH = '::warning::start-budget: nur noch 0.4 KB Luft (Warnung unter 3.0 KB) – Startdateien verkleinern'
const LOG_OK = `x\n${MESS_OK}\ny\n`
const LOG_ENG = `x\n${MESS_ENG}\n${WARN}\ny\n`

let faelle = 0
const gleich = (name, ist, soll) => {
  assert.deepEqual(ist, soll, name)
  faelle++
}

// Auswertung des Logs: genau die Warnzeile des Budget-Werkzeugs löst aus, die Messzeile allein nicht
gleich('Warnzeile im Job-Log', budgetZeile(LOG_ENG, 77), 'WARNUNG start-budget: 2.3 KB Luft (Warnung unter 3.0 KB, Deploy-Lauf 77)')
gleich('Warnzeile roh (::warning::)', budgetZeile(WARN_ROH, 5), 'WARNUNG start-budget: 0.4 KB Luft (Warnung unter 3.0 KB, Deploy-Lauf 5)')
gleich('3,3 KB Luft: Messzeile ohne Warnung', budgetZeile(LOG_OK, 77), null)
gleich('Schwelle kommt aus der Warnzeile, nicht aus der Wache', budgetZeile('start-budget: nur noch 5.0 KB Luft (Warnung unter 6.0 KB)', 1), 'WARNUNG start-budget: 5.0 KB Luft (Warnung unter 6.0 KB, Deploy-Lauf 1)')
gleich('Log ohne Budget-Zeile', budgetZeile('nichts davon', 77), undefined)
gleich('leeres Log', budgetZeile('', 77), undefined)
gleich('Zeile mit ganzer Zahl', budgetZeile('start-budget: nur noch 2 KB Luft (Warnung unter 3 KB)', 1), 'WARNUNG start-budget: 2 KB Luft (Warnung unter 3 KB, Deploy-Lauf 1)')

// Abruf: Reihenfolge und Argumente, drei verschiedene Antworten (Lauf 4711, Job 9001)
const SCHLUESSEL = {
  lauf: 'run list --repo o/r --workflow deploy.yml --branch main --status success --limit 1 --json databaseId -q .[0].databaseId',
  job: 'run view 4711 --repo o/r --json jobs -q .jobs[] | select(.name == "build") | .databaseId',
  log: 'run view 4711 --repo o/r --job 9001 --log',
}
const kulisse = (log, aufrufe = []) => (...a) => {
  aufrufe.push(a.join(' '))
  const k = a.join(' ')
  if (k === SCHLUESSEL.lauf) return '4711\n'
  if (k === SCHLUESSEL.job) return '9001\n'
  if (k === SCHLUESSEL.log) return log
  throw new Error(`unerwarteter Aufruf: ${k}`)
}
const aufrufe = []
gleich('Warnung aus dem Abruf', startBudgetZeilen(kulisse(LOG_ENG, aufrufe), 'o/r'), ['WARNUNG start-budget: 2.3 KB Luft (Warnung unter 3.0 KB, Deploy-Lauf 4711)'])
gleich('Abruf: Lauf, Job, Log in dieser Reihenfolge', aufrufe, [SCHLUESSEL.lauf, SCHLUESSEL.job, SCHLUESSEL.log])
gleich('genug Luft: keine Zeile', startBudgetZeilen(kulisse(LOG_OK), 'o/r'), [])
gleich('Log ohne Budget-Zeile: START-BUDGET?', startBudgetZeilen(kulisse('leer'), 'o/r'), ['START-BUDGET? Deploy-Lauf 4711: keine start-budget-Zeile im Bau-Log'])

// Fehlerarten: jede Nichtauskunft ist eine eigene Zeile, nie stilles Grün
gleich('kein erfolgreicher Lauf', startBudgetZeilen(() => '\n', 'o/r'), ['START-BUDGET? kein erfolgreicher Deploy-Lauf auf main gefunden'])
const ohneJob = (...a) => (a[0] === 'run' && a[1] === 'list' ? '4711' : '')
gleich('Lauf ohne Job „build“', startBudgetZeilen(ohneJob, 'o/r'), ['START-BUDGET? Deploy-Lauf 4711 hat keinen Job „build“'])
gleich('Abruffehler: nur die erste Fehlerzeile', startBudgetZeilen(() => { throw new Error('gh: HTTP 503\nzweite Zeile') }, 'o/r'), ['START-BUDGET? Bau-Log nicht lesbar: gh: HTTP 503'])
const logFehler = (...a) => (a.join(' ') === SCHLUESSEL.log ? (() => { throw new Error('Zeitlimit') })() : kulisse('')(...a))
gleich('Fehler erst beim Log', startBudgetZeilen(logFehler, 'o/r'), ['START-BUDGET? Bau-Log nicht lesbar: Zeitlimit'])

// Verdrahtung: die Wachphase ruft die Wache wirklich auf (Prozess mit gh-Attrappe, Schlüssel für repo danielzaiser91/anime-kalender-de)
const { spawnSync } = await import('node:child_process')
const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
const { pathToFileURL } = await import('node:url')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
const ordner = mkdtempSync(join(tmpdir(), 'start-budget-wache-'))
const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
const abruf = join(ordner, 'abruf-abgelehnt.mjs')
writeFileSync(abruf, "globalThis.fetch = async () => { throw new Error('offline') }\n")
const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
const R = 'danielzaiser91/anime-kalender-de'
const starte = (daten) => {
  writeFileSync(join(ordner, 'daten.json'), JSON.stringify(daten))
  const env = { ...process.env, ATTRAPPE_LOG: join(ordner, 'log.txt'), ATTRAPPE_DATEN: join(ordner, 'daten.json'), LAUF_TOKEN: '' }
  const args = ['--import', vorlader, '--import', pathToFileURL(abruf).href, werkzeug, '--trocken', '--wurzel', ordner, '--gesundheit', join(ordner, 'fehlt.json')]
  return spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, timeout: 60_000, env })
}
const daten = (log) => ({
  [SCHLUESSEL.lauf.replace('o/r', R)]: { aus: '4711\n' },
  [SCHLUESSEL.job.replace('o/r', R)]: { aus: '9001\n' },
  [SCHLUESSEL.log.replace('o/r', R)]: { aus: log },
})
const warnt = starte(daten(LOG_ENG))
gleich('Prozess: Warnzeile steht in der Ausgabe der Wachphase', /^WARNUNG start-budget: 2\.3 KB Luft \(Warnung unter 3\.0 KB, Deploy-Lauf 4711\)$/m.test(warnt.stdout), true)
const ruhig = starte(daten(LOG_OK))
gleich('Prozess: genug Luft, keine start-budget-Zeile', /^(WARNUNG start-budget|START-BUDGET)/m.test(ruhig.stdout), false)
const kaputt = starte({})
gleich('Prozess: Abruffehler als START-BUDGET?-Zeile', /^START-BUDGET\? Bau-Log nicht lesbar: /m.test(kaputt.stdout), true)
rmSync(ordner, { recursive: true, force: true })

console.log(`start-budget-wache: ${faelle} Fälle grün (Warnzeile, Schwelle aus dem Werkzeug, Abrufreihenfolge, Nichtauskunft, Prozess)`)
