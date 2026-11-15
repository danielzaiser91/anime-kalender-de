import assert from 'node:assert/strict'
import { medianCiGruenBisMergeH, nachbesserungsrunden, qualitaet, urteileJePr } from './tageskennzahlen-pruefung.mjs'
import { lehrenAmTag, lehrenJeTag, datumIn } from './kennzahlen-lehren.mjs'

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
  '## 22.10.2026 — Vier', '## 19:14 — Fünf (erbt 22.10.)', '## Ohne Datum (erbt 22.10.)', '**85. Sechs (14.11.2026, PR 1):** Text', '- 05.11. gh 2.103 nicht als Datum',
].join('\n')
const jeTag = lehrenJeTag(lehren)
assert.deepEqual(jeTag, { '2026-10-19': 2, '2026-10-20': 1, '2026-10-22': 3, '2026-11-14': 1, '2026-11-05': 1 })
assert.equal(lehrenAmTag(jeTag, '2026-10-18'), undefined, 'vor dem ersten Eintrag keine Quelle')
assert.equal(lehrenAmTag(jeTag, '2026-10-21'), 0, 'Tag ohne Eintrag im überdeckten Bereich')
assert.equal(lehrenAmTag(jeTag, '2026-10-22'), 3)
assert.equal(lehrenAmTag({}, '2026-10-22'), undefined, 'leere Datei: keine Quelle')

console.log('tageskennzahlen-pruefung: alle Zusicherungen grün (Urteile, Runden, Qualität, CI grün bis Merge, Lehren)')

// Verdrahtung in tageszeile: Bot-PRs zählen nicht, Felder ohne Quelle fehlen (nicht 0), Lehren kommen vom Tag.
const { pruefungsfelder } = await import('./tageskennzahlen.mjs')
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
