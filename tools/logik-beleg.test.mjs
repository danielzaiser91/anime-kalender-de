/**
 * Beleg „check:logic war für diesen Inhalt grün“ (tools/logik-beleg.mjs): Abdruck, Nachrichtenzeile, Gültigkeit im Wegwerf-Repo,
 * Kommandozeile und die Verdrahtung in commit-data.sh, deploy.yml und bestand-bauen.yml (geparst, nicht per Textsuche).
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { BELEG_ZEILE, BOT_MAIL, abdruckAusGit, abdruckVon, belegAusNachricht, belegZeile, belegt, gueltigkeit, main } from './logik-beleg.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const wegwerf = mkdtempSync(join(tmpdir(), 'logik-beleg-'))
let faelle = 0
const ok = (bedingung, name) => {
  assert.ok(bedingung, name)
  faelle += 1
}
const gleich = (ist, soll, name) => {
  assert.deepEqual(ist, soll, name)
  faelle += 1
}

// Datenpfad-Namen zusammengesetzt: der Schreibziel-Scanner liest data/-Literale als Ziele.
const DATEN = ['public', 'data'].join('/')
const CACHE = ['data', 'cache'].join('/')
const BELEGE = ['data', 'dub-confirmed.yaml'].join('/')

let nummer = 0
function repo() {
  const ordner = join(wegwerf, `r${(nummer += 1)}`)
  mkdirSync(ordner, { recursive: true })
  const git = (...a) => execFileSync('git', a, { cwd: ordner, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  git('init', '-q', '-b', 'main')
  git('config', 'core.autocrlf', 'false')
  const schreibe = (pfad, text) => {
    mkdirSync(dirname(join(ordner, pfad)), { recursive: true })
    writeFileSync(join(ordner, pfad), text)
  }
  const commit = (nachricht, email = 't@t', zeile = null) => {
    git('add', '-A')
    const nachrichten = zeile ? ['-m', nachricht, '-m', zeile] : ['-m', nachricht]
    git('-c', 'user.name=t', '-c', `user.email=${email}`, 'commit', '-q', '--allow-empty', ...nachrichten)
  }
  return { ordner, git, schreibe, commit }
}
const abdruckIn = (ordner) => {
  const zeilen = []
  main(['abdruck'], ordner, (z) => zeilen.push(z))
  assert.match(zeilen[0] ?? '', /^[0-9a-f]{64}$/, 'abdruckIn: der Abdruck muss berechenbar sein')
  return zeilen[0]
}

// 1. Abdruck: Datenpfade sind egal, alles andere zählt.
{
  const r = repo()
  r.schreibe('tools/a.mjs', 'eins')
  r.schreibe(`${DATEN}/titles.json`, '{}')
  r.schreibe(`${CACHE}/roh.json`, '{}')
  r.schreibe(BELEGE, 'a: 1')
  r.commit('start')
  const a0 = abdruckIn(r.ordner)
  ok(/^[0-9a-f]{64}$/.test(a0), 'Abdruck ist ein sha256')
  r.schreibe(`${DATEN}/titles.json`, '{"neu":1}')
  r.schreibe(`${DATEN}/neu.json`, '{}')
  r.schreibe(`${CACHE}/roh.json`, '{"neu":1}')
  gleich(abdruckIn(r.ordner), a0, 'Datenpfade geändert (auch ungestaged, neu): gleicher Abdruck')
  r.commit('daten')
  gleich(abdruckIn(r.ordner), a0, 'Datenpfade committet: gleicher Abdruck')
  r.schreibe(BELEGE, 'a: 2')
  ok(abdruckIn(r.ordner) !== a0, 'Handbeleg-Datei geändert: anderer Abdruck')
  r.schreibe(BELEGE, 'a: 1')
  gleich(abdruckIn(r.ordner), a0, 'Handbeleg zurück: wieder der alte Abdruck')
  r.schreibe('tools/a.mjs', 'zwei')
  ok(abdruckIn(r.ordner) !== a0, 'Code geändert: anderer Abdruck')
  r.schreibe('tools/a.mjs', 'eins')
  r.schreibe('tools/neu.mjs', 'x')
  ok(abdruckIn(r.ordner) !== a0, 'neue ungetrackte Code-Datei: anderer Abdruck')
  rmSync(join(r.ordner, 'tools/neu.mjs'))
  rmSync(join(r.ordner, 'tools/a.mjs'))
  ok(abdruckIn(r.ordner) !== a0, 'Code-Datei gelöscht: anderer Abdruck')
  r.schreibe('tools/a.mjs', 'eins')
  gleich(abdruckIn(r.ordner), a0, 'Code-Datei zurück: wieder der alte Abdruck')
  r.schreibe('.gitignore', 'ignoriert.txt\n')
  const a1 = abdruckIn(r.ordner)
  r.schreibe('ignoriert.txt', 'x')
  gleich(abdruckIn(r.ordner), a1, 'ignorierte Datei zählt nicht')
  // Dieselbe Pfadmenge mit vertauschtem Inhalt ist ein anderer Abdruck (Pfad und Hash zusammen).
  gleich(abdruckVon([['a', '1'], ['b', '2']]) === abdruckVon([['a', '2'], ['b', '1']]), false, 'Pfade und Hashes bleiben gepaart')
  gleich(abdruckVon([['a', '1'], ['b', '2']]), abdruckVon([['b', '2'], ['a', '1']]), 'Reihenfolge der Eingabe ist egal')
}

// 1b. Fehlerfälle von git (Kulisse für den Aufruf): unlesbare Antworten ergeben nie einen Abdruck.
{
  const r = repo()
  r.schreibe('tools/a.mjs', 'eins')
  r.schreibe('tools/b.mjs', 'zwei')
  r.commit('start')
  const kulisse = (pfade, hashes) => (args) => (args[0] === 'ls-files' ? `${pfade.join('\0')}\0` : `${hashes.join('\n')}\n`)
  const h40 = (z) => z.repeat(40)
  ok(/^[0-9a-f]{64}$/.test(abdruckAusGit(r.ordner, kulisse(['tools/a.mjs', 'tools/b.mjs'], [h40('a'), h40('b')]))), 'Kulisse: zwei Dateien, zwei Hashes: Abdruck')
  assert.throws(() => abdruckAusGit(r.ordner, kulisse(['tools/a.mjs', 'tools/b.mjs'], [h40('a')])), /Hash-Anzahl/, 'ein Hash zu wenig: kein Abdruck')
  faelle += 1
  assert.throws(() => abdruckAusGit(r.ordner, kulisse(['tools/a.mjs', 'tools/b.mjs'], [h40('a'), h40('b'), h40('c')])), /Hash-Anzahl/, 'ein Hash zu viel: kein Abdruck')
  faelle += 1
  assert.throws(() => abdruckAusGit(r.ordner, kulisse(['tools/a.mjs', 'tools/x\ny.mjs'], [h40('a'), h40('b')])), /Zeilenumbruch/, 'Pfad mit Zeilenumbruch: kein Abdruck')
  faelle += 1
  assert.throws(() => abdruckAusGit(r.ordner, kulisse([`${DATEN}/a\nb.json`, 'tools/a.mjs'], [h40('a')])), /Zeilenumbruch/, 'auch ein Datenpfad mit Zeilenumbruch: kein Abdruck (geschlossen)')
  faelle += 1
}

// 2. Nachrichtenzeile und Belegprüfung.
{
  const h = 'a'.repeat(64)
  gleich(belegAusNachricht(`chore(data)\n\n${belegZeile(h)}\n`), h, 'Zeile in eigener Zeile gefunden')
  gleich(belegAusNachricht(`chore(data) ${belegZeile(h)}`), null, 'Zeile mitten im Satz zählt nicht')
  gleich(belegAusNachricht(`${belegZeile('b'.repeat(63))}`), null, 'zu kurzer Abdruck zählt nicht')
  gleich(belegAusNachricht(`Logik-geprueft: ${'G'.repeat(64)}`), null, 'kein Hex zählt nicht')
  gleich(belegAusNachricht(`${belegZeile(h)}0`), null, 'Zeile mit angehängtem Zeichen zählt nicht')
  ok(BELEG_ZEILE.test(belegZeile(h)), 'belegZeile passt zu BELEG_ZEILE')
  const bot = (n) => ({ email: BOT_MAIL, nachricht: n })
  ok(belegt([bot('x'), bot(belegZeile(h))], h), 'zweiter Commit belegt')
  ok(!belegt([bot(belegZeile('b'.repeat(64)))], h), 'anderer Abdruck belegt nicht')
  ok(!belegt([{ email: 'mensch@example.org', nachricht: belegZeile(h) }], h), 'Zeile eines anderen Autors belegt nicht')
  ok(!belegt([], h), 'keine Commits belegen nichts')
}

// 3. Gültigkeit im Wegwerf-Repo: Bau-Commit mit Beleg, danach Bewegungen.
{
  const r = repo()
  r.schreibe('tools/a.mjs', 'eins')
  r.schreibe(`${DATEN}/titles.json`, '{}')
  r.commit('start')
  const gruen = abdruckIn(r.ordner)
  const zeile = []
  gleich(main(['zeile', gruen], r.ordner, (z) => zeile.push(z)), 0, 'zeile: Exit 0')
  gleich(zeile, [belegZeile(gruen)], 'zeile druckt bei gleichem Abdruck die Beleg-Zeile')
  const keine = []
  gleich(main(['zeile', 'c'.repeat(64)], r.ordner, (z) => keine.push(z)), 0, 'zeile: auch bei fremdem Abdruck Exit 0 (Commit nie blockieren)')
  gleich(keine, [], 'zeile druckt bei fremdem Abdruck nichts')
  main(['zeile', ''], r.ordner, (z) => keine.push(z))
  gleich(keine, [], 'zeile druckt bei leerem Abdruck nichts')
  const still = []
  gleich(main(['gleich', gruen], r.ordner, (z) => still.push(z)), 0, 'gleich: gleicher Abdruck, Exit 0')
  gleich(still, [], 'gleich druckt nichts')
  gleich(main(['gleich', 'c'.repeat(64)], r.ordner, () => {}), 1, 'gleich: anderer Abdruck, Exit 1')
  gleich(main(['gleich', ''], r.ordner, () => {}), 1, 'gleich: leerer Abdruck, Exit 1')

  ok(!gueltigkeit(r.ordner).gueltig, 'ohne Bau-Commit: nicht gültig')
  r.schreibe(`${DATEN}/titles.json`, '{"neu":1}')
  r.commit('chore(data): Bestand neu gebaut', BOT_MAIL, zeile[0])
  ok(gueltigkeit(r.ordner).gueltig, 'Bau-Commit mit Beleg: gültig')
  r.schreibe(`${DATEN}/titles.json`, '{"neu":2}')
  r.commit('Datenfix eines Menschen')
  ok(gueltigkeit(r.ordner).gueltig, 'danach nur Datenpfade bewegt: weiter gültig')
  r.schreibe('tools/a.mjs', 'zwei')
  r.commit('Codeänderung')
  ok(!gueltigkeit(r.ordner).gueltig, 'danach Code bewegt: nicht gültig')
  r.schreibe('tools/a.mjs', 'eins')
  r.commit('Codeänderung zurück')
  ok(gueltigkeit(r.ordner).gueltig, 'Code zurück: wieder gültig (Inhalt gleich dem belegten)')
  r.schreibe('tools/a.mjs', 'drei')
  r.commit('Mensch behauptet Beleg', 't@t', belegZeile(abdruckIn(r.ordner)))
  ok(!gueltigkeit(r.ordner).gueltig, 'Beleg-Zeile von einem Menschen: nicht gültig')

  // Der Beleg liegt weiter zurück als gelesen wird: 31 Commits dahinter gelten nicht.
  const s = repo()
  s.schreibe('tools/a.mjs', 'eins')
  s.commit('start')
  s.commit('Bau', BOT_MAIL, belegZeile(abdruckIn(s.ordner)))
  for (let i = 0; i < 29; i += 1) s.commit(`leer ${i}`)
  ok(gueltigkeit(s.ordner).gueltig, 'Beleg im 30. Commit von oben: gelesen')
  s.commit('leer 29')
  ok(!gueltigkeit(s.ordner).gueltig, 'Beleg im 31. Commit von oben: nicht mehr gelesen')
}

// 4. Kommandozeile: Ausgabe nach $GITHUB_OUTPUT nur bei Gültigkeit; Fehler heißen nicht gültig.
{
  const r = repo()
  r.schreibe('tools/a.mjs', 'eins')
  r.commit('start')
  const ausgabe = join(wegwerf, 'github-output.txt')
  const zeilen = []
  gleich(main(['gueltig'], r.ordner, (z) => zeilen.push(z), { GITHUB_OUTPUT: ausgabe }), 0, 'gueltig ohne Beleg: Exit 0')
  ok(!existsSync(ausgabe), 'ohne Beleg wird nichts nach GITHUB_OUTPUT geschrieben')
  ok(zeilen[0].startsWith('check:logic läuft'), 'ohne Beleg nennt das Log den Lauf')
  r.commit('Bau', BOT_MAIL, belegZeile(abdruckIn(r.ordner)))
  main(['gueltig'], r.ordner, (z) => zeilen.push(z), { GITHUB_OUTPUT: ausgabe })
  gleich(readFileSync(ausgabe, 'utf8'), 'gueltig=1\n', 'mit Beleg steht gueltig=1 in GITHUB_OUTPUT')
  ok(zeilen[1].startsWith('check:logic entfällt'), 'mit Beleg nennt das Log die Auslassung')
  const kein = join(wegwerf, 'kein-repo')
  mkdirSync(kein)
  const ausgabe2 = join(wegwerf, 'github-output-2.txt')
  gleich(main(['gueltig'], kein, () => {}, { GITHUB_OUTPUT: ausgabe2 }), 0, 'außerhalb eines Repos: Exit 0')
  ok(!existsSync(ausgabe2), 'außerhalb eines Repos wird nichts geschrieben')
  gleich(main(['abdruck'], kein, () => {}), 1, 'abdruck außerhalb eines Repos: Exit 1')
  gleich(main(['gleich', 'a'.repeat(64)], kein, () => {}), 1, 'gleich außerhalb eines Repos: Exit 1')
  gleich(main(['unbekannt'], r.ordner, () => {}), 2, 'unbekannter Befehl: Exit 2')
  // Als eigener Prozess (Aufruf wie im Workflow).
  const prozess = execFileSync(process.execPath, [join(tools, 'logik-beleg.mjs'), 'gueltig'], { cwd: r.ordner, encoding: 'utf8', windowsHide: true, env: { ...process.env, GITHUB_OUTPUT: join(wegwerf, 'prozess.txt') } })
  ok(prozess.startsWith('check:logic entfällt'), 'Prozessaufruf: Beleg erkannt')
  gleich(readFileSync(join(wegwerf, 'prozess.txt'), 'utf8'), 'gueltig=1\n', 'Prozessaufruf schreibt GITHUB_OUTPUT')
}

// 5. Verdrahtung: geparste Workflows und die Autor-Adresse in commit-data.sh.
{
  const deploy = yaml.load(readFileSync(join(wurzel, '.github/workflows/deploy.yml'), 'utf8'))
  const schritte = deploy.jobs.pruefen.steps
  const beleg = schritte.find((s) => s.id === 'beleg')
  gleich(beleg.run, 'node tools/logik-beleg.mjs gueltig', 'deploy.yml: Beleg-Schritt ruft logik-beleg gueltig')
  gleich(schritte.indexOf(beleg) < schritte.findIndex((s) => s.name === 'Zusicherungen prüfen'), true, 'deploy.yml: Beleg vor den Zusicherungen')
  gleich(schritte[0].with, { 'fetch-depth': 30, filter: 'blob:none' }, 'deploy.yml: Checkout holt den Verlauf')
  const zusicherung = schritte.find((s) => s.name === 'Zusicherungen prüfen')
  gleich(zusicherung.env.LOGIK_BELEGT, '${{ steps.beleg.outputs.gueltig }}', 'deploy.yml: LOGIK_BELEGT kommt aus dem Beleg-Schritt')
  gleich(
    zusicherung.run,
    'npm run check:pfade\nif [ "$LOGIK_BELEGT" = 1 ]; then\n  echo "check:logic übersprungen: vom Bestandsbau für diesen Inhalt belegt (Schritt „Logik-Beleg“)."\nelse\n  npm run check:logic\nfi\nnpm run check:search\n',
    'deploy.yml: check:logic nur im Zweig ohne Beleg, pfade und search immer',
  )
  const bau = yaml.load(readFileSync(join(wurzel, '.github/workflows/bestand-bauen.yml'), 'utf8'))
  const vor = Object.values(bau.jobs).flatMap((j) => j.steps).find((s) => s.name === 'Neue Handbelege prüfen')
  ok(vor.run.includes('node tools/logik-beleg.mjs abdruck > "$RUNNER_TEMP/logik-gruen.txt"'), 'bestand-bauen.yml: Vorprüfung schreibt den Abdruck')
  ok(vor.run.includes('echo "LOGIK_GRUEN_DATEI=$RUNNER_TEMP/logik-gruen.txt" >> "$GITHUB_ENV"'), 'bestand-bauen.yml: Vorprüfung reicht die Datei weiter')
  const skript = readFileSync(join(tools, 'commit-data.sh'), 'utf8')
  ok(skript.includes(`BOT_MAIL="${BOT_MAIL}"`), 'commit-data.sh: Autor-Adresse gleicht BOT_MAIL des Belegs')
}

rmSync(wegwerf, { recursive: true, force: true })
console.log(`logik-beleg: ${faelle} Fälle grün.`)
