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

// Tabelle: genau diese Fristen
assert.deepEqual(FRISTEN_STUNDEN, {
  'refresh-hourly.yml': 3,
  'refresh-data.yml': 36,
  'bestand-bauen.yml': 8,
  'deploy.yml': 48,
  'adn-laufende.yml': 18,
  'claude-verpasst-recherche.yml': 36,
  'claude-anime2you-extraktion.yml': 36,
  'claude-wache-urteil.yml': 36,
  'anisearch-katalog.yml': 48,
  'ladezeiten.yml': 36,
  'offizielle-news.yml': 36,
  'meldungskopie.yml': 36,
  'refresh-weekly.yml': 216,
  'tonspuren-monatlich.yml': 792,
})

// Der Fall: stündlicher Workflow, letzter Erfolg vor 4 h -> Meldung (vorher Frist 12 h: stumm)
assert.equal(befundZuAlt('refresh-hourly.yml', 4), 'refresh-hourly.yml: letzter erfolgreicher Lauf vor 4 h, erlaubt 3 h')
// Grenze und Nichtauskunft
assert.equal(befundZuAlt('refresh-hourly.yml', 3), null)
assert.equal(befundZuAlt('refresh-hourly.yml', 2.9), null)
assert.equal(befundZuAlt('refresh-hourly.yml', null), 'refresh-hourly.yml: letzter erfolgreicher Lauf nie, erlaubt 3 h')
// Unverkürzter Workflow bleibt bei 4 h still
assert.equal(befundZuAlt('bestand-bauen.yml', 7), null)
assert.equal(befundZuAlt('bestand-bauen.yml', 9), 'bestand-bauen.yml: letzter erfolgreicher Lauf vor 9 h, erlaubt 8 h')
assert.equal(befundZuAlt('deploy.yml', 47), null)
assert.equal(befundZuAlt('deploy.yml', 49), 'deploy.yml: letzter erfolgreicher Lauf vor 49 h, erlaubt 48 h')
assert.equal(befundZuAlt('adn-laufende.yml', 19), 'adn-laufende.yml: letzter erfolgreicher Lauf vor 19 h, erlaubt 18 h')
assert.equal(befundZuAlt('adn-laufende.yml', 18), null)

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
  'ladezeiten.yml: letzter erfolgreicher Lauf nie, erlaubt 36 h',
])
assert.equal(zeilen.length, 13) // alle außer dem Abruf-Fehler
assert.ok(zeilen[0].includes('refresh-hourly.yml') && zeilen[0].includes('vor 4.0 h') && zeilen[0].includes('erlaubt 3 h'))
// Eigene Tabelle wird benutzt
assert.deepEqual(pruefeFristen(() => vor(5), JETZT, { 'x.yml': 4, 'y.yml': 6 }), ['x.yml: letzter erfolgreicher Lauf vor 5 h, erlaubt 4 h'])
// Alles frisch -> keine Befunde (Gegenprobe)
assert.deepEqual(pruefeFristen(() => vor(1), JETZT), [])

console.log('wache-fristen: 6 Regelfälle, Tabelle (14 Workflows), Grenze 3 h, stündlich 4 h -> Meldung, Durchlauf 13 Zeilen + Abruffehler + nie, frisch -> leer: ok')
