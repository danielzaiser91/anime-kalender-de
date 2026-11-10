/**
 * Test für pr-pruefer-nachtrag.yml: Eine abgebrochene PR-Prüfkette (workflow_run.conclusion == cancelled) startet keinen Prüfer-Neustart.
 * Die YAML-Ausdrücke (Job-`if`, Concurrency-Gruppe) werden als Tabelle über Ereignisse ausgewertet, nicht als Text verglichen.
 * Kreislauf: Kette abgebrochen -> Kette desselben Kopfes endet -> genau ein Neustart-Lauf; ein cancelled-Ereignis verdrängt keinen
 * wartenden Neustart desselben Kopfes (eigene Gruppe). Aufruf: node tools/pr-pruefer-nachtrag-abbruch.test.mjs
 */
import fs from 'node:fs'
import { parse } from 'yaml'

const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer-nachtrag.yml', import.meta.url), 'utf8'))
const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

/** Wertet einen GitHub-Ausdruck (nur ==, !=, &&, ||, Zeichenketten, Punktpfade) gegen `github` aus; fehlende Pfade sind null. */
function werte(ausdruck, github) {
  const hol = (pfad) => pfad.split('.').slice(1).reduce((o, k) => (o == null ? null : (o[k] ?? null)), github)
  const js = ausdruck.replace(/github(\.[A-Za-z_]+)+/g, (pfad) => `hol(${JSON.stringify(pfad)})`).replace(/==/g, '===').replace(/!=/g, '!==')
  return new Function('hol', `return (${js})`)(hol)
}
/** Setzt jedes ${{ … }} einer Zeichenkette ein (Gruppe). */
const einsetzen = (text, github) => text.replace(/\$\{\{\s*(.+?)\s*\}\}/g, (_, a) => String(werte(a, github) ?? ''))

const KOPF = 'k'.repeat(40)
const kette = (conclusion, ereignis = 'pull_request') => ({ event_name: 'workflow_run', event: { workflow_run: { event: ereignis, conclusion, head_sha: KOPF } } })
const kommentar = (login = 'inhaber') => ({ event_name: 'issue_comment', event: { issue: { number: 7, pull_request: {} }, comment: { user: { login } } } })
const laeuft = (jobName, github) => werte(wf.jobs[jobName].if, github) === true

gleich('Kettenende success: nach-kette läuft', laeuft('nach-kette', kette('success')), true)
gleich('Kettenende failure: nach-kette läuft', laeuft('nach-kette', kette('failure')), true)
gleich('Kettenende cancelled: nach-kette läuft nicht', laeuft('nach-kette', kette('cancelled')), false)
gleich('Kettenende ohne Ergebnis (null): nach-kette läuft (nur cancelled ist ausgenommen)', laeuft('nach-kette', kette(null)), true)
gleich('Kettenende eines Push-Laufs: nach-kette läuft nicht', laeuft('nach-kette', kette('success', 'push')), false)
gleich('Kettenende cancelled: neustart läuft auch nicht', laeuft('neustart', kette('cancelled')), false)
gleich('Kommentar: neustart läuft, nach-kette nicht', [laeuft('neustart', kommentar()), laeuft('nach-kette', kommentar())], [true, false])
gleich('Kommentar des Prüfer-Bots: nichts', laeuft('neustart', kommentar('github-actions[bot]')), false)

const gruppe = (g) => einsetzen(wf.concurrency.group, g)
gleich('Gruppe Kommentar: PR-Nummer', gruppe(kommentar()), 'pr-pruefer-nachtrag-7')
gleich('Gruppe Kettenende success: Kopf', gruppe(kette('success')), `pr-pruefer-nachtrag-${KOPF}`)
gleich('Gruppe Kettenende failure: gleiche Gruppe wie success', gruppe(kette('failure')), gruppe(kette('success')))
gleich('Gruppe cancelled: eigene, nicht die des Kettenendes', [gruppe(kette('cancelled')) !== gruppe(kette('success')), gruppe(kette('cancelled'))], [true, `pr-pruefer-nachtrag-${KOPF}-abgebrochen`])
gleich('Concurrency verdrängt nicht: cancel-in-progress aus', wf.concurrency['cancel-in-progress'], false)

// Kreislauf je Kopf: Ereignisse in Reihenfolge; ein Lauf zählt, wenn sein Job startet. Wartend ersetzt der neuere derselben Gruppe.
function laeufeDieStarten(ereignisse) {
  const wartend = new Map()
  for (const g of ereignisse) wartend.set(gruppe(g), g)
  return [...wartend.values()].filter((g) => laeuft('nach-kette', g)).length
}
gleich('Kreislauf: Kette abgebrochen, dann Kette desselben Kopfes success: ein Neustart-Lauf', laeufeDieStarten([kette('cancelled'), kette('success')]), 1)
gleich('Kreislauf: success wartet, danach cancelled-Ereignis: der Neustart bleibt', laeufeDieStarten([kette('success'), kette('cancelled')]), 1)
gleich('Kreislauf: nur cancelled (von Hand abgebrochen, kein Nachfolger): kein Lauf, der nächste Kettenlauf holt es nach', laeufeDieStarten([kette('cancelled')]), 0)
gleich('Kreislauf: abgebrochen, success, wieder abgebrochen: weiter genau ein Lauf', laeufeDieStarten([kette('cancelled'), kette('success'), kette('cancelled')]), 1)

console.log(`Nachtrag-Abbruch: ${fehler.length === 0 ? 'alle Fälle grün' : fehler.length + ' Fälle rot'}`)
process.exit(fehler.length === 0 ? 0 : 1)
