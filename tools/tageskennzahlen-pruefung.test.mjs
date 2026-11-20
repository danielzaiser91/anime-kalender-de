import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { medianCiGruenBisMergeH, nachbesserungsrunden, qualitaet, urteileJePr } from './tageskennzahlen-pruefung.mjs'
import { lehrenAmTag, lehrenJeTag, datumIn, unzugeordnet } from './kennzahlen-lehren.mjs'

// Urteilsfolgen wie an PR 3920 (aendern, aendern, ok; je Kopf mit „nicht beurteilt“ davor) und PR 3911 (ok).
const z = (pr, zeit, kopf, urteil) => ({ pr, zeit, kopf, urteil })
const kommentare = [
  z(3920, '2026-11-15T11:48:41Z', 'a1', 'nicht beurteilt, Kette lief noch'),
  z(3920, '2026-11-15T12:11:07Z', 'b2', 'aendern'),
  z(3920, '2026-11-15T11:58:09Z', 'a1', 'aendern'),
  z(3920, '2026-11-15T12:22:05Z', 'c3', 'ok'),
  z(3920, '2026-11-15T13:10:44Z', 'd4', 'aendern'),
  z(3911, '2026-11-15T11:13:39Z', 'e5', 'ok'),
  z(3912, '2026-11-15T11:07:46Z', 'f6', 'nicht beurteilt, Kette lief noch'),
]
const urteile = urteileJePr(kommentare)
assert.equal(urteile.has(3912), false, 'nur „nicht beurteilt“ ist kein Urteil')
assert.deepEqual(urteile.get(3920).map((u) => u.kopf), ['a1', 'b2', 'c3', 'd4'], 'in Zeitfolge, ohne nicht beurteilt')
assert.equal(nachbesserungsrunden(urteile.get(3920)), 2, 'a1 und b2; das aendern nach dem ersten ok zählt nicht')
assert.equal(nachbesserungsrunden([{ kopf: 'a', ok: false }, { kopf: 'a', ok: false }]), 1, 'zwei Kommentare zum selben Kopf = eine Runde')
assert.equal(nachbesserungsrunden([{ kopf: 'a', ok: false }]), 1, 'nie ok, ein Kopf: eine Runde')
assert.equal(nachbesserungsrunden(urteile.get(3911)), 0)

assert.deepEqual(qualitaet([{ number: 3920 }, { number: 3911 }, { number: 999 }], urteile), { prs: 2, runde1Prozent: 50, nachbesserungenJePr: 1 })
assert.equal(qualitaet([{ number: 3912 }, { number: 999 }], urteile), undefined, 'ohne Urteil: null, nicht 0')
assert.equal(qualitaet([], urteile), undefined)

const lauf = (headSha, ende, conclusion = 'success', name = 'PR-Prüfkette') => ({ name, headSha, ende, conclusion })
const laeufe = [
  lauf('h1', '2026-11-15T13:08:53Z'),
  lauf('h1', '2026-11-15T12:00:00Z'),
  lauf('h2', '2026-11-15T10:00:00Z', 'failure'),
  lauf('h3', '2026-11-15T10:00:00Z', 'success', 'PR-Prüfer'),
  lauf('h4', '2026-11-15T14:00:00Z'),
  lauf('h5', '2026-11-15T09:00:00Z'),
]
const pr = (headSha, mergedAt) => ({ headSha, mergedAt })
assert.equal(medianCiGruenBisMergeH([pr('h1', '2026-11-15T13:09:14Z')], laeufe), 0.01, 'letzter grüner Lauf des Kopfs, 21 s')
assert.equal(medianCiGruenBisMergeH([pr('h2', '2026-11-15T13:00:00Z'), pr('h3', '2026-11-15T13:00:00Z'), pr('h4', '2026-11-15T13:00:00Z')], laeufe), undefined, 'rot, fremder Workflow, Lauf nach dem Merge: kein Beleg')
assert.equal(medianCiGruenBisMergeH([pr('h5', '2026-11-15T11:00:00Z'), pr('h1', '2026-11-15T14:08:53Z'), pr('h2', '2026-11-15T11:00:00Z')], laeufe), 1.5, 'Median aus 2 h und 1 h; PR ohne Beleg zählt nicht')

assert.equal(datumIn('## 23.10.2026 – 1854: Prime'), '2026-10-23')
assert.equal(datumIn('## 2026-10-30 12:42 — Vorrat'), '2026-10-30')
assert.equal(datumIn('## 08.11. 15:05 — Nachbesserung'), '2026-11-08')
assert.equal(datumIn('## 19:14 — PR 3028'), null)
assert.equal(datumIn('## Keine F-Frage (31.10.2026)'), '2026-10-31')

const lehren = [
  '# Lehren', '| Datum | Lehre |', '|---|---|',
  '| 19.10. | Eine |', '| 19.10. | Zwei |', '- 20.10. 22:05 — Drei', '  - 20.10. eingerückter Unterpunkt', '- Unterpunkt ohne Datum',
  '## 22.10.2026 — Vier', '## 19:14 — Fünf', '## Ohne Datum', '**85. Sechs (14.11.2026, PR 1):** Text', '- 05.11. gh 2.103 nicht als Datum',
].join('\n')
const jeTag = lehrenJeTag(lehren)
assert.deepEqual(jeTag, { '2026-10-19': 2, '2026-10-20': 1, '2026-10-22': 3, '2026-11-14': 1, '2026-11-05': 1 })
assert.equal(lehrenAmTag(jeTag, '2026-10-18'), undefined, 'vor dem ersten Eintrag keine Quelle')
assert.equal(lehrenAmTag(jeTag, '2026-10-21'), 0, 'Tag ohne Eintrag im überdeckten Bereich')
assert.equal(lehrenAmTag(jeTag, '2026-10-22'), 3, 'Überschriften ohne Datum erben das der letzten datierten')
assert.equal(lehrenAmTag(jeTag, '2026-10-19'), 2, 'am ersten Tag gibt es eine Quelle (Grenze tag < erster)')
assert.equal(lehrenAmTag({}, '2026-10-22'), undefined, 'leere Datei: keine Quelle')
assert.deepEqual(lehrenJeTag('## Ohne Datum davor\n- 05.11. Eins'), { '2026-11-05': 1 }, 'Überschrift ohne Datum vor der ersten datierten zählt nicht')

// Die weiteren Formen der echten lehren.md, je Zeile im Wortlaut (Stand 15.11.2026): erste Zeile jeder Form.
const formen = [
  '64. **Remote-Vergabe braucht die Vergeben-Zeile sofort (13.11.2026):** Der Vorrat-Hook sieht nur lokale Subagenten',
  '- **20.10., PR 1680:** Fixtures mit Standardparametern (`folgen = 12`) machen `undefined` wirkungslos',
  '- **08.11. 20:35 (Abgleich In-Arbeit):** 5 von 15 Hauptzeilen waren veraltet',
  '- **23.10.2026, Dirigent (Auftrag 00-f):** Ich schrieb einen Auftrag auf die Behauptung',
  '- 25.10.2026 (Bauer Prüflisten): Befund in stand.md ohne Lauf-Kennung',
  '- 21.10.2026 03:34: TaskStop auf eine Merge-Reihe im Hintergrund',
  '- 1844 Bauer (23.10.2026): Push-Fehlerweg nur über HTTP-Status getestet',
  '| 18.10.2026 | Beim Kürzen von stand.md wanderten offene PRs mit Auflagen in einen Bericht | Messwerkzeug |',
  '  - 20.10. eingerückt zählt nicht',
  '- 1844 Bauer ohne Datum: zählt nicht',
  '65. **Titel ohne Datum:** Text vom 12.11.2026 zählt nicht',
].join('\n')
assert.deepEqual(lehrenJeTag(formen), { '2026-11-13': 1, '2026-10-20': 1, '2026-11-08': 1, '2026-10-23': 2, '2026-10-25': 1, '2026-10-21': 1, '2026-10-18': 1 })
assert.deepEqual(unzugeordnet(formen), [], 'jede Zeile mit Datum am Anfang ist zugeordnet')
assert.deepEqual(unzugeordnet('25.10.2026 Kopf ohne Aufzählungszeichen\n2026-10-30 12:42 Zeile\n- **Titel** vom 12.11.2026\n  - 20.10. eingerückt\n- 20.10. zugeordnet'), ['25.10.2026 Kopf ohne Aufzählungszeichen', '2026-10-30 12:42 Zeile'], 'neue Form wird gemeldet, Datum mitten in der Zeile oder eingerückt nicht')

// Urteilsformen mit Zusatz im echten Wortlaut (A4): „ok, …“ ist ok, „aendern, …“ ist aendern, gleicher Kopf zweimal ist keine Nachbesserung.
const ur = (...paare) => urteileJePr(paare.map(([kopf, urteil], i) => z(7, `2026-11-15T10:0${i}:00Z`, kopf, urteil)))
assert.equal(nachbesserungsrunden(ur(['a', 'ok, Checks rot: PR-Prüfkette']).get(7)), 0, 'ok mit Zusatz (Checks rot) = Runde 1')
assert.equal(nachbesserungsrunden(ur(['a', 'ok, Checks laufen noch: PR-Prüfkette']).get(7)), 0, 'ok mit Zusatz (laufen noch) = Runde 1')
assert.equal(nachbesserungsrunden(ur(['a', 'aendern, Auflagen offen: Dirigent entscheidet'], ['b', 'ok']).get(7)), 1, 'aendern mit Zusatz zählt als aendern')
assert.equal(nachbesserungsrunden(ur(['a', 'aendern'], ['a', 'ok']).get(7)), 0, 'gleicher Kopf erst aendern, dann ok: Neulauf, keine Nachbesserung')
assert.equal(nachbesserungsrunden(ur(['a', 'aendern'], ['a', 'ok, Checks rot: x']).get(7)), 0, 'gleicher Kopf, ok mit Zusatz')
assert.equal(nachbesserungsrunden(ur(['a', 'aendern'], ['b', 'aendern'], ['b', 'ok'], ['c', 'aendern']).get(7)), 1, 'a ist eine Runde, b bekam ok, c kam nach dem ok')
assert.equal(nachbesserungsrunden(ur(['a', 'aendern'], ['b', 'nicht beurteilt, Kette lief noch']).get(7)), 1, 'nicht beurteilt ist kein Urteil')
assert.equal(ur(['a', 'okay']).get(7)[0].ok, false, '„okay“ ist kein ok')

console.log('tageskennzahlen-pruefung: alle Zusicherungen grün (Urteile, Runden, Qualität, CI grün bis Merge, Lehren)')

// Verdrahtung in tageszeile: Bot-PRs zählen nicht, Felder ohne Quelle fehlen (nicht 0), Lehren kommen vom Tag.
const { pruefungsfelder, tageszeile, erzeugeZeilen, holeUrteile, leseLehren, leseLehrenAusArgumenten } = await import('./tageskennzahlen.mjs')
const tagPrs = [
  { number: 3920, bot: false, headSha: 'h1', mergedAt: '2026-11-15T13:09:14Z' },
  { number: 3911, bot: false, headSha: 'h9', mergedAt: '2026-11-15T13:09:14Z' },
  { number: 5, bot: true, headSha: 'h5', mergedAt: '2026-11-15T13:09:14Z' },
]
const daten = { urteile: urteileJePr([...kommentare, z(5, '2026-11-15T11:00:00Z', 'x', 'aendern')]), laeufe, lehren: jeTag }
assert.deepEqual(pruefungsfelder('2026-10-22', tagPrs, daten), {
  pruefer: { prs: 2, runde1Prozent: 50, nachbesserungenJePr: 1 },
  medianCiGruenBisMergeHandH: 0.01,
  lehren: 3,
})
assert.deepEqual(pruefungsfelder('2026-10-01', [], { urteile, laeufe, lehren: jeTag }), {}, 'ohne Quelle fehlen alle drei Felder')

// Genau eine Nachbesserungsrunde (aendern, dann ok) ist nicht Runde 1: Grenze r === 0, nicht r <= 1.
const mitEinerRunde = urteileJePr([...kommentare, z(3930, '2026-11-15T10:00:00Z', 'g7', 'aendern'), z(3930, '2026-11-15T10:30:00Z', 'h8', 'ok')])
assert.deepEqual(qualitaet([{ number: 3920 }, { number: 3911 }, { number: 3930 }], mitEinerRunde), { prs: 3, runde1Prozent: 33.3, nachbesserungenJePr: 1 })

// Verdrahtung (A3): tageszeile übernimmt die drei Felder und die Seitengröße je Tag.
const tz = tageszeile('2026-11-15', {
  prs: tagPrs.map((p) => ({ ...p, createdAt: '2026-11-15T09:00:00Z' })),
  punkte: new Map(),
  commits: [],
  rotJeTag: {},
  laeufe: [],
  urteile: daten.urteile,
  lehren: { '2026-11-14': 1, '2026-11-15': 4 },
  seite: (tag) => ({ metaGzipKb: Number(tag.slice(-2)) }),
})
assert.deepEqual(tz.pruefer, { prs: 2, runde1Prozent: 50, nachbesserungenJePr: 1 }, 'Prüfer-Qualität steht in der Tageszeile')
assert.equal(tz.lehren, 4, 'Lehren vom Tag')
assert.deepEqual(tz.seite, { metaGzipKb: 15 }, 'Seitengröße vom Tag, nicht vom Vortag')
assert.equal('medianCiGruenBisMergeHandH' in tz, false, 'ohne Läufe fehlt das Feld')

// erzeugeZeilen: jede Quelle kommt in der Zeile an; Zeiträume und Vorlauf der Urteile stehen fest.
const aufrufe = {}
const merke = (name, wert) => { aufrufe[name] = [...(aufrufe[name] ?? []), wert]; return wert }
const lehrenText = (extra = '') => `- 14.11. Eine\n- 15.11. Zwei\n- 15.11. Drei${extra}`
const quellen = (text) => ({
  prs: () => [
    { number: 3920, bot: false, headSha: 'h1', createdAt: '2026-11-14T08:00:00Z', mergedAt: '2026-11-14T10:00:00Z', endeAt: '2026-11-14T10:00:00Z' },
    { number: 3911, bot: false, headSha: 'h9', createdAt: '2026-11-15T08:00:00Z', mergedAt: '2026-11-15T10:00:00Z', endeAt: '2026-11-15T10:00:00Z' },
  ],
  commits: (von) => merke('commits', von) && [],
  laeufe: (von, bis) => { merke('laeufe', `${von}..${bis}`); return laeufe.map((l) => ({ ...l, createdAt: l.ende })) },
  urteile: (seit) => { merke('urteile', seit); return kommentare },
  seite: (tag) => ({ metaGzipKb: Number(tag.slice(-2)) }),
  kette: () => merke('kette', 'ja') && null,
  lehrenText: () => text,
  warne: (m) => merke('warne', m),
})
const erg = erzeugeZeilen('2026-11-14', '2026-11-15', Date.parse('2026-11-16T00:00:00Z'), quellen(lehrenText()))
const zeilen = erg.zeilen.map((s) => JSON.parse(s))
assert.deepEqual(zeilen.map((x) => x.tag), ['2026-11-14', '2026-11-15'])
assert.deepEqual(zeilen.map((x) => x.lehren), [1, 2], 'Lehren aus der Quelle je Tag')
assert.deepEqual(zeilen.map((x) => x.pruefer?.prs), [1, 1], 'Urteile aus der Quelle (3920 am 14., 3911 am 15.)')
assert.deepEqual(zeilen.map((x) => x.seite.metaGzipKb), [14, 15])
assert.deepEqual(erg.anzahl, [2, laeufe.length, 0])
assert.deepEqual(aufrufe.urteile, ['2026-10-31'], 'Urteile ab --von minus 14 Tage (längste PR-Lebensdauer), nicht ab --von')
assert.deepEqual(aufrufe.laeufe, ['2026-11-13..2026-11-16'])
assert.deepEqual(aufrufe.commits, ['2026-11-13'])
assert.deepEqual(aufrufe.kette, ['ja'], 'die Prüfkette wird für die Story Points gelesen')
assert.equal(aufrufe.warne, undefined, 'saubere Lehren-Datei: keine Warnung')
erzeugeZeilen('2026-11-14', '2026-11-15', Date.parse('2026-11-16T00:00:00Z'), quellen(lehrenText('\n25.10.2026 Neue Form')))
assert.equal(aufrufe.warne.length, 1, 'unzugeordnete Zeile: eine Warnung')
assert.match(aufrufe.warne[0], /1 Zeilen .* „25\.10\.2026 Neue Form“/)

// holeUrteile: eigene Seitenzählung; die Seite endet erst unter 100 Kommentaren (genau 99 endet, genau 100 geht weiter).
const seiten = (ns) => {
  const abgerufen = []
  const abruf = (befehl, args) => {
    abgerufen.push([befehl, args[1]])
    const seite = Number(/&page=(\d+)/.exec(args[1])[1])
    return JSON.stringify({ n: ns[seite - 1] ?? 0, e: [{ pr: seite, zeit: 'z', kopf: 'k', urteil: 'ok' }] })
  }
  return { abruf, abgerufen }
}
const s1 = seiten([100, 99, 50])
assert.deepEqual(holeUrteile('2026-10-31', s1.abruf).map((x) => x.pr), [1, 2], '100 weiter, 99 Ende')
assert.deepEqual(s1.abgerufen.map((a) => a[0]), ['gh', 'gh'])
assert.equal(s1.abgerufen[0][1], 'repos/derNamenloseDaniel/anime-kalender-de/issues/comments?since=2026-10-31T00:00:00Z&per_page=100&page=1')
assert.equal(holeUrteile('2026-10-31', seiten([0]).abruf).length, 1, 'eine leere Seite endet')

// Fehlende lehren.md (A5): Abbruch mit Hinweis, außer ausdrücklich ohne; vorhandene Datei wird gelesen.
const ordner = mkdtempSync(join(tmpdir(), 'kennzahlen-lehren-'))
assert.throws(() => leseLehren(join(ordner, 'fehlt.md')), /lehren\.md fehlt .*--lehren=<Datei>.*--ohne-lehren/)
assert.equal(leseLehren(join(ordner, 'fehlt.md'), true), '', 'ausdrücklich ohne Lehren')
writeFileSync(join(ordner, 'da.md'), '- 15.11. Eins\n')
assert.equal(leseLehren(join(ordner, 'da.md')), '- 15.11. Eins\n')
assert.equal(leseLehrenAusArgumenten([`--lehren=${join(ordner, 'da.md')}`]), '- 15.11. Eins\n', '--lehren=<Datei> wird gelesen')
assert.equal(leseLehrenAusArgumenten([`--lehren=${join(ordner, 'fehlt.md')}`, '--ohne-lehren']), '', '--ohne-lehren')
assert.throws(() => leseLehrenAusArgumenten([`--lehren=${join(ordner, 'fehlt.md')}`]), /lehren\.md fehlt/)

// Prozess: fehlende Datei bricht mit Exit 1 ab, bevor gh gefragt wird (Frist 30 s: ein Abruf zuerst würde länger brauchen).
const fehlt = join(ordner, 'nicht-da.md')
const prozess = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'tageskennzahlen.mjs'), `--lehren=${fehlt}`], { cwd: ordner, encoding: 'utf8', timeout: 30_000 })
assert.equal(prozess.status, 1, `Exit 1 bei fehlender lehren.md (stderr: ${prozess.stderr})`)
assert.match(prozess.stderr, /FEHLER: lehren\.md fehlt \(.*nicht-da\.md\).*--ohne-lehren/)
rmSync(ordner, { recursive: true })

console.log('tageskennzahlen-pruefung: Verdrahtung grün (tageszeile, erzeugeZeilen, holeUrteile-Seitenende, fehlende lehren.md)')
