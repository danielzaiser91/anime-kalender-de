/**
 * Tests für tools/liegegut.mjs: alle 7 Signale mit Fixtures, nachgebaut aus den echten Fällen des Liegegut-Berichts vom 21.10.2026
 * (1676 Freigabe liegt, 1437/1371 überholt, 1530 Konflikt, 1397/1513 Urteile widersprechen sich, 1433/1594 rot, 1390 Ändern ohne Commit,
 * 1508/1513 gleiche Entscheidung F39), Grenzen genau auf/über der Schwelle, Nichtauskunft und Startlogik als eigener Prozess.
 * Schwellen und Erwartungen stehen hier fest eingetragen (nicht aus dem Modul importiert).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { offenePrs, checkStand, geteilteEntscheidungen, offeneEntscheidungen, kopfZeitVon, kopfZeiten, liegegut, main, grepMain, neueBezeichner, naechsterSchritt, signaleEinzel, stillstandSignal, ueberholtTreffer, urteile, JQ_PATCHES } from './liegegut.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const JETZT = Date.parse('2026-10-21T13:00:00Z')
const h = (stunden) => new Date(JETZT - stunden * 3600 * 1000).toISOString()
const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const ALT = 'ffffffffffffffffffffffffffffffffffffffff'
const GRUEN = [{ status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: h(30) }, { status: 'COMPLETED', conclusion: 'SKIPPED', completedAt: h(30) }]
const ROTE = [{ status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: h(40) }, { status: 'COMPLETED', conclusion: 'FAILURE', completedAt: h(13) }]

const bot = (stunden, kopf, urteil) => ({ author: { login: 'github-actions' }, createdAt: h(stunden), body: `**Prüfer-Review** für ${kopf.slice(0, 9)} - Urteil: **${urteil}**\n\nText` })
const daniel = (stunden, erste, rest = '') => ({ author: { login: 'danielzaiser91' }, createdAt: h(stunden), body: `${erste}\n${rest}` })

const pr = (nummer, felder) => ({
  number: nummer,
  title: `fix(x): Titel ${nummer}`,
  headRefOid: KOPF,
  createdAt: h(200),
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  isDraft: false,
  body: '',
  comments: [],
  statusCheckRollup: GRUEN,
  ...felder,
})

const nummern = (p, kopfStunden = 100) => signaleEinzel(p, JETZT - kopfStunden * 3600 * 1000, JETZT).map((s) => s.nr)

console.log('liegegut: Urteile lesen')
{
  const u = urteile([bot(5, KOPF, 'ok'), bot(4, ALT, 'aendern'), daniel(3, 'Prüfer Runde 2: freigeben', 'Kopf a1b2c3d4e'), daniel(2, 'Prüfer Runde 4 (Agent): ändern'), daniel(1, 'Bauer Runde 2: freigeben'), { author: { login: 'fremd' }, createdAt: h(1), body: 'Prüfer: ändern' }])
  pruefe('Bot ok, Bot ändern, Daniel freigeben mit Kopf, Daniel ändern ohne Kopf; Bauer und Fremde zählen nicht', JSON.stringify(u.map((x) => [x.quelle, x.gut, x.kopf])) === JSON.stringify([['bot', true, 'a1b2c3d4e'], ['bot', false, 'ffffffffff'.slice(0, 9)], ['daniel', true, 'a1b2c3d4e'], ['daniel', false, null]]), u)
  const rot = urteile([{ author: { login: 'github-actions' }, createdAt: h(1), body: `**Prüfer-Review** für ${KOPF.slice(0, 9)} - Urteil: **ok, Checks rot: Kette**` }])
  pruefe('„ok, Checks rot“ bleibt ein ok-Urteil (rot meldet Signal 4)', rot.length === 1 && rot[0].gut === true)
}

console.log('liegegut: Signal 1 Freigabe + grün + ruhend (Fall 1676)')
{
  const frei = pr(1676, { comments: [bot(20, KOPF, 'ok')] })
  pruefe('ok + grün + clean + 20 h ruhig → Signal 1', JSON.stringify(nummern(frei)) === '[1]', nummern(frei))
  pruefe('Daniel „freigeben“ ohne Bot zählt als Freigabe', JSON.stringify(nummern(pr(1, { comments: [daniel(20, 'Prüfer Runde 2: freigeben')] }))) === '[1]')
  pruefe('genau 12 h ruhig → noch nicht', nummern(pr(2, { comments: [bot(12, KOPF, 'ok')] })).length === 0)
  pruefe('12 h und eine Minute → Signal 1', nummern(pr(3, { comments: [{ ...bot(12, KOPF, 'ok'), createdAt: new Date(JETZT - 12 * 3600 * 1000 - 60000).toISOString() }] })).includes(1))
  pruefe('Kopf-Commit jünger als 12 h → nicht ruhend', nummern(pr(4, { comments: [bot(20, KOPF, 'ok')] }), 5).length === 0)
  pruefe('jüngerer Kommentar (5 h) → nicht ruhend', nummern(pr(5, { comments: [bot(20, KOPF, 'ok'), daniel(5, 'Hinweis')] })).length === 0)
  pruefe('Urteil auf altem Kopf zählt nicht', nummern(pr(6, { comments: [bot(20, ALT, 'ok')] })).length === 0)
  pruefe('Check offen (pending) → nicht grün', nummern(pr(7, { comments: [bot(20, KOPF, 'ok')], statusCheckRollup: [...GRUEN, { status: 'IN_PROGRESS', conclusion: '' }] })).length === 0)
  pruefe('keine Checks → nicht grün', nummern(pr(8, { comments: [bot(20, KOPF, 'ok')], statusCheckRollup: [] })).length === 0)
  pruefe('mergeStateStatus BLOCKED → nicht sauber', nummern(pr(9, { comments: [bot(20, KOPF, 'ok')], mergeStateStatus: 'BLOCKED' })).length === 0)
  pruefe('kein Urteil → kein Signal 1', nummern(pr(10)).length === 0)
}

console.log('liegegut: Signal 2 Urteile widersprechen sich (Fälle 1397, 1513)')
{
  const p1397 = pr(1397, { comments: [bot(60, KOPF, 'ok'), daniel(59, 'Prüfer Runde 4: ändern', 'Kopf a1b2c3d4e')] })
  pruefe('Bot ok, danach Daniel ändern → Signal 2', nummern(p1397).includes(2), nummern(p1397))
  const p1513 = pr(1513, { comments: [daniel(60, 'Prüfer: freigeben [runde-ausnahme]'), bot(59, KOPF, 'aendern')] })
  pruefe('Daniel freigeben, danach Bot ändern → Signal 2 (und 5)', JSON.stringify(nummern(p1513, 61)) === '[2,5]', nummern(p1513, 61))
  pruefe('Daniel-Urteil mit älterem Kopf zählt nicht mit', !nummern(pr(11, { comments: [daniel(60, 'Prüfer Runde 1: ändern', `Kopf ${ALT.slice(0, 9)}`), bot(59, KOPF, 'ok')] })).includes(2))
  pruefe('Daniel-Urteil ohne Kopf vor dem Kopf-Commit zählt nicht mit', !nummern(pr(12, { comments: [daniel(60, 'Prüfer: ändern'), bot(10, KOPF, 'ok')] }), 20).includes(2))
}

console.log('liegegut: Signal 3 Konflikt liegt (Fall 1530) und Gegenprobe')
{
  const p1530 = pr(1530, { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', comments: [bot(40, KOPF, 'ok')] })
  pruefe('ok + Konflikt 40 h → Signal 3, nicht Signal 1', JSON.stringify(nummern(p1530)) === '[3]', nummern(p1530))
  pruefe('Konflikt genau 24 h → noch nicht', nummern(pr(13, { mergeable: 'CONFLICTING', comments: [daniel(24, 'Hinweis')] })).length === 0)
  pruefe('Konflikt 25 h → Signal 3', nummern(pr(14, { mergeable: 'CONFLICTING', comments: [daniel(25, 'Hinweis')] })).includes(3))
  pruefe('MERGEABLE + UNKNOWN zählt nicht als Konflikt', nummern(pr(15, { mergeable: 'UNKNOWN', comments: [daniel(40, 'Hinweis')] })).length === 0)
}

console.log('liegegut: Signal 4 rote Checks auf dem Kopf (Fälle 1433, 1594)')
{
  pruefe('FAILURE seit 13 h → Signal 4', nummern(pr(1594, { statusCheckRollup: ROTE })).includes(4))
  const knapp = [{ status: 'COMPLETED', conclusion: 'FAILURE', completedAt: h(12) }]
  pruefe('FAILURE genau 12 h → noch nicht', !nummern(pr(16, { statusCheckRollup: knapp })).includes(4))
  pruefe('TIMED_OUT zählt als rot', nummern(pr(17, { statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'TIMED_OUT', completedAt: h(20) }] })).includes(4))
  pruefe('StatusContext state ERROR zählt als rot', nummern(pr(18, { statusCheckRollup: [{ state: 'ERROR', startedAt: h(20) }] })).includes(4))
  pruefe('abgebrochen/offen ist nicht rot', !nummern(pr(19, { statusCheckRollup: [{ status: 'IN_PROGRESS', conclusion: '', startedAt: h(20) }, { status: 'COMPLETED', conclusion: 'CANCELLED', completedAt: h(20) }] })).includes(4))
}

console.log('liegegut: Signal 5 Ändern-Urteil ohne neuen Commit (Fall 1390)')
{
  pruefe('Bot ändern auf dem Kopf seit 30 h → Signal 5', JSON.stringify(nummern(pr(1390, { comments: [bot(30, KOPF, 'aendern')] }), 40)) === '[5]')
  pruefe('genau 24 h → noch nicht', nummern(pr(20, { comments: [bot(24, KOPF, 'aendern')] }), 40).length === 0)
  pruefe('neuer Commit nach dem Urteil: Urteil gilt nicht mehr', nummern(pr(21, { comments: [bot(30, ALT, 'aendern')] }), 2).length === 0)
  pruefe('Daniel ändern seit 25 h, danach Bot ok → kein Signal 5 (letztes Urteil ok)', !nummern(pr(22, { comments: [daniel(26, 'Prüfer: ändern'), bot(25, KOPF, 'ok')] }), 40).includes(5))
  const review = (stunden, state) => ({ state, submittedAt: h(stunden), author: { login: 'danielzaiser91' } })
  const ohneApprove = pr(3009, { comments: [bot(30, KOPF, 'aendern')] })
  pruefe('Ändern seit 30 h, Approve jünger → kein Signal 5 (3009)', !nummern({ ...ohneApprove, reviews: [review(10, 'APPROVED')] }, 40).includes(5))
  pruefe('Gegenfall: Approve älter als das Ändern → Signal 5 bleibt', nummern({ ...ohneApprove, reviews: [review(40, 'APPROVED')] }, 40).includes(5))
  pruefe('Gegenfall: jüngeres Review ohne Approve (COMMENTED) → Signal 5 bleibt', nummern({ ...ohneApprove, reviews: [review(10, 'COMMENTED')] }, 40).includes(5))
}

console.log('liegegut: Signal 6 gleiche offene Entscheidung (Fälle 1508, 1513)')
{
  const a = pr(1508, { body: 'Entscheidung F39 offen' })
  const b = pr(1513, { title: 'Regel (F39)', body: 'F39 und F39' })
  const c = pr(1600, { body: 'Regel F40 gilt' })
  const m = geteilteEntscheidungen([a, b, c])
  pruefe('F39 in zwei PRs → beide', JSON.stringify([...m]) === JSON.stringify([[1508, ['F39']], [1513, ['F39']]]), [...m])
  pruefe('F-Nummer nur in einem PR (auch zweimal genannt) → nichts', geteilteEntscheidungen([b, c]).size === 0)
  const imBot = pr(1508, { comments: [bot(5, KOPF, 'aendern')].map((k) => ({ ...k, body: `${k.body} Entscheidung F39` })) })
  const imDaniel = pr(1513, { comments: [daniel(5, 'Hinweis', 'F39 offen')] })
  const stufe = pr(1514, { comments: [{ author: { login: 'github-actions' }, createdAt: h(5), body: '<!-- pr-stufe -->\n**Prüfstufe 1** F39' }] })
  pruefe('F39 im Prüfer-Review (1508) und im Daniel-Kommentar (1513) → beide', geteilteEntscheidungen([imBot, imDaniel]).size === 2)
  pruefe('Bot-Kommentar ohne Prüfer-Review (pr-stufe) zählt nicht', geteilteEntscheidungen([stufe, imDaniel]).size === 0)
  pruefe('Kommentar eines Fremden zählt nicht', geteilteEntscheidungen([pr(1515, { comments: [{ author: { login: 'fremd' }, createdAt: h(5), body: 'F39' }] }), imDaniel]).size === 0)
  pruefe('„F390“ ist nicht F39', geteilteEntscheidungen([a, pr(1601, { body: 'F390' })]).size === 0)
}

console.log('liegegut: Signal 6 nur für F-Nummern unter „### Jetzt“ in stand.md (F109 = A, 07.11.2026: 3141/3138/3117)')
{
  const stand = ['## Daniel-Todo', '### Jetzt', '- 🟠 **Frage** F39 offen', '', '### Später', '- ⏳ F40 wartet', '## Als Nächstes', '- F109 = A erledigt'].join('\n')
  const offen = offeneEntscheidungen(stand)
  pruefe('nur F39 steht unter Jetzt', JSON.stringify([...offen]) === '["F39"]', [...offen])
  const a = pr(3117, { body: 'F109 und F39' })
  const b = pr(3138, { body: 'F109 und F39' })
  pruefe('F39 offen unter Jetzt → Signal in beiden PRs', JSON.stringify([...geteilteEntscheidungen([a, b], offen)]) === JSON.stringify([[3117, ['F39']], [3138, ['F39']]]))
  const c = pr(3141, { body: 'F109' })
  const d = pr(3142, { body: 'F109 F40' })
  pruefe('F109 nur außerhalb von Jetzt → kein Signal', geteilteEntscheidungen([c, d], offen).size === 0)
  pruefe('F40 unter Später zählt nicht', geteilteEntscheidungen([pr(1, { body: 'F40' }), pr(2, { body: 'F40' })], offen).size === 0)
  pruefe('Datei fehlt (null) → keine Einschränkung', geteilteEntscheidungen([c, d], offeneEntscheidungen(null)).size === 2)
  pruefe('Jetzt am Dateiende (ohne nächste Überschrift)', offeneEntscheidungen('### Jetzt\n- F7').has('F7'))
  pruefe('ohne Abschnitt Jetzt → nichts offen', offeneEntscheidungen('## X\nF7').size === 0)
}

console.log('liegegut: Signal 7 Überholt über den Diff (Fehlalarme 07.11.2026: 7 von 7 nur wegen ähnlichem Titel)')
{
  const patch = (datei, zeilen) => `+++ b/${datei}\n@@ -1,3 +1,4 @@\n${zeilen.join('\n')}`
  const neuP = patch('tools/a.mjs', ['+export function neueFunktion(x) {', '+const GRENZWERT = 5', '+const abc = 1', '+  return x', ' alt'])
  const m = neueBezeichner(neuP)
  pruefe('neue Bezeichner: Funktion und Konstante, kurzer Name (abc) nicht', JSON.stringify([...m]) === JSON.stringify([['tools/a.mjs', ['neueFunktion', 'GRENZWERT']]]), [...m])
  pruefe('Name in entfernter UND hinzugefügter Zeile (Signaturänderung) ist nicht neu', neueBezeichner(patch('tools/a.mjs', ['-function bestehend(a) {', '+function bestehend(a, b) {'])).size === 0)
  pruefe('Name nur in entfernter Zeile zählt nicht, Name davor in der Nachbardatei schon', JSON.stringify([...neueBezeichner(`${patch('x.ts', ['+const nurHier = 1'])}\n${patch('y.ts', ['-const nurHier = 1'])}`)]) === JSON.stringify([['x.ts', ['nurHier']]]))
  pruefe('Nicht-Code (Doku, Daten) liefert keine Namen', neueBezeichner(patch('docs/x.md', ['+const dokuName = 1'])).size === 0 && neueBezeichner(patch('data/x.json', ['+const datenName = 1'])).size === 0)
  pruefe('Typen und Klassen zählen, TS und tsx auch', JSON.stringify([...neueBezeichner(patch('web/src/k.tsx', ['+export type Zustand = 1', '+class Behaelter {'])).values()]) === JSON.stringify([['Zustand', 'Behaelter']]))
  const stehtAlles = (_datei, namen) => namen.map((n, i) => `${10 + i}:  ${n} = 1`).join('\n')
  const t = ueberholtTreffer(neuP, stehtAlles)
  pruefe('alle neuen Namen stehen auf main → Treffer mit Fundstelle', t.map((x) => x.fundstelle).join() === 'tools/a.mjs:10 neueFunktion,tools/a.mjs:11 GRENZWERT', t)
  pruefe('einer fehlt auf main → kein Treffer (verschiedene Namen, einer vorhanden)', ueberholtTreffer(neuP, (_d, namen) => namen.filter((n) => n === 'GRENZWERT').map((n) => `3:${n}`).join('\n')).length === 0)
  pruefe('keiner steht auf main → kein Treffer (Titel ähnelt einem main-Commit, Inhalt neu)', ueberholtTreffer(neuP, () => '').length === 0)
  pruefe('Teilwort auf main (GRENZWERT_MAX) ist kein Treffer für GRENZWERT', ueberholtTreffer(patch('a.ts', ['+const GRENZWERT = 5']), () => '4:const GRENZWERT_MAX = 6').length === 0)
  pruefe('Wortende auf main (MAX_GRENZWERT) ist kein Treffer für GRENZWERT', ueberholtTreffer(patch('a.ts', ['+const GRENZWERT = 5']), () => '4:const MAX_GRENZWERT = 6').length === 0)
  pruefe('PR ohne neue Bezeichner (nur Daten/Doku) → kein Treffer', ueberholtTreffer('', stehtAlles).length === 0 && ueberholtTreffer(patch('docs/x.md', ['+text']), stehtAlles).length === 0)

  const werk = fs.mkdtempSync(path.join(os.tmpdir(), 'liegegut-git-'))
  const echt = (args) => execFileSync('git', args, { cwd: werk, encoding: 'utf8', windowsHide: true, timeout: 20000 })
  echt(['init', '-q'])
  fs.writeFileSync(path.join(werk, 'lib.mjs'), 'export function vorhanden() {}\nconst anderes = 1\n')
  echt(['add', 'lib.mjs'])
  echt(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x'])
  echt(['update-ref', 'refs/remotes/origin/main', 'HEAD'])
  pruefe('echtes git: Treffer ohne Präfix, Zeilennummer vorn', grepMain(echt, 'lib.mjs', ['vorhanden']).trim() === '1:export function vorhanden() {}', grepMain(echt, 'lib.mjs', ['vorhanden']))
  pruefe('echtes git: kein Treffer (Exit 1) → leer', grepMain(echt, 'lib.mjs', ['fehlt']) === '')
  let geworfen = null
  try { grepMain((a) => echt(a.map((x) => (x === 'origin/main' ? 'gibtesnicht' : x))), 'lib.mjs', ['vorhanden']) } catch (e) { geworfen = e }
  pruefe('echtes git: unbekannter Ref (Exit 128) wirft, kein stilles „nichts“', geworfen !== null && geworfen.status === 128, geworfen?.status)
  const gesamt = ueberholtTreffer(patch('lib.mjs', ['+export function vorhanden() {}', '+const anderes = 1']), (d, n) => grepMain(echt, d, n))
  pruefe('echtes git: Patch gegen main-Stand → beide Namen belegt', gesamt.map((x) => x.fundstelle).join() === 'lib.mjs:1 vorhanden,lib.mjs:2 anderes', gesamt)
  pruefe('echtes git: einer neu → kein Treffer', ueberholtTreffer(patch('lib.mjs', ['+const anderes = 1', '+const wirklichNeu = 2']), (d, n) => grepMain(echt, d, n)).length === 0)
  fs.rmSync(werk, { recursive: true, force: true })
}

console.log('liegegut: Grenzen und Randfälle (Mutationsprobe 21.10.2026)')
{
  const minute = (stunden) => new Date(JETZT - stunden * 3600 * 1000 - 60000).toISOString()
  const ae = (zeit) => ({ ...bot(0, KOPF, 'aendern'), createdAt: zeit })
  pruefe('Ändern-Urteil 24 h und eine Minute → Signal 5', nummern(pr(30, { comments: [ae(minute(24))] }), 40).includes(5))
  const unsortiert = urteile([daniel(1, 'Prüfer: ändern'), daniel(5, 'Prüfer: freigeben')])
  pruefe('Urteile kommen nach Zeit sortiert (älteste zuerst)', unsortiert.map((u) => u.gut).join() === 'true,false', unsortiert)
  pruefe('Daniel schreibt klein/groß: „prüfer Runde 2: Freigeben“ gilt', urteile([daniel(1, 'prüfer Runde 2: Freigeben')]).length === 1)
  pruefe('Daniel-Urteil nur aus der ersten Zeile', urteile([daniel(1, 'Prüfer Runde 1: Hinweis', 'freigeben')]).length === 0)
  const gleich = signaleEinzel(pr(31, { comments: [{ ...daniel(0, 'Prüfer: ändern'), createdAt: new Date(JETZT - 30 * 3600 * 1000).toISOString() }] }), JETZT - 30 * 3600 * 1000, JETZT)
  pruefe('Daniel-Urteil ohne Kopf zur Sekunde des Kopf-Commits gilt', gleich.map((s) => s.nr).join() === '5', gleich)
  pruefe('CANCELLED ist weder grün noch rot', nummern(pr(32, { comments: [bot(20, KOPF, 'ok')], statusCheckRollup: [...GRUEN, { status: 'COMPLETED', conclusion: 'CANCELLED', completedAt: h(20) }] })).length === 0)
  pruefe('StatusContext state SUCCESS zählt als grün', nummern(pr(33, { comments: [bot(20, KOPF, 'ok')], statusCheckRollup: [{ state: 'SUCCESS' }] })).includes(1))
  pruefe('zweiter, jüngerer Fehlschlag (5 h) setzt die Rotzeit zurück', !nummern(pr(34, { statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE', completedAt: h(30) }, { status: 'COMPLETED', conclusion: 'FAILURE', completedAt: h(5) }] })).includes(4))
  // Doppelstart der Kette (pr-nachrechnen öffnet zweimal): der abgebrochene Sammeljob bleibt neben dem neuen im Rollup (PR 2340: 3 CANCELLED + 4 SUCCESS)
  const lauf = (konkl, vor, name = 'PR-Prüfkette') => ({ name, status: 'COMPLETED', conclusion: konkl, completedAt: h(vor) })
  const mitLauf = (...laeufe) => nummern(pr(40, { comments: [bot(20, KOPF, 'ok')], statusCheckRollup: [...GRUEN, ...laeufe] }))
  pruefe('Doppelstart: älterer CANCELLED, jüngerer SUCCESS gleichen Namens → grün', mitLauf(lauf('CANCELLED', 30), lauf('SUCCESS', 25)).includes(1))
  pruefe('Doppelstart: Reihenfolge der Einträge egal', mitLauf(lauf('SUCCESS', 25), lauf('CANCELLED', 30)).includes(1))
  pruefe('Abbruch ohne Nachfolger: jüngerer CANCELLED über älterem SUCCESS → nicht grün', !mitLauf(lauf('SUCCESS', 30), lauf('CANCELLED', 25)).includes(1))
  // Laufender Eintrag: gh liefert completedAt "0001-01-01T00:00:00Z"; die Zeit kommt dann aus startedAt
  const laeuft = (vor) => ({ name: 'PR-Prüfkette', status: 'IN_PROGRESS', conclusion: '', startedAt: h(vor), completedAt: '0001-01-01T00:00:00Z' })
  pruefe('älterer SUCCESS, jüngerer laufender Eintrag (completedAt 0001) → nicht grün', !mitLauf(lauf('SUCCESS', 30), laeuft(25)).includes(1))
  pruefe('laufender Eintrag in anderer Reihenfolge → nicht grün', !mitLauf(laeuft(25), lauf('SUCCESS', 30)).includes(1))
  pruefe('älterer FAILURE, jüngerer laufender Eintrag → nicht rot', !nummern(pr(43, { statusCheckRollup: [lauf('FAILURE', 30), laeuft(25)] })).includes(4))
  pruefe('laufender Eintrag älter als der abgeschlossene SUCCESS → grün', mitLauf(laeuft(30), lauf('SUCCESS', 25)).includes(1))
  pruefe('CANCELLED eines anderen Namens wird nicht vom SUCCESS verdeckt', !mitLauf(lauf('CANCELLED', 30, 'Anderer'), lauf('SUCCESS', 25)).includes(1))
  pruefe('Wiederholungslauf: älterer FAILURE, jüngerer SUCCESS → nicht rot', !nummern(pr(41, { statusCheckRollup: [lauf('FAILURE', 30), lauf('SUCCESS', 25)] })).includes(4))
  pruefe('jüngerer FAILURE über älterem SUCCESS → rot', nummern(pr(42, { statusCheckRollup: [lauf('SUCCESS', 30), lauf('FAILURE', 25)] })).includes(4))
  pruefe('gleicher Zeitpunkt: der spätere Listeneintrag gewinnt', checkStand([lauf('CANCELLED', 30), lauf('SUCCESS', 30)]).art === 'gruen')
  pruefe('StatusContext ohne completedAt: startedAt zählt (5 h → nicht rot lang genug)', !nummern(pr(35, { statusCheckRollup: [{ state: 'ERROR', startedAt: h(5) }] })).includes(4))
  const widerspruch = signaleEinzel(pr(36, { comments: [bot(60, KOPF, 'ok'), bot(50, KOPF, 'aendern'), bot(40, KOPF, 'ok'), bot(30, KOPF, 'aendern')] }), JETZT - 100 * 3600 * 1000, JETZT).find((s) => s.nr === 2)
  pruefe('Signal 2 „seit“ ist das jüngste Urteil', widerspruch !== undefined && widerspruch.seit === JETZT - 30 * 3600 * 1000, widerspruch)
  const stufe1 = signaleEinzel(pr(37, { comments: [bot(30, KOPF, 'aendern'), bot(20, KOPF, 'ok')] }), JETZT - 100 * 3600 * 1000, JETZT)
  pruefe('Ändern, dann ok (Nachtrag statt Commit, 1997/2007): weder Signal 5 noch Signal 2', stufe1.length === 0, stufe1)
  const mitNachtrag = signaleEinzel(pr(38, { comments: [bot(30, KOPF, 'aendern'), daniel(25, 'Nachtrag', 'Auflagen umgesetzt'), bot(20, KOPF, 'ok')] }), JETZT - 100 * 3600 * 1000, JETZT)
  pruefe('Ändern, Nachtrag-Kommentar, ok: kein Signal 2', !mitNachtrag.some((s) => s.nr === 2), mitNachtrag)
  const umgekehrt = signaleEinzel(pr(39, { comments: [bot(30, KOPF, 'ok'), bot(20, KOPF, 'aendern')] }), JETZT - 100 * 3600 * 1000, JETZT)
  pruefe('Ok, dann ändern: Signal 2 bleibt', umgekehrt.some((s) => s.nr === 2), umgekehrt)
  const f = (titel) => pr(40, { title: titel, body: '' })
  pruefe('F-Nummer nur im Titel zählt', geteilteEntscheidungen([f('Regel F39'), pr(41, { body: 'F39' })]).size === 2)
}

console.log('liegegut: nächster Schritt (Tabelle)')
{
  const t = [
    [[1], [1], false, 'ÜBERHOLT?'], [[3], [1], false, 'ÜBERHOLT?'], [[5], [1], false, 'ÜBERHOLT?'], [[1], [], false, 'MERGEN'],
    [[2], [1], true, 'DANIEL'], [[4], [1], false, 'NACHBESSERN'], [[6], [1], false, 'DANIEL'], [[2], [], true, 'DANIEL'],
    [[2], [], false, 'NACHBESSERN'], [[3], [], false, 'NACHBESSERN'], [[1, 6], [], false, 'DANIEL'], [[2, 3], [], true, 'DANIEL'],
  ]
  for (const [n, treffer, botLetzt, soll] of t) {
    const ist = naechsterSchritt(n, treffer.map(() => ({})), botLetzt)
    pruefe(`Signale ${n} Treffer ${treffer.length} bot-zuletzt ${botLetzt} → ${soll}`, ist === soll, ist)
  }
}

// Gesamtlauf mit eingespeistem gh/git: Anlassfälle, Reihenfolge der Schritte
const STAND_MAIN = { 'pipeline/bau/urteil-schliesst-luecken.ts': '7:export function loescheKennzeichnung(weg) {', 'extension/melder.js': '3:const MELDEKASTEN = 1' }
const LISTE = [
  pr(1676, { comments: [bot(20, KOPF, 'ok')], title: 'feat(x): Freigabe liegt' }),
  pr(1437, { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', comments: [bot(40, KOPF, 'ok')], title: 'fix(bau): spätes Urteil entfernt die JustWatch-Flagge am selben Weg' }),
  pr(1438, { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', comments: [bot(40, KOPF, 'ok')], title: 'fix(bau): spätes Urteil entfernt die JustWatch-Flagge am selben Weg' }),
  pr(1530, { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', comments: [bot(40, KOPF, 'ok')], title: 'fix(kalender): Termine ohne Beleg raus' }),
  pr(1397, { comments: [bot(60, KOPF, 'ok'), daniel(59, 'Prüfer Runde 4: ändern')], title: 'fix(extension): Meldekasten' }),
  pr(1513, { comments: [daniel(60, 'Prüfer: freigeben'), bot(59, KOPF, 'aendern')], body: 'F39', title: 'Regel Uhrzeit' }),
  pr(1508, { comments: [daniel(2, 'Hinweis')], body: 'F39', title: 'data: Tank Chair' }),
  pr(1700, { isDraft: true, mergeable: 'CONFLICTING', comments: [daniel(90, 'Hinweis')] }),
  pr(1390, { comments: [bot(30, KOPF, 'aendern')], title: 'feat(netflix): Meldung meldet die Staffel' }),
  pr(1701, { comments: [daniel(2, 'frisch')] }),
]
// Patch je PR: 1437/1390 bringen Namen, die auf main schon stehen; 1438 hat denselben Titel wie 1437, aber einen neuen Namen; alle anderen eine neue Datei.
const patchVon = (url) => {
  const text = (datei, zeile) => `+++ b/${datei}\n@@ -1 +1,2 @@\n+${zeile}\n`
  if (url.includes('/1437/')) return text('pipeline/bau/urteil-schliesst-luecken.ts', 'export function loescheKennzeichnung(weg) {')
  if (url.includes('/1390/')) return text('extension/melder.js', 'const MELDEKASTEN = 1')
  if (url.includes('/1438/')) return text('pipeline/bau/urteil-schliesst-luecken.ts', 'export function ganzAndereSache(weg) {')
  return text('andere.ts', 'const voelligNeuHier = 1')
}
const attrappeGh = (liste, aufrufe = []) => (args) => {
  aufrufe.push(args.join(' '))
  if (args[0] === 'pr') return JSON.stringify(liste)
  if (args[1].includes('/commits/')) return h(100)
  if (args[1].endsWith('/files')) return patchVon(args[1])
  throw new Error(`unerwartet: ${args.join(' ')}`)
}
const attrappeGit = (stand = STAND_MAIN, aufrufe = []) => (args) => {
  aufrufe.push(args.join(' '))
  const datei = args.at(-1)
  if (stand[datei] === undefined) throw Object.assign(new Error('git grep: kein Treffer'), { status: 1 })
  return `origin/main:${datei}:${stand[datei]}\n`
}

console.log('liegegut: Kopf-Zeiten in einem Aufruf')
{
  const aufrufe = []
  const einzeln = (args) => {
    aufrufe.push(args.join(' '))
    return '2026-10-01T08:00:00Z\n'
  }
  const sammel = (args) => (args[1] === 'graphql' ? `${KOPF} 2026-10-02T09:00:00Z\n${ALT} 2026-09-01T00:00:00Z\nkaputt\n` : einzeln(args))
  const karte = kopfZeiten(sammel)
  pruefe('Karte: zwei Köpfe, Zeile ohne Datum ignoriert', karte.size === 2 && karte.get(KOPF) === Date.parse('2026-10-02T09:00:00Z') && karte.get(ALT) === Date.parse('2026-09-01T00:00:00Z'), [...karte])
  pruefe('Kopf in der Karte → Zeit aus der Karte, kein Einzelaufruf', kopfZeitVon(einzeln, { headRefOid: KOPF }, karte) === Date.parse('2026-10-02T09:00:00Z') && aufrufe.length === 0, aufrufe)
  pruefe('Kopf nicht in der Karte → Commit-Schnittstelle', kopfZeitVon(einzeln, { headRefOid: 'b'.repeat(40) }, karte) === Date.parse('2026-10-01T08:00:00Z') && aufrufe.length === 1, aufrufe)
  pruefe('Abruf wirft → leere Karte, kein Abbruch', kopfZeiten(() => { throw new Error('HTTP 502') }).size === 0)
  const alle = []
  liegegut(attrappeGh([pr(1, { comments: [daniel(2, 'frisch')] }), pr(2, { comments: [daniel(2, 'frisch')] })], alle), attrappeGit(), JETZT)
  pruefe('Gesamtlauf: genau ein graphql-Aufruf für alle PRs', alle.filter((x) => x.includes('graphql')).length === 1, alle)
}

console.log('liegegut: Signal 8 Stillstand (48 h)')
{
  const still = (p, kopfStunden) => stillstandSignal(p, JETZT - kopfStunden * 3600 * 1000, JETZT)
  pruefe('Kopf 47 h alt, sonst nichts → noch nicht', still(pr(1), 47).length === 0)
  pruefe('Kopf 48 h alt → genau an der Grenze noch nicht', still(pr(1), 48).length === 0)
  pruefe('Kopf 49 h alt → Signal 8 seit dem Kopf', JSON.stringify(still(pr(1), 49).map((s) => s.nr)) === '[8]')
  pruefe('Kommentar vor 5 h setzt zurück (Kopf 100 h)', still(pr(2, { comments: [daniel(5, 'Hinweis')] }), 100).length === 0)
  pruefe('Kommentar vor 49 h, Kopf 100 h → Signal 8 seit dem Kommentar', still(pr(3, { comments: [daniel(49, 'Hinweis')] }), 100)[0]?.seit === JETZT - 49 * 3600 * 1000)
  pruefe('Review vor 5 h setzt zurück (Kopf und Kommentar alt)', still(pr(4, { comments: [daniel(60, 'Hinweis')], reviews: [{ submittedAt: h(5) }] }), 100).length === 0)
  pruefe('Review vor 49 h, Kopf 100 h → Signal 8 seit dem Review', still(pr(5, { reviews: [{ submittedAt: h(49) }] }), 100)[0]?.seit === JETZT - 49 * 3600 * 1000)
  pruefe('Kopf vor 5 h setzt zurück (Kommentar alt)', still(pr(6, { comments: [daniel(90, 'Hinweis')] }), 5).length === 0)
  pruefe('offene Review ohne Zeitstempel (submittedAt fehlt) verdeckt den Stillstand nicht', still(pr(8, { reviews: [{ state: 'PENDING' }] }), 49).length === 1)
  pruefe('ohne reviews-Feld kein Absturz', still({ ...pr(7), reviews: undefined }, 49).length === 1)
  pruefe('nur Signal 8 → Schritt STILLSTAND, mit Signal 3 → NACHBESSERN', naechsterSchritt([8], [], false) === 'STILLSTAND' && naechsterSchritt([3, 8], [], false) === 'NACHBESSERN')
  const lauf = liegegut(attrappeGh([pr(11, { comments: [daniel(60, 'Hinweis')] })]), attrappeGit(), JETZT)
  pruefe('Gesamtlauf: still wartender PR bekommt eine Zeile', lauf.length === 1 && /^PR 11: STILLSTAND – Signal 8 Stillstand/.test(lauf[0]), lauf)
  const zwei = () => [pr(21, { body: 'F109', comments: [daniel(2, 'frisch')] }), pr(22, { body: 'F109', comments: [daniel(2, 'frisch')] })]
  const signal6 = (standText) => liegegut(attrappeGh(zwei()), attrappeGit(), JETZT, () => {}, standText).filter((z) => z.includes('Signal 6')).length
  pruefe('Gesamtlauf: F109 nur außerhalb von Jetzt → kein Signal 6 (Verdrahtung)', signal6('### Jetzt\n### Später\n- F109 = A') === 0)
  pruefe('Gesamtlauf: F109 unter Jetzt → Signal 6 in beiden PRs', signal6('### Jetzt\n- F109 offen\n### Später') === 2)
  pruefe('Gesamtlauf: ohne stand.md → Signal 6 wie zuvor', signal6(null) === 2)
}

console.log('liegegut: Gesamtlauf mit Anlassfällen')
{
  const gh = []
  const git = []
  const zeilen = liegegut(attrappeGh(LISTE, gh), attrappeGit(STAND_MAIN, git), JETZT)
  const nach = (n) => zeilen.find((z) => z.startsWith(`PR ${n}:`))
  pruefe('1676 → MERGEN mit „keine Treffer“', /^PR 1676: MERGEN – Signal 1 Freigabe \+ grün \+ ruhend – seit \d\d\.\d\d\. [\d:]+; Gegenprobe: keine Treffer$/.test(nach(1676) ?? ''), nach(1676))
  pruefe('1437 → ÜBERHOLT? mit Fundstelle der Funktion auf main', /^PR 1437: ÜBERHOLT\? – Signal 3 Konflikt liegt.*Treffer pipeline\/bau\/urteil-schliesst-luecken\.ts:7 loescheKennzeichnung$/.test(nach(1437) ?? ''), nach(1437))
  pruefe('1438 gleicher Titel und gleiche Datei wie 1437, aber neuer Name → NACHBESSERN, kein Fehlalarm', /^PR 1438: NACHBESSERN – Signal 3 .*keine Treffer$/.test(nach(1438) ?? ''), nach(1438))
  pruefe('1530 → NACHBESSERN (Konflikt, kein Treffer)', /^PR 1530: NACHBESSERN – Signal 3 .*keine Treffer$/.test(nach(1530) ?? ''), nach(1530))
  pruefe('1397 → NACHBESSERN (Daniel ändern zuletzt)', /^PR 1397: NACHBESSERN – Signal 2/.test(nach(1397) ?? ''), nach(1397))
  pruefe('1513 → DANIEL (Bot zuletzt, F39)', /^PR 1513: DANIEL – Signal 2 .*; 5 .*; 6 Gleiche offene Entscheidung F39/.test(nach(1513) ?? ''), nach(1513))
  pruefe('1508 → DANIEL (nur F39 geteilt), ohne Gegenprobe', /^PR 1508: DANIEL – Signal 6 Gleiche offene Entscheidung F39 – seit \d\d\.\d\d\. [\d:]+$/.test(nach(1508) ?? ''), nach(1508))
  pruefe('1390 nur Signal 5 mit Treffer → ÜBERHOLT? (Gegenprobe läuft auch für Signal 5)', /^PR 1390: ÜBERHOLT\? – Signal 5 .*Treffer extension\/melder\.js:3 MELDEKASTEN$/.test(nach(1390) ?? ''), nach(1390))
  pruefe('„seit“ 1508: Kopf-Commit (17.10. 11:00 Berlin)', (nach(1508) ?? '').endsWith('seit 17.10. 11:00'), nach(1508))
  pruefe('„seit“ 1513: frühester Zeitpunkt aller Signale (Kopf-Commit des Signals 6)', (nach(1513) ?? '').includes('seit 17.10. 11:00;'), nach(1513))
  pruefe('„seit“ 1676: Kommentar (20.10. 19:00 Berlin)', (nach(1676) ?? '').includes('seit 20.10. 19:00;'), nach(1676))
  pruefe('Entwurf und frischer PR ohne Zeile', nach(1700) === undefined && nach(1701) === undefined)
  pruefe('Gegenprobe nur für Signale 1, 3, 5: 1508 (nur Signal 6) ruft die Dateiliste nicht ab', !gh.some((a) => a.includes('/pulls/1508/files')) && gh.some((a) => a.includes('/pulls/1437/files')))
  pruefe('git grep auf origin/main, je PR eine Datei, nie git log', git.length > 0 && git.every((a) => /^grep -n -w -F -e \S+ origin\/main -- \S+$/.test(a)), git)
}

console.log('liegegut: Nichtauskunft und Startlogik')
{
  const meldungen = []
  const gh = attrappeGh([pr(1676, { comments: [bot(20, KOPF, 'ok')] })])
  const kaputt = (args) => (args[0] === 'pr' ? gh(args) : 'kein Datum')
  pruefe('Kopf-Zeit nicht lesbar → Exit 2, kein stilles „nichts“', main(kaputt, attrappeGit(), (t) => meldungen.push(t), JETZT) === 2 && /FEHLER PR 1676: Kopf-Zeit nicht lesbar/.test(meldungen.join('\n')), meldungen)
  const aus = []
  pruefe('gh wirft → Exit 2', main(() => { throw new Error('HTTP 502') }, attrappeGit(), (t) => aus.push(t), JETZT) === 2 && /FEHLER HTTP 502/.test(aus.join()))
  const ok = []
  const code = main(attrappeGh(LISTE), attrappeGit(), (t) => ok.push(t), JETZT)
  pruefe('Funde → Exit 0 und Schlusszeile mit Zahl', code === 0 && ok.at(-1) === 'liegegut: 8 auffällige PRs', ok.at(-1))
  const leer = []
  pruefe('ohne Funde → Exit 0, „0 auffällige PRs“', main(attrappeGh([pr(1, { comments: [daniel(2, 'frisch')] })]), attrappeGit(), (t) => leer.push(t), JETZT) === 0 && leer.at(-1) === 'liegegut: 0 auffällige PRs')
}

console.log('liegegut: offene PRs in Blöcken (GraphQL-Limit 05.11.2026)')
{
  const p1 = { number: 7, title: 'a', isDraft: false, body: 'b1' }
  const p2 = { number: 9, title: 'z', isDraft: false, body: 'b2' }
  const sammel = (aufrufe, comments) => (args) => {
    aufrufe.push(args.join(' '))
    const f = args[args.indexOf('--json') + 1]
    if (args[1] === 'list' && f === 'number,title,headRefOid,createdAt,mergeable,mergeStateStatus,isDraft,body') return JSON.stringify([p1, p2])
    if (args[1] === 'list' && f === 'number,reviews,statusCheckRollup') return JSON.stringify([{ number: 9, reviews: ['r9'], statusCheckRollup: ['s9'] }, { number: 7, reviews: ['r7'], statusCheckRollup: ['s7'] }])
    if (args[1] === 'list') return comments(args)
    return JSON.stringify({ comments: ['einzeln-' + args[2]] })
  }
  const ganz = []
  const ok = offenePrs(sammel(ganz, () => JSON.stringify([{ number: 9, comments: ['c9'] }, { number: 7, comments: ['c7'] }])))
  pruefe('Blöcke: drei Listenaufrufe, Felder je Nummer zusammengeführt', ganz.length === 3 && ok[0].number === 7 && ok[0].comments[0] === 'c7' && ok[0].reviews[0] === 'r7' && ok[1].statusCheckRollup[0] === 's9' && ok[1].body === 'b2', { ganz, ok })
  const limit = []
  const zeilen = offenePrs(sammel(limit, () => { throw new Error('GraphQL: Resource limits for this query exceeded.') }))
  pruefe('Limit bei comments → je PR ein pr view, andere Felder unverändert', limit.slice(3).join('|') === 'pr view 7 --json comments|pr view 9 --json comments' && zeilen[1].comments[0] === 'einzeln-9' && zeilen[0].comments[0] === 'einzeln-7' && zeilen[0].reviews[0] === 'r7', limit)
}

console.log('liegegut: Fehlerwege der Blöcke (Prüfer A1–A3)')
{
  const p1 = { number: 7, title: 'a', isDraft: false, body: 'b1' }
  const p2 = { number: 9, title: 'z', isDraft: false, body: 'b2' }
  const LIMIT = new Error('Command failed\nGraphQL: Resource limits for this query exceeded.')
  const bau = (verhalten) => (args) => {
    const f = args[args.indexOf('--json') + 1]
    if (args[1] === 'list' && f.startsWith('number,title')) return JSON.stringify([p1, p2])
    return verhalten(args, f)
  }
  const gruppe = (nr, f) => (f.includes('comments') ? { number: nr, comments: [] } : { number: nr, reviews: [], statusCheckRollup: [] })
  const liste = (f) => JSON.stringify([gruppe(7, f), gruppe(9, f)])
  const wirft = (text) => { try { text(); return null } catch (e) { return String(e.message) } }
  const http = wirft(() => offenePrs(bau((a, f) => { if (f === 'number,comments') throw new Error('HTTP 502'); return liste(f) })))
  pruefe('A1: HTTP 502 in einer Gruppe schlägt durch (kein pr view)', http === 'HTTP 502', http)
  const aus = []
  pruefe('A1: Exit 2 mit FEHLER bei HTTP 502', main(bau((a, f) => { if (f === 'number,comments') throw new Error('HTTP 502'); return liste(f) }), attrappeGit(), (t) => aus.push(t), JETZT) === 2 && /FEHLER HTTP 502/.test(aus.join()), aus)
  const aufrufe = []
  const rr = offenePrs(bau((a, f) => {
    aufrufe.push(a.join(' '))
    if (a[1] === 'list' && f === 'number,reviews,statusCheckRollup') throw LIMIT
    if (a[1] === 'view') return JSON.stringify({ reviews: ['v' + a[2]], statusCheckRollup: [] })
    return liste(f)
  }))
  pruefe('A2: Limit bei reviews,statusCheckRollup → pr view je PR mit genau diesen Feldern', aufrufe.filter((x) => x.startsWith('pr view')).join('|') === 'pr view 7 --json reviews,statusCheckRollup|pr view 9 --json reviews,statusCheckRollup' && rr[1].reviews[0] === 'v9' && rr[0].comments.length === 0, aufrufe)
  const view = wirft(() => offenePrs(bau((a, f) => {
    if (a[1] === 'list' && f === 'number,comments') throw LIMIT
    if (a[1] === 'view') throw new Error('HTTP 404: pr view')
    return liste(f)
  })))
  pruefe('A2: Fehler im pr view des Rückfalls schlägt durch', view === 'HTTP 404: pr view', view)
  const hinweise = []
  const fehlt = offenePrs(bau((a, f) => (f === 'number,comments' ? JSON.stringify([gruppe(9, f)]) : liste(f))), (h) => hinweise.push(h))
  pruefe('A3: PR 7 fehlt in einer Gruppe → übersprungen, Hinweiszeile mit Nummer, PR 9 bleibt', fehlt.length === 1 && fehlt[0].number === 9 && hinweise.length === 1 && /PR 7 übersprungen/.test(hinweise[0]), { fehlt, hinweise })
  const gesamt = []
  const ghGanz = bau((a, f) => (f === 'number,comments' ? JSON.stringify([gruppe(9, f)]) : liste(f)))
  const rest = attrappeGh([pr(9)])
  const code = main((a) => (a[1] === 'list' ? ghGanz(a) : rest(a)), attrappeGit(), (t) => gesamt.push(t), JETZT)
  pruefe('A3: main meldet die Hinweiszeile und läuft mit Exit 0 durch', code === 0 && gesamt.some((z) => /PR 7 übersprungen/.test(z)) && /liegegut: \d+ auffällige PRs/.test(gesamt.at(-1)), gesamt)
}

console.log('liegegut: eigener Prozess (Vorlader tools/pr-nachrechnen-mock.mjs)')
{
  const werk = fs.mkdtempSync(path.join(os.tmpdir(), 'liegegut-'))
  const leicht = 'number,title,headRefOid,createdAt,mergeable,mergeStateStatus,isDraft,body'
  const frei = pr(1676, { comments: [{ author: { login: 'github-actions' }, createdAt: '2026-10-20T10:44:00Z', body: `**Prüfer-Review** für ${KOPF.slice(0, 9)} - Urteil: **ok**` }] })
  const daten = {
    [`pr list --state open --limit 100 --json ${leicht}`]: { aus: JSON.stringify([frei]) },
    'pr list --state open --limit 100 --json number,reviews,statusCheckRollup': { aus: JSON.stringify([frei]) },
    'pr list --state open --limit 100 --json number,comments': { aus: JSON.stringify([frei]) },
    [`api repos/{owner}/{repo}/commits/${KOPF} --jq .commit.committer.date`]: { aus: '2026-10-20T10:40:00Z\n' },
    [`api repos/{owner}/{repo}/pulls/1676/files --paginate --jq ${JQ_PATCHES}`]: { aus: '+++ b/tools/x.mjs\n@@ -1 +1,2 @@\n+nagel = 1\n' },
  }
  fs.writeFileSync(path.join(werk, 'daten.json'), JSON.stringify(daten))
  const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
  const skript = fileURLToPath(new URL('./liegegut.mjs', import.meta.url))
  const lauf = spawnSync(process.execPath, ['--import', vorlader, skript], { encoding: 'utf8', env: { ...process.env, ATTRAPPE_LOG: path.join(werk, 'log.txt'), ATTRAPPE_DATEN: path.join(werk, 'daten.json') } })
  pruefe('Prozess: Exit 0, Zeile für 1676 und Schlusszeile', lauf.status === 0 && /PR 1676: MERGEN – Signal 1/.test(lauf.stdout) && /liegegut: 1 auffällige PRs/.test(lauf.stdout), { s: lauf.status, o: lauf.stdout, e: lauf.stderr })
  const leerDaten = { ...daten, [`pr list --state open --limit 100 --json ${leicht}`]: { fehler: 'HTTP 502' } }
  fs.writeFileSync(path.join(werk, 'daten.json'), JSON.stringify(leerDaten))
  const kaputt = spawnSync(process.execPath, ['--import', vorlader, skript], { encoding: 'utf8', env: { ...process.env, ATTRAPPE_LOG: path.join(werk, 'log.txt'), ATTRAPPE_DATEN: path.join(werk, 'daten.json') } })
  pruefe('Prozess: Abruffehler → Exit 2 mit FEHLER', kaputt.status === 2 && /liegegut: FEHLER/.test(kaputt.stdout), { s: kaputt.status, o: kaputt.stdout })
  fs.rmSync(werk, { recursive: true, force: true })
}

if (fehler.length > 0) {
  console.error(`liegegut.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('liegegut.test: alle Fälle grün (7 Signale, Grenzen, Gesamtlauf, Nichtauskunft, Prozess)')
