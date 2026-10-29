/**
 * Gegenprobe zu `tools/app-token-sperre.mjs` (17.10.2026, Runde 3 zu #1442): Der Stand des Repos ist in Ordnung; jeder zusätzliche Weg, auf dem ein Schritt das
 * App-Token sieht oder anders benutzt als vorgesehen, macht die Sperre rot — gleich in welcher Schreibweise der Befehl steht (Array-Form, Anführungszeichen).
 * Aufruf: node tools/app-token-sperre.test.mjs
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pruefeAppToken, TOKEN_JOBS } from './app-token-sperre.mjs'
import { ladeRepo } from './sammler-pruefschritt-waechter.mjs'

const original = ladeRepo(join(import.meta.dirname, '..'))
const stand = () => structuredClone({ workflows: original.workflows, aktionen: original.aktionen })
function mit(aendere) {
  const s = stand()
  aendere(s)
  return pruefeAppToken(s)
}
function erwarte(name, aendere, muster) {
  const fehler = mit(aendere)
  assert.ok(fehler.some((f) => muster.test(f)), `${name}: erwartet ${muster}, gefunden ${JSON.stringify(fehler)}`)
}
const erwarteOk = (name, aendere) => assert.deepEqual(mit(aendere), [], name)

assert.deepEqual(pruefeAppToken(stand()), [], 'der Stand des Repos ist in Ordnung')

const ARRAY_FORM = `node -e "require('child_process').execFileSync('gh', ['pr', 'merge', '5', '--admin'])"`
const job = (s, datei, id) => s.workflows[datei].jobs[id]
const schritt = (s, datei, id, name) => job(s, datei, id).steps.find((x) => x.name === name)
const URTEIL = ['claude-wache-urteil.yml', 'urteilen', 'Ergebnis als Pull Request einreichen']
const MERGEN = ['claude-daten-merge.yml', 'nachholen', 'Mergebare Daten-Pull-Requests mergen']
const TOKEN = '${{ steps.app.outputs.token }}'
const ANMELDUNG = 'git config --local --unset-all http.https://github.com/.extraheader || true\ngit remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"\n'

// Auflage 2: Befehlsformen, die eine Textsuche nach `gh pr merge` übersah — im Token-Schritt sind sie rot, weil nur die feste Form zählt.
erwarte('Array-Form im quellen-pr-Schritt', (s) => { schritt(s, ...URTEIL).run = ARRAY_FORM }, /claude-wache-urteil\.yml: Job urteilen.*\(quellen-pr\): run genau/)
erwarte('Array-Form im daten-pr-mergen-Schritt', (s) => { schritt(s, ...MERGEN).run = ARRAY_FORM }, /claude-daten-merge\.yml: Job nachholen.*\(daten-pr-mergen\): run genau/)
erwarte('Anführungszeichen-Form gh pr "merge"', (s) => { schritt(s, ...URTEIL).run = 'gh pr "merge" 5 --admin' }, /Job urteilen.*run genau/)
erwarte('Array-Form statt Checkout', (s) => {
  const steps = job(s, 'bestand-bauen.yml', 'bauen').steps
  const i = steps.findIndex((x) => x.with?.token === TOKEN)
  steps[i] = { name: 'x', env: { GH_TOKEN: TOKEN }, run: ARRAY_FORM }
}, /bestand-bauen\.yml: Job bauen.*\(checkout\): nur actions\/checkout/)
erwarte('quellen-pr: zusätzliche Zeile vor dem Aufruf', (s) => { schritt(s, ...URTEIL).run = `${ANMELDUNG}gh pr merge 5\nbash tools/quellen-pr.sh "x"\n` }, /Job urteilen.*run genau/)
erwarte('quellen-pr: Zeile nach dem Aufruf', (s) => { schritt(s, ...URTEIL).run += ARRAY_FORM }, /Job urteilen.*run genau/)
erwarte('quellen-pr: Nachricht mit Befehlsersetzung', (s) => { schritt(s, ...URTEIL).run = `${ANMELDUNG}bash tools/quellen-pr.sh "$(gh pr merge 5)"\n` }, /Job urteilen.*run genau/)
erwarte('quellen-pr: Nachricht mit Backtick', (s) => { schritt(s, ...URTEIL).run = 'bash tools/quellen-pr.sh "`gh pr merge 5`"' }, /Job urteilen.*run genau/)
erwarte('quellen-pr: nur eine der zwei Anmeldezeilen', (s) => { schritt(s, ...URTEIL).run = `${ANMELDUNG.split('\n')[1]}\nbash tools/quellen-pr.sh "x"` }, /Job urteilen.*run genau/)
erwarteOk('quellen-pr: ohne Anmeldung, nur der Aufruf', (s) => { schritt(s, ...URTEIL).run = 'bash tools/quellen-pr.sh "chore(x): y"' })
erwarte('daten-pr-mergen: anderes Skript', (s) => { schritt(s, ...MERGEN).run = 'bash tools/anders.sh $NUMMERN' }, /Job nachholen.*run genau/)
erwarteOk('daten-pr-mergen: die zweite erlaubte Form', (s) => { schritt(s, ...MERGEN).run = 'bash tools/daten-pr-mergen.sh ${NUMMERN//,/ }' })
// Umleitungen des festen Befehls
erwarte('shell: node', (s) => { schritt(s, ...URTEIL).shell = 'node {0}' }, /Job urteilen.*nur die Schlüssel/)
erwarte('working-directory', (s) => { schritt(s, ...MERGEN)['working-directory'] = 'fremd' }, /Job nachholen.*nur die Schlüssel/)
erwarte('NODE_OPTIONS im Schritt', (s) => { schritt(s, ...URTEIL).env.NODE_OPTIONS = '--require ./x.cjs' }, /Job urteilen.*env nur/)
erwarte('Token unter anderem Namen, GH_TOKEN aus anderer Quelle', (s) => { Object.assign(schritt(s, ...MERGEN).env, { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}', NUMMERN: TOKEN }) }, /Job nachholen.*env nur.*GH_TOKEN genau/)
erwarte('daten-pr-mergen: Zeile nach dem Aufruf', (s) => { schritt(s, ...MERGEN).run += '\ngh pr merge 5' }, /Job nachholen.*run genau/)
erwarte('quellen-pr: zweite Anmeldezeile ersetzt', (s) => { schritt(s, ...URTEIL).run = `${ANMELDUNG.split('\n')[0]}\ngh pr merge 5\nbash tools/quellen-pr.sh "x"` }, /Job urteilen.*run genau/)
erwarte('quellen-pr: erste Anmeldezeile ersetzt', (s) => { schritt(s, ...URTEIL).run = `gh pr merge 5\n${ANMELDUNG.split('\n')[1]}\nbash tools/quellen-pr.sh "x"` }, /Job urteilen.*run genau/)
erwarte('Checkout: fremde Aktion mit with.token', (s) => { job(s, 'delta-wache.yml', 'wache').steps.find((x) => x.with?.token === TOKEN).uses = 'fremd/checkout@v1' }, /delta-wache\.yml: Job wache.*\(checkout\)/)
erwarte('quellen-pr: Befehl vor dem Aufruf in derselben Zeile', (s) => { schritt(s, ...URTEIL).run = 'gh pr merge 5; bash tools/quellen-pr.sh "x"' }, /Job urteilen.*run genau/)
erwarte('quellen-pr: Befehl nach dem Aufruf in derselben Zeile', (s) => { schritt(s, ...URTEIL).run = 'bash tools/quellen-pr.sh "x"; gh pr merge 5' }, /Job urteilen.*run genau/)
erwarte('Checkout: Token in ref statt token', (s) => { const w = job(s, 'delta-wache.yml', 'wache').steps.find((x) => x.with?.token === TOKEN).with; w.ref = TOKEN; delete w.token }, /delta-wache\.yml: Job wache.*\(checkout\)/)
erwarte('Checkout mit env', (s) => { job(s, 'bestand-bauen.yml', 'bauen').steps.find((x) => x.with?.token === TOKEN).env = { NODE_OPTIONS: '--require x' } }, /bestand-bauen\.yml: Job bauen.*\(checkout\)/)
erwarte('Token nur im Job-Output, kein Schritt', (s) => {
  const j = job(s, ...MERGEN.slice(0, 2))
  delete schritt(s, ...MERGEN).env.GH_TOKEN
  j.outputs = { t: TOKEN }
}, /Job nachholen: das App-Token sehen 1 Stellen \(outputs\.t\)/)
erwarte('fremde Token-Aktion mit private-key im Token-Job', (s) => {
  job(s, 'bestand-bauen.yml', 'bauen').steps.push({ uses: 'evil/app-token@v1', with: { 'private-key': '${{ secrets.DATEN_APP_KEY }}' } })
}, /bestand-bauen\.yml: nennt das App-Secret an jobs\.bauen\.steps\.\d+\.with\.private-key/)
erwarte('BASH_ENV im Job', (s) => { job(s, ...URTEIL.slice(0, 2)).env.BASH_ENV = './x.sh' }, /Job urteilen holt ein App-Token; env nur.*gefunden: BASH_ENV/)
erwarte('NODE_OPTIONS im Workflow', (s) => { s.workflows['claude-daten-merge.yml'].env = { NODE_OPTIONS: '--require x' } }, /claude-daten-merge\.yml: Job nachholen holt ein App-Token; env nur/)
erwarte('defaults im Job', (s) => { job(s, ...MERGEN.slice(0, 2)).defaults = { run: { shell: 'node {0}' } } }, /Job nachholen holt ein App-Token.*defaults/)
erwarte('defaults im Workflow', (s) => { s.workflows['claude-wache-urteil.yml'].defaults = { run: { shell: 'node {0}' } } }, /Job urteilen holt ein App-Token.*defaults/)
erwarte('Checkout mit weiterem with', (s) => { job(s, 'delta-wache.yml', 'wache').steps.find((x) => x.with?.token === TOKEN).with['persist-credentials'] = 'true' }, /delta-wache\.yml: Job wache.*\(checkout\)/)

// Wer das Token sieht: genau ein Schritt. Der zweite steht einmal vor, einmal nach dem erlaubten (der richtige in der Mitte).
const zweiter = (vorne) => (s) => {
  const steps = job(s, ...URTEIL.slice(0, 2)).steps
  const i = steps.findIndex((x) => x.name === URTEIL[2])
  steps.splice(vorne ? i : i + 1, 0, { name: 'Heimlich', env: { T: TOKEN }, run: ARRAY_FORM })
}
erwarte('zweiter Schritt mit dem Token davor', zweiter(true), /Job urteilen: das App-Token sehen 2 Stellen/)
erwarte('zweiter Schritt mit dem Token danach', zweiter(false), /Job urteilen: das App-Token sehen 2 Stellen/)
erwarte('Token als Job-Output', (s) => { job(s, ...MERGEN.slice(0, 2)).outputs = { t: TOKEN } }, /Job nachholen: das App-Token sehen 2 Stellen \(steps\.\d+, outputs\.t\)/)
erwarte('toJSON(steps) in einem späteren Schritt', (s) => { job(s, ...MERGEN.slice(0, 2)).steps.push({ run: 'echo "${{ toJSON(steps) }}"' }) }, /Job nachholen: das App-Token sehen 2 Stellen/)
erwarte('steps[…]-Schreibweise', (s) => { job(s, ...MERGEN.slice(0, 2)).steps.push({ run: "echo \"${{ steps['app'].outputs.token }}\"" }) }, /Job nachholen: das App-Token sehen 2 Stellen/)
erwarte('Token-Schritt ohne Verbraucher', (s) => { const j = job(s, ...MERGEN.slice(0, 2)); j.steps = j.steps.filter((x) => x.name !== MERGEN[2]) }, /Job nachholen: das App-Token sehen 0 Stellen/)
erwarteOk('andere steps.<id> zählen nicht (Mitte)', (s) => { job(s, ...URTEIL.slice(0, 2)).steps.push({ run: 'echo "${{ steps.einreichen.outcome }}"' }) })

// Wer das Token holt: nur die Jobs der Tabelle, je genau ein Schritt mit id und fester Aktion.
const holer = (s, d, j) => job(s, d, j).steps.find((x) => String(x.uses).includes('create-github-app-token'))
erwarte('neuer Workflow holt ein Token', (s) => {
  s.workflows['neu.yml'] = { jobs: { a: { steps: [{ id: 'app', uses: 'actions/create-github-app-token@v3', with: { 'app-id': '${{ secrets.DATEN_APP_ID }}', 'private-key': '${{ secrets.DATEN_APP_KEY }}' } }, { env: { GH_TOKEN: TOKEN }, run: ARRAY_FORM }] } } }
}, /neu\.yml: Job a holt ein App-Token, steht aber nicht in TOKEN_JOBS/)
erwarte('dasselbe: das Secret steht außerhalb der Tabelle', (s) => {
  s.workflows['neu.yml'] = { jobs: { a: { steps: [{ id: 'app', uses: 'actions/create-github-app-token@v3', with: { 'app-id': '${{ secrets.DATEN_APP_ID }}' } }] } } }
}, /neu\.yml: nennt das App-Secret an jobs\.a\.steps\.0\.with\.app-id/)
erwarte('Tabelle veraltet: Job ohne Token', (s) => { const j = job(s, 'bestand-bauen.yml', 'bauen'); j.steps = j.steps.filter((x) => !String(x.uses).includes('create-github-app-token')) }, /bestand-bauen\.yml: Job bauen steht in TOKEN_JOBS, holt aber kein App-Token/)
erwarte('zwei Token-Schritte', (s) => { const j = job(s, ...MERGEN.slice(0, 2)); j.steps.unshift({ ...holer(s, ...MERGEN.slice(0, 2)), id: 'app2' }) }, /Job nachholen braucht genau einen Schritt/)
erwarte('Token-Schritt ohne id', (s) => { delete holer(s, ...MERGEN.slice(0, 2)).id }, /Job nachholen braucht genau einen Schritt/)
erwarte('andere Version der Token-Aktion', (s) => { holer(s, ...MERGEN.slice(0, 2)).uses = 'actions/create-github-app-token@main' }, /Job nachholen braucht genau einen Schritt/)
for (const [datei, jobs] of Object.entries(TOKEN_JOBS)) for (const id of Object.keys(jobs)) assert.ok(original.workflows[datei]?.jobs?.[id], `TOKEN_JOBS: ${datei}/${id} gibt es`)

// Secrets der App: nur als genauer Wert im with
erwarte('Secret in der env eines Schritts', (s) => { schritt(s, ...URTEIL).env.K = '${{ secrets.DATEN_APP_KEY }}' }, /claude-wache-urteil\.yml: nennt das App-Secret an jobs\.urteilen\.steps\.\d+\.env\.K/)
erwarte('Secret mit passendem Schlüssel in der env des Token-Schritts', (s) => { holer(s, ...MERGEN.slice(0, 2)).env = { 'app-id': '${{ secrets.DATEN_APP_ID }}' } }, /claude-daten-merge\.yml: nennt das App-Secret an jobs\.nachholen\.steps\.\d+\.env\.app-id/)
erwarte('Secret im with eines Schritts verschachtelt', (s) => { holer(s, ...MERGEN.slice(0, 2)).with['app-id'] = { 'app-id': '${{ secrets.DATEN_APP_ID }}' } }, /nennt das App-Secret an jobs\.nachholen\.steps\.\d+\.with\.app-id\.app-id/)
erwarte('Secret in Job-with eines wiederverwendbaren Workflows', (s) => { s.workflows['neu.yml'] = { jobs: { steps: { uses: './.github/workflows/x.yml', with: { '0': { with: { 'app-id': '${{ secrets.DATEN_APP_ID }}' } } }, steps: [{ uses: './.github/actions/einreichen' }] } } } }, /neu\.yml: nennt das App-Secret an jobs\.steps\.with\.0\.with\.app-id/)
erwarte('Secret in einem Schlüssel neben jobs, der wie ein Schritt aussieht', (s) => {
  const w = s.workflows['refresh-hourly.yml']
  const nr = w.jobs.sendezeiten.steps.findIndex((x) => String(x.uses).includes('actions/einreichen'))
  w.neben = { sendezeiten: { steps: { [nr]: { with: { 'app-id': '${{ secrets.DATEN_APP_ID }}' } } } } }
}, /refresh-hourly\.yml: nennt das App-Secret an neben\.sendezeiten/)
erwarte('Secret in der Job-env', (s) => { s.workflows['refresh-hourly.yml'].jobs.sendezeiten.env.K = '${{ secrets.DATEN_APP_KEY }}' }, /refresh-hourly\.yml: nennt das App-Secret an jobs\.sendezeiten\.env\.K/)
erwarte('Secret in der Workflow-env', (s) => { s.workflows['refresh-weekly.yml'].env.K = '${{ secrets.DATEN_APP_KEY }}' }, /refresh-weekly\.yml: nennt das App-Secret an env\.K/)
erwarte('Secret im Text eines run', (s) => { schritt(s, ...MERGEN).run = 'echo ${{ secrets.DATEN_APP_KEY }}' }, /nennt das App-Secret an jobs\.nachholen\.steps\.\d+\.run/)
erwarte('Secret in einer fremden Token-Aktion', (s) => { s.workflows['neu.yml'] = { jobs: { a: { steps: [{ uses: 'tibdex/github-app-token@v2', with: { private_key: '${{ secrets.DATEN_APP_KEY }}' } }] } } } }, /neu\.yml: nennt das App-Secret/)
erwarte('Secret in einem with der Aktion mit Zusatz', (s) => {
  const w = s.workflows['refresh-hourly.yml']
  w.jobs.sendezeiten.steps.find((x) => String(x.uses).includes('actions/einreichen')).with['app-key'] = '${{ secrets.DATEN_APP_KEY }} '
}, /refresh-hourly\.yml: nennt das App-Secret/)
erwarte('secrets: inherit', (s) => { s.workflows['neu.yml'] = { jobs: { a: { uses: './.github/workflows/x.yml', secrets: 'inherit' } } } }, /neu\.yml: Job a reicht Secrets weiter/)
erwarte('toJSON(secrets)', (s) => { s.workflows['neu.yml'] = { jobs: { a: { steps: [{ run: 'echo "${{ toJSON(secrets) }}"' }] } } } }, /neu\.yml: liest Secrets als Ganzes/)
erwarte('secrets[…]', (s) => { s.workflows['neu.yml'] = { jobs: { a: { steps: [{ run: "echo ${{ secrets['DATEN_' + 'APP_KEY'] }}" }] } } } }, /neu\.yml: liest Secrets als Ganzes/)

// Die Aktion einreichen
const aktion = (s) => s.aktionen.einreichen.runs.steps
const prSchritt = (s) => aktion(s).find((x) => x.id === 'pr')
const AKTION = /\.github\/actions\/einreichen: das App-Token darf nur der Schritt pr sehen/
erwarte('Aktion: Array-Form im Schritt pr', (s) => { prSchritt(s).run = ARRAY_FORM }, AKTION)
erwarte('Aktion: zweiter Schritt mit dem Token (nach pr)', (s) => { aktion(s).push({ name: 'Heimlich', shell: 'bash', env: { T: '${{ steps.app.outputs.token }}' }, run: ARRAY_FORM }) }, AKTION)
erwarte('Aktion: zweiter Schritt mit dem Token (vor pr)', (s) => { aktion(s).splice(1, 0, { name: 'Heimlich', shell: 'bash', env: { T: '${{ steps.app.outputs.token }}' }, run: ARRAY_FORM }) }, AKTION)
erwarte('Aktion: Token als Output', (s) => { s.aktionen.einreichen.outputs = { t: { value: '${{ steps.app.outputs.token }}' } } }, AKTION)
erwarte('Aktion: app-key in einem anderen Schritt', (s) => { aktion(s).push({ shell: 'bash', env: { K: '${{ inputs.app-key }}' }, run: 'true' }) }, AKTION)
erwarte('Aktion: Shell des Schritts pr', (s) => { prSchritt(s).shell = 'node {0}' }, AKTION)
erwarte('Aktion: NODE_OPTIONS im Schritt pr', (s) => { prSchritt(s).env.NODE_OPTIONS = '--require x' }, AKTION)
erwarte('Aktion: Token-Schritt mit anderem Schlüssel', (s) => { aktion(s).find((x) => x.id === 'app').with['private-key'] = '${{ inputs.anderer }}' }, AKTION)
erwarte('Aktion: zwei Token-Schritte', (s) => { aktion(s).unshift({ ...aktion(s).find((x) => x.id === 'app'), id: 'app2' }) }, AKTION)
erwarte('Aktion: Token-Schritt mit anderer id, Token in einem anderen Schritt', (s) => {
  aktion(s).find((x) => x.id === 'app').id = 'x'
  aktion(s).push({ name: 'Heimlich', shell: 'bash', env: { T: '${{ steps.x.outputs.token }}' }, run: ARRAY_FORM })
}, AKTION)
erwarte('Aktion: andere Version der Token-Aktion', (s) => { aktion(s).find((x) => x.id === 'app').uses = 'actions/create-github-app-token@main' }, AKTION)
erwarte('Aktion: Token-Schritt mit anderer app-id', (s) => { aktion(s).find((x) => x.id === 'app').with['app-id'] = '${{ inputs.andere }}' }, AKTION)
erwarte('Aktion: Token wandert von pr in einen anderen Schritt', (s) => {
  prSchritt(s).env.GH_TOKEN = '${{ github.token }}'
  aktion(s).at(-1).env = { T: '${{ steps.app.outputs.token }}' }
}, AKTION)
erwarte('Aktion: Token unter anderem Namen im Schritt pr', (s) => { Object.assign(prSchritt(s).env, { GH_TOKEN: '${{ github.token }}', FUND_DIR: '${{ steps.app.outputs.token }}' }) }, AKTION)
erwarte('Aktion: working-directory im Schritt pr', (s) => { prSchritt(s)['working-directory'] = 'fremd' }, AKTION)
erwarte('Aktion: steps[…] in einem anderen Schritt', (s) => { aktion(s).push({ shell: 'bash', run: "echo ${{ steps['app'].outputs.token }}" }) }, AKTION)
erwarte('Aktion: toJSON(steps) in einem anderen Schritt', (s) => { aktion(s).push({ shell: 'bash', run: 'echo ${{ toJSON(steps) }}' }) }, AKTION)
erwarte('Aktion: zweiter Token-Schritt mit derselben id', (s) => { aktion(s).push({ ...aktion(s).find((x) => x.id === 'app') }) }, AKTION)
erwarte('Aktion: kein Schritt pr', (s) => { prSchritt(s).id = 'anders' }, AKTION)
erwarteOk('Aktion: Schritt nach pr mit eigener id', (s) => { aktion(s).at(-1).id = 'hinweis' })
erwarte('andere Aktion nennt das App-Secret', (s) => { s.aktionen.einrichten.description += ' DATEN_APP_KEY' }, /\.github\/actions\/einrichten: holt oder nennt/)
// R4: Zugriffswege auf den Schlüssel, Nachricht nur über env, kein Ausdruck im run-Text
erwarte("Aktion: inputs['app-key'] in einem anderen Schritt", (s) => { aktion(s).push({ shell: 'bash', env: { K: "${{ inputs['app-key'] }}" }, run: 'true' }) }, AKTION)
erwarte('Aktion: toJSON(inputs) in einem anderen Schritt', (s) => { aktion(s).push({ shell: 'bash', env: { K: '${{ toJSON(inputs) }}' }, run: 'true' }) }, AKTION)
erwarte("Aktion: inputs [ 'app-key' ] mit Leerzeichen", (s) => { aktion(s).push({ shell: 'bash', env: { K: "${{ inputs [ 'app-key' ] }}" }, run: 'true' }) }, AKTION)
erwarte('Aktion: toJSON( inputs ) mit Leerzeichen', (s) => { aktion(s).push({ shell: 'bash', env: { K: '${{ toJSON( inputs ) }}' }, run: 'true' }) }, AKTION)
erwarte('Aktion: BASH_ENV im Schritt pr', (s) => { prSchritt(s).env.BASH_ENV = './x.sh' }, AKTION)
erwarte('Aktion: inputs . app-key mit Leerzeichen', (s) => { aktion(s).push({ shell: 'bash', env: { K: '${{ inputs . app-key }}' }, run: 'true' }) }, AKTION)
const AUSDRUCK = (name) => new RegExp(`einreichen: Schritt „${name}“ setzt einen Ausdruck in den run-Text`)
erwarte('Aktion: Nachricht wieder im Skripttext', (s) => { prSchritt(s).run = 'bash tools/quellen-pr.sh "${{ inputs.nachricht }}"' }, AUSDRUCK('Quellen als Pull Request einreichen'))
erwarte('Aktion: Ausdruck im run des letzten Schritts', (s) => { aktion(s).at(-1).run = 'echo "${{ inputs.fund }}"' }, AUSDRUCK('Einreichen fehlgeschlagen'))
erwarte('Aktion: NACHRICHT aus anderer Quelle', (s) => { prSchritt(s).env.NACHRICHT = '${{ github.event.head_commit.message }}' }, AKTION)
erwarteOk('Aufrufer-Nachricht mit Einschub bleibt Text', (s) => { s.workflows['adn-laufende.yml'].jobs.auffrischen.steps.find((x) => String(x.uses).includes('actions/einreichen')).with.nachricht = 'x" ; gh pr merge 5 --admin ; echo "' })
// R4: Jobs, die über einreichen ein Token bekommen — Umgebung je Ebene (Workflow, Job, Schritt) und defaults; der Job crunchyroll steht in refresh-weekly mittendrin.
const einreichSchritt = (s, d, j) => job(s, d, j).steps.find((x) => String(x.uses).includes('actions/einreichen'))
const EINREICHER = (d, j) => new RegExp(`${d.replace('.', '\\.')}: Job ${j} holt ein App-Token \\(Aktion einreichen\\); env nur`)
erwarte('einreichen: NODE_OPTIONS im Workflow', (s) => { s.workflows['adn-laufende.yml'].env = { NODE_OPTIONS: '--require ./x.cjs' } }, EINREICHER('adn-laufende.yml', 'auffrischen'))
erwarte('einreichen: BASH_ENV im Job', (s) => { job(s, 'refresh-weekly.yml', 'crunchyroll').env.BASH_ENV = './x.sh' }, EINREICHER('refresh-weekly.yml', 'crunchyroll'))
erwarte('einreichen: defaults im Workflow', (s) => { s.workflows['adn-laufende.yml'].defaults = { run: { shell: 'node {0}' } } }, EINREICHER('adn-laufende.yml', 'auffrischen'))
erwarte('einreichen: defaults im Job', (s) => { job(s, 'refresh-weekly.yml', 'crunchyroll').defaults = { run: { shell: 'node {0}' } } }, EINREICHER('refresh-weekly.yml', 'crunchyroll'))
erwarte('einreichen: BASH_ENV am mittleren von drei Einreich-Schritten', (s) => {
  const steps = job(s, 'refresh-weekly.yml', 'crunchyroll').steps
  const e = einreichSchritt(s, 'refresh-weekly.yml', 'crunchyroll')
  steps.splice(steps.indexOf(e), 0, { ...e }, { ...e, env: { BASH_ENV: './x.sh' } })
}, /refresh-weekly\.yml: Job crunchyroll: der Schritt einreichen darf nur/)
erwarte('andere Aktion holt ein Token', (s) => { s.aktionen.einrichten.runs.steps.push({ uses: 'actions/create-github-app-token@v3', with: {} }) }, /\.github\/actions\/einrichten: holt oder nennt ein App-Token/)

// Ohne App-Token bleibt ein Befehl in jeder Form ohne Wirkung auf main: GITHUB_TOKEN umgeht das Ruleset nicht, der Nachholer mergt nur App-PRs.
erwarteOk('gh pr merge mit GITHUB_TOKEN in einem neuen Workflow', (s) => { s.workflows['neu.yml'] = { jobs: { a: { steps: [{ env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }, run: ARRAY_FORM }] } } } })
console.log('app-token-sperre.test: ok')
