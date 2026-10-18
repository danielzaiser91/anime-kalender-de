/**
 * Attrappe für `gh` in `untersucher-frist.test.mjs` (über GH_BIN="node|<diese Datei>"). Sie prüft Pfad und Parameter
 * (falsche Aufrufe enden mit Exit 2 und stehen im Protokoll) und liest ihre Antworten aus ATTRAPPE_ANTWORTEN (JSON-Datei).
 * Jeder Aufruf kommt als Zeile in ATTRAPPE_PROTOKOLL, damit der Test auch sieht, was der Prüfling abgefangen hat.
 */
import { appendFileSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const antworten = JSON.parse(readFileSync(process.env.ATTRAPPE_ANTWORTEN, 'utf8'))
const protokoll = (zeile) => appendFileSync(process.env.ATTRAPPE_PROTOKOLL, `${zeile}\n`)
const nach = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)

function falsch(grund) {
  protokoll(`FALSCH ${grund}: ${args.join(' ')}`)
  process.exit(2)
}

/** Wie `gh ... list`: nur die mit `--json` angeforderten Felder, höchstens `--limit` Einträge (beide Pflicht). */
function liste(eintraege) {
  const felder = (nach('--json') ?? '').split(',').filter(Boolean)
  const limit = Number(nach('--limit'))
  if (felder.length === 0 || !(limit > 0)) falsch('json oder limit fehlt')
  return eintraege.slice(0, limit).map((e) => Object.fromEntries(felder.filter((f) => f in e).map((f) => [f, e[f]])))
}

if (nach('--repo') !== 'danielzaiser91/anime-kalender-de') falsch('repo')
const [gruppe, aktion] = args

if (gruppe === 'run' && aktion === 'view') {
  if (args[2] !== antworten.lauf || !args.includes('--log-failed')) falsch('run view')
  process.stdout.write(readFileSync(antworten.protokollDatei, 'utf8'))
} else if (gruppe === 'issue' && aktion === 'list') {
  if (nach('--state') !== 'open') falsch('issue list state')
  process.stdout.write(JSON.stringify(liste(antworten.issues)))
} else if (gruppe === 'issue' && aktion === 'view') {
  if (args[2] !== String(antworten.issueNr)) falsch('issue view nr')
  process.stdout.write(JSON.stringify(antworten.issueAnsicht))
} else if (gruppe === 'pr' && aktion === 'list') {
  if (nach('--state') !== 'open') falsch('pr list state')
  process.stdout.write(JSON.stringify(liste(antworten.prs)))
} else if ((gruppe === 'issue' || gruppe === 'pr') && aktion === 'comment') {
  protokoll(`KOMMENTAR ${gruppe} ${args[2]}`)
} else {
  falsch('unbekannt')
}
