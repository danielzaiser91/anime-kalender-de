/**
 * Prüft den Rot-Alarm-Kanal: ALARM-Zeile -> ein Tagesissue, zweiter Lauf am selben Tag kein Duplikat, Alarm vorbei -> schließen,
 * und der Workflow `wecker-wache.yml` ruft beides (Aufräumen, dann Issue) wirklich auf. Aufruf: `node tools/alarm-issue.test.mjs`
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { alarmEntscheid, alarmLauf, alarmZeilen, berlinTag } from './alarm-issue.mjs'

const lies = (pfad) => readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8')
const SCHLUSS = '12 Läufe in der App, 0 rot\n\n0 abgenommen (trocken), 0 bleiben sichtbar\n'
const BESTAND = 'ALARM Bestandsbau seit 7.5 h rot (kein grüner Lauf danach, 3 rote/abgebrochene danach, Grenze 6 h)'
const DEPLOY = 'ALARM Deploy seit 8.0 h ohne Erfolg (kein grüner Lauf, 2 rote/abgebrochene danach, Grenze 6 h)'
const mit = (...zeilen) => `Kopf\n${zeilen.join('\n')}\n${SCHLUSS}`
const TAG = '2026-11-09'
const TITEL = `ALARM ${TAG}: Wache meldet ALARM`
const issue = (number, title, body = '', kommentare = []) => ({ number, title, body, comments: kommentare.map((b) => ({ body: b })) })

/* ---- Zeilen ---- */
assert.deepEqual(alarmZeilen(mit(BESTAND, `  ALARM? Fix-PRs nicht lesbar: x`, 'ALARM? Läufe nicht lesbar: y')), [BESTAND], 'nur echte Alarmzeilen')
assert.deepEqual(alarmZeilen('ALARM? nur Lesefehler\n'), [])

/* ---- Alarm, nichts offen -> neues Tagesissue ---- */
const neu = alarmEntscheid({ ausgabe: mit(BESTAND), offene: [], tag: TAG })
assert.equal(neu.length, 1)
assert.equal(neu[0].typ, 'neu')
assert.equal(neu[0].titel, TITEL)
assert.ok(neu[0].text.includes(BESTAND), 'Issue nennt die Alarmzeile')

/* ---- Zweiter Lauf am selben Tag: kein Duplikat (Issue steht mit Tagesdatum offen) ---- */
assert.deepEqual(alarmEntscheid({ ausgabe: mit(BESTAND), offene: [issue(7, TITEL, neu[0].text)], tag: TAG }), [], 'gleiche Art am selben Tag: nichts')
/* Neue Alarmart am selben Tag: Kommentar, kein zweites Issue. */
const komm = alarmEntscheid({ ausgabe: mit(BESTAND, DEPLOY), offene: [issue(7, TITEL, neu[0].text)], tag: TAG })
assert.equal(komm.length, 1)
assert.equal(komm[0].typ, 'kommentar')
assert.equal(komm[0].nummer, 7)
assert.ok(komm[0].text.includes(DEPLOY) && !komm[0].text.includes(BESTAND), 'Kommentar nennt nur die neue Art')
/* Die Art steht schon in einem Kommentar: nichts mehr. */
assert.deepEqual(alarmEntscheid({ ausgabe: mit(BESTAND, DEPLOY), offene: [issue(7, TITEL, neu[0].text, ['Neue Alarmart: - ' + DEPLOY])], tag: TAG }), [])
/* Ein Issue eines anderen Tags zählt nicht als Tagesissue: neues Issue, das alte schließt. */
const folgetag = alarmEntscheid({ ausgabe: mit(BESTAND), offene: [issue(5, 'ALARM 2026-11-08: Wache meldet ALARM', BESTAND)], tag: TAG })
assert.deepEqual(folgetag.map((h) => h.typ), ['neu', 'schliessen'])
assert.equal(folgetag[1].nummer, 5)

/* ---- Alarm vorbei -> schließen ---- */
const zu = alarmEntscheid({ ausgabe: mit(), offene: [issue(7, TITEL), issue(5, 'ALARM 2026-11-08: x')], tag: TAG })
assert.deepEqual(zu.map((h) => [h.typ, h.nummer]), [['schliessen', 7], ['schliessen', 5]])
assert.deepEqual(alarmEntscheid({ ausgabe: mit(), offene: [], tag: TAG }), [], 'nichts offen, nichts zu schließen')
/* Nichtauskunft schließt nie: Lesefehler, abgestürzte (unvollständige) Ausgabe, leere Ausgabe. */
assert.deepEqual(alarmEntscheid({ ausgabe: mit('ALARM? Läufe des Bestandsbaus nicht lesbar: timeout'), offene: [issue(7, TITEL)], tag: TAG }), [], 'Lesefehler schließt nicht')
assert.deepEqual(alarmEntscheid({ ausgabe: 'Kopf\nTypeError: boom\n', offene: [issue(7, TITEL)], tag: TAG }), [], 'Absturz schließt nicht')
assert.deepEqual(alarmEntscheid({ ausgabe: '', offene: [issue(7, TITEL)], tag: TAG }), [], 'leere Ausgabe schließt nicht')
/* A2: von Hand angelegte Issues mit demselben Label bleiben unberührt (Schließen und Folgetag). */
const vonHand = issue(3, 'Quelle X prüfen')
assert.deepEqual(alarmEntscheid({ ausgabe: mit(), offene: [vonHand, issue(7, TITEL)], tag: TAG }).map((h) => h.nummer), [7], 'Schließen nur bei „ALARM “-Titel')
assert.deepEqual(alarmEntscheid({ ausgabe: mit(BESTAND), offene: [vonHand], tag: TAG }).map((h) => h.typ), ['neu'], 'Handissue wird weder Tagesissue noch geschlossen')

/* A3: zwei Zeilen derselben Wortgruppe („ALARM Bestandsbau“) sind zwei Arten; Stundenzahlen allein sind keine neue Art. */
const SCHRITTE = 'ALARM Bestandsbau seit 7.0 h rot mit 2 verschiedenen Fehlerschritten (a; b; Grenze 2)'
const zweiArten = alarmEntscheid({ ausgabe: mit(BESTAND, SCHRITTE), offene: [issue(7, TITEL, `- ${BESTAND}`)], tag: TAG })
assert.deepEqual(zweiArten.map((h) => h.typ), ['kommentar'], 'zweite Bestandsbau-Zeile wird gemeldet')
assert.ok(zweiArten[0].text.includes(SCHRITTE) && !zweiArten[0].text.includes(BESTAND))
assert.deepEqual(alarmEntscheid({ ausgabe: mit(BESTAND.replace('7.5 h', '13.5 h').replace('3 rote', '9 rote')), offene: [issue(7, TITEL, `- ${BESTAND}`)], tag: TAG }), [], 'andere Zahlen, gleiche Art')

/* Berliner Tag: 23:30 UTC im Sommer ist schon der Folgetag, im Winter noch nicht. */
assert.equal(berlinTag(new Date('2026-07-01T23:30:00Z')), '2026-07-02')
assert.equal(berlinTag(new Date('2026-11-09T22:30:00Z')), '2026-11-09')
assert.equal(berlinTag(new Date('2026-11-09T23:30:00Z')), '2026-11-10')

/* Fehlende Ausgabedatei (Checkout gescheitert): Exit 0, kein gh-Aufruf (ohne Token im Test würde gh scheitern). */
const lauf = spawnSync(process.execPath, [fileURLToPath(new URL('./alarm-issue.mjs', import.meta.url)), '/nicht/vorhanden.txt'], { encoding: 'utf8', timeout: 30000, env: { PATH: '' } })
assert.equal(lauf.status, 0, lauf.stderr)
assert.match(lauf.stdout, /keine Ausgabe der Wachphase/)

/* ---- Ganzer Lauf mit gh-Attrappe: Aufrufe samt Argumenten, zweiter Lauf am selben Tag ohne Duplikat ---- */
function attrappe(offene) {
  const aufrufe = []
  const gh = (a) => {
    aufrufe.push(a)
    if (a[0] === 'issue' && a[1] === 'list') return JSON.stringify(offene)
    return ''
  }
  return { gh, aufrufe }
}
const a1 = attrappe([])
alarmLauf({ ausgabe: mit(BESTAND), tag: TAG, gh: a1.gh, repo: 'o/r' })
const erzeugt = a1.aufrufe.filter((a) => a[0] === 'issue' && a[1] === 'create')
assert.equal(erzeugt.length, 1)
assert.deepEqual(erzeugt[0].slice(0, 7), ['issue', 'create', '--repo', 'o/r', '--label', 'alarm', '--title'])
assert.equal(erzeugt[0][7], TITEL)
assert.ok(!erzeugt[0].join(' ').includes('TOKEN'), 'kein Token im Issue-Text')
const liste = a1.aufrufe.find((a) => a[0] === 'issue' && a[1] === 'list')
assert.deepEqual(liste.slice(0, 6), ['issue', 'list', '--repo', 'o/r', '--label', 'alarm'], 'nur Issues mit Label alarm')
const a2 = attrappe([issue(9, TITEL, erzeugt[0][9])])
alarmLauf({ ausgabe: mit(BESTAND), tag: TAG, gh: a2.gh, repo: 'o/r' })
assert.equal(a2.aufrufe.filter((a) => a[0] === 'issue' && a[1] !== 'list').length, 0, 'zweiter Lauf: kein Duplikat')
const a3 = attrappe([issue(9, TITEL)])
alarmLauf({ ausgabe: mit(), tag: TAG, gh: a3.gh, repo: 'o/r' })
const close = a3.aufrufe.find((a) => a[1] === 'close')
assert.deepEqual(close.slice(0, 5), ['issue', 'close', '9', '--repo', 'o/r'])
const a4 = attrappe([issue(9, TITEL, 'x', [])])
alarmLauf({ ausgabe: mit(BESTAND, DEPLOY), tag: TAG, gh: a4.gh, repo: 'o/r' })
const k = a4.aufrufe.find((a) => a[1] === 'comment')
assert.deepEqual(k.slice(0, 5), ['issue', 'comment', '9', '--repo', 'o/r'])

/* ---- Verdrahtung im Workflow: Aufräumen (ohne --trocken) vor dem Issue, beides unabhängig vom Deploy ---- */
const wache = parse(lies('.github/workflows/wecker-wache.yml'))
const job = wache.jobs.alarm
assert.ok(job, 'Job „alarm“ fehlt')
assert.deepEqual(job.permissions, { actions: 'read', contents: 'read', issues: 'write', 'pull-requests': 'read' })
assert.ok(job['timeout-minutes'] <= 9)
const aufraeumen = job.steps.findIndex((s) => /laeufe-aufraeumen\.mjs/.test(s.run ?? ''))
const issueSchritt = job.steps.findIndex((s) => /alarm-issue\.mjs/.test(s.run ?? ''))
assert.ok(aufraeumen >= 0 && issueSchritt > aufraeumen, 'erst Aufräumen, dann Issue')
assert.match(job.steps[aufraeumen].run, /laeufe-aufraeumen\.mjs --trocken >/, 'Wachphase nur lesend (scharf würde haengerWache Läufe abbrechen)')
assert.equal(job.steps[aufraeumen]['continue-on-error'], true, 'Absturz des Aufräumens stoppt den Alarm nicht')
assert.equal(job.steps[issueSchritt].if, 'always()')
assert.ok(!JSON.stringify(job).includes('LAUF_TOKEN'), 'kein LAUF_TOKEN im Job')
assert.ok(job.needs === undefined, 'unabhängig vom Deploy und vom Nachholen')
assert.ok(!JSON.stringify(job.steps[issueSchritt]).includes('LAUF_TOKEN'), 'Issue-Schritt sieht das Lauf-Token nicht')

console.log('alarm-issue: ok (Entscheid, Lauf mit gh-Attrappe, Verdrahtung)')
