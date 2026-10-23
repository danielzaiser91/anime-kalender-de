/**
 * Test für tools/pr-pruefer-modus.mjs (Abnahme-Modus des CI-Prüfers, 21.10.2026). Die Fälle sind die Fixture-Verläufe der Abnahme:
 * 1 Runde 1 „aendern“ mit A1-A3, dann der spätere Kopf -> Abnahme mit genau diesen Auflagen; 2 derselbe Verlauf ohne A2 ändert
 * die Auflagenliste nicht (A2 bleibt drin, das Urteil darüber fällt der Prüfer); 3 erster bereiter Kopf ohne Vorgeschichte -> voll.
 * Das Urteil des Modells selbst ist kein Testgegenstand; die Abbildung Urteil -> Review prüft pr-pruefer-freigabe.test.mjs.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auflagenText, bestimmeModus, main } from './pr-pruefer-modus.mjs'

const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

const BOT = 'github-actions[bot]'
const ci = (kopf, urteil, modus, protokoll = 'Protokoll') => ({
  user: { login: BOT },
  author_association: 'NONE',
  body: `**Prüfer-Review** für ${kopf} - Urteil: **${urteil}**\n\n${protokoll}\n\n<!-- pruefer-modus: ${modus} -->\n`,
})
const agent = (text, assoc = 'OWNER', login = 'danielzaiser91') => ({ user: { login }, author_association: assoc, body: text })
const R1 = agent('Prüfer Runde 1: ändern\nA1 Test fehlt\nA2 Mutation fehlt\nA3 Doku alt')
const CI_R1 = ci('aaaaaaaaa', 'aendern', 'voll', 'A1 Test fehlt\nA2 Mutation fehlt\nA3 Doku alt')
const NACHTRAG = agent('## Nachtrag\nA1 erledigt\nA2 erledigt\nA3 erledigt')
const kurz = (m) => ({
  modus: m.modus,
  vorher: m.vorher,
  frei: m.aenderFrei,
  quellen: m.auflagen.map((a) => a.quelle),
})

// Fall 1: Verlauf Runde 1 -> Nachbesserung -> späterer Kopf.
const fall1 = bestimmeModus([CI_R1, R1, NACHTRAG], '2')
gleich('Fall 1: Abnahme mit beiden Quellen der Runde 1, frei bei Stufe 2', kurz(fall1), {
  modus: 'abnahme',
  vorher: 'aaaaaaaaa',
  frei: true,
  quellen: ['Kommentar des Agent-Prüfers', 'CI-Review für aaaaaaaaa (aendern)'],
})
const text1 = auflagenText(fall1.auflagen, fall1.vorher)
gleich('Fall 1: A1, A2, A3 stehen in der Auflagendatei, der Nachtrag nicht',
  ['A1 Test fehlt', 'A2 Mutation fehlt', 'A3 Doku alt'].every((a) => text1.includes(a)) && !text1.includes('erledigt'), true)
// Fall 2: dieselbe Lage, der Nachtrag lässt A2 aus -> die Liste bleibt gleich (A2 ist weiter eine Auflage).
const fall2 = bestimmeModus([CI_R1, R1, agent('## Nachtrag\nA1 erledigt\nA3 erledigt')], '2')
gleich('Fall 2: Auflagenliste unverändert, A2 bleibt Auflage', auflagenText(fall2.auflagen, fall2.vorher), text1)
// Fall 3: erster bereiter Kopf ohne CI-Vorgeschichte -> voll, auch wenn der Agent-Prüfer schon kommentiert hat.
gleich('Fall 3: keine Kommentare -> voll', kurz(bestimmeModus([], '2')).modus, 'voll')
gleich('Fall 3: nur Agent-Prüfer-Kommentar, noch kein CI-Review -> voll', bestimmeModus([R1, NACHTRAG], '2').modus, 'voll')
gleich('Fall 3: nur Nachtrag und Stufen-Kommentar -> voll', bestimmeModus([agent('<!-- pr-stufe -->', 'NONE', BOT), NACHTRAG], '2').modus, 'voll')

// Wer zählt: nur der Bot als CI-Review, nur Berechtigte als Agent-Prüfer; Marke nur in der letzten Zeile.
const fremdesCi = { user: { login: 'fremd' }, author_association: 'NONE', body: CI_R1.body }
gleich('CI-Kopfzeile von einem Fremden -> kein Review, voll', bestimmeModus([fremdesCi], '2').modus, 'voll')
gleich('Prüfer-Kommentar eines Fremden zählt nicht als Auflage', bestimmeModus([CI_R1, agent('Prüfer: ändern X', 'NONE', 'fremd')], '2').auflagen.length, 1)
gleich('Prüfer-Kommentar eines Mitglieds zählt', bestimmeModus([CI_R1, agent('Prüfer: ändern X', 'MEMBER', 'm')], '2').auflagen.length, 2)
gleich('Prüfer-Kommentar eines Mitarbeiters zählt', bestimmeModus([CI_R1, agent('Prüfer: ändern X', 'COLLABORATOR', 'm')], '2').auflagen.length, 2)
gleich('Kommentar „Prüfer-Review“ des Inhabers ist kein Agent-Urteil', bestimmeModus([CI_R1, agent('**Prüfer-Review** für abc - Urteil: **ok**')], '2').auflagen.length, 1)
const zitat = ci('bbbbbbbbb', 'aendern', 'voll', 'Zitat: <!-- pruefer-modus: abnahme --> mitten im Text').body.replace(/\n<!-- pruefer-modus: voll -->\n$/, '\n')
gleich('Marke im Protokoll, keine Marke am Ende -> Modus voll, Auflage zählt',
  bestimmeModus([{ user: { login: BOT }, author_association: 'NONE', body: zitat }], '2').auflagen.length, 1)

// Frei: nur Stufe 2 und nur, solange kein Abnahme-aendern im Verlauf steht.
const abnahmeAendern = ci('ccccccccc', 'aendern, Auflagen offen: Dirigent entscheidet', 'abnahme')
const abnahmeOk = ci('ddddddddd', 'ok', 'abnahme')
gleich('Stufe 2, kein Abnahme-Urteil -> frei', bestimmeModus([CI_R1], '2').aenderFrei, true)
gleich('Stufe 1 -> nicht frei', bestimmeModus([CI_R1], '1').aenderFrei, false)
gleich('Stufe 0 -> nicht frei', bestimmeModus([CI_R1], '0').aenderFrei, false)
gleich('Stufe leer -> nicht frei', bestimmeModus([CI_R1], '').aenderFrei, false)
gleich('Stufe 2, Abnahme-aendern schon einmal -> nicht frei', bestimmeModus([CI_R1, abnahmeAendern], '2').aenderFrei, false)
gleich('Stufe 2, Abnahme-aendern (Titel nur „aendern“) -> nicht frei', bestimmeModus([CI_R1, ci('ccccccccc', 'aendern', 'abnahme')], '2').aenderFrei, false)
gleich('Stufe 2, nur Abnahme-ok bisher -> frei', bestimmeModus([CI_R1, abnahmeOk], '2').aenderFrei, true)
gleich('Stufe 2, nur voll-aendern (Runde 1) zählt nicht als Abnahme-aendern -> frei', bestimmeModus([CI_R1, ci('eeeeeeeee', 'aendern', 'voll')], '2').aenderFrei, true)
// Auflagen: nur voll-aendern und Agent; Abnahme-Kommentare und ok nicht.
gleich('Auflagen ohne Abnahme-Kommentare und ohne ok-Reviews', bestimmeModus([CI_R1, abnahmeAendern, abnahmeOk, ci('fffffffff', 'ok', 'voll')], '2').auflagen.map((a) => a.quelle), ['CI-Review für aaaaaaaaa (aendern)'])
gleich('Früheres Review nur ok: Abnahme ohne Auflagen', kurz(bestimmeModus([ci('999999999', 'ok, Checks rot: X', 'voll')], '2')), { modus: 'abnahme', vorher: '999999999', frei: true, quellen: [] })
gleich('Ohne Auflagen steht der Hinweis in der Datei', auflagenText([], '999999999').includes('Keine Auflagen'), true)
gleich('Letzter geprüfter Kopf ist der des jüngsten CI-Reviews', bestimmeModus([CI_R1, abnahmeOk], '2').vorher, 'ddddddddd')
gleich('Kopf wird auf 9 Zeichen gekürzt', bestimmeModus([ci('0123456789abcdef', 'aendern', 'voll')], '2').vorher, '012345678')

// Grenzen: höchstens 6 Quellen, je 20000 Zeichen.
const viele = bestimmeModus([CI_R1, ...Array.from({ length: 8 }, (_, i) => agent(`Prüfer: ändern ${i}`))], '2')
gleich('Höchstens 6 Quellen, die ersten bleiben', viele.auflagen.length === 6 && viele.auflagen[0].text.includes('ändern 0') && viele.auflagen[5].text.includes('ändern 5'), true)
const lang = bestimmeModus([CI_R1, agent('Prüfer: ' + 'x'.repeat(30000))], '2').auflagen[0].text
gleich('Je Quelle höchstens 20000 Zeichen, der Anfang bleibt', [lang.length, lang.startsWith('Prüfer: x')], [20000, true])
gleich('Ohne CI-Review ist der letzte Kopf leer', bestimmeModus([R1], '2').vorher, '')
gleich('Ohne Kopf steht „(unbekannt)“ in der Datei', auflagenText([], '').includes('Letzter geprüfter Kopf: (unbekannt)'), true)

// main: Aufruf der API, Ausgabe, Datei; Abruffehler und Unsinn -> voll.
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-modus-'))
const datei = path.join(ordner, 'auflagen.md')
try {
  const aufrufe = []
  const api = (args) => {
    aufrufe.push(args.join(' '))
    return [[CI_R1, R1], [NACHTRAG]]
  }
  gleich('main: Ausgabezeilen', main('7', '2', datei, api, 'o/r'), 'modus=abnahme\naendern-frei=1\nvorher=aaaaaaaaa\n')
  gleich('main: genau ein API-Aufruf mit Seiten zusammengefasst', aufrufe, ['--paginate --slurp repos/o/r/issues/7/comments'])
  const geschrieben = fs.readFileSync(datei, 'utf8')
  gleich('main: Datei enthält die Auflagen und den letzten Kopf', [geschrieben.includes('A2 Mutation fehlt'), geschrieben.includes('Letzter geprüfter Kopf: aaaaaaaaa')], [true, true])
  gleich('main: nur Nachtrag, kein CI-Review -> voll', main('7', '2', datei, () => [[NACHTRAG]], 'o/r'), 'modus=voll\naendern-frei=1\nvorher=\n')
  gleich('main: Datei ohne Auflagen nennt den Hinweis', fs.readFileSync(datei, 'utf8').includes('Keine Auflagen'), true)
  gleich('main: Stufe 1 -> aendern-frei=0', main('7', '1', datei, api, 'o/r').includes('aendern-frei=0\n'), true)
  const stumm = console.error
  console.error = () => {}
  const werfend = () => {
    throw new Error('HTTP 502')
  }
  gleich('main: Abruf scheitert -> voll, nicht frei', main('7', '2', datei, werfend, 'o/r'), 'modus=voll\naendern-frei=0\nvorher=\n')
  gleich('main: Antwort ohne Liste -> voll', main('7', '2', datei, () => ({}), 'o/r'), 'modus=voll\naendern-frei=0\nvorher=\n')
  console.error = stumm

  // Prozess: Aufruf ohne Argumente endet mit 2 und schreibt nichts nach stdout.
  const lauf = spawnSync(process.execPath, [fileURLToPath(new URL('./pr-pruefer-modus.mjs', import.meta.url))], { encoding: 'utf8' })
  gleich('Prozess ohne Argumente: Exit 2, stdout leer', [lauf.status, lauf.stdout], [2, ''])

  // Prozess mit gh als Programm (Kopie von node; `gh api …` lädt die Datei `api` im Arbeitsordner): echter Abruf-Weg von main.
  const bin = path.join(ordner, 'bin')
  fs.mkdirSync(bin)
  if (process.platform === 'win32') fs.copyFileSync(process.execPath, path.join(bin, 'gh.exe'))
  else fs.symlinkSync(process.execPath, path.join(bin, 'gh'))
  const log = path.join(ordner, 'gh.log')
  const attrappe = [
    "const fs = require('node:fs')",
    "fs.appendFileSync(process.env.GH_LOG, process.argv.slice(2).join(' ') + '\\n')",
    "if (process.env.GH_FEHLER) { process.stderr.write('HTTP 502'); process.exit(1) }",
    `process.stdout.write(${JSON.stringify(JSON.stringify([[CI_R1, R1], [NACHTRAG]]))})`,
  ].join('\n')
  fs.writeFileSync(path.join(ordner, 'api'), attrappe)
  const skript = fileURLToPath(new URL('./pr-pruefer-modus.mjs', import.meta.url))
  const env = (extra) => ({ ...process.env, PATH: bin + path.delimiter + process.env.PATH, GITHUB_REPOSITORY: 'o/r', GH_LOG: log, ...extra })
  const gut = spawnSync(process.execPath, [skript, '7', '2', path.join(ordner, 'a.md')], { cwd: ordner, env: env({}), encoding: 'utf8' })
  gleich('Prozess mit gh: Ausgabe, Exit 0, ein Abruf', [gut.status, gut.stdout, fs.readFileSync(log, 'utf8')], [0, 'modus=abnahme\naendern-frei=1\nvorher=aaaaaaaaa\n', '--paginate --slurp repos/o/r/issues/7/comments\n'])
  gleich('Prozess mit gh: Auflagendatei geschrieben', fs.readFileSync(path.join(ordner, 'a.md'), 'utf8').includes('A3 Doku alt'), true)
  const schlecht = spawnSync(process.execPath, [skript, '7', '2', path.join(ordner, 'b.md')], { cwd: ordner, env: env({ GH_FEHLER: '1' }), encoding: 'utf8' })
  gleich('Prozess mit gh, Abruf scheitert: Exit 0, voll, Fehler auf stderr', [schlecht.status, schlecht.stdout, schlecht.stderr.includes('HTTP 502')], [0, 'modus=voll\naendern-frei=0\nvorher=\n', true])
} finally {
  fs.rmSync(ordner, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`pr-pruefer-modus.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-modus.test: grün (Fall 1-3, Frei-Weiche, Quellen, Grenzen, main, Prozess)')
