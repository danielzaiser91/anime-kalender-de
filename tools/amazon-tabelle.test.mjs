/**
 * Prüft `tools/amazon-tabelle.mjs` (DD-16, Wochenwache 20.10.2026) und die Form aller `buyUrl` der Handdateien.
 * Aufruf: `node tools/amazon-tabelle.test.mjs`
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { amazonAdresse, bearbeiteDatei, buyUrlEintragen, eintraegeAus, kennungZu, normalisiere, zeilenAusArtikel } from './amazon-tabelle.mjs'

const zeile = (asin, name, tag, tagParam = '?tag=anim0f-21') =>
  `<tr> <td><a target="_blank" rel="nofollow" href="https://www.amazon.de/dp/${asin}${tagParam}">${name}</a></td> <td>${tag}</td> <td>Blu-ray</td> </tr>`

const html = [
  '<p>Prosa <a href="https://www.amazon.de/dp/B0PROSA001?tag=x">Re:ZERO</a>, kein Tabellenlink.</p>',
  zeile('B0AAAAAA01', 'Re:ZERO – Staffel 3 – Vol. 3', '15.01.'),
  zeile('B0AAAAAA02', 'Zwilling – Vol. 1', '20.11.'),
  zeile('B0AAAAAA03', 'Zwilling – Vol. 1', '20.11.'),
  zeile('B0AAAAAA04', 'Einzel – Vol. 1', '20.11.'),
  zeile('B0AAAAAA05', 'Einzel – Vol. 1', '04.12.'),
].join('\n')

const zeilen = zeilenAusArtikel(html)
assert.equal(zeilen.length, 5, 'nur Tabellenzeilen, nicht der Prosa-Link')
assert.deepEqual(zeilen[0], { asin: 'B0AAAAAA01', name: normalisiere('Re:ZERO – Staffel 3 – Vol. 3'), tag: '01-15' })

assert.equal(kennungZu(zeilen, 'Re:ZERO – Staffel 3 – Vol. 3', '01-15'), 'B0AAAAAA01')
assert.equal(kennungZu(zeilen, 'Re:ZERO – Staffel 3 – Vol. 3', '01-16'), undefined, 'anderer Tag')
assert.equal(kennungZu(zeilen, 'Re:ZERO – Staffel 3 – Vol. 3', '02-15'), undefined, 'anderer Monat, gleicher Tag')
assert.equal(kennungZu(zeilen, 'Re:ZERO – Staffel 3 – Vol. 2', '01-15'), undefined, 'anderer Name')
assert.equal(kennungZu(zeilen, 'Zwilling – Vol. 1', '20.11.'.replace(/(\d+)\.(\d+)\./, '$2-$1')), undefined, 'zwei Kennungen zum selben Schlüssel')
assert.equal(kennungZu(zeilen, 'Einzel – Vol. 1', '11-20'), 'B0AAAAAA04', 'derselbe Name an anderem Tag: der eigene Tag entscheidet')
assert.equal(kennungZu(zeilen, 'Einzel – Vol. 1', '12-04'), 'B0AAAAAA05')
assert.equal(amazonAdresse('B0AAAAAA01'), 'https://www.amazon.de/dp/B0AAAAAA01', 'ohne Partner-Tag')

const datei = [
  '# Kopf',
  '- slug: a',
  '  titleDe: "Re:ZERO – Staffel 3 – Vol. 3"',
  '  edition: "Blu-ray"',
  '  schedule: { firstEpisodeDate: "2027-01-15", estimated: true }',
  '  sources: [https://x/1]',
  '',
  '- slug: b',
  '  titleDe: "Einzel – Vol. 1"',
  '  edition: "Limited Edition, Blu-ray"',
  '  schedule: { firstEpisodeDate: "2026-11-20" }',
  '',
  '- slug: c',
  '  titleDe: "Schon – Vol. 1"',
  '  buyUrl: https://www.amazon.de/dp/B0VORHANDE',
  '  schedule: { firstEpisodeDate: "2026-11-20" }',
].join('\n')

const eintraege = eintraegeAus(datei)
assert.deepEqual(
  eintraege.map((e) => [e.slug, e.tag, e.hatBuyUrl, Boolean(e.sonderausgabe)]),
  [['a', '01-15', false, false], ['b', '11-20', false, true], ['c', '11-20', true, false]],
)

const neu = buyUrlEintragen(datei, 'a', amazonAdresse('B0AAAAAA01'))
assert.ok(neu.includes('  edition: "Blu-ray"\n  buyUrl: https://www.amazon.de/dp/B0AAAAAA01\n  schedule:'), 'vor schedule, im eigenen Eintrag')
assert.equal(neu.split('\n').length, datei.split('\n').length + 1, 'genau eine Zeile mehr')
assert.equal(buyUrlEintragen(neu, 'a', amazonAdresse('B0AAAAAA01')), neu, 'zweiter Lauf ändert nichts')
assert.equal(buyUrlEintragen(datei, 'c', amazonAdresse('B0AAAAAA09')), datei, 'vorhandene buyUrl bleibt')
assert.equal(buyUrlEintragen(datei, 'fehlt', amazonAdresse('B0AAAAAA09')), datei, 'unbekannter Slug')
assert.equal(buyUrlEintragen('', 'a', amazonAdresse('B0AAAAAA09')), '', 'leere Datei')
const ohneSchedule = '- slug: a\n  titleDe: "X"\n'
assert.equal(buyUrlEintragen(ohneSchedule, 'a', amazonAdresse('B0AAAAAA09')), ohneSchedule, 'Eintrag ohne schedule bleibt')
const letzter = '- slug: x\n  titleDe: "X"\n- slug: y\n  titleDe: "Y"\n  schedule: { firstEpisodeDate: "2026-11-20" }'
assert.ok(buyUrlEintragen(letzter, 'y', amazonAdresse('B0AAAAAA07')).includes('  buyUrl: https://www.amazon.de/dp/B0AAAAAA07\n  schedule:'), 'letzter Eintrag ohne Schlusszeile')
assert.equal(buyUrlEintragen(letzter, 'fehlt', amazonAdresse('B0AAAAAA07')), letzter, 'unbekannter Slug, letzte Zeile ist ein schedule')
const zweiter = buyUrlEintragen(datei, 'b', amazonAdresse('B0AAAAAA04'))
assert.ok(zweiter.indexOf('B0AAAAAA04') > zweiter.indexOf('- slug: b'), 'landet im Eintrag b, nicht im Vorgänger')

const lauf = bearbeiteDatei(datei, zeilen, false)
assert.deepEqual(lauf.vorschlaege.map((v) => v.slug), ['a'], 'b (Sonderausgabe) und c (hat buyUrl) bleiben außen')
assert.equal(lauf.text, datei, 'ohne --schreiben bleibt der Text')
const geschrieben = bearbeiteDatei(datei, zeilen, true)
assert.ok(geschrieben.text.includes('buyUrl: https://www.amazon.de/dp/B0AAAAAA01'))
assert.deepEqual(bearbeiteDatei(geschrieben.text, zeilen, true).vorschlaege, [], 'zweiter Lauf findet nichts mehr')
assert.equal(bearbeiteDatei(geschrieben.text, zeilen, true).text, geschrieben.text)
assert.deepEqual(bearbeiteDatei('', zeilen, true), { text: '', vorschlaege: [] }, 'leere Datei')
for (const wort of ['Limited Edition', 'mit Sammelschuber', 'Steelbook', 'Steelcase-Edition', 'Amazon-exklusiv']) {
  const sonder = `- slug: s\n  titleDe: "Einzel – Vol. 1"\n  edition: "${wort}, Blu-ray"\n  schedule: { firstEpisodeDate: "2026-11-20" }\n`
  assert.deepEqual(bearbeiteDatei(sonder, zeilen, true).vorschlaege, [], `Sonderausgabe: ${wort}`)
}
const standard = '- slug: s\n  titleDe: "Einzel – Vol. 1"\n  edition: "Komplettbox, Blu-ray"\n  schedule: { firstEpisodeDate: "2026-11-20" }\n'
assert.equal(bearbeiteDatei(standard, zeilen, false).vorschlaege.length, 1, 'Komplettbox zählt nicht als Sonderausgabe')

/* Daten: jede buyUrl der Handdateien ist eine Produktseite ohne Partner-Tag und ohne Abfrage. */
const ordner = resolve(import.meta.dirname, '..', 'data', 'curated')
let gezaehlt = 0
for (const f of readdirSync(ordner).filter((x) => x.endsWith('.yaml'))) {
  for (const z of readFileSync(join(ordner, f), 'utf8').split('\n')) {
    const m = z.match(/^\s+buyUrl: (\S+)/)
    if (!m) continue
    gezaehlt++
    const adresse = m[1].replaceAll('"', '')
    assert.match(adresse, /^https:\/\/[^?\s]+$/, `${f}: buyUrl mit Abfrage (Suche oder Partner-Tag): ${adresse}`)
  }
}
assert.ok(gezaehlt >= 20, `buyUrl-Zeilen gezählt: ${gezaehlt}`)
console.log(`amazon-tabelle: ok (${zeilen.length} Zeilen, ${gezaehlt} buyUrl in den Handdateien)`)
