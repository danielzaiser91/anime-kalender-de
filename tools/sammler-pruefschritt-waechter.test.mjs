/**
 * Gegenprobe zu `tools/sammler-pruefschritt-waechter.mjs`: Der Stand des Repos ist in Ordnung, und jede einzelne Abweichung — eine umgangene Aktion,
 * ein gesetzter Schalter, eine vertauschte Reihenfolge, eine fehlende Marke, eine zu lange Frist — macht ihn rot. Die App-Token-Sperre hat ihre eigene
 * Gegenprobe (`tools/app-token-sperre.test.mjs`); hier steht nur, dass der Wächter sie aufruft, und der Exit-Code als eigener Prozess.
 * Aufruf: node tools/sammler-pruefschritt-waechter.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnMitLimit } from './kind-mit-limit.mjs'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ladeRepo, pruefeFristen, pruefeSammler, REST_SEKUNDEN } from './sammler-pruefschritt-waechter.mjs'

const WURZEL = join(import.meta.dirname, '..')
const original = ladeRepo(WURZEL)
const kopie = () => structuredClone(original)

/** Mutation anwenden und die Fehlertexte holen. */
function mit(aendere) {
  const stand = kopie()
  aendere(stand)
  return pruefeSammler(stand)
}
function erwarte(name, aendere, muster) {
  const fehler = mit(aendere)
  assert.ok(fehler.some((f) => muster.test(f)), `${name}: erwartet ${muster}, gefunden ${JSON.stringify(fehler)}`)
}

assert.deepEqual(pruefeSammler(original), [], 'der Stand des Repos ist in Ordnung')
const neuerWorkflow = (schritte) => ({ name: 'Neuer Sammler', on: 'workflow_dispatch', jobs: { sammeln: { 'runs-on': 'ubuntu-latest', steps: schritte } } })

// Die App-Token-Sperre ist verdrahtet: Array-Form im Token-Job macht auch den Wächter rot (Auflage 2, Runde 3).
const ARRAY_FORM = `node -e "require('child_process').execFileSync('gh', ['pr', 'merge', '5', '--admin'])"`
erwarte('Array-Form gh im Token-Schritt', (s) => {
  s.workflows['claude-wache-urteil.yml'].jobs.urteilen.steps.find((x) => x.name === 'Ergebnis als Pull Request einreichen').run = ARRAY_FORM
}, /claude-wache-urteil\.yml: Job urteilen, Schritt „Ergebnis als Pull Request einreichen“ \(quellen-pr\): run genau/)

// Weg 1: die Aktion
const schritteDerAktion = (s) => s.aktionen.einreichen.runs.steps
const aufrufSchritt = (s) => schritteDerAktion(s).find((x) => x.id === 'pr')
erwarte('Aktion: Aufruf mit || true', (s) => { aufrufSchritt(s).run += ' || true' }, /0 Aufrufe/)
erwarte('Aktion: Aufruf fehlt', (s) => { s.aktionen.einreichen.runs.steps = schritteDerAktion(s).filter((x) => x.id !== 'pr') }, /0 Aufrufe/)
erwarte('Aktion: Aufruf doppelt', (s) => { schritteDerAktion(s).push({ ...aufrufSchritt(s), id: 'pr2' }) }, /2 Aufrufe/)
erwarte('Aktion: zusätzlicher Aufruf von quellen-pr.sh mit anderem Text', (s) => { schritteDerAktion(s).push({ name: 'Zweiter', run: 'bash tools/quellen-pr.sh "anders"' }) }, /Schritt „Zweiter“/)

// Weg 2: Schalter
erwarte('Workflow setzt QUELLEN_PRUEFBEFEHL', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'true', env: { QUELLEN_PRUEFBEFEHL: 'true' } }]) }, /neu\.yml: setzt oder nennt einen Schalter/)
erwarte('Aktion setzt QUELLEN_PRUEFFRIST', (s) => { aufrufSchritt(s).env.QUELLEN_PRUEFFRIST = '1' }, /einreichen: setzt oder nennt einen Schalter/)
erwarte('Workflow setzt APP_AUTOR für den Nachholer', (s) => {
  s.workflows['claude-daten-merge.yml'].jobs.pruefen.env = { APP_AUTOR: 'github-actions[bot]' }
}, /claude-daten-merge\.yml: setzt oder nennt einen Schalter/)

// Weg 3: quellen-pr.sh und quellen-pruefen.sh
const PR = 'quellen-pr.sh'
const ohne = (text, teil) => { assert.ok(text.includes(teil), `Mutation trifft nichts: ${teil}`); return text.replace(teil, '') }
erwarte('quellen-pr.sh lädt die Prüfung nicht', (s) => { s.skripte[PR] = ohne(s.skripte[PR], 'source "$(dirname "${BASH_SOURCE[0]}")/quellen-pruefen.sh"') }, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh ruft die Prüfung nicht auf', (s) => { s.skripte[PR] = s.skripte[PR].replace('quellen_pruefen)"', 'true)"') }, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh prüft erst nach dem Anlegen', (s) => {
  const t = s.skripte[PR]
  s.skripte[PR] = t.replace('PRUEF_GRUND="$(quellen_pruefen)" || PRUEF_ROT=1\n', '').replace('NUMMER="$(printf', 'PRUEF_GRUND="$(quellen_pruefen)" || PRUEF_ROT=1\nNUMMER="$(printf')
}, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: Rot-Zweig nach dem Merge', (s) => {
  s.skripte[PR] = s.skripte[PR].replace('if [ "$PRUEF_ROT" = 1 ]; then\n  # Das Label', 'if false; then\n  # Das Label')
}, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: andere Marke', (s) => { s.skripte[PR] = s.skripte[PR].replace('MARKE_ROT="[Prüfung rot]"', 'MARKE_ROT="[rot]"') }, /MARKE_ROT ist nicht/)
erwarte('Prüfung fährt nur check:logic ohne --alle', (s) => { s.skripte['quellen-pruefen.sh'] = s.skripte['quellen-pruefen.sh'].replace('check:logic -- --alle', 'check:logic') }, /Standardbefehl/)
erwarte('Prüfung fährt etwas anderes', (s) => { s.skripte['quellen-pruefen.sh'] = s.skripte['quellen-pruefen.sh'].replace('npm run check:logic -- --alle', 'true') }, /Standardbefehl/)
const ROT_BLOCK = 'if [ "$PRUEF_ROT" = 1 ]; then\n  # Das Label'
erwarte('quellen-pr.sh: Rot-Zweig steht vor dem Anlegen', (s) => { s.skripte[PR] = `${ROT_BLOCK}\n${ohne(s.skripte[PR], ROT_BLOCK)}` }, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: Rot-Zweig steht erst nach dem Merge', (s) => { s.skripte[PR] = `${ohne(s.skripte[PR], ROT_BLOCK)}\n${ROT_BLOCK}` }, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: gh pr merge steht vor dem Anlegen', (s) => { s.skripte[PR] = `if gh pr merge x\n${s.skripte[PR]}` }, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: zweites gh pr create', (s) => { s.skripte[PR] += '\ngh pr create --fill\n' }, /genau ein gh pr create/)
erwarte('quellen-pr.sh: zweites gh pr create als gh pr new', (s) => { s.skripte[PR] += '\ngh pr new --fill\n' }, /genau ein gh pr create/)
erwarte('quellen-pr.sh: zweites gh pr merge', (s) => { s.skripte[PR] += '\ngh  pr merge 1 --admin\n' }, /genau ein gh pr merge/)
assert.deepEqual(mit((s) => { s.skripte[PR] += '\n# gh pr create\n' }), [], 'quellen-pr.sh: Kommentar mit gh pr create zählt nicht')

// Weg 4: die Marke und der App-Autor bei den Nachholern
const MERGEN = 'daten-pr-mergen.sh'
erwarte('daten-pr-mergen.sh ohne Marke', (s) => { s.skripte[MERGEN] = s.skripte[MERGEN].replace('"[Prüfung rot]"*', '"x"*') }, /daten-pr-mergen\.sh überspringt/)
erwarte('daten-pr-mergen.sh ohne Autorprüfung', (s) => { s.skripte[MERGEN] = ohne(s.skripte[MERGEN], '[ "$autor" = "$APP_AUTOR" ] || {') }, /prüft den Autor nicht/)
erwarte('daten-pr-mergen.sh mit anderem App-Autor', (s) => { s.skripte[MERGEN] = s.skripte[MERGEN].replace('app/anime-kalender-daten}', 'github-actions}') }, /prüft den Autor nicht/)
const listen = (s) => s.workflows['claude-daten-merge.yml'].jobs.pruefen.steps.find((x) => x.id === 'suche')
const FILTER = 'select(.title | startswith("[Prüfung rot]") | not) | '
for (const nr of [0, 1]) {
  erwarte(`claude-daten-merge.yml: Filter in der ${nr + 1}. gh pr list fehlt`, (s) => {
    const schritt = listen(s)
    const teile = schritt.run.split(FILTER)
    assert.equal(teile.length, 3, 'zwei Filter erwartet')
    schritt.run = teile.reduce((text, teil, i) => text + (i - 1 === nr ? '' : FILTER) + teil)
  }, /filtert die Marke nicht heraus/)
}
erwarte('claude-daten-merge.yml: gar keine gh pr list (Erkennung)', (s) => { listen(s).run = 'echo nichts' }, /keine `gh pr list` gefunden/)

// Weg 5: Fristen (Auflage 3, Runde 3). fund-nachliefern hat 20 min; mit den Fristen aus Runde 2 (900 + 240 s) blieben 60 s für Download und Merge.
const PRUEFEN = 'quellen-pruefen.sh'
const fristen = (pruef, basis) => (s) => {
  s.skripte[PRUEFEN] = s.skripte[PRUEFEN]
    .replace(/^QUELLEN_PRUEFFRIST_STANDARD=\d+$/m, `QUELLEN_PRUEFFRIST_STANDARD=${pruef}`)
    .replace(/^QUELLEN_BASISFRIST_STANDARD=\d+$/m, `QUELLEN_BASISFRIST_STANDARD=${basis}`)
}
erwarte('Fristen aus Runde 2 sprengen fund-nachliefern', fristen(900, 240), /fund-nachliefern\.yml: Job nachliefern \(timeout 1200 s\) lässt nach Prüfung und Vergleich \(1140 s\)/)
erwarte('Basisfrist allein zu lang', fristen(420, 400), /fund-nachliefern\.yml: Job nachliefern/)
assert.deepEqual(mit(fristen(1200 - 240 - REST_SEKUNDEN, 240)), [], 'genau auf der Grenze ist erlaubt')
erwarte('eine Sekunde über der Grenze', fristen(1200 - 240 - REST_SEKUNDEN + 1, 240), /fund-nachliefern\.yml: Job nachliefern/)
erwarte('Frist nicht lesbar', (s) => { s.skripte[PRUEFEN] = ohne(s.skripte[PRUEFEN], 'QUELLEN_BASISFRIST_STANDARD=240\n') }, /als Zahl erwartet/)
// Ein neuer Einreicher mit kurzem Timeout als mittlerer von drei Jobs: über die Aktion wie über den direkten Aufruf.
const dreiJobs = (mitte) => ({ jobs: { a: { 'timeout-minutes': 300, steps: [{ uses: './.github/actions/einreichen' }] }, b: mitte, c: { steps: [{ run: 'bash tools/quellen-pr.sh "x"' }] } } })
erwarte('Einreicher über die Aktion mit 15 min', (s) => { s.workflows['neu.yml'] = dreiJobs({ 'timeout-minutes': 15, steps: [{ uses: '.github/actions/einreichen@main' }] }) }, /neu\.yml: Job b \(timeout 900 s\)/)
erwarte('direkter Aufruf mit 15 min', (s) => { s.workflows['neu.yml'] = dreiJobs({ 'timeout-minutes': 15, steps: [{ run: 'true' }, { run: 'bash tools/quellen-pr.sh "y"' }] }) }, /neu\.yml: Job b/)
erwarte('Timeout als Ausdruck ist nicht nachrechenbar', (s) => { s.workflows['neu.yml'] = dreiJobs({ 'timeout-minutes': '${{ inputs.t }}', steps: [{ uses: './.github/actions/einreichen' }] }) }, /neu\.yml: Job b/)
assert.deepEqual(pruefeFristen({ 'x.yml': dreiJobs({ steps: [{ run: 'true' }] }) }, original.skripte[PRUEFEN]), [], 'ohne timeout gelten 360 min; ein Job ohne Einreichen zählt nicht')
assert.deepEqual(pruefeFristen({ 'x.yml': { jobs: { a: { steps: [{ run: 'true' }] } } } }, original.skripte[PRUEFEN]), ['Wächter findet keinen Job, der einreicht — Erkennung kaputt?'])
const ohneTimeout = { 'x.yml': { jobs: { a: { steps: [{ run: 'bash tools/quellen-pr.sh "x"' }] } } } }
assert.match(pruefeFristen(ohneTimeout, 'QUELLEN_PRUEFFRIST_STANDARD=21000\nQUELLEN_BASISFRIST_STANDARD=240\n').join(), /x\.yml: Job a \(timeout 21600 s\)/, 'ohne timeout-minutes zählen 360 min')
erwarte('Einreichen vor einem weiteren Schritt', (s) => { s.workflows['neu.yml'] = dreiJobs({ 'timeout-minutes': 15, steps: [{ uses: './.github/actions/einreichen' }, { run: 'true' }] }) }, /neu\.yml: Job b/)
erwarte('zu knapper Einreicher nach einem Job ohne Einreichen', (s) => { s.workflows['neu.yml'] = { jobs: { a: { steps: [{ run: 'true' }] }, b: { 'timeout-minutes': 15, steps: [{ uses: './.github/actions/einreichen' }] } } } }, /neu\.yml: Job b/)
erwarte('Frist nur am Zeilenanfang (kein Präfix-Name davor)', (s) => { fristen(900, 240)(s); s.skripte[PRUEFEN] = `ALT_QUELLEN_PRUEFFRIST_STANDARD=1\n${s.skripte[PRUEFEN]}` }, /fund-nachliefern\.yml: Job nachliefern/)
// Gemessen 17.10.2026 in fund-nachliefern: rund 370 s nach der Prüfung (Checkout, Einrichten, Download, Push, Merge); 420 s mit Rand. Wer den Wert ändert, misst neu.
assert.equal(REST_SEKUNDEN, 420)

// Fund-Schlüssel (Auflage 1): daten-auf-abruf hat einen Job, aber wechselnde Läufe — die Nachricht trägt den Lauf, sonst löste ein roter TOGGO-Fund einen roten aniSearch-Fund ab.
const abruf = original.workflows['daten-auf-abruf.yml'].jobs.lauf.steps
assert.match(abruf.find((x) => x.id === 'lauf').run, /^ {0}echo "name=\$LAUF" >> "\$GITHUB_OUTPUT"$/m, 'der Lauf-Schritt gibt den Lauf aus')
assert.match(abruf.find((x) => String(x.uses).includes('actions/einreichen')).with.nachricht, /\$\{\{ steps\.lauf\.outputs\.name/, 'die Nachricht trägt den Lauf')

// Exit-Code als eigener Prozess: Wächter und Repo-Teile in einem Wegwerf-Ordner, einmal unverändert (0), einmal mit Array-Form im Token-Job (1).
const ordner = mkdtempSync(join(tmpdir(), 'sammler-waechter-'))
try {
  for (const teil of ['.github', 'tools/sammler-pruefschritt-waechter.mjs', 'tools/app-token-sperre.mjs', 'node_modules/yaml', 'package.json']) cpSync(join(WURZEL, teil), join(ordner, teil), { recursive: true })
  for (const sh of Object.keys(original.skripte)) cpSync(join(WURZEL, 'tools', sh), join(ordner, 'tools', sh))
  const lauf = () => spawnMitLimit(process.execPath, [join(ordner, 'tools/sammler-pruefschritt-waechter.mjs')], { cwd: ordner, encoding: 'utf8' })
  const gruen = lauf()
  assert.equal(gruen.status, 0, gruen.stderr)
  assert.match(gruen.stdout, /^sammler-pruefschritt-waechter: ok \(\d+ Workflows/)
  const datei = join(ordner, '.github/workflows/claude-wache-urteil.yml')
  const aufruf = 'bash tools/quellen-pr.sh "chore(wache): Wache durchgesehen, Urteil eingetragen"'
  assert.ok(readFileSync(datei, 'utf8').includes(aufruf), 'Mutation trifft den Aufruf')
  writeFileSync(datei, readFileSync(datei, 'utf8').replace(aufruf, ARRAY_FORM))
  const rot = lauf()
  assert.equal(rot.status, 1, 'Fehlerfall endet mit Exit 1')
  assert.match(rot.stderr, /^FEHL claude-wache-urteil\.yml: Job urteilen/m)
  assert.equal(rot.stdout, '', 'rot: keine Erfolgszeile')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('sammler-pruefschritt-waechter.test: ok')
