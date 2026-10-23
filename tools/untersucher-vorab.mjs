#!/usr/bin/env node
/**
 * Läuft in claude-reparatur.yml vor dem Untersucher: gibt es zu diesem roten Bestandsbau schon ein
 * offenes Issue (und einen offenen PR) mit derselben Ursache? Dann kommt ein Kommentar mit dem
 * Lauf-Link statt eines zweiten Issues, und der Untersucher startet nur, wenn noch kein PR läuft.
 *
 * Aufruf: GH_TOKEN=… GITHUB_REPOSITORY=… node tools/untersucher-vorab.mjs <lauf-id> [--trocken]
 * Ausgabe (GITHUB_OUTPUT): schluessel, issue, claude (ja|nein), hinweis (eine Zeile für den Auftrag).
 * Ohne erkennbare Ursache im Protokoll bleibt alles beim Alten (claude=ja, kein Issue).
 */
import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { schluesselAusProtokoll, markerFuer, offenesIssue, laufNummern, offenePrs, liegengebliebenePrs, PR_FRIST_MS } from './untersucher-logik.mjs'

const [lauf, ...optionen] = process.argv.slice(2)
const trocken = optionen.includes('--trocken')
const repo = process.env.GITHUB_REPOSITORY ?? 'danielzaiser91/anime-kalender-de'
const laufUrl = `https://github.com/${repo}/actions/runs/${lauf}`

// GH_BIN ("befehl|vorspann") ersetzt gh nur für Probeläufe mit einem Stellvertreter.
const [ghBefehl, ...ghVorspann] = (process.env.GH_BIN ?? 'gh').split('|')
const gh = (...args) => execFileSync(ghBefehl, [...ghVorspann, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
const ghJson = (...args) => JSON.parse(gh(...args))

function melde(werte) {
  console.log(JSON.stringify(werte))
  if (process.env.GITHUB_OUTPUT) {
    for (const [k, v] of Object.entries(werte)) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`)
  }
}

function kommentiere(typ, nr, text) {
  if (trocken) return console.log(`[trocken] ${typ} #${nr} kommentieren: ${text}`)
  gh(typ, 'comment', String(nr), '--repo', repo, '--body', text)
}

function legeIssueAn(schluessel, ursache) {
  const titel = `Bestandsbau rot: ${ursache}`.slice(0, 120)
  const body = `Lauf ${lauf}: ${laufUrl}\n\nUrsache laut Protokoll: \`${ursache}\`\n\nDie Untersuchung läuft; ihr Befund folgt als Kommentar.\n\n${markerFuer(schluessel)}`
  if (trocken) return console.log(`[trocken] Issue anlegen: ${titel}`)
  return Number(gh('issue', 'create', '--repo', repo, '--title', titel, '--body', body).trim().split('/').pop())
}

const protokoll = gh('run', 'view', lauf, '--repo', repo, '--log-failed')
const treffer = schluesselAusProtokoll(protokoll)
if (!treffer) {
  melde({ schluessel: '', issue: '', claude: 'ja', hinweis: '' })
  process.exit(0)
}

const { schluessel, lesbar } = treffer
const issues = ghJson('issue', 'list', '--repo', repo, '--state', 'open', '--limit', '100', '--json', 'number,body')
const vorhanden = offenesIssue(issues, schluessel)
if (!vorhanden) {
  const neu = legeIssueAn(schluessel, lesbar) ?? 0
  const hinweis = `Für diesen Fehler steht das Issue #${neu} (Schlüssel ${schluessel}); lege kein weiteres an, schreibe die Ursache als Kommentar in #${neu} und nenne es im Pull Request als „Behebt #${neu}“.`
  melde({ schluessel, issue: neu, claude: 'ja', hinweis })
  process.exit(0)
}

const issue = ghJson('issue', 'view', String(vorhanden), '--repo', repo, '--json', 'body,comments')
const laeufe = laufNummern([issue.body, ...issue.comments.map((c) => c.body)])
const prs = ghJson('pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100', '--json', 'number,title,body,createdAt')
const offen = offenePrs(prs, vorhanden, laeufe, Date.now())
const liegen = liegengebliebenePrs(prs, vorhanden, laeufe, Date.now())
const kommentar = `Derselbe Fehler (Schlüssel ${schluessel}) im Lauf ${lauf}: ${laufUrl}`
kommentiere('issue', vorhanden, kommentar)
for (const pr of [...offen, ...liegen]) kommentiere('pr', pr, kommentar)

if (offen.length) {
  const grund = `Kein Untersucher: PR #${offen.join(', #')} behandelt den Fehler schon, der Bau ist weiter rot.`
  melde({ schluessel, issue: vorhanden, claude: 'nein', hinweis: '', grund })
} else {
  const alt = liegen.length ? `PR #${liegen.join(', #')} steht seit über ${PR_FRIST_MS / 3600000} Stunden offen und hat den Bau nicht repariert; prüfe, ob er die Ursache trifft, und führe ihn sonst mit eigener Reparatur weiter` : 'kein offener Pull Request'
  const hinweis = `Für diesen Fehler steht schon das Issue #${vorhanden} (Schlüssel ${schluessel}, ${alt}); lege kein weiteres Issue an, schreibe deinen Befund als Kommentar in #${vorhanden} und nenne es im Pull Request als „Behebt #${vorhanden}“.`
  melde({ schluessel, issue: vorhanden, claude: 'ja', hinweis })
}
