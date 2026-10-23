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
const einzel = new RegExp(`^api ${r}/commits/([0-9a-f]{40})$`).exec(schluessel)
const dateien = einzel && abfrage === null ? Object.values(daten.prs).find((p) => p.einzel[einzel[1]])?.einzel[einzel[1]] : undefined
if (dateien) ende(JSON.stringify({ files: dateien.map((filename) => ({ filename })) }))
nicht()
