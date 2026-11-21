/**
 * Tests für tools/pr-pruefer-uebernahme.mjs (CI-Prüfer übernimmt ein „ok“ bei gleichem eigenem Diff, 21.11.2026).
 * `lauf` mit gh-Attrappe: Antworten je Aufruf-Schlüssel, jeder Aufruf wird protokolliert. Kennungen über die Compare-Dateiliste.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { urteilAus } from './pr-nachrechnen-pruefer.mjs'
import { letztesUrteil } from './pr-pruefer-nach-kette.mjs'
import { legeGhAttrappe } from './gh-attrappe.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

// Startprüfung zuerst und im Kind: liefe main() schon beim Import, endete jeder Importeur (auch dieser Test) still mit Exit 0.
const modul = new URL('./pr-pruefer-uebernahme.mjs', import.meta.url).href
const ladeOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'uebernahme-laden-'))
const lader = path.join(ladeOrdner, 'lader.mjs')
fs.writeFileSync(lader, `await import(${JSON.stringify(modul)})\nconsole.log('geladen')\n`)
const laden = spawnSync(process.execPath, [lader], { encoding: 'utf8', timeout: 30_000 })
fs.rmSync(ladeOrdner, { recursive: true, force: true })
if (laden.stdout !== 'geladen\n') {
  console.error(`  ✗ Import startet das Werkzeug nicht — ${JSON.stringify([laden.status, laden.stdout, laden.stderr])}`)
  process.exit(1)
}
console.log('  ✓ Import startet das Werkzeug nicht')
const { MARKE_UEBERNAHME, lauf, uebernahme, uebernahmeKommentar, vertrauterAutor } = await import(modul)

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const C = 'c0123456789'.padEnd(40, 'c')
const commits = [{ oid: A, committedDate: '2026-11-21T10:00:00Z' }, { oid: B, committedDate: '2026-11-21T11:00:00Z' }, { oid: C, committedDate: '2026-11-21T12:00:00Z' }]
// Autorfelder wie `gh pr view --json comments`: Dirigent als Inhaber, CI-Prüfer mit Login „github-actions“ und Zuordnung NONE.
const DIRIGENT = { author: { login: 'derNamenloseDaniel' }, authorAssociation: 'OWNER' }
const BOT = { author: { login: 'github-actions' }, authorAssociation: 'NONE' }
const ok = (sha, zeit, wer = DIRIGENT) => ({ ...wer, createdAt: zeit, body: `**Prüfer (Dirigent entscheidet)** für ${sha.slice(0, 9)} - Urteil: **ok**` })
const de = (sha, zeit) => ({ ...BOT, createdAt: zeit, body: `**Prüfer-Review** für ${sha.slice(0, 9)} - Urteil: **aendern, Auflagen offen: Dirigent entscheidet**` })
const inhalt = (sha, zeit) => ({ ...BOT, createdAt: zeit, body: `**Prüfer-Review** für ${sha.slice(0, 9)} - Urteil: **aendern**` })
const alleGleich = () => true
const keinGleich = () => false

console.log('pr-pruefer-uebernahme: uebernahme')
pruefe('(1) ok am vorigen Kopf, Diff gleich -> übernehmen', JSON.stringify(uebernahme([ok(B, '2026-11-21T11:30:00Z')], commits, alleGleich)) === '{"von":"bbbbbbbbb","schon":false}')
pruefe('(2)/(3) ok am vorigen Kopf, Diff anders -> volle Prüfung', uebernahme([ok(B, '2026-11-21T11:30:00Z')], commits, keinGleich) === null)
pruefe('(4) wiederholtes „Dirigent entscheidet“ am diff-gleichen Kopf nach dem ok -> übernehmen', uebernahme([ok(A, '2026-11-21T10:30:00Z'), de(B, '2026-11-21T11:30:00Z')], commits, alleGleich)?.von === 'aaaaaaaaa')
pruefe('(5) inhaltliches „aendern“ nach dem ok -> volle Prüfung', uebernahme([ok(A, '2026-11-21T10:30:00Z'), inhalt(B, '2026-11-21T11:30:00Z')], commits, alleGleich) === null)
pruefe('nur „Dirigent entscheidet“, kein ok -> volle Prüfung (übernommen wird nur ein ok)', uebernahme([de(B, '2026-11-21T11:30:00Z')], commits, alleGleich) === null)
pruefe('ok ohne Kopfnennung wird nicht übernommen', uebernahme([{ ...DIRIGENT, createdAt: '2026-11-21T11:30:00Z', body: 'Prüfer Runde 2: ok' }], commits, alleGleich) === null)
pruefe('echtes ok am jetzigen Kopf -> bisheriger Weg (null)', uebernahme([ok(C, '2026-11-21T12:30:00Z')], commits, alleGleich) === null)
// Prüfer PR 4480, Befund 1: nur CI-Prüfer und Inhaber/Mitglied/Mitarbeiter zählen.
const fremd = (assoc) => ({ author: { login: 'fremder-nutzer' }, authorAssociation: assoc })
for (const assoc of ['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', undefined]) {
  pruefe(`Fremd-„ok“ (${assoc ?? 'ohne Zuordnung'}) am diff-gleichen Kopf -> keine Übernahme`, uebernahme([ok(B, '2026-11-21T11:30:00Z', fremd(assoc))], commits, alleGleich) === null)
}
pruefe('Fremd-„ok“ im REST-Format (user.login „github-actions[bot]“, kein author) -> keine Übernahme', uebernahme([ok(B, '2026-11-21T11:30:00Z', { user: { login: 'github-actions[bot]' } })], commits, alleGleich) === null)
pruefe('Fremd-„ok“ nach echtem „Dirigent entscheidet“ hebt es nicht auf', uebernahme([de(B, '2026-11-21T11:00:00Z'), ok(B, '2026-11-21T11:30:00Z', fremd('NONE'))], commits, alleGleich) === null)
for (const assoc of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
  pruefe(`„ok“ von ${assoc} -> übernehmen`, uebernahme([ok(B, '2026-11-21T11:30:00Z', fremd(assoc))], commits, alleGleich)?.von === 'bbbbbbbbb')
}
pruefe('„ok“ des CI-Prüfers (Login github-actions, Zuordnung NONE) -> übernehmen', uebernahme([ok(B, '2026-11-21T11:30:00Z', BOT)], commits, alleGleich)?.von === 'bbbbbbbbb')
pruefe('vertrauterAutor: Login ähnlich, aber nicht gleich zählt nicht', !vertrauterAutor({ author: { login: 'github-actions-x' }, authorAssociation: 'NONE' }) && !vertrauterAutor({}))
const schonDa = { ...BOT, createdAt: '2026-11-21T12:30:00Z', body: uebernahmeKommentar(C, 'bbbbbbbbb') }
pruefe('Übernahme am jetzigen Kopf schon geschrieben -> schon', JSON.stringify(uebernahme([ok(B, '2026-11-21T11:30:00Z'), schonDa], commits, alleGleich)) === '{"von":"c01234567","schon":true}')
pruefe('keine Commits -> null', uebernahme([ok(B, '2026-11-21T11:30:00Z')], [], alleGleich) === null)
pruefe('keine Urteile -> null', uebernahme([], commits, alleGleich) === null)

console.log('pr-pruefer-uebernahme: Kommentarform')
const text = uebernahmeKommentar(C, 'bbbbbbbbb')
pruefe('erste Zeile ist ein Prüfer-Urteil „ok“ für den Kopf', JSON.stringify(urteilAus(text)) === '{"wort":"ok","kopf":"c01234567"}', text.split('\n')[0])
pruefe('Marke steht im Text', text.includes(MARKE_UEBERNAHME))
pruefe('pr-pruefer-nach-kette sieht das Urteil des Kopfes (kein Neustart)', letztesUrteil([{ createdAt: '2026-11-21T12:30:00Z', body: text, user: { login: 'github-actions[bot]' } }], C)?.body === text)

console.log('pr-pruefer-uebernahme: lauf mit gh-Attrappe')
const PATCH = '@@ -1,2 +1,3 @@\n a\n+b\n c'
const dateien = (zeilen) => JSON.stringify([{ filename: 'tools/x.mjs', status: 'modified', patch: zeilen }])
function welt({ kommentare, kopfDiff = PATCH, headRefOid = C, letzter = C }) {
  const aufrufe = []
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    if (args[0] === 'pr' && args[1] === 'view') return JSON.stringify({ comments: kommentare, commits: [...commits.slice(0, 2), { oid: letzter, committedDate: '2026-11-21T12:00:00Z' }], baseRefName: 'main', headRefOid })
    if (args[0] === 'api') return args[1].endsWith(`...${C}`) ? dateien(kopfDiff) : dateien(PATCH.replace('-1,2 +1,3', '-7,2 +7,3'))
    if (args[0] === 'pr' && (args[1] === 'comment' || args[1] === 'review')) return ''
    throw new Error(`unerwartet: ${args.join(' ')}`)
  }
  const geschrieben = {}
  const zeilen = []
  const ja = lauf({ pr: '7', kopf: C, gh, schreibe: (n, t) => ((geschrieben[n] = t), `/tmp/${n}`), melde: (t) => zeilen.push(t) })
  return { ja, aufrufe, geschrieben, zeilen }
}
const w1 = welt({ kommentare: [ok(B, '2026-11-21T11:30:00Z'), de(C, '2026-11-21T12:10:00Z')] })
pruefe('(1)+(4) lauf: Übernahme, Kommentar und Approve, Rückgabe true', w1.ja === true
  && w1.aufrufe.includes('pr comment 7 --body-file /tmp/uebernahme.md') && w1.aufrufe.includes('pr review 7 --approve --body Urteil: ok, übernommen von bbbbbbbbb (eigener Diff gleich). Stand c01234567.')
  && w1.geschrieben['uebernahme.md'] === uebernahmeKommentar(C, 'bbbbbbbbb'), w1.aufrufe)
pruefe('lauf: Compare je Kopf genau einmal, Basis aus baseRefName', w1.aufrufe.filter((a) => a.startsWith('api ')).join('|') === `api repos/{owner}/{repo}/compare/main...${B} --jq .files|api repos/{owner}/{repo}/compare/main...${C} --jq .files`, w1.aufrufe)
pruefe('lauf: Meldung nennt beide Köpfe', w1.zeilen.at(-1) === 'Übernahme: ja, „ok“ von bbbbbbbbb gilt für c01234567', w1.zeilen)
const w2 = welt({ kommentare: [ok(B, '2026-11-21T11:30:00Z')], kopfDiff: `${PATCH}\n+eigen` })
pruefe('(2) lauf: eigener Commit -> kein Kommentar, kein Review, false', w2.ja === false && !w2.aufrufe.some((a) => a.startsWith('pr comment') || a.startsWith('pr review')), w2.aufrufe)
const w3 = welt({ kommentare: [ok(B, '2026-11-21T11:30:00Z'), inhalt(C, '2026-11-21T12:10:00Z')] })
pruefe('(5) lauf: inhaltliches aendern -> volle Prüfung, nichts geschrieben', w3.ja === false && !w3.aufrufe.some((a) => a.startsWith('pr comment') || a.startsWith('pr review')), w3.aufrufe)
const w4 = welt({ kommentare: [ok(B, '2026-11-21T11:30:00Z'), schonDa] })
pruefe('lauf: schon übernommen (Neustart) -> true ohne neuen Kommentar oder Review', w4.ja === true && !w4.aufrufe.some((a) => a.startsWith('pr comment') || a.startsWith('pr review')), w4.aufrufe)
const w5 = welt({ kommentare: [ok(B, '2026-11-21T11:30:00Z')], headRefOid: 'd'.repeat(40), letzter: 'd'.repeat(40) })
pruefe('lauf: Kopf ist nicht mehr der aktuelle -> false, kein Compare', w5.ja === false && w5.zeilen.join() === 'Übernahme: nein (Kopf c01234567 ist nicht der aktuelle)' && !w5.aufrufe.some((a) => a.startsWith('api ')), w5.aufrufe)
const w6 = welt({ kommentare: [ok(B, '2026-11-21T11:30:00Z')], letzter: 'd'.repeat(40) })
pruefe('lauf: letzter Commit weicht von headRefOid ab -> false', w6.ja === false, w6.zeilen)
const w7 = welt({ kommentare: [ok(B, '2026-11-21T11:30:00Z')], headRefOid: 'd'.repeat(40) })
pruefe('lauf: headRefOid neuer als das Ereignis, Commit-Liste noch alt -> false', w7.ja === false && !w7.aufrufe.some((a) => a.startsWith('pr comment')), w7.zeilen)

console.log('pr-pruefer-uebernahme: Prozess (Exit immer 0, Ausgabe nur bei Übernahme)')
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'uebernahme-test-'))
const ausgabe = path.join(ordner, 'output')
fs.writeFileSync(ausgabe, '')
// PATH ohne gh: der erste Aufruf scheitert, das Werkzeug muss trotzdem mit 0 enden und nichts ausgeben.
const umgebung = { ...process.env, PATH: ordner, GH_TOKEN: '', GITHUB_OUTPUT: ausgabe, RUNNER_TEMP: ordner, PR: '7', HEAD_SHA: C }
const werkzeug = fileURLToPath(new URL('./pr-pruefer-uebernahme.mjs', import.meta.url))
const kind = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8', timeout: 30_000, cwd: ordner, env: umgebung })
pruefe('ohne gh: Exit 0, „volle Prüfung“, keine Ausgabe uebernommen', kind.status === 0 && /^Übernahme: nein \(Fehler: .*\), volle Prüfung$/m.test(kind.stdout) && fs.readFileSync(ausgabe, 'utf8') === '', [kind.status, kind.stdout, kind.stderr])
// gh-Attrappe: PR ohne „ok“ -> lauf gibt false, Exit 0 und GITHUB_OUTPUT bleibt leer (die Ausgabe hängt an der Rückgabe, nicht am Durchlauf).
const ghOrdner = path.join(ordner, 'gh')
fs.mkdirSync(ghOrdner)
const antwort = path.join(ordner, 'pr.json')
fs.writeFileSync(antwort, JSON.stringify({ comments: [], commits, baseRefName: 'main', headRefOid: C }))
const ghUmgebung = legeGhAttrappe(ghOrdner, { befehl: 'pr view 7 --json comments,commits,baseRefName,headRefOid', antwortDatei: antwort })
const ohneOk = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8', timeout: 30_000, cwd: ordner, env: { ...umgebung, ...ghUmgebung } })
pruefe('mit gh, kein ok: Exit 0, „volle Prüfung“, GITHUB_OUTPUT leer', ohneOk.status === 0 && ohneOk.stdout.includes('Übernahme: nein (kein „ok“') && fs.readFileSync(ausgabe, 'utf8') === '', [ohneOk.status, ohneOk.stdout, ohneOk.stderr])
// Ganzer Weg als Prozess: gh als Node-Skript (Kommentar-Datei wird mitgeschrieben), „ok“ an B, gleicher Diff -> Kommentar, Approve, uebernommen=1.
if (process.platform === 'win32') {
  console.log('  - Prozess mit Übernahme: 1 übersprungen (Shell-Hülle nur unter Linux, die Kette fährt ihn)')
} else {
  const voll = path.join(ordner, 'voll')
  fs.mkdirSync(voll)
  const protokoll = path.join(ordner, 'protokoll.jsonl')
  const skript = path.join(ordner, 'gh-voll.mjs')
  const prDaten = { comments: [ok(B, '2026-11-21T11:30:00Z')], commits, baseRefName: 'main', headRefOid: C }
  fs.writeFileSync(skript, [
    "import fs from 'node:fs'",
    'const a = process.argv.slice(2)',
    `fs.appendFileSync(${JSON.stringify(protokoll)}, JSON.stringify({ a, body: a[3] === '--body-file' ? fs.readFileSync(a[4], 'utf8') : null }) + '\\n')`,
    `if (a[0] === 'pr' && a[1] === 'view') process.stdout.write(${JSON.stringify(JSON.stringify(prDaten))})`,
    `else if (a[0] === 'api') process.stdout.write(${JSON.stringify(dateien(PATCH))})`,
    "else if (a[0] !== 'pr') process.exit(1)",
  ].join('\n'))
  fs.writeFileSync(path.join(voll, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${skript}" "$@"\n`)
  fs.chmodSync(path.join(voll, 'gh'), 0o755)
  fs.writeFileSync(ausgabe, '')
  const mitOk = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8', timeout: 30_000, cwd: ordner, env: { ...umgebung, PATH: `${voll}:${process.env.PATH}` } })
  const zeilen = fs.readFileSync(protokoll, 'utf8').trim().split('\n').map((z) => JSON.parse(z))
  const kommentar = zeilen.find((z) => z.a[1] === 'comment')
  pruefe('Prozess mit Übernahme: Exit 0, uebernommen=1, Kommentartext aus der Datei, Approve', mitOk.status === 0 && fs.readFileSync(ausgabe, 'utf8') === 'uebernommen=1\n'
    && kommentar?.body === uebernahmeKommentar(C, 'bbbbbbbbb') && zeilen.some((z) => z.a[1] === 'review' && z.a[3] === '--approve'), [mitOk.status, mitOk.stdout, mitOk.stderr, zeilen.map((z) => z.a.slice(0, 2).join(' '))])
}
fs.rmSync(ordner, { recursive: true, force: true })

if (fehler.length > 0) {
  console.error(`pr-pruefer-uebernahme: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-uebernahme: alle Fälle grün')
