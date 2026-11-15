import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { erzeugeDatenJs, leseAlles } from './kennzahlen-daten-erzeugen.mjs'
import { baueAnsichtsDaten, markerZuordnen, reihe, wert, wirkung, wochenmittel } from './kennzahlen-aufbereiten.mjs'
import { ergaenze, kernpunkteAus, tagAusDateiname } from './kennzahlen-kernpunkte.mjs'

const logik = createRequire(import.meta.url)('./kennzahlen/kennzahlen-logik.cjs')

// A6: ein einziger Tag darf keine Division durch 0 (NaN/Infinity) ergeben
assert.equal(logik.tagPosition(0, 1), 40)
assert.equal(logik.tagPosition(0, 0), 40)
assert.equal(logik.naechsterTag(500, 1), 0)
assert.equal(logik.tagPosition(0, 45), 40)
assert.equal(logik.tagPosition(44, 45), 948)
assert.equal(logik.tagPosition(22, 45), 494)
assert.equal(logik.naechsterTag(0, 45), 0, 'links davor: auf 0 begrenzt')
assert.equal(logik.naechsterTag(2000, 45), 44, 'rechts dahinter: auf n-1 begrenzt')
assert.equal(logik.naechsterTag(494, 45), 22)
assert.equal(baueAnsichtsDaten([{ tag: '2026-10-01', merges: 3 }], [{ datum: '2026-10-01', pr: 1, text: 't', kennzahl: 'merges', richtung: 'sinkt' }]).marker[0].zeile, 0)

// A5: Beschriftungen nebeneinander überlappen nicht (Breite 40, 3 Zeilen)
assert.deepEqual(logik.staffelZeilen([100, 300, 500], 40, 3), [0, 0, 0], 'weit auseinander: alle in Zeile 0')
assert.deepEqual(logik.staffelZeilen([100, 120, 140, 160], 40, 3), [0, 1, 0, 1], 'dicht: Zeile 0 wieder frei ab Abstand 40')
assert.deepEqual(logik.staffelZeilen([100, 100], 40, 3), [0, 1], 'gleiche Position: verschiedene Zeilen')
assert.deepEqual(logik.staffelZeilen([130, 100], 40, 3), [1, 0], 'Reihenfolge der Eingabe egal, Ergebnis je Eintrag')
assert.deepEqual(logik.staffelZeilen([100, 140], 40, 3), [0, 0], 'genau Breite Abstand: kein Überlapp')
assert.deepEqual(logik.staffelZeilen([100, 139], 40, 3), [0, 1], 'einen unter Breite: Überlapp')
for (const z of logik.staffelZeilen([1, 2, 3, 4, 5, 6, 7], 40, 3)) assert.ok(z >= 0 && z < 3, 'nie außerhalb der Zeilen')

assert.equal(wert({ stau: { offen: 4 } }, 'stau.offen'), 4)
assert.equal(wert({ stau: {} }, 'stau.offen'), null)
assert.equal(wert({}, 'seite.metaGzipKb'), null)
assert.equal(wert({ a: 0 }, 'a'), 0, 'Null ist ein Wert')

// Wochenmittel: Lücken zählen nicht mit (nicht als 0)
assert.deepEqual(wochenmittel([2, 4, 6, 8], 3), [2, 3, 4, 6])
assert.deepEqual(wochenmittel([null, 4, null, null, 10], 2), [null, 4, 4, null, 10])
assert.deepEqual(wochenmittel([0, 0, 3], 7), [0, 0, 1])
assert.deepEqual(wochenmittel([1, 2, 3, 4, 5, 6, 7, 70], 7), [1, 1.5, 2, 2.5, 3, 3.5, 4, 13.86])

const tage = [{ tag: '2026-10-01', stau: { offen: 1 } }, { tag: '2026-10-02' }, { tag: '2026-10-03', stau: { offen: 5 } }]
assert.deepEqual(reihe(tage, 'stau.offen'), [1, null, 5])

const m = [
  { datum: '2026-10-03', pr: 7, text: 'a', kennzahl: 'x', richtung: 'sinkt' },
  { datum: '2026-09-01', pr: 1, text: 'vorher', kennzahl: 'x', richtung: 'sinkt' },
  { datum: '2026-10-01', pr: 2, text: 'b', kennzahl: 'y', richtung: 'sinkt' },
]
assert.deepEqual(markerZuordnen(m, tage).map((x) => [x.index, x.pr]), [[2, 7], [0, 2]])

const d = baueAnsichtsDaten(tage, m, { '2026-10-02': { geschafft: ['x'], probleme: [] } })
assert.deepEqual(d.tage, ['2026-10-01', '2026-10-02', '2026-10-03'])
assert.deepEqual(d.kennzahlen.find((k) => k.pfad === 'stau.offen').werte, [1, null, 5])
assert.deepEqual(d.kennzahlen.find((k) => k.pfad === 'stau.offen').wochenmittel, [1, 1, 3])
assert.equal(d.marker.length, 2)
assert.deepEqual(d.kernpunkte['2026-10-02'].geschafft, ['x'])
console.log('kennzahlen-aufbereiten: ok (Wochenmittel, Lücken, Marker, Gesamtaufbau)')

// Echte Dateien: YAML-Daten müssen Zeichenketten bleiben (sonst 0 Marker), Marker liegen im Tagesbereich
const echt = leseAlles()
assert.equal(typeof echt.massnahmen[0].datum, 'string')
const echtDaten = baueAnsichtsDaten(echt.tage, echt.massnahmen, echt.kernpunkte)
assert.equal(echtDaten.marker.length, echt.massnahmen.length, 'jede Maßnahme liegt im Zeitraum der Tage')
assert.equal(echtDaten.kennzahlen[0].werte.length, echt.tage.length)
console.log('echte Daten:', echtDaten.tage.length, 'Tage,', echtDaten.marker.length, 'Marker')

// Wirkung: 7 Tage davor gegen 7 Tage danach, der Maßnahmentag selbst zählt nicht, je Seite mindestens 3 Werte
const w = [10, 10, 10, 99, 4, 4, 4]
assert.deepEqual(wirkung(w, 3, 'sinkt'), { vorher: 10, nachher: 4, urteil: 'ja' })
assert.equal(wirkung(w, 3, 'steigt').urteil, 'nein')
assert.equal(wirkung([4, 4, 4, 99, 10, 10, 10], 3, 'sinkt').urteil, 'nein')
assert.equal(wirkung([5, 5, 5, 0, 5, 5, 5], 3, 'sinkt').urteil, 'nein', 'gleich ist nicht gesunken')
assert.equal(wirkung([5, 5, 5, 0, 5, 5, 5], 3, 'nicht-steigend').urteil, 'ja', 'gleich ist nicht gestiegen')
assert.equal(wirkung([5, 5, 5, 0, 6, 6, 6], 3, 'nicht-steigend').urteil, 'nein')
assert.equal(wirkung(w, 3, 'wackelt').urteil, null, 'unbekannte Richtung: kein Urteil')
assert.deepEqual(wirkung([10, 10, 99, 4, 4, 4], 2, 'sinkt'), { vorher: null, nachher: 4, urteil: null }, 'nur 2 Tage davor: zu früh')
assert.deepEqual(wirkung([10, 10, 10, 99, 4, 4], 3, 'sinkt'), { vorher: 10, nachher: null, urteil: null }, 'nur 2 Tage danach: zu früh')
assert.deepEqual(wirkung([10, null, 10, 10, 99, 4, 4, null], 4, 'sinkt').nachher, null, 'Lücken zählen nicht als Wert')
assert.equal(wirkung([1, 1, 1, 1, 1, 1, 1, 50, 50, 50, 50, 99, 4, 4, 4], 11, 'sinkt').vorher, 29, 'höchstens 7 Tage davor (die ersten vier 1er liegen außerhalb)')
const mw = markerZuordnen(
  [{ datum: '2026-10-04', pr: 9, text: 'm', kennzahl: 'stau.offen', richtung: 'sinkt' }],
  [1, 1, 1, 9, 2, 2, 2].map((v, i) => ({ tag: `2026-10-0${i + 1}`, stau: { offen: v } })),
)
assert.deepEqual([mw[0].vorher, mw[0].nachher, mw[0].urteil], [1, 2, 'nein'], 'Wirkung steht am Marker (Verdrahtung)')

// A2: daten.js passt zu tage.jsonl, massnahmen.yaml und kernpunkte.yaml (veraltet = rot)
assert.equal(readFileSync(new URL('./kennzahlen/daten.js', import.meta.url), 'utf8'), erzeugeDatenJs(), 'daten.js veraltet: node tools/kennzahlen-daten-erzeugen.mjs')

// A1: Kernpunkte aus Tagesberichten
const bericht = [
  '# Tagesbericht', '', '## Was geschafft wurde', '', '92 PRs gemergt.', '', '**Für Besucher**',
  '- Neu: [Link](x) mit `Code` und **fett** (1).', '  - Unterpunkt zählt nicht', '- ' + 'x'.repeat(200),
  '', '## Wo es Probleme gab', '- Falsches Signal', '', '## Warum morgen besser läuft', '- nicht dabei',
].join('\n')
const kp = kernpunkteAus(bericht)
assert.equal(kp.geschafft[0], 'Neu: Link mit Code und fett (1).')
assert.equal(kp.geschafft.length, 2, 'Unterpunkt und Fließtext zählen nicht, wenn es Aufzählungen gibt')
assert.equal(kp.geschafft[1].length, 140, 'lange Punkte gekürzt')
assert.ok(kp.geschafft[1].endsWith('…'))
assert.deepEqual(kp.probleme, ['Falsches Signal'])
assert.deepEqual(kernpunkteAus('## Beim Prüfer\nText ohne Liste\n').probleme, ['Text ohne Liste'], 'ohne Aufzählung: Textzeile')
assert.deepEqual(kernpunkteAus('## Was geschafft wurde\n' + Array.from({ length: 12 }, (_, i) => `- p${i}`).join('\n')).geschafft.length, 8, 'höchstens 8 je Gruppe')
assert.deepEqual(kernpunkteAus('nichts'), { geschafft: [], probleme: [] })
assert.equal(tagAusDateiname('tagesbericht-2026-11-14-nachtrag.md'), '2026-11-14')
assert.equal(tagAusDateiname('lehren.md'), null)
const tmp = mkdtempSync(resolve(tmpdir(), 'kennzahlen-kp-'))
mkdirSync(tmp, { recursive: true })
writeFileSync(resolve(tmp, 'tagesbericht-2026-11-05.md'), '## Was geschafft wurde\n- A\n')
writeFileSync(resolve(tmp, 'andere-datei.md'), '## Was geschafft wurde\n- B\n')
const bestand = { '2026-11-01': { geschafft: ['alt'], probleme: [] }, '2026-11-05': { geschafft: ['überholt'], probleme: ['x'] } }
const neu = ergaenze(bestand, tmp)
assert.deepEqual(Object.keys(neu), ['2026-11-01', '2026-11-05'], 'Tage ohne Bericht bleiben, andere Dateien zählen nicht')
assert.deepEqual(neu['2026-11-05'], { geschafft: ['A'], probleme: [] }, 'Bericht ersetzt den Eintrag seines Tags')
assert.deepEqual(ergaenze(bestand, resolve(tmp, 'gibt-es-nicht')), bestand, 'fehlender Ordner: Bestand unverändert')
for (const tag of ['2026-11-08', '2026-11-13', '2026-11-14']) {
  assert.ok(echt.kernpunkte[tag]?.geschafft.length > 0 && echt.kernpunkte[tag]?.probleme.length > 0, `kernpunkte.yaml ${tag}`)
  assert.deepEqual(echtDaten.kernpunkte[tag], echt.kernpunkte[tag], 'Kernpunkte erreichen daten.js')
}
console.log('Wirkung, Staffelung, Kernpunkte, daten.js-Aktualität: ok')
