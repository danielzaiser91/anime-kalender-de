/**
 * Tests für tools/liegegut.mjs: alle 7 Signale mit Fixtures, nachgebaut aus den echten Fällen des Liegegut-Berichts vom 21.10.2026
 * (1676 Freigabe liegt, 1437/1371 überholt, 1530 Konflikt, 1397/1513 Urteile widersprechen sich, 1433/1594 rot, 1390 Ändern ohne Commit,
 * 1508/1513 gleiche Entscheidung F39), Grenzen genau auf/über der Schwelle, Nichtauskunft und Startlogik als eigener Prozess.
 * Schwellen und Erwartungen stehen hier fest eingetragen (nicht aus dem Modul importiert).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { geteilteEntscheidungen, liegegut, main, mainCommits, naechsterSchritt, signaleEinzel, ueberholtTreffer, urteile } from './liegegut.mjs'

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

console.log('liegegut: Signal 7 Überholt-Gegenprobe (Fälle 1437, 1371, 1386)')
{
  const log = ['\x01ad6d02998\tfix(bau): Urteil-Ja löscht die JustWatch-Kennzeichnung (#1441)', 'pipeline/bau/urteil-schliesst-luecken.ts', '', '\x01bbbbbbbbb\tfeat: anderes Thema', 'pipeline/bau/urteil-schliesst-luecken.ts', '\x01ccccccccc\tfix: Urteil JustWatch Kennzeichnung', 'docs/x.md', ''].join('\n')
  const commits = mainCommits(log)
  pruefe('mainCommits liest drei Commits mit Dateien', commits.length === 3 && commits[0].hash === 'ad6d02998' && commits[1].dateien.length === 1 && commits[2].dateien[0] === 'docs/x.md', commits)
  const titel1437 = 'fix(bau): spätes Urteil entfernt die JustWatch-Flagge am selben Weg'
  const dateien = ['pipeline/bau/urteil-schliesst-luecken.ts']
  pruefe('Datei + zwei Stichwörter → Treffer ad6d02998 (nur der)', ueberholtTreffer(titel1437, dateien, commits).map((c) => c.hash).join() === 'ad6d02998')
  pruefe('Datei gleich, aber nur ein Stichwort (Urteil) → kein Treffer', ueberholtTreffer('Urteil schließt Lücke', dateien, commits).length === 0)
  pruefe('zwei Stichwörter, aber keine gemeinsame Datei → kein Treffer', ueberholtTreffer(titel1437, ['andere.ts'], commits.slice(0, 1)).length === 0)
  pruefe('Füllwort „statt“ zählt nicht als Stichwort', ueberholtTreffer('Stift hängt statt Stempel', ['d.ts'], [{ hash: 'x', betreff: 'Rand hängt statt Stempel', dateien: ['d.ts'] }]).length === 1 && ueberholtTreffer('Stift statt Marke', ['d.ts'], [{ hash: 'x', betreff: 'Rand statt Flagge', dateien: ['d.ts'] }]).length === 0)
  pruefe('Stamm: „Termine“ trifft „Terminen“', ueberholtTreffer('Kanal Termine', ['d.ts'], [{ hash: 'x', betreff: 'Kanal Terminen', dateien: ['d.ts'] }]).length === 1)
}

console.log('liegegut: Grenzen und Randfälle (Mutationsprobe 21.10.2026)')
{
  const minute = (stunden) => new Date(JETZT - stunden * 3600 * 1000 - 60000).toISOString()
  const ae = (zeit) => ({ ...bot(0, KOPF, 'aendern'), createdAt: zeit })
  pruefe('Ändern-Urteil 24 h und eine Minute → Signal 5', nummern(pr(30, { comments: [ae(minute(24))] }), 40).includes(5))
  const unsortiert = urteile([daniel(1, 'Prüfer: ändern'), daniel(5, 'Prüfer: freigeben')])
  pruefe('Urteile kommen nach Zeit sortiert (älteste zuerst)', unsortiert.map((u) => u.gut).join() === 'true,false', unsortiert)
  pruefe('Daniel-Urteil nur aus der ersten Zeile', urteile([daniel(1, 'Prüfer Runde 1: Hinweis', 'freigeben')]).length === 0)
  const gleich = signaleEinzel(pr(31, { comments: [{ ...daniel(0, 'Prüfer: ändern'), createdAt: new Date(JETZT - 30 * 3600 * 1000).toISOString() }] }), JETZT - 30 * 3600 * 1000, JETZT)
  pruefe('Daniel-Urteil ohne Kopf zur Sekunde des Kopf-Commits gilt', gleich.map((s) => s.nr).join() === '5', gleich)
  pruefe('CANCELLED ist weder grün noch rot', nummern(pr(32, { comments: [bot(20, KOPF, 'ok')], statusCheckRollup: [...GRUEN, { status: 'COMPLETED', conclusion: 'CANCELLED', completedAt: h(20) }] })).length === 0)
  pruefe('StatusContext state SUCCESS zählt als grün', nummern(pr(33, { comments: [bot(20, KOPF, 'ok')], statusCheckRollup: [{ state: 'SUCCESS' }] })).includes(1))
  pruefe('zweiter, jüngerer Fehlschlag (5 h) setzt die Rotzeit zurück', !nummern(pr(34, { statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE', completedAt: h(30) }, { status: 'COMPLETED', conclusion: 'FAILURE', completedAt: h(5) }] })).includes(4))
  pruefe('StatusContext ohne completedAt: startedAt zählt (5 h → nicht rot lang genug)', !nummern(pr(35, { statusCheckRollup: [{ state: 'ERROR', startedAt: h(5) }] })).includes(4))
  const widerspruch = signaleEinzel(pr(36, { comments: [bot(60, KOPF, 'ok'), bot(50, KOPF, 'aendern'), bot(40, KOPF, 'ok')] }), JETZT - 100 * 3600 * 1000, JETZT).find((s) => s.nr === 2)
  pruefe('Signal 2 „seit“ ist das jüngste Urteil', widerspruch !== undefined && widerspruch.seit === JETZT - 40 * 3600 * 1000, widerspruch)
  const stufe1 = signaleEinzel(pr(37, { comments: [bot(30, KOPF, 'aendern'), bot(20, KOPF, 'ok')] }), JETZT - 100 * 3600 * 1000, JETZT)
  pruefe('Ändern, dann ok: Signal 5 entfällt, Signal 2 steht', stufe1.map((s) => s.nr).join() === '2', stufe1)
  const nur = (titel, commitBetreff) => ueberholtTreffer(titel, ['d.ts'], [{ hash: 'x', betreff: commitBetreff, dateien: ['d.ts'] }]).length
  pruefe('Wörter unter 5 Buchstaben zählen nicht (Kanal + kein + eine)', nur('Kanal erbt kein Deutsch', 'Kanal erbt kein Brot') === 0 && nur('Kanal erbt Deutsch', 'Kanal erbt Deutsch') === 1)
  pruefe('Stamm 6: Terminal ≠ Terminen reicht zusammen mit Kanal', nur('Kanal Terminen', 'Kanal Terminal') === 1)
  pruefe('Stamm nicht kürzer: Sendeplan ≠ Sendezeit', nur('Kanal Sendeplan', 'Kanal Sendezeit') === 0)
  pruefe('Stamm nicht länger: Termine = Terminen', nur('Kanal Termine', 'Kanal Terminen') === 1)
  pruefe('Füllwort statt zählt nicht (statt + Stempel allein ist kein Treffer)', nur('Stift statt Stempel', 'Rand statt Stempel') === 0)
  pruefe('Füllwörter nicht, keine, sowie, wieder, schon, gegen zählen nicht', nur('nicht keine sowie wieder schon gegen', 'nicht keine sowie wieder schon gegen') === 0)
  const zweiDateien = [{ hash: 'x', betreff: 'Kanal Deutsch', dateien: ['d.ts', 'fremd.ts'] }]
  pruefe('Commit mit zwei Dateien, eine gemeinsam → Treffer', ueberholtTreffer('Kanal Deutsch', ['d.ts'], zweiDateien).length === 1)
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
const GIT_LOG = ['\x01ad6d02998\tfix(bau): Urteil-Ja löscht die JustWatch-Kennzeichnung (#1441)', 'pipeline/bau/urteil-schliesst-luecken.ts', '\x0159d384028\tfix: Alle Staffeln meldet nur gemeldete Staffeln (#1688)', 'extension/melder.js', ''].join('\n')
const LISTE = [
  pr(1676, { comments: [bot(20, KOPF, 'ok')], title: 'feat(x): Freigabe liegt' }),
  pr(1437, { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', comments: [bot(40, KOPF, 'ok')], title: 'fix(bau): spätes Urteil entfernt die JustWatch-Flagge am selben Weg' }),
  pr(1530, { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', comments: [bot(40, KOPF, 'ok')], title: 'fix(kalender): Termine ohne Beleg raus' }),
  pr(1397, { comments: [bot(60, KOPF, 'ok'), daniel(59, 'Prüfer Runde 4: ändern')], title: 'fix(extension): Meldekasten' }),
  pr(1513, { comments: [daniel(60, 'Prüfer: freigeben'), bot(59, KOPF, 'aendern')], body: 'F39', title: 'Regel Uhrzeit' }),
  pr(1508, { comments: [daniel(2, 'Hinweis')], body: 'F39', title: 'data: Tank Chair' }),
  pr(1700, { isDraft: true, mergeable: 'CONFLICTING', comments: [daniel(90, 'Hinweis')] }),
  pr(1390, { comments: [bot(30, KOPF, 'aendern')], title: 'feat(netflix): Meldung meldet die Staffel' }),
  pr(1701, { comments: [daniel(2, 'frisch')] }),
]
const attrappeGh = (liste, aufrufe = []) => (args) => {
  aufrufe.push(args.join(' '))
  if (args[0] === 'pr') return JSON.stringify(liste)
  if (args[1].includes('/commits/')) return h(100)
  if (args[1].endsWith('/files')) return args[1].includes('/1437/') ? 'pipeline/bau/urteil-schliesst-luecken.ts\n' : args[1].includes('/1390/') ? 'extension/melder.js\n' :'andere.ts\n'
  throw new Error(`unerwartet: ${args.join(' ')}`)
}
const attrappeGit = (log = GIT_LOG, aufrufe = []) => (args) => {
  aufrufe.push(args.join(' '))
  return log
}

console.log('liegegut: Gesamtlauf mit Anlassfällen')
{
  const gh = []
  const git = []
  const zeilen = liegegut(attrappeGh(LISTE, gh), attrappeGit(GIT_LOG, git), JETZT)
  const nach = (n) => zeilen.find((z) => z.startsWith(`PR ${n}:`))
  pruefe('1676 → MERGEN mit „keine Treffer“', /^PR 1676: MERGEN – Signal 1 Freigabe \+ grün \+ ruhend – seit \d\d\.\d\d\. [\d:]+; Gegenprobe: keine Treffer$/.test(nach(1676) ?? ''), nach(1676))
  pruefe('1437 → ÜBERHOLT? mit Treffer ad6d02998', /^PR 1437: ÜBERHOLT\? – Signal 3 Konflikt liegt.*Treffer ad6d02998/.test(nach(1437) ?? ''), nach(1437))
  pruefe('1530 → NACHBESSERN (Konflikt, kein Treffer)', /^PR 1530: NACHBESSERN – Signal 3 .*keine Treffer$/.test(nach(1530) ?? ''), nach(1530))
  pruefe('1397 → NACHBESSERN (Daniel ändern zuletzt)', /^PR 1397: NACHBESSERN – Signal 2/.test(nach(1397) ?? ''), nach(1397))
  pruefe('1513 → DANIEL (Bot zuletzt, F39)', /^PR 1513: DANIEL – Signal 2 .*; 5 .*; 6 Gleiche offene Entscheidung F39/.test(nach(1513) ?? ''), nach(1513))
  pruefe('1508 → DANIEL (nur F39 geteilt), ohne Gegenprobe', /^PR 1508: DANIEL – Signal 6 Gleiche offene Entscheidung F39 – seit \d\d\.\d\d\. [\d:]+$/.test(nach(1508) ?? ''), nach(1508))
  pruefe('1390 nur Signal 5 mit Treffer → ÜBERHOLT? (Gegenprobe läuft auch für Signal 5)', /^PR 1390: ÜBERHOLT\? – Signal 5 .*Treffer 59d384028/.test(nach(1390) ?? ''), nach(1390))
  pruefe('„seit“ 1508: Kopf-Commit (17.10. 11:00 Berlin)', (nach(1508) ?? '').endsWith('seit 17.10. 11:00'), nach(1508))
  pruefe('„seit“ 1676: Kommentar (20.10. 19:00 Berlin)', (nach(1676) ?? '').includes('seit 20.10. 19:00;'), nach(1676))
  pruefe('Entwurf und frischer PR ohne Zeile', nach(1700) === undefined && nach(1701) === undefined)
  pruefe('Gegenprobe nur für Signale 1, 3, 5: 1508 (nur Signal 6) ruft die Dateiliste nicht ab', !gh.some((a) => a.includes('/pulls/1508/files')) && gh.some((a) => a.includes('/pulls/1437/files')))
  pruefe('git log mit origin/main, Beginn am PR-Datum und Dateinamen', git.length > 0 && git.every((a) => a === `log origin/main --since=${h(200)} --name-only --format=%x01%h%x09%s`), git)
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
  pruefe('Funde → Exit 0 und Schlusszeile mit Zahl', code === 0 && ok.at(-1) === 'liegegut: 7 auffällige PRs', ok.at(-1))
  const leer = []
  pruefe('ohne Funde → Exit 0, „0 auffällige PRs“', main(attrappeGh([pr(1, {})]), attrappeGit(), (t) => leer.push(t), JETZT) === 0 && leer.at(-1) === 'liegegut: 0 auffällige PRs')
}

console.log('liegegut: eigener Prozess (Vorlader tools/pr-nachrechnen-mock.mjs)')
{
  const werk = fs.mkdtempSync(path.join(os.tmpdir(), 'liegegut-'))
  const felder = 'number,title,headRefOid,createdAt,mergeable,mergeStateStatus,isDraft,body,comments,statusCheckRollup'
  const frei = pr(1676, { comments: [{ author: { login: 'github-actions' }, createdAt: '2026-10-20T10:44:00Z', body: `**Prüfer-Review** für ${KOPF.slice(0, 9)} - Urteil: **ok**` }] })
  const daten = {
    [`pr list --state open --limit 100 --json ${felder}`]: { aus: JSON.stringify([frei]) },
    [`api repos/{owner}/{repo}/commits/${KOPF} --jq .commit.committer.date`]: { aus: '2026-10-20T10:40:00Z\n' },
    'api repos/{owner}/{repo}/pulls/1676/files --paginate --jq .[].filename': { aus: 'tools/x.mjs\n' },
    [`log origin/main --since=${frei.createdAt} --name-only --format=%x01%h%x09%s`]: { aus: '' },
  }
  fs.writeFileSync(path.join(werk, 'daten.json'), JSON.stringify(daten))
  const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
  const skript = fileURLToPath(new URL('./liegegut.mjs', import.meta.url))
  const lauf = spawnSync(process.execPath, ['--import', vorlader, skript], { encoding: 'utf8', env: { ...process.env, ATTRAPPE_LOG: path.join(werk, 'log.txt'), ATTRAPPE_DATEN: path.join(werk, 'daten.json') } })
  pruefe('Prozess: Exit 0, Zeile für 1676 und Schlusszeile', lauf.status === 0 && /PR 1676: MERGEN – Signal 1/.test(lauf.stdout) && /liegegut: 1 auffällige PRs/.test(lauf.stdout), { s: lauf.status, o: lauf.stdout, e: lauf.stderr })
  const leerDaten = { ...daten, [`pr list --state open --limit 100 --json ${felder}`]: { fehler: 'HTTP 502' } }
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
