/**
 * Tests der Textmerge-Stufe (`pr-nachrechnen-textmerge.mjs`, 13.11.2026): Hunk-Rechnung rein, echtes git im Wegwerf-Repo
 * (disjunkte Hunks, überlappende Hunks, Konflikt, Binärdatei) und die Verdrahtung über `datenpfadGrund` mit Attrappen.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { botSprungAusnahme, datenpfadAusnahme, datenpfadGrund } from './pr-nachrechnen.mjs'
import { bewegtesGelesen } from './pr-nachrechnen-leser.mjs'
import { gitAufruf } from './pr-nachrechnen-leser-git.mjs'
import { ABSTAND, beruehren, hunks, hunksFrei, textmergeFrei } from './pr-nachrechnen-textmerge.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

// Reine Hunk-Rechnung
const h = hunks('diff --git a/x b/x\n@@ -2 +2 @@\n-a\n+b\n@@ -10,3 +10,0 @@\n-x\n@@ -20,0 +21,2 @@\n+y\n')
pruefe('hunks: Zahl ohne Komma = 1 Zeile, Anzahl 0 = Position', JSON.stringify(h) === JSON.stringify([{ alt: [2, 2], neu: [2, 2] }, { alt: [10, 12], neu: [10, 10] }, { alt: [20, 20], neu: [21, 22] }]), h)
pruefe('beruehren: Abstand genau ABSTAND zählt, ABSTAND + 1 nicht', beruehren([2, 2], [2 + ABSTAND, 2 + ABSTAND]) && !beruehren([2, 2], [3 + ABSTAND, 3 + ABSTAND]) && beruehren([10, 10], [10 - ABSTAND, 10 - ABSTAND]) && !beruehren([10, 10], [6, 6]))
pruefe('hunksFrei: ohne Hunks auf einer Seite nie frei (fail-closed)', !hunksFrei([], h) && !hunksFrei(h, []))

// Echtes git
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-textmerge-'))
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const zeilen = (aenderungen = {}) => `${Array.from({ length: 30 }, (_, i) => aenderungen[i + 1] ?? `zeile ${i + 1}`).join('\n')}\n`
const schreibe = (repo, datei, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, datei)), { recursive: true })
  fs.writeFileSync(path.join(repo, datei), text)
}
const vorher = process.cwd()
try {
  const remote = path.join(wurzel, 'remote.git')
  const arbeit = path.join(wurzel, 'arbeit')
  git(wurzel, 'init', '-q', '--bare', remote)
  git(wurzel, 'init', '-q', '-b', 'main', arbeit)
  git(arbeit, 'remote', 'add', 'origin', remote)
  schreibe(arbeit, 'docs/a.md', zeilen())
  schreibe(arbeit, 'bild.bin', 'alt\0\n')
  git(arbeit, 'add', '-A')
  git(arbeit, 'commit', '-q', '-m', 'basis')
  git(arbeit, 'push', '-q', 'origin', 'main')
  const basis = git(arbeit, 'rev-parse', 'main')
  // PR: ändert Zeile 2 der Datei und die Binärdatei
  git(arbeit, 'checkout', '-q', '-b', 'pr')
  schreibe(arbeit, 'docs/a.md', zeilen({ 2: 'PR-Änderung' }))
  schreibe(arbeit, 'bild.bin', 'pr\0\n')
  git(arbeit, 'commit', '-q', '-am', 'pr')
  const kopf = git(arbeit, 'rev-parse', 'pr')
  git(arbeit, 'push', '-q', 'origin', 'pr:refs/pull/7/head')
  process.chdir(arbeit)
  /** main = Basis plus ein Commit mit den Änderungen; liefert die Menge der Dateien ohne Berührung. */
  const mitMain = (zeilenAenderung) => {
    git(arbeit, 'checkout', '-q', '-B', 'main', basis)
    schreibe(arbeit, 'docs/a.md', zeilen(zeilenAenderung))
    git(arbeit, 'commit', '-q', '-am', 'main')
    git(arbeit, 'push', '-q', '-f', 'origin', 'main')
    return textmergeFrei(gitAufruf)({ nummer: 7, kopf, main: git(arbeit, 'rev-parse', 'main'), basis }, ['docs/a.md', 'bild.bin'])
  }
  const weit = mitMain({ 20: 'main weit weg' })
  pruefe('disjunkte Hunks (Zeile 2 gegen 20) -> Textdatei frei', weit.has('docs/a.md'), [...weit])
  pruefe('Datei ohne Hunks auf main-Seite (Binärdatei) -> nie frei', !weit.has('bild.bin'), [...weit])
  const nah = mitMain({ [2 + ABSTAND]: 'main nah' })
  pruefe(`Hunks ${ABSTAND} Zeilen auseinander, Git mergt sauber -> trotzdem nicht frei`, !nah.has('docs/a.md'), [...nah])
  const grenze = mitMain({ [3 + ABSTAND]: 'main knapp daneben' })
  pruefe(`Hunks ${ABSTAND + 1} Zeilen auseinander -> frei`, grenze.has('docs/a.md'), [...grenze])
  const konflikt = mitMain({ 2: 'main gleiche Zeile' })
  pruefe('Konflikt (dieselbe Zeile) -> leere Menge', konflikt.size === 0, [...konflikt])
  const danach = mitMain({ 20: 'main weit weg' })
  pruefe('Wiederholung nach Konflikt -> wieder frei (kein Zustand zwischen Aufrufen)', danach.has('docs/a.md'), [...danach])
  const ohneKopf = textmergeFrei(gitAufruf)({ nummer: 99, kopf, main: git(arbeit, 'rev-parse', 'main'), basis }, ['docs/a.md'])
  pruefe('PR-Referenz fehlt -> Fehler wird leere Menge, kein Wurf', ohneKopf.size === 0, [...ohneKopf])
} finally {
  process.chdir(vorher)
  fs.rmSync(wurzel, { recursive: true, force: true })
}

// Verdrahtung über datenpfadGrund (Attrappen für gh und Textmerge)
const KOPF = 'a'.repeat(40)
const BASIS = 'b'.repeat(40)
const MAIN = 'c'.repeat(40)
/** main bewegt `bewegt` (ein Mensch-Commit), der PR ändert `pr`; `textmerge` liefert die freie Menge, `leser` zeichnet Aufrufe auf. */
function lauf(bewegt, pr, textmerge, leserAntwort = null, status = 'ahead') {
  const gh = (args) => {
    if (args[1].includes('/compare/')) return JSON.stringify({ status, anzahl: bewegt.length, dateien: bewegt, commitsGesamt: 1, autoren: ['Mensch'] })
    if (args[1].endsWith('/files')) return `${pr.join('\n')}\n`
    throw new Error(`unerwarteter gh-Aufruf ${args.join(' ')}`)
  }
  const aufrufe = { textmerge: [], leser: [] }
  const tm = (refs, dateien) => {
    aufrufe.textmerge.push({ refs, dateien })
    return textmerge(dateien)
  }
  const leser = (b, p, refs) => {
    aufrufe.leser.push(refs)
    return leserAntwort
  }
  const r = datenpfadGrund(gh, { number: 7, headRefOid: KOPF }, BASIS, MAIN, leser, () => ({ fehler: 'kein git' }), () => ({ fehler: 'kein git' }), () => null, () => null, tm)
  return { r, aufrufe }
}
const alle = (d) => new Set(d)
const keine = () => new Set()
{
  const x = lauf(['docs/wissen/betrieb.md'], ['docs/wissen/betrieb.md'], alle)
  pruefe('Doku: PR und main ändern dieselbe Datei, Hunks disjunkt -> aktuell', x.r.ausnahme !== undefined && x.aufrufe.textmerge.length === 1, x.r)
  pruefe('Textmerge bekommt Nummer, Kopf, main und Basis', JSON.stringify(x.aufrufe.textmerge[0].refs) === JSON.stringify({ nummer: 7, kopf: KOPF, main: MAIN, basis: BASIS }), x.aufrufe.textmerge[0])
  const y = lauf(['docs/wissen/betrieb.md'], ['docs/wissen/betrieb.md'], keine)
  pruefe('Doku: Hunks überlappen oder Konflikt (leere Menge) -> NICHT AKTUELL, „der PR berührt“', /der PR berührt docs\/wissen\/betrieb\.md/.test(y.r.grund ?? ''), y.r)
}
{
  const x = lauf(['tools/check-logic-liste.txt'], ['tools/check-logic-liste.txt'], alle)
  pruefe('Hotspot-Liste (nicht kettenweit): disjunkte Hunks -> aktuell, der Leser bekommt die freie Menge', x.r.ausnahme !== undefined && x.aufrufe.leser.length === 1 && x.aufrufe.leser[0].frei.has('tools/check-logic-liste.txt'), x)
  const y = lauf(['tools/check-logic-liste.txt'], ['tools/check-logic-liste.txt'], keine)
  pruefe('Hotspot-Liste: Überlappung -> NICHT AKTUELL', /der PR berührt tools\/check-logic-liste\.txt/.test(y.r.grund ?? ''), y.r)
}
{
  const x = lauf(['docs/a.md'], ['tools/andere.mjs'], () => { throw new Error('darf nicht gefragt werden') })
  pruefe('ohne gemeinsame Datei kein Textmerge-Aufruf', x.r.ausnahme !== undefined && x.aufrufe.textmerge.length === 0, x.r)
}
{
  const x = lauf(['docs/a.md'], ['docs/a.md'], () => { throw new Error('darf nicht gefragt werden') }, null, 'diverged')
  pruefe('main nicht nur vorgerückt (diverged) -> kein Textmerge-Aufruf, Grund bleibt', x.aufrufe.textmerge.length === 0 && x.r.grund !== undefined, x.r)
  const v = { status: 'ahead', anzahl: 1, dateien: ['docs/a.md'], commitsGesamt: 1, autoren: ['Mensch'], vollstaendig: true }
  pruefe('datenpfadAusnahme: freie Datei zählt nicht als berührt, ohne `frei` schon', datenpfadAusnahme(v, ['docs/a.md'], new Set(['docs/a.md'])) === null && datenpfadAusnahme(v, ['docs/a.md']) === 'der PR berührt docs/a.md')
  pruefe('botSprungAusnahme: freie Datei zählt nicht als berührt, ohne `frei` schon', botSprungAusnahme({ ...v, dateien: ['data/ann-ids.json'] }, ['data/ann-ids.json'], () => null, undefined, undefined, new Set(['data/ann-ids.json'])) === null && botSprungAusnahme({ ...v, dateien: ['data/ann-ids.json'] }, ['data/ann-ids.json'], () => null) === 'der PR berührt data/ann-ids.json')
}
pruefe('Leser-Regel: freie Datei zählt nicht als berührt, ohne `frei` bleibt es ein Grund', bewegtesGelesen({ bewegt: ['tools/liste.txt'], pr: ['tools/liste.txt'], leser: [], lies: () => null, paketSkripte: null, frei: new Set(['tools/liste.txt']) }) === null && /der PR berührt/.test(bewegtesGelesen({ bewegt: ['tools/liste.txt'], pr: ['tools/liste.txt'], leser: [], lies: () => null, paketSkripte: null })))

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-textmerge.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-textmerge.test: grün')
