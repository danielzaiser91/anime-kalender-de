/**
 * Laufzeitprobe zu tools/pr-vorpruefung.mjs: `main()` meldet eine unsortierte Prüfliste (Verdrahtung von listenRot)
 * und Tests mit echter Uhr über der Grenze von tools/uhr-in-tests-grenzen.json (Verdrahtung von uhrRot).
 * Baut in einem Wegwerf-Ordner unter os.tmpdir() ein Repo mit „origin“ und startet die Vorprüfung als eigenen Prozess.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const SKRIPT = resolve(import.meta.dirname, 'pr-vorpruefung.mjs')
const UHR = resolve(import.meta.dirname, 'uhr-in-tests.mjs')
const KIND_FRIST = resolve(import.meta.dirname, 'test-kind-frist.mjs')
const MODULE = resolve(import.meta.dirname, '../node_modules')
const wurzel = mkdtempSync(join(tmpdir(), 'vorpruefung-lauf-'))
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, stdio: 'ignore' })
const SORTIERT = '# k\npipeline/check-a-b.ts\npipeline/check-a.ts\n'

/** Zusatzdateien (Pfad -> Text) im Arbeitsbaum; Ordner werden angelegt. */
function schreibeExtra(arbeit, extra = {}) {
  for (const [pfad, inhalt] of Object.entries(extra)) {
    mkdirSync(dirname(join(arbeit, pfad)), { recursive: true })
    writeFileSync(join(arbeit, pfad), inhalt)
  }
}

/** Klon mit einem Zweigcommit (Prüfliste `liste`, Testdatei `testText`); `erlaubt` ist die Uhr-Grenze der Basis. */
function lauf(name, liste, testText = 'export const x = 1\n', erlaubt = 0, opt = {}) {
  const bare = join(wurzel, `${name}.git`)
  const arbeit = join(wurzel, name)
  mkdirSync(arbeit, { recursive: true })
  git(arbeit, 'init', '-q', '-b', 'main')
  mkdirSync(join(arbeit, 'tools'))
  writeFileSync(join(arbeit, 'tools/umfang-pruefen.mjs'), "console.log('Umfang in Ordnung.')\n")
  copyFileSync(UHR, join(arbeit, 'tools/uhr-in-tests.mjs'))
  copyFileSync(KIND_FRIST, join(arbeit, 'tools/test-kind-frist.mjs'))
  writeFileSync(join(arbeit, 'tools/test-kind-frist-stand.json'), '{}\n')
  writeFileSync(join(arbeit, 'tools/uhr-in-tests-grenzen.json'), JSON.stringify({ erlaubt }))
  writeFileSync(join(arbeit, 'tools/pr-nachrechnen-bot-pfade.test.mjs'), opt.waechter ?? "console.log('Bot-Pfade grün')\n")
  writeFileSync(join(arbeit, 'README.md'), 'k\na b\n')
  writeFileSync(join(arbeit, '.gitignore'), 'node_modules\n')
  schreibeExtra(arbeit, opt.basis)
  symlinkSync(MODULE, join(arbeit, 'node_modules'), 'junction')
  git(arbeit, 'add', '.')
  git(arbeit, 'commit', '-q', '-m', 'basis')
  git(wurzel, 'clone', '-q', '--bare', arbeit, bare)
  git(arbeit, 'remote', 'add', 'origin', bare)
  git(arbeit, 'fetch', '-q', 'origin')
  git(arbeit, 'checkout', '-q', '-b', 'speed/x')
  if (!opt.nurReadme) writeFileSync(join(arbeit, 'tools/check-logic-liste.txt'), liste)
  if (!opt.nurReadme) writeFileSync(join(arbeit, 'tools/zeit.test.mjs'), testText)
  if (opt.readme) writeFileSync(join(arbeit, 'README.md'), opt.readme)
  schreibeExtra(arbeit, opt.extra)
  git(arbeit, 'add', '.')
  git(arbeit, 'commit', '-q', '-m', 'liste')
  const kopf = opt.nurReadme ? 'README.md geändert.' : 'tools/check-logic-liste.txt und tools/zeit.test.mjs neu (Prüfung der Liste).'
  const text = `${kopf}
Patch Notes: keine – Technik${opt.zusatz ?? ''}`
  const r = spawnSync(process.execPath, [SKRIPT, '--titel', opt.titel ?? 't', '--text', text], { cwd: arbeit, encoding: 'utf8' })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}

try {
  const rot = lauf('rot', '# k\npipeline/check-a.ts\npipeline/check-a-b.ts\n')
  assert.equal(rot.status, 1, 'unsortierte Liste macht die Vorprüfung rot')
  assert.match(rot.text, /Vorprüfung: tools\/check-logic-liste\.txt muss alphabetisch sortiert sein/, 'Meldung nennt die Liste')
  const gruen = lauf('gruen', SORTIERT)
  assert.equal(gruen.status, 0, `sortierte Liste bleibt grün: ${gruen.text}`)
  const jetzt = 'export const t = Date.now()\n'
  const uhr = lauf('uhr', SORTIERT, jetzt)
  assert.equal(uhr.status, 1, 'Date.now() über der Grenze macht die Vorprüfung rot')
  assert.match(uhr.text, /Uhr in Tests/, 'Meldung nennt die Uhr-Prüfung')
  assert.match(uhr.text, /1 statt höchstens 0/, 'Meldung nennt die Zählung des Wächters')
  assert.match(uhr.text, /Dateien dieses PR: tools\/zeit\.test\.mjs:1\b/, 'Meldung nennt die Datei und Zeile')
  const grenze = lauf('grenze', SORTIERT, jetzt, 1)
  assert.equal(grenze.status, 0, `Date.now() genau an der Grenze bleibt grün: ${grenze.text}`)
  const verschluckt = lauf('leer', SORTIERT, undefined, 0, { readme: 'k\nab\n', zusatz: ' README.md' })
  assert.equal(verschluckt.status, 1, 'verschluckter Leerraum in einer Nachbarzeile macht die Vorprüfung rot')
  assert.match(verschluckt.text, /Leerraum-Änderung README\.md:2 /, 'Meldung nennt Datei und Zeile')
  const absicht = lauf('absicht', SORTIERT, undefined, 0, { readme: 'k\nab\n', zusatz: ' README.md\nLeerraum: absichtlich – Probe' })
  assert.equal(absicht.status, 0, `Zeile „Leerraum: absichtlich“ lässt den Diff durch: ${absicht.text}`)
  const datenTitel = lauf('daten', SORTIERT, undefined, 0, { titel: 'fix(prime): fünf Fremdzuordnungen sperren' })
  assert.equal(datenTitel.status, 1, 'Daten-Titel mit „keine“ ohne gemessene Wirkung macht die Vorprüfung rot')
  assert.match(datenTitel.text, /gemessene Wirkung/, 'Meldung nennt die Titelregel')
  const ROT = "console.error('  ✗ Wächter: tools/x.test.mjs|beispiel.json')\nprocess.exit(1)\n"
  const bot = lauf('bot', SORTIERT, undefined, 0, { waechter: ROT })
  assert.equal(bot.status, 1, 'roter Bot-Pfade-Wächter bei berührter Kettendatei macht die Vorprüfung rot')
  assert.match(bot.text, /Bot-Pfade-Wächter .*rot:[\s\S]*tools\/x\.test\.mjs\|beispiel\.json/, 'Meldung nennt Datei und Literal des Wächters')
  const botAus = lauf('botaus', SORTIERT, undefined, 0, { waechter: ROT, nurReadme: true, readme: 'k\na b\nc\n' })
  assert.equal(botAus.status, 0, `ohne Kettendatei im Diff läuft der Wächter nicht: ${botAus.text}`)
  const OHNE = "import { spawnSync } from 'node:child_process'\nspawnSync('node', ['-v'])\n"
  const kind = lauf('kind', SORTIERT, OHNE)
  assert.equal(kind.status, 1, 'neuer Test mit spawnSync ohne Frist macht die Vorprüfung rot')
  assert.match(kind.text, /Kindprozess in Tests ohne Frist[\s\S]*tools\/zeit\.test\.mjs: 1 Kindprozess-Aufrufe ohne Frist, erlaubt 0/, 'Meldung nennt Datei und Zählung')
  const kulisse = lauf('kulisse', SORTIERT, undefined, 0, { nurReadme: true, readme: 'k\na b\nc\n', extra: { 'tools/x-kulisse.mjs': OHNE } })
  assert.equal(kulisse.status, 1, `Kulisse mit spawnSync ohne Frist macht die Vorprüfung rot: ${kulisse.text}`)
  assert.match(kulisse.text, /tools\/x-kulisse\.mjs: 1 Kindprozess-Aufrufe ohne Frist/, 'Meldung nennt die Kulisse')
  const kindFrist = lauf('kindfrist', SORTIERT, OHNE.replace("['-v']", "['-v'], { timeout: 5000 }"))
  assert.equal(kindFrist.status, 0, `spawnSync mit timeout bleibt grün: ${kindFrist.text}`)
  const kindAus = lauf('kindaus', SORTIERT, undefined, 0, { nurReadme: true, readme: 'k\na b\nc\n', basis: { 'tools/alt.test.mjs': OHNE } })
  assert.equal(kindAus.status, 0, `ohne berührten Test läuft die Ratsche nicht: ${kindAus.text}`)
  const MUT = JSON.stringify([{ name: 'neu', aenderungen: [{ datei: 'a.ts', suche: 'a', ersetze: 'b' }] }])
  const mutant = lauf('mutant', SORTIERT, undefined, 0, { basis: { 'a.ts': 'a' }, extra: { 'tools/mutationen/x.json': MUT }, zusatz: ' tools/mutationen/x.json' })
  assert.match(mutant.text, /! Hinweis: tools\/mutationen\/x\.json: neuer Mutant „neu“ ohne Feld tests/, 'main meldet den Mutanten ohne tests')
  assert.equal(mutant.status, 0, `der Hinweis bricht nicht ab: ${mutant.text}`)
  // Ein alter Stempel (feste Vergangenheit, nie „heute“) bei umgeschriebenem Eintrag; ein neuer Eintrag löst nichts aus.
  const alt = { 'data/patchnotes/a.yaml': 'text: x\n', 'data/patchnotes/_ueberarbeitet-bis.txt': '2000-01-01\n' }
  const stempel = lauf('stempel', SORTIERT, undefined, 0, { basis: alt, extra: { 'data/patchnotes/a.yaml': 'text: y\n' }, zusatz: ' data/patchnotes/a.yaml' })
  assert.match(stempel.text, /! Hinweis: Patch-Notes-Texte umgeschrieben, .* steht auf 2000-01-01/, 'main meldet den alten Stempel')
  const neuerEintrag = lauf('neueintrag', SORTIERT, undefined, 0, { basis: alt, extra: { 'data/patchnotes/b.yaml': 'text: y\n' }, zusatz: ' data/patchnotes/b.yaml' })
  assert.doesNotMatch(neuerEintrag.text, /Patch-Notes-Texte umgeschrieben/, 'neuer Eintrag löst keinen Stempel-Hinweis aus')
  // Neue Testdatei (tools/zeit.test.mjs): Hinweis ohne Beleg „rot an der Basis“, mit Beleg keiner; beides bricht nicht ab.
  const ohneBeleg = lauf('ohnebeleg', SORTIERT)
  assert.match(ohneBeleg.text, /! Hinweis: Neuer Test tools\/zeit\.test\.mjs: kein Beleg „rot an der Basis“/, 'main meldet den fehlenden Basis-Beleg')
  assert.equal(ohneBeleg.status, 0, `der Hinweis bricht nicht ab: ${ohneBeleg.text}`)
  const mitBeleg = lauf('mitbeleg', SORTIERT, undefined, 0, { zusatz: '\nBasis: Fall 1 rot (✖)' })
  assert.doesNotMatch(mitBeleg.text, /kein Beleg „rot an der Basis“/, 'mit Beleg im Text kein Hinweis')
  console.log('pr-vorpruefung-lauf.test: ok (unsortiert rot, sortiert grün, Uhr über Grenze rot, an Grenze grün, Leerraum rot, Ausweg grün, Daten-Titel rot, Bot-Pfade-Wächter bei Kettendatei rot, ohne Kettendatei nicht gefahren, Kindprozess ohne Frist rot, mit Frist grün, ohne berührten Test nicht gefahren, Mutant ohne tests und alter Stempel als Hinweis, neuer Eintrag ohne Stempel-Hinweis, neuer Test mit/ohne Basis-Beleg)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
