// Fristen der Wochenwache: Werte fest eingetragen, nicht aus dem geprüften Modul abgeleitet.
import assert from 'node:assert/strict'
import { befundZuAlt, FRISTEN_STUNDEN, fristAusTakt, pruefeFristen } from './wache-fristen.mjs'

// Regel: 3 x Takt, mindestens 3 h, nie über der alten Frist
assert.equal(fristAusTakt(1, 12), 3)
assert.equal(fristAusTakt(0.5, 12), 3)
assert.equal(fristAusTakt(2, 12), 6)
assert.equal(fristAusTakt(6, 24), 18)
assert.equal(fristAusTakt(24, 36), 36)
assert.equal(fristAusTakt(1, 2), 2)

// Tabelle: Fristen gegen die gemessenen größten Lücken (gh run list, 03.11.2026, Stunden). Die Erwartung kommt aus dieser Messung,
// nicht aus einer Abschrift der Tabelle: Frist >= 1,25 x größte Lücke (tonspuren-monatlich: 1,15 x, nur 4 Läufe), und (außer ohne festen Takt) <= 2 x.
const GROESSTE_LUECKE = {
  'refresh-hourly.yml': 2.0,
  'refresh-data.yml': 24.0,
  'daten-auf-abruf.yml': 18.1,
  'bestand-bauen.yml': 13.54,
  'd1-verbrauch.yml': 26.9,
  'deploy.yml': 12.7,
  'adn-laufende.yml': 7.0,
  'claude-verpasst-recherche.yml': 24.0,
  'claude-anime2you-extraktion.yml': 24.0,
  'claude-wache-urteil.yml': 24.0,
  'claude-daten-merge.yml': 1.95,
  'anisearch-katalog.yml': 24.0,
  'ladezeiten.yml': 24.0,
  'offizielle-news.yml': 24.0,
  'meldungskopie.yml': 33.2,
  'refresh-weekly.yml': 243.6,
  'tonspuren-monatlich.yml': 867.7,
}
const OHNE_OBERGRENZE = new Set(['deploy.yml', 'adn-laufende.yml', 'claude-daten-merge.yml'])
assert.deepEqual(Object.keys(FRISTEN_STUNDEN).sort(), Object.keys(GROESSTE_LUECKE).sort())
for (const [w, frist] of Object.entries(FRISTEN_STUNDEN)) {
  assert.ok(frist >= (w === 'tonspuren-monatlich.yml' ? 1.15 : 1.25) * GROESSTE_LUECKE[w], `${w}: ${frist} h zu knapp für Lücke ${GROESSTE_LUECKE[w]} h`)
  if (!OHNE_OBERGRENZE.has(w)) assert.ok(frist <= 2 * GROESSTE_LUECKE[w], `${w}: ${frist} h zu locker für Lücke ${GROESSTE_LUECKE[w]} h`)
}
const F = FRISTEN_STUNDEN

// Der Fall: stündlicher Workflow, letzter Erfolg vor 4 h -> Meldung (vorher Frist 12 h: stumm)
assert.equal(befundZuAlt('refresh-hourly.yml', 4), 'refresh-hourly.yml: letzter erfolgreicher Lauf vor 4 h, erlaubt 3 h')
// Grenze und Nichtauskunft
assert.equal(befundZuAlt('refresh-hourly.yml', 3), null)
assert.equal(befundZuAlt('refresh-hourly.yml', 2.9), null)
assert.equal(befundZuAlt('refresh-hourly.yml', null), 'refresh-hourly.yml: letzter erfolgreicher Lauf nie, erlaubt 3 h')
// Unverkürzter Workflow bleibt bei 4 h still
const bb = F['bestand-bauen.yml']
assert.equal(befundZuAlt('bestand-bauen.yml', bb - 1), null)
assert.equal(befundZuAlt('bestand-bauen.yml', bb + 1), `bestand-bauen.yml: letzter erfolgreicher Lauf vor ${bb + 1} h, erlaubt ${bb} h`)
assert.equal(befundZuAlt('deploy.yml', F['deploy.yml'] - 1), null)
assert.equal(befundZuAlt('deploy.yml', F['deploy.yml'] + 1), `deploy.yml: letzter erfolgreicher Lauf vor ${F['deploy.yml'] + 1} h, erlaubt ${F['deploy.yml']} h`)
assert.equal(befundZuAlt('adn-laufende.yml', F['adn-laufende.yml'] + 1), `adn-laufende.yml: letzter erfolgreicher Lauf vor ${F['adn-laufende.yml'] + 1} h, erlaubt ${F['adn-laufende.yml']} h`)
assert.equal(befundZuAlt('adn-laufende.yml', F['adn-laufende.yml']), null)

// Durchlauf über die echte Tabelle: fester Zeitpunkt, Erfolg überall vor 4 h, einer wirft, einer nie
const JETZT = Date.parse('2999-12-31T12:00:00Z')
const vor = (h) => JETZT - h * 3600e3
const zeilen = []
const befunde = pruefeFristen(
  (w) => {
    if (w === 'deploy.yml') throw new Error('gh kaputt\nzweite Zeile')
    if (w === 'ladezeiten.yml') return null
    return vor(4)
  },
  JETZT,
  FRISTEN_STUNDEN,
  (z) => zeilen.push(z),
)
assert.deepEqual(befunde, [
  'refresh-hourly.yml: letzter erfolgreicher Lauf vor 4 h, erlaubt 3 h',
  'deploy.yml: Abfrage fehlgeschlagen (gh kaputt)',
  `ladezeiten.yml: letzter erfolgreicher Lauf nie, erlaubt ${F['ladezeiten.yml']} h`,
])
assert.equal(zeilen.length, Object.keys(F).length - 1) // alle außer dem Abruf-Fehler
assert.ok(zeilen[0].includes('refresh-hourly.yml') && zeilen[0].includes('vor 4.0 h') && zeilen[0].includes('erlaubt 3 h'))
// Eigene Tabelle wird benutzt
assert.deepEqual(pruefeFristen(() => vor(5), JETZT, { 'x.yml': 4, 'y.yml': 6 }), ['x.yml: letzter erfolgreicher Lauf vor 5 h, erlaubt 4 h'])
// Alles frisch -> keine Befunde (Gegenprobe)
assert.deepEqual(pruefeFristen(() => vor(1), JETZT, FRISTEN_STUNDEN), [])

console.log(`wache-fristen: 6 Regelfälle, Tabelle (${Object.keys(F).length} Workflows gegen gemessene Lücken, 1,25x bis 2x), Grenze 3 h, stündlich 4 h -> Meldung, Durchlauf ${Object.keys(F).length - 1} Zeilen + Abruffehler + nie, frisch -> leer: ok`)
