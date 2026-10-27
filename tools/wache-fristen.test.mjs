// Fristen der Wochenwache: Werte fest eingetragen, nicht aus dem geprüften Modul abgeleitet.
import assert from 'node:assert/strict'
import { befundZuAlt, FRISTEN_STUNDEN, fristAusTakt } from './wache-fristen.mjs'

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
  'bestand-bauen.yml': 36,
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
assert.equal(befundZuAlt('bestand-bauen.yml', 4), null)
assert.equal(befundZuAlt('bestand-bauen.yml', 37), 'bestand-bauen.yml: letzter erfolgreicher Lauf vor 37 h, erlaubt 36 h')
assert.equal(befundZuAlt('adn-laufende.yml', 19), 'adn-laufende.yml: letzter erfolgreicher Lauf vor 19 h, erlaubt 18 h')
assert.equal(befundZuAlt('adn-laufende.yml', 18), null)

console.log('wache-fristen: 6 Regelfälle, Tabelle (14 Workflows), Grenze 3 h, stündlich 4 h -> Meldung, nie -> Meldung: ok')
