/**
 * Prüft die Auswertung der Cartoon-Stichprobe (`tools/cartoon-jw-auswerten.mjs`): Zuordnung der Meldungen,
 * Urteil je Weg, Trefferquote je Anbieter und Richtung, Wilson-Untergrenze, seitenweises Holen.
 * Aufruf: node tools/cartoon-jw-auswerten.test.mjs
 */
import assert from 'node:assert/strict'
import { adresskennung, auswerten, holeMeldungen, tabelle, tonDerMeldung, urteilJeWeg, wilsonUnten } from './cartoon-jw-auswerten.mjs'

const weg = (id, plattform, richtung, url) => ({ id, titel: `T${-id}`, plattform, url, richtung, jw: { urteil: 'x', text: 'x' } })
const eintraege = [
  weg(-1, 'primevideo', 'jw-deutsch', 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.aaaa-1'),
  weg(-2, 'primevideo', 'jw-deutsch', 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.aaaa-2'),
  weg(-3, 'disneyplus', 'jw-deutsch', 'https://www.disneyplus.com/browse/entity-11111111-aaaa'),
  weg(-4, 'netflix', 'jw-ohne-deutsch', 'https://www.netflix.com/title/80000004'),
  weg(-5, 'netflix', 'jw-ohne-deutsch', 'https://www.netflix.com/title/80000005'),
  weg(-6, 'netflix', 'jw-ohne-deutsch', 'https://www.netflix.com/title/80000006'),
  weg(-7, 'netflix', 'jw-ohne-deutsch', 'https://www.netflix.com/title/80000007'),
]
const m = (plattform, extra) => ({ plattform, gemeldet_am: '2026-10-12T10:00:00Z', ...extra })
const meldungen = [
  m('primevideo', { titel_id: -1, ton_de: 'ja', vorhanden: 'ja' }), // JW deutsch, stimmt
  m('primevideo', { url: 'https://www.amazon.de/dp/amzn1.dv.gti.aaaa-2', ton_de: 'nein', vorhanden: 'ja' }), // JW deutsch, falsch (Adresse trifft)
  m('disneyplus', { titel_id: -3, ton_de: 'unbekannt', vorhanden: 'ja' }), // offen
  m('netflix', { url: 'https://www.netflix.com/title/80000004?x=1', befund: 'kein_dub' }), // JW ohne, stimmt (alte Meldung)
  m('netflix', { titel_id: -5, ton_de: 'ja', vorhanden: 'ja' }), // JW ohne, verfehlt
  m('netflix', { titel_id: -5, ton_de: 'nein', vorhanden: 'ja' }), // dieselbe Serie: irgendeine Folge deutsch gewinnt
  m('netflix', { titel_id: -6, vorhanden: 'nein' }), // nicht verfügbar
  m('disneyplus', { titel_id: -7, ton_de: 'ja', vorhanden: 'ja' }), // anderer Anbieter, zählt nicht für Netflix -7
]

assert.equal(adresskennung('https://www.netflix.com/title/80000004?x=1'), '80000004')
assert.equal(adresskennung('https://www.amazon.de/dp/B0ABCDEFGH'), 'b0abcdefgh')
assert.equal(adresskennung('https://www.disneyplus.com/browse/entity-AAAA1111-bbbb'), 'aaaa1111-bbbb')
assert.equal(adresskennung('https://example.org/'), undefined)
assert.equal(tonDerMeldung({ befund: 'dub' }), 'ja')
assert.equal(tonDerMeldung({ befund: 'weg' }), 'weg')
assert.equal(tonDerMeldung({ ton_de: 'ja', vorhanden: 'nein' }), 'weg', 'nicht vorhanden schlägt den Ton')
assert.equal(urteilJeWeg([]), 'offen')
assert.equal(urteilJeWeg([{ ton_de: 'nein', vorhanden: 'ja' }, { ton_de: 'ja', vorhanden: 'ja' }]), 'deutsch')

const zahlen = auswerten(eintraege, meldungen)
const zeile = (richtung, plattform) => zahlen.find((z) => z.richtung === richtung && z.plattform === plattform)
const pd = zeile('jw-deutsch', 'primevideo')
assert.deepEqual([pd.wege, pd.n, pd.richtig, pd.falsch.length], [2, 2, 1, 1])
assert.equal(pd.quote, 0.5)
const dd = zeile('jw-deutsch', 'disneyplus')
assert.deepEqual([dd.n, dd.offen], [0, 1], 'offene Wege zählen nicht in n')
assert.equal(dd.quote, null)
const nn = zeile('jw-ohne-deutsch', 'netflix')
assert.deepEqual([nn.wege, nn.n, nn.richtig, nn.offen, nn.nichtVerfuegbar], [4, 2, 1, 1, 1])
assert.match(nn.falsch[0], /T5 \(netflix, deutsch\)/)
const gesamt = zeile('jw-deutsch', 'gesamt')
assert.deepEqual([gesamt.wege, gesamt.n, gesamt.richtig], [3, 2, 1])
assert.match(tabelle(zahlen), /n < 50/, 'zu kleines n wird gekennzeichnet')
assert.match(tabelle(zahlen), /Fehlschläge:/)

/* Wilson: 0 von 0 ist 0; 50 von 50 liegt über 0,92; 45 von 50 deutlich darunter. */
assert.equal(wilsonUnten(0, 0), 0)
assert.ok(wilsonUnten(50, 50) > 0.92 && wilsonUnten(50, 50) < 0.93)
assert.ok(wilsonUnten(45, 50) < 0.8)
assert.ok(wilsonUnten(468 - 3, 468) > 0.98 - 0.001, 'Anime-Messung: 465 von 468 → Untergrenze ≈ 98,1 %')

/* Seitenweises Holen mit nachgebautem fetch. */
const seiten = [{ pruefungen: [{ a: 1 }], weiter: 5 }, { pruefungen: [{ a: 2 }], weiter: null }]
const abgerufen = []
const kopfzeilen = []
const antwort = async (url, optionen) => {
  abgerufen.push(url)
  kopfzeilen.push(optionen?.headers?.Authorization)
  return { ok: true, json: async () => seiten[abgerufen.length - 1] }
}
assert.deepEqual(await holeMeldungen('https://w.example', 'geheim', antwort), [{ a: 1 }, { a: 2 }])
assert.match(abgerufen[1], /nach=5$/)
assert.ok(abgerufen.every((u) => !u.includes('geheim')), 'Token nie in der Adresse')
assert.deepEqual(kopfzeilen, ['Bearer geheim', 'Bearer geheim'])
await assert.rejects(holeMeldungen('https://w.example', 'x', async () => ({ ok: false, status: 403 })), /403/)

console.log('cartoon-jw-auswerten: ok')
