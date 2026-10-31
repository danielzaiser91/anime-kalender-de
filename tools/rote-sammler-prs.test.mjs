// Gegenprobe zu `tools/rote-sammler-prs.mjs` (17.10.2026): Auswahl, Alter, Text, und die Verdrahtung in `tools/laeufe-aufraeumen.mjs`.
// Das Werkzeug läuft ganz (ohne Netz: untergeschobenes fetch), `gh` ist eine Attrappe im PATH und prüft Befehl und Parameter.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legeGhAttrappe } from './gh-attrappe.mjs'
import { abzuloesen, meldeRoteSammlerPrs, rotePrs, schluesselVon, zeilen } from './rote-sammler-prs.mjs'

const JETZT = Date.parse('2026-10-17T12:00:00Z')
const vorStunden = (h) => new Date(JETZT - h * 3600_000).toISOString()
const liste = [
  { number: 1, title: 'chore(data): ohne Marke', body: '**A**', createdAt: vorStunden(1) },
  { number: 2, title: '[Prüfung rot] chore(data): Zwei', body: 'von **A** (Lauf 1)', createdAt: vorStunden(5) },
  { number: 3, title: '[Prüfung rot] chore(data): Drei', body: 'von **B** (Lauf 2)', createdAt: vorStunden(72) },
  { number: 4, title: 'x [Prüfung rot] mitten im Titel', body: '**A**', createdAt: vorStunden(1) },
  { number: 5, title: '[Prüfung rot] chore(data): Fünf', body: 'von **A** (Lauf 3)', createdAt: vorStunden(47) },
  { number: 6, title: '[Prüfung rot] chore(data): Sechs', body: 'von **AB** (Lauf 4)', createdAt: vorStunden(2) },
  { number: 7, title: '[Prüfung rot] ohne Text', createdAt: vorStunden(2) },
]

assert.deepEqual(rotePrs(liste).map((p) => p.number), [2, 3, 5, 6, 7], 'nur Titel, die mit der Marke beginnen')

// Grenze je Fund (Runde 3): zwei Jobs desselben Workflows, der fremde Job steht in der Mitte und bleibt offen.
const W = 'Wöchentlich — tiefer Durchlauf'
const fund = (nr, schluessel, titel = `[Prüfung rot] Fund ${nr}`, zeilenende = '\n') => ({
  number: nr,
  title: titel,
  body: `von **${W}** (Lauf ${nr})${zeilenende}<!-- fund-schluessel: ${schluessel} -->${zeilenende}${zeilenende}Rest`,
})
const ANILIST = `${W}/anilist/chore(data): Tiefendurchlauf gesammelt (AniList)`
const ADN = `${W}/adn/chore(data): Tiefendurchlauf gesammelt (ADN)`
const jobs = [
  fund(501, ANILIST),
  fund(504, `${ANILIST} 2`),
  fund(502, ADN),
  fund(505, ANILIST, 'chore(data): grün, gleicher Schlüssel'),
  { number: 506, title: '[Prüfung rot] alter Text', body: `von **${W}** (Lauf 1)` },
  fund(503, ADN, '[Prüfung rot] Fund 503', '\r\n'),
  fund(507, ADN),
]
assert.deepEqual(abzuloesen(jobs, ADN, 507), [502, 503], 'der ADN-Fund löst nur ADN-Funde ab (auch mit CRLF), nie den AniList-Fund in der Mitte')
assert.deepEqual(abzuloesen(jobs, ANILIST, 501), [], 'Schlüssel ganz, nicht als Präfix; ohne Marke und ohne Schlüssel bleibt alles')
assert.deepEqual(abzuloesen(jobs, ADN, '502'), [503, 507], 'Nummer als Text gleich Nummer als Zahl')
assert.deepEqual(abzuloesen(jobs, `${W}/rtl/x`, 9), [])
assert.deepEqual(abzuloesen(jobs, `${ANILIST} 2 und mehr`, 9), [], 'ein älterer Schlüssel, der Präfix des neuen ist, bleibt')
const pfeil = [fund(601, 'W/j/a --> b'), fund(602, 'W/j/a --> c'), fund(603, 'W/j/a --> b')]
assert.deepEqual(abzuloesen(pfeil, 'W/j/a --> b', 9), [601, 603], 'ein „-->“ in der Nachricht gehört zum Schlüssel')
const zitiert = { number: 604, title: '[Prüfung rot] z', body: `Zitat <!-- fund-schluessel: ${ADN} -->\n<!-- fund-schluessel: ${ANILIST} -->\n` }
assert.equal(schluesselVon(zitiert), ANILIST, 'nur eine Zeile, die mit der Marke beginnt')
assert.equal(schluesselVon({ body: `<!-- fund-schluessel: ${ADN} --> Nachsatz\n<!-- fund-schluessel: ${ANILIST} -->` }), ANILIST, 'nur eine Zeile, die mit der Marke endet')
assert.equal(zeilen(jobs, JETZT)[0], '6 Sammler-PR(s) mit roter Datenprüfung offen (nicht gemergt, ein Mensch löst sie):', 'die Liste nennt rote PRs mit und ohne Schlüssel')
assert.equal(schluesselVon(jobs[2]), ADN)
assert.equal(schluesselVon({ body: null }), undefined)
const cli = spawnSync(process.execPath, [fileURLToPath(new URL('./rote-sammler-prs.mjs', import.meta.url)), 'nummern', ADN, '507'], { input: JSON.stringify(jobs), encoding: 'utf8' })
assert.equal(cli.stdout, '502\n503\n', `Aufruf wie in quellen-pr.sh: ${cli.stderr}`)
assert.deepEqual(zeilen([liste[0]], JETZT), [], 'nichts offen: keine Zeilen')
const z = zeilen(liste, JETZT)
assert.match(z[0], /^5 Sammler-PR/)
assert.ok(z.some((s) => /#2 {2}seit 5 h {2}\[Prüfung rot\] chore\(data\): Zwei/.test(s)), z.join('\n'))
assert.ok(z.some((s) => /#3 {2}seit 3 Tage /.test(s)), 'ab 48 Stunden in Tagen')
assert.ok(z.some((s) => /#5 {2}seit 47 h /.test(s)), 'unter 48 Stunden in Stunden')

assert.match(zeilen([{ number: 8, title: '[Prüfung rot] z', body: '', createdAt: vorStunden(71) }], JETZT)[1], /seit 2 Tage/, 'Tage werden abgerundet')
const ausgabe = []
meldeRoteSammlerPrs(() => liste, (t) => ausgabe.push(t), JETZT)
assert.match(ausgabe.join('\n'), /#3 {2}seit 3 Tage/)
const leer = []
meldeRoteSammlerPrs(() => [liste[0]], (t) => leer.push(t), JETZT)
assert.deepEqual(leer, ['Keine Sammler-PRs mit roter Datenprüfung offen.'])
const kaputt = []
meldeRoteSammlerPrs(() => { throw new Error('gh kaputt\nzweite Zeile') }, (t) => kaputt.push(t), JETZT)
assert.deepEqual(kaputt, ['Rote Sammler-PRs nicht lesbar: gh kaputt'], 'ein Abruffehler wirft nicht')

// Verdrahtung: Die Wachphase (laeufe-aufraeumen --trocken) nennt die roten PRs, obwohl alle Läufe grün sind.
const dir = mkdtempSync(join(tmpdir(), 'rote-prs-'))
try {
  const befehl = 'pr list --state open --limit 100 --json number,title,body,createdAt'
  // Der Prüfling liest die echte Uhr: die Zeitstempel wandern mit, sonst kippt "seit 3 Tage" mit dem Kalender (18.10.2026, 12:00 UTC).
  const verschoben = liste.map((p) => ({ ...p, createdAt: new Date(Date.parse(p.createdAt) + Date.now() - JETZT).toISOString() }))
  writeFileSync(join(dir, 'liste.json'), JSON.stringify(verschoben))
  const ghEnv = legeGhAttrappe(dir, { befehl, antwortDatei: join(dir, 'liste.json') })
  const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const wache = (antwort) =>
    spawnSync(process.execPath, ['--import', `data:text/javascript,globalThis.fetch=async()=>${antwort}`, werkzeug, '--trocken'], {
      encoding: 'utf8',
      env: { ...process.env, ...ghEnv },
    })
  const r = wache('new Response("[]",{status:200})')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /5 Sammler-PR\(s\) mit roter Datenprüfung offen/)
  assert.match(r.stdout, /#3 {2}seit 3 Tage/)
  // W10 (Runde 3): Ist der Status-Worker nicht erreichbar, kehrt die Wachphase früh zurück — die roten PRs stehen trotzdem schon da.
  const ohneWorker = wache('new Response("kaputt",{status:503})')
  assert.match(ohneWorker.stderr, /Status-Worker antwortet 503/, 'der Worker-Fehler ist eingetreten')
  assert.match(ohneWorker.stdout, /5 Sammler-PR\(s\) mit roter Datenprüfung offen/, 'rote PRs auch ohne Status-Worker')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('rote-sammler-prs: ok')
