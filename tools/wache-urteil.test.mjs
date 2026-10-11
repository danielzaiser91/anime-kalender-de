// Prüft, dass ein Urteil nur in der vereinbarten Form durchkommt und der Eintrag oben in der Auswertung landet.
import assert from 'node:assert/strict'
import { berlinZeit, pruefeUrteil, setzeEin } from './wache-urteil-eintrag.mjs'

const FUELLTEXT = 'Beleg aus Dossier 01: 12 Läufe grün, nichts auffällig.'
const urteil = (lage, ersetze = {}) => {
  const koepfe = ['**Was läuft korrekt.**', '**Wo ist Verbesserungspotenzial?**', '**Wo sind echte Risiken und Lücken?**', '**Was läuft komplett falsch?**']
  return `Lage: ${lage}\n\n${koepfe.map((k, i) => ersetze[i] ?? `${k} ${FUELLTEXT}`).join('\n\n')}\n`
}

const gut = pruefeUrteil(urteil('befund'))
assert.equal(gut.ok, true)
assert.equal(gut.lage, 'befund')
assert.equal(gut.absaetze.length, 4)
assert.equal(pruefeUrteil(urteil('ruhig')).lage, 'ruhig')

const fehler = (text, muster) => {
  const r = pruefeUrteil(text)
  assert.equal(r.ok, false)
  assert.match(r.fehler, muster)
}
fehler('Lage: vielleicht\n\nx', /erste Zeile/)
fehler('', /erste Zeile/)
fehler(urteil('befund').replace('\n\n**Was läuft komplett falsch?**', '\n**Was läuft komplett falsch?**'), /3 Absätze/)
fehler(urteil('befund', { 2: '**Wo sind echte Risiken und Lücken?** Siehe https://example.org/x für mehr.' }), /Adresse/)
fehler(urteil('befund', { 1: '**Wo ist Verbesserungspotenzial?** <b>fett</b> und genug Text hier.' }), /Markup/)
fehler(urteil('befund', { 1: '**Wo ist Verbesserungspotenzial?** Siehe [die Liste](daniel-zum-abarbeiten/x.md) für den Rest.' }), /Verweis/)
fehler(urteil('befund', { 1: '**Wo ist Verbesserungspotenzial?** Mehr dazu auf www.example.org im Netz.' }), /Adresse/)
fehler(urteil('befund', { 2: '**Wo sind echte Risiken und Lücken?** @danielzaiser91 sollte das ansehen, sagt der Beleg.' }), /Erwähnung/)
fehler(urteil('befund', { 2: '**Wo sind echte Risiken und Lücken?** Bitte `rm -rf data/cache` ausführen, dann neu bauen.' }), /Befehl/)
// Dateinamen in Backticks ohne Leerzeichen und Mail-artige Zeichen mitten im Wort bleiben erlaubt.
assert.equal(pruefeUrteil(urteil('befund', { 0: '**Was läuft korrekt.** `data/source-health.json` und `tools/briefkasten-wache.mjs` zeigen 12 Läufe grün (01).' })).ok, true)
assert.equal(pruefeUrteil(urteil('befund', { 0: '**Was läuft korrekt.** Eine Kennung wie name@host im Text ist keine Erwähnung, 12 Läufe grün (01).' })).ok, true)
fehler(urteil('befund', { 3: '**Was läuft komplett falsch?**' }), /Absatz 4 ist leer/)
fehler(urteil('befund', { 0: `**Was läuft korrekt.** ${'x'.repeat(5000)}` }), /länger/)
fehler(urteil('befund').replace('**Wo ist Verbesserungspotenzial?**', '**Anderes.**'), /Absatz 2 beginnt nicht/)

// Zeit: 11.10.2026 06:20 UTC ist 08:20 in Berlin (Sommerzeit bis 25.10.).
assert.equal(berlinZeit(new Date('2026-10-11T06:20:00Z')), '11.10.2026, 08:20')

const datei = '# Auswertung\n\nEinleitung.\n\n## 02.10.2026, 15:05 — alt\n\nAlt.\n'
const neu = setzeEin(datei, gut, new Date('2026-10-11T06:20:00Z'))
assert.ok(neu.indexOf('## 11.10.2026, 08:20 — Claude-Lauf, Befund') < neu.indexOf('## 02.10.2026'), 'neuer Eintrag steht über dem alten')
assert.ok(neu.startsWith('# Auswertung\n\nEinleitung.\n\n## 11.10.2026'), 'Kopf der Datei bleibt')
assert.ok(neu.endsWith('## 02.10.2026, 15:05 — alt\n\nAlt.\n'), 'älterer Eintrag bleibt unverändert')
assert.throws(() => setzeEin('# ohne Abschnitt\n', gut, new Date()), /Aufbau geändert/)

console.log('wache-urteil: ok')
