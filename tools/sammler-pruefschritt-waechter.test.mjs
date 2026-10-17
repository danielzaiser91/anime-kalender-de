/**
 * Gegenprobe zu `tools/sammler-pruefschritt-waechter.mjs`: Der Stand des Repos ist in Ordnung, und jede einzelne Abweichung — ein Sammler mit eigenem PR-Weg,
 * eine umgangene Aktion, ein gesetzter Test-Schalter, eine vertauschte Reihenfolge, eine fehlende Marke — macht ihn rot.
 * Aufruf: node tools/sammler-pruefschritt-waechter.test.mjs
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ladeRepo, pruefeSammler } from './sammler-pruefschritt-waechter.mjs'

const original = ladeRepo(join(import.meta.dirname, '..'))
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
function erwarteOk(name, aendere) {
  const fehler = mit(aendere)
  assert.deepEqual(fehler, [], `${name}: ${JSON.stringify(fehler)}`)
}

assert.deepEqual(pruefeSammler(original), [], 'der Stand des Repos ist in Ordnung')

const neuerWorkflow = (schritte) => ({ name: 'Neuer Sammler', on: 'workflow_dispatch', jobs: { sammeln: { 'runs-on': 'ubuntu-latest', steps: schritte } } })

// Weg 1: Sammler ohne die gemeinsame Stelle
erwarte('Sammler mit eigenem gh pr create', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ name: 'Einreichen', run: 'gh pr create --fill' }]) }, /neu\.yml: öffnet einen Pull Request auf eigenem Weg/)
erwarte('eigener Weg in einem with-Feld', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ uses: 'x/y@v1', with: { befehl: 'gh pr create --fill' } }]) }, /neu\.yml: öffnet/)
erwarte('eigener Weg über die API', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'gh api repos/x/y/pulls -f title=a' }]) }, /neu\.yml: öffnet/)
erwarte('Sammler-Skript mit gh pr create', (s) => { s.skripte['neu.sh'] = 'gh pr create --fill\n' }, /tools\/neu\.sh: öffnet/)
erwarteOk('Sammler über die Aktion (auch in der Schreibweise mit Anführungszeichen und Zweig)', (s) => {
  s.workflows['neu.yml'] = neuerWorkflow([{ uses: '.github/actions/einreichen/@main', with: { nachricht: 'x' } }])
})
erwarteOk('Sammler über quellen-pr.sh', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'bash tools/quellen-pr.sh "x"' }]) })
erwarteOk('claude-auftrag.yml darf einen eigenen Weg haben (Prüfkette im PR)', (s) => {
  s.workflows['claude-auftrag.yml'] = neuerWorkflow([{ run: 'gh pr create --fill' }])
})
erwarte('kein Workflow nutzt die Aktion (Erkennung)', (s) => {
  for (const [datei, doc] of Object.entries(s.workflows)) {
    for (const job of Object.values(doc.jobs ?? {})) job.steps = (job.steps ?? []).filter((x) => !String(x.uses ?? '').includes('actions/einreichen'))
    s.workflows[datei] = doc
  }
}, /keinen Workflow, der die Aktion einreichen benutzt/)
erwarte('kein Workflow ruft quellen-pr.sh direkt auf (Erkennung)', (s) => {
  for (const doc of Object.values(s.workflows)) {
    for (const job of Object.values(doc.jobs ?? {})) for (const x of job.steps ?? []) if (typeof x.run === 'string') x.run = x.run.replaceAll('quellen-pr.sh', 'anders.sh')
  }
}, /quellen-pr\.sh direkt/)

// Weg 2: die Aktion
const schritteDerAktion = (s) => s.aktionen.einreichen.runs.steps
const aufrufSchritt = (s) => schritteDerAktion(s).find((x) => x.id === 'pr')
erwarte('Aktion: Aufruf mit || true', (s) => { aufrufSchritt(s).run += ' || true' }, /0 Aufrufe/)
erwarte('Aktion: Aufruf fehlt', (s) => { s.aktionen.einreichen.runs.steps = schritteDerAktion(s).filter((x) => x.id !== 'pr') }, /0 Aufrufe/)
erwarte('Aktion: Aufruf doppelt', (s) => { schritteDerAktion(s).push({ ...aufrufSchritt(s) }) }, /2 Aufrufe/)
erwarte('Aktion: zusätzlicher Schritt mit gh pr create', (s) => { schritteDerAktion(s).push({ name: 'Heimlich', run: 'gh pr create --fill' }) }, /Schritt „Heimlich“/)
erwarte('Aktion: zusätzlicher Aufruf von quellen-pr.sh mit anderem Text', (s) => { schritteDerAktion(s).push({ name: 'Zweiter', run: 'bash tools/quellen-pr.sh "anders"' }) }, /Schritt „Zweiter“/)

// Weg 3: Schalter
erwarte('Workflow setzt QUELLEN_PRUEFBEFEHL', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'true', env: { QUELLEN_PRUEFBEFEHL: 'true' } }]) }, /neu\.yml: setzt oder nennt einen Test-Schalter/)
erwarte('Aktion setzt QUELLEN_PRUEFFRIST', (s) => { aufrufSchritt(s).env.QUELLEN_PRUEFFRIST = '1' }, /einreichen: setzt oder nennt einen Test-Schalter/)

// Weg 4: quellen-pr.sh und quellen-pruefen.sh
const PR = 'quellen-pr.sh'
const ohne = (text, teil) => { assert.ok(text.includes(teil), `Mutation trifft nichts: ${teil}`); return text.replace(teil, '') }
erwarte('quellen-pr.sh lädt die Prüfung nicht', (s) => { s.skripte[PR] = ohne(s.skripte[PR], 'source "$(dirname "${BASH_SOURCE[0]}")/quellen-pruefen.sh"') }, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh ruft die Prüfung nicht auf', (s) => { s.skripte[PR] = s.skripte[PR].replace('quellen_pruefen)"', 'true)"') }, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh prüft erst nach dem Anlegen', (s) => {
  const t = s.skripte[PR]
  s.skripte[PR] = t.replace('PRUEF_GRUND="$(quellen_pruefen)" || PRUEF_ROT=1\n', '').replace('NUMMER="$(printf', 'PRUEF_GRUND="$(quellen_pruefen)" || PRUEF_ROT=1\nNUMMER="$(printf')
}, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: Rot-Zweig nach dem Merge', (s) => {
  const t = s.skripte[PR]
  s.skripte[PR] = t.replace('if [ "$PRUEF_ROT" = 1 ]; then\n  # Das Label', 'if false; then\n  # Das Label')
}, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: andere Marke', (s) => { s.skripte[PR] = s.skripte[PR].replace('MARKE_ROT="[Prüfung rot]"', 'MARKE_ROT="[rot]"') }, /MARKE_ROT ist nicht/)
erwarte('Prüfung fährt nur check:logic ohne --alle', (s) => { s.skripte['quellen-pruefen.sh'] = s.skripte['quellen-pruefen.sh'].replace('check:logic -- --alle', 'check:logic') }, /Standardbefehl/)
erwarte('Prüfung fährt etwas anderes', (s) => { s.skripte['quellen-pruefen.sh'] = s.skripte['quellen-pruefen.sh'].replace('npm run check:logic -- --alle', 'true') }, /Standardbefehl/)

// Weg 5: die Marke bei den Nachholern
erwarte('daten-pr-mergen.sh ohne Marke', (s) => { s.skripte['daten-pr-mergen.sh'] = s.skripte['daten-pr-mergen.sh'].replace('"[Prüfung rot]"*', '"x"*') }, /daten-pr-mergen\.sh überspringt/)
const listen = (s) => s.workflows['claude-daten-merge.yml'].jobs.pruefen.steps.find((x) => x.id === 'suche')
for (const nr of [0, 1]) {
  erwarte(`claude-daten-merge.yml: Filter in der ${nr + 1}. gh pr list fehlt`, (s) => {
    const schritt = listen(s)
    const teile = schritt.run.split('select(.title | startswith("[Prüfung rot]") | not) | ')
    assert.equal(teile.length, 3, 'zwei Filter erwartet')
    const filter = 'select(.title | startswith("[Prüfung rot]") | not) | '
    schritt.run = teile.reduce((text, teil, i) => text + (i - 1 === nr ? '' : filter) + teil)
  }, /filtert die Marke nicht heraus/)
}
erwarte('claude-daten-merge.yml: gar keine gh pr list (Erkennung)', (s) => { listen(s).run = 'echo nichts' }, /keine `gh pr list` gefunden/)

const ROT_BLOCK = 'if [ "$PRUEF_ROT" = 1 ]; then\n  # Das Label'
erwarte('quellen-pr.sh: Rot-Zweig steht vor dem Anlegen', (s) => {
  s.skripte[PR] = `${ROT_BLOCK}\n${ohne(s.skripte[PR], ROT_BLOCK)}`
}, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: Rot-Zweig steht erst nach dem Merge', (s) => {
  s.skripte[PR] = `${ohne(s.skripte[PR], ROT_BLOCK)}\n${ROT_BLOCK}`
}, /Reihenfolge muss sein/)
erwarte('quellen-pr.sh: gh pr merge steht vor dem Anlegen', (s) => {
  s.skripte[PR] = `if gh pr merge x\n${s.skripte[PR]}`
}, /Reihenfolge muss sein/)
// Runde 2 (17.10.2026): weitere Schreibweisen eines eigenen PR-Wegs
const eigenerWeg = (name, run, muster = /neu\.yml: öffnet/) => erwarte(name, (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run }]) }, muster)
eigenerWeg('gh pr new (Alias von create)', 'gh pr new --fill')
eigenerWeg('mehrfache Leerzeichen', 'gh  pr   create --fill')
eigenerWeg('Zeilenfortsetzung mit Backslash', 'gh pr \\\n   create --fill')
eigenerWeg('Schalter vor pr', 'gh --repo x/y pr create --fill')
eigenerWeg('API-POST ohne Zeilenende nach /pulls', 'gh api -X POST repos/o/r/pulls')
erwarte('Aktion create-pull-request', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ uses: 'peter-evans/create-pull-request@v7' }]) }, /neu\.yml: öffnet/)
eigenerWeg('quellen-pr.sh und danach ein zweiter Befehl im selben Schritt', 'bash tools/quellen-pr.sh "x"\ngh pr create --fill')
erwarteOk('Lesen von commits/<sha>/pulls ist kein PR-Öffnen', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'gh api repos/o/r/commits/abc/pulls' }]) })
erwarteOk('Lesen einer PR-Datei (…/pulls/5/files) ist kein PR-Öffnen', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'gh api repos/o/r/pulls/5/files' }]) })
// Quelltexte unter tools/ und pipeline/
const quellcode = (name, pfad, text, muster) => erwarte(name, (s) => { s.quellcode[pfad] = text }, muster)
quellcode('tools/*.mjs mit execSync gh pr create', 'tools/neu.mjs', "execSync('gh pr create --fill')", /tools\/neu\.mjs: öffnet/)
quellcode('pipeline/*.ts mit Octokit pulls.create', 'pipeline/neu.ts', 'await octokit.rest.pulls.create({})', /pipeline\/neu\.ts: öffnet/)
erwarteOk('Kommentar in einem Quelltext öffnet nichts', (s) => { s.quellcode['tools/neu.mjs'] = '// früher: gh pr create --fill\n * gh pr merge' })
assert.ok(Object.keys(original.quellcode).some((p) => p.startsWith('tools/') && p.endsWith('.mjs')), 'ladeRepo liest tools/*.mjs')
assert.ok(Object.keys(original.quellcode).some((p) => p.startsWith('pipeline/') && p.endsWith('.ts')), 'ladeRepo liest pipeline/*.ts')
assert.ok(!Object.keys(original.quellcode).some((p) => /\.test\./.test(p)), 'Tests werden nicht gelesen')
assert.ok(Object.keys(original.quellcode).some((p) => /^pipeline\/[^/]+\/[^/]+\.ts$/.test(p)), 'ladeRepo liest auch Unterordner von pipeline/')
assert.ok(Object.keys(original.quellcode).some((p) => /^tools\/[^/]+\/[^/]+\.(mjs|js|ts)$/.test(p)), 'ladeRepo liest auch Unterordner von tools/')
quellcode('Octokit createPullRequest (GraphQL)', 'tools/neu.mjs', 'graphql(`mutation { createPullRequest(input: {}) }`)', /tools\/neu\.mjs: öffnet/)
erwarteOk('Blockkommentar in einem Quelltext öffnet nichts', (s) => { s.quellcode['tools/neu.mjs'] = '/* gh pr create --fill */' })
erwarteOk('Kommentarzeile in einem Shell-Skript öffnet nichts', (s) => { s.skripte['neu.sh'] = '# gh pr create --fill\necho x\n' })
erwarte('Quelltext öffnet nach einer Kommentarzeile', (s) => { s.quellcode['tools/neu.mjs'] = '// nichts\nexecSync("gh pr create")' }, /tools\/neu\.mjs: öffnet/)
// genau ein create und genau ein merge in quellen-pr.sh
erwarte('quellen-pr.sh: zweites gh pr create', (s) => { s.skripte[PR] += '\ngh pr create --fill\n' }, /genau ein gh pr create/)
erwarte('quellen-pr.sh: zweites gh pr create als gh pr new', (s) => { s.skripte[PR] += '\ngh pr new --fill\n' }, /genau ein gh pr create/)
erwarte('quellen-pr.sh: zweites gh pr merge', (s) => { s.skripte[PR] += '\ngh  pr merge 1 --admin\n' }, /genau ein gh pr merge/)
erwarteOk('quellen-pr.sh: Kommentar mit gh pr create zählt nicht', (s) => { s.skripte[PR] += '\n# gh pr create\n' })
// Merge-Stellen: Liste
const merge = /kann einen Pull Request mergen/
erwarte('neuer Workflow mit gh pr merge --admin', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'gh pr merge 5 --squash --admin' }]) }, /\.github\/workflows\/neu\.yml: kann einen Pull Request mergen/)
erwarte('neues Skript mit gh pr merge', (s) => { s.skripte['x.sh'] = 'gh pr merge $n --admin\n' }, /tools\/x\.sh: kann/)
erwarte('Quelltext mit gh pr merge', (s) => { s.quellcode['tools/x.mjs'] = "execSync('gh pr merge 5')" }, /tools\/x\.mjs: kann/)
erwarte('Merge über die API', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'gh api -X PUT repos/o/r/pulls/5/merge' }]) }, merge)
erwarte('Auto-Merge-Aktion', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ uses: 'pascalgn/automerge-action@v0.16' }]) }, merge)
erwarte('Merge mit Schalter vor pr und Leerzeichen', (s) => { s.workflows['neu.yml'] = neuerWorkflow([{ run: 'gh -R x/y  pr   merge 5' }]) }, merge)
erwarte('Merge in einer Aktion', (s) => { schritteDerAktion(s).push({ name: 'M', run: 'gh pr merge 5' }) }, /\.github\/actions\/einreichen: kann/)
erwarte('Octokit pulls.merge', (s) => { s.quellcode['tools/x.mjs'] = 'await octokit.rest.pulls.merge({})' }, /tools\/x\.mjs: kann/)
erwarte('GraphQL mergePullRequest', (s) => { s.quellcode['tools/x.mjs'] = 'graphql(`mutation { mergePullRequest(input: {}) }`)' }, /tools\/x\.mjs: kann/)
erwarte('GraphQL enablePullRequestAutoMerge', (s) => { s.quellcode['tools/x.mjs'] = 'graphql(`mutation { enablePullRequestAutoMerge(input: {}) }`)' }, /tools\/x\.mjs: kann/)
erwarte('Merge in einem Skript nach einer Kommentarzeile', (s) => { s.skripte['x.sh'] = '# nichts\ngh pr merge 1\n' }, /tools\/x\.sh: kann/)
for (const stelle of ['quellen-pr.sh', 'daten-pr-mergen.sh', 'pr-einreichen.sh']) {
  erwarte(`${stelle}: ohne Eintrag auf der Liste wäre sie rot (Gegenprobe über eine Kopie)`, (s) => { s.skripte['kopie-von-' + stelle] = s.skripte[stelle] }, /kann einen Pull Request mergen/)
}
erwarteOk('Merge-Stellen auf der Liste bleiben erlaubt', (s) => { s.skripte['pr-einreichen.sh'] += '\ngh pr merge 3 --auto\n' })
console.log('sammler-pruefschritt-waechter.test: ok')
