// gh-Attrappe für tools/pr-pruefer-kulisse.mjs: läuft als `gh api …` bzw. `gh pr …` (Dateiname = Unterbefehl).
// Antwortet nur auf die Aufrufe, die pr-pruefer.yml heute macht, mit genauem Pfad und Parametern; sonst HTTP 404.
const fs = require('node:fs')
const path = require('node:path')

const roh = process.argv.slice(2)
const befehl = path.basename(process.argv[1])
fs.appendFileSync(process.env.ATTRAPPE_LOG, JSON.stringify([befehl, ...roh]) + '\n')
const daten = JSON.parse(fs.readFileSync(process.env.ATTRAPPE_DATEN, 'utf8'))
const iq = roh.indexOf('-q')
const abfrage = iq < 0 ? null : roh[iq + 1]
const schluessel = [befehl, ...(iq < 0 ? roh : [...roh.slice(0, iq), ...roh.slice(iq + 2)])].join(' ')
const r = `repos/${daten.repo}`

function ende(text) {
  process.stdout.write(text)
  process.exit(0)
}
function nicht() {
  process.stderr.write(`HTTP 404: ${befehl} ${roh.join(' ')}`)
  process.exit(1)
}
function treffer(muster) {
  const m = new RegExp(`^${muster}$`).exec(schluessel)
  return m ? daten.prs[m[1]] : undefined
}

let pr
if ((pr = treffer(`pr view (\\d+) --repo ${daten.repo} --json title,body,headRefName`))) ende(pr.view + '\n')
if ((pr = treffer(`pr diff (\\d+)`)) && pr.diff !== undefined) ende(pr.diff)
if ((pr = treffer(`pr comment (\\d+) --repo ${daten.repo} --body-file \\S+`))) ende('')
if ((pr = treffer(`api --method GET --paginate ${r}/pulls/(\\d+)/files -f per_page=100`)) && abfrage === '.[]') {
  ende(pr.dateien.map((d) => JSON.stringify(d) + '\n').join(''))
}
if ((pr = treffer(`api ${r}/pulls/(\\d+)`)) && abfrage === '.user.login') ende(pr.login + '\n')
if ((pr = treffer(`api ${r}/issues/(\\d+)/comments --paginate`)) && abfrage !== null) ende('')
if ((pr = treffer(`api --paginate --slurp ${r}/issues/(\\d+)/comments`)) && abfrage === null) ende(JSON.stringify(pr.kommentare))
if ((pr = treffer(`api --paginate --slurp ${r}/pulls/(\\d+)/commits`)) && abfrage === null && pr.commits) ende(JSON.stringify(pr.commits))
// Kettenlog (tools/pr-kettenlog.mjs): ein abgeschlossener Lauf mit einem Job und einer Logzeile, die es im echten Repo nicht gibt.
if (schluessel === `api ${r}/actions/workflows/pr-pruefung.yml/runs?head_sha=${'c'.repeat(40)}&event=pull_request&per_page=30` && abfrage !== null) {
  ende('5\tcompleted\tsuccess\n')
}
if (schluessel === `api --paginate ${r}/actions/runs/5/jobs?per_page=100` && abfrage !== null) ende('11\tKulissen-Job\tcompleted\tsuccess\n')
if (schluessel === `api --allow-escape-sequences ${r}/actions/jobs/11/logs` && abfrage === null) ende('2026-10-28T10:00:00.0000000Z kulissen-waechter: ok (3 Fälle)\n')
const einzel = new RegExp(`^api ${r}/commits/([0-9a-f]{40})$`).exec(schluessel)
const dateien = einzel && abfrage === null ? Object.values(daten.prs).find((p) => p.einzel[einzel[1]])?.einzel[einzel[1]] : undefined
if (dateien) ende(JSON.stringify({ files: dateien.map((filename) => ({ filename })) }))
nicht()
