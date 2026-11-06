// Auflage-Quelle Startbudget im Kettenlog: Tabellentest der Auswertung und der Weg durch baueDateien (kettenlog.txt) samt Prüfer-Regel.
// Die Warnzeile ist wörtlich die Ausgabe von tools/start-budget.mjs (bewerte mit Grenze 187,4 KB, 06.11.2026) mit Job-Log-Präfix.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { budgetHinweise } from './pr-kettenlog-budget.mjs'
import { baueDateien } from './pr-kettenlog.mjs'

const WARN = '2026-11-06T16:17:39.9903803Z ##[warning]start-budget: nur noch 2.3 KB Luft (Warnung unter 3.0 KB) – Startdateien verkleinern, bevor der nächste Datenlauf die Grenze reißt'
const MESS = '2026-11-06T16:17:39.9903758Z start-budget: 185.1 KB gzip von 187.4 KB, 2.3 KB Luft (Code und Daten 185.1 KB)'
const job = (name, log, status = 'completed') => ({ id: 1, name, status, conclusion: 'success', log })
const SHA = 'cc5f0a969037601701855016bba3acb43d4e062e'
const lauf = { id: 9, status: 'completed', conclusion: 'success' }

let faelle = 0
const gleich = (name, ist, soll) => {
  assert.deepEqual(ist, soll, name)
  faelle++
}
const zeilen = (j) => String(j.log).split('\n')
const name = (n) => n

const HINWEIS = 'AUFLAGE-QUELLE start-budget: Job „PR-Aussehen“ meldet nur noch 2.3 KB Luft (Warnung unter 3.0 KB). Berührt der PR web/ oder Startdaten: Auflage, Startdateien verkleinern.'
gleich('Warnstufe im Job-Log: eine Zeile mit Job-Namen', budgetHinweise([job('PR-Aussehen', `${MESS}\n${WARN}`)], zeilen, name), [HINWEIS])
gleich('nur die Messzeile (genug Luft): nichts', budgetHinweise([job('PR-Aussehen', MESS)], zeilen, name), [])
gleich('Warnstufe als rohes ::warning::', budgetHinweise([job('A', '::warning::start-budget: nur noch 0.4 KB Luft (Warnung unter 3.0 KB)')], zeilen, name).length, 1)
gleich('laufender Job zählt nicht', budgetHinweise([job('PR-Aussehen', WARN, 'in_progress')], zeilen, name), [])
gleich('zwei Jobs mit Warnung: eine Zeile je Job', budgetHinweise([job('A', WARN), job('B', 'nichts'), job('C', WARN)], zeilen, name).length, 2)
gleich('leere Jobliste', budgetHinweise([], zeilen, name), [])
gleich('Name wird über den Bereiniger geführt', budgetHinweise([job('X', WARN)], zeilen, (n) => n.toLowerCase())[0].includes('„x“'), true)

// Weg bis in die Datei, die der Prüfer liest
const d = baueDateien({ kopf: SHA, lauf, jobs: [job('PR-Aussehen', `${MESS}\n${WARN}`)] })
gleich('kettenlog.txt trägt die Auflage-Quelle', d.uebersicht.includes(HINWEIS), true)
gleich('Auflage-Quelle steht über den Job-Abschnitten', d.uebersicht.indexOf(HINWEIS) < d.uebersicht.indexOf('=== PR-Aussehen'), true)
gleich('ohne Warnstufe keine Auflage-Quelle', baueDateien({ kopf: SHA, lauf, jobs: [job('PR-Aussehen', MESS)] }).uebersicht.includes('AUFLAGE-QUELLE'), false)
gleich('Job-Name mit Steuerzeichen bleibt einzeilig', baueDateien({ kopf: SHA, lauf, jobs: [job('A\nB', WARN)] }).uebersicht.includes('„A B“'), true)

// Prüfer-Regel steht im Prüfer-Text
const pruefer = readFileSync(new URL('./claude-global/agents/pruefer.md', import.meta.url), 'utf8')
gleich('pruefer.md nennt Zeile, Bedingung und Auflage', ['AUFLAGE-QUELLE start-budget', 'web/', 'Startdaten', 'Auflage'].every((s) => pruefer.includes(s)), true)

console.log(`pr-kettenlog-budget: ${faelle} Fälle grün (Warnstufe je Job, Messzeile allein, laufender Job, baueDateien, Prüfer-Text)`)
