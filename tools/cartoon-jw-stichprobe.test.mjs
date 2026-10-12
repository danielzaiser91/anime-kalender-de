/**
 * Prüft die Auswahl der Cartoon-Stichprobe (`tools/cartoon-jw-stichprobe.mjs`): deterministisch, je Gruppe genau 50,
 * keine Doppelten, und die eingefrorene Datei hält dieselben Regeln ein.
 * Aufruf: node tools/cartoon-jw-stichprobe.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QUOTEN, ZIEL, jwAussage, kandidaten, stichprobeDatei, waehleStichprobe } from './cartoon-jw-stichprobe.mjs'

const WURZEL = resolve(import.meta.dirname, '..')

/* Eine Zeile je Weg-Art: (Anbieter, Tonangabe von JustWatch, Adresse). */
const ADRESSE = {
  netflix: (i) => `https://www.netflix.com/title/${80000000 + i}`,
  primevideo: (i) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.${String(i).padStart(8, '0')}-aaaa`,
  disneyplus: (i) => `https://www.disneyplus.com/browse/entity-${String(i).padStart(8, '0')}-0000-0000`,
}
const JW_ANBIETER = { netflix: 'Netflix', primevideo: 'Amazon Prime Video', disneyplus: 'Disney Plus' }

/** 60 künstliche Cartoons je Anbieter und Tonangabe; Kennung = laufende Nummer. */
function erfundeneWelt() {
  const cartoons = []
  const jw = {}
  let id = 0
  for (const plattform of Object.keys(ADRESSE)) {
    for (const audio of [['de'], [], ['en']]) {
      for (let i = 0; i < 60; i++) {
        id++
        cartoons.push({ id: -id, titleEn: `T${id}`, streams: [{ platform: plattform, url: ADRESSE[plattform](id) }] })
        jw[String(-id)] = { angebote: [{ anbieter: JW_ANBIETER[plattform], art: 'FLATRATE', audio }] }
      }
    }
  }
  return { cartoons, jw }
}

const gruppe = (liste, richtung) => liste.filter((e) => e.richtung === richtung)
const ohneDoppelte = (liste, schluessel) => new Set(liste.map(schluessel)).size === liste.length

function pruefeInvarianten(liste, was) {
  for (const richtung of Object.keys(QUOTEN)) assert.equal(gruppe(liste, richtung).length, 50, `${was}: genau 50 in ${richtung}`)
  assert.equal(liste.length, 100, `${was}: 100 insgesamt`)
  assert.ok(ohneDoppelte(liste, (e) => `${e.id}|${e.plattform}`), `${was}: kein Weg doppelt`)
  assert.ok(ohneDoppelte(liste, (e) => `${e.plattform}|${e.url}`), `${was}: keine Adresse doppelt`)
  assert.ok(liste.every((e) => e.id < 0 && e.titel && e.url && e.jw.text), `${was}: Kennung, Titel, Adresse und JustWatch-Aussage je Eintrag`)
  assert.ok(gruppe(liste, 'jw-deutsch').every((e) => e.jw.urteil === 'deutsch'), `${was}: jw-deutsch nennt Deutsch`)
  assert.ok(gruppe(liste, 'jw-ohne-deutsch').every((e) => e.jw.urteil !== 'deutsch'), `${was}: jw-ohne-deutsch nennt kein Deutsch`)
}

/* JustWatchs Aussage je Fall. */
const angebot = (anbieter, audio, art = 'FLATRATE') => ({ anbieter, art, audio })
assert.equal(jwAussage([angebot('Amazon Prime Video with Ads', ['de', 'en'])], 'primevideo').urteil, 'deutsch')
assert.equal(jwAussage([angebot('Amazon Prime Video', ['en'])], 'primevideo').urteil, 'ton-ohne-deutsch')
assert.equal(jwAussage([angebot('Netflix', [])], 'netflix').urteil, 'ton-leer')
assert.equal(jwAussage([angebot('Netflix', [])], 'disneyplus').urteil, 'kein-angebot')
assert.equal(jwAussage([angebot('Amazon Video', ['de'], 'BUY')], 'primevideo').urteil, 'kein-angebot', 'Store und Kauf zählen nicht')
assert.equal(jwAussage([angebot('ZDF Select Amazon Channel', ['de'])], 'primevideo').urteil, 'kein-angebot', 'Kanäle zählen nicht')
assert.equal(jwAussage(undefined, 'netflix').urteil, 'kein-angebot')

/* Erfundene Welt: Quoten, Reihenfolge-Unabhängigkeit, Stabilität. */
const { cartoons, jw } = erfundeneWelt()
const wahl = waehleStichprobe(kandidaten(cartoons, jw))
pruefeInvarianten(wahl, 'erfundene Welt')
for (const [richtung, quoten] of Object.entries(QUOTEN)) {
  for (const [plattform, n] of Object.entries(quoten)) assert.equal(wahl.filter((e) => e.richtung === richtung && e.plattform === plattform).length, n, `Quote ${richtung} ${plattform}`)
}
assert.deepEqual(waehleStichprobe(kandidaten(cartoons, jw)), wahl, 'zweimal gerechnet: gleich')
assert.deepEqual(waehleStichprobe(kandidaten([...cartoons].reverse(), jw)), wahl, 'Eingabereihenfolge ändert nichts')
assert.notDeepEqual(waehleStichprobe(kandidaten(cartoons, jw, 'anderer-seed')), wahl, 'anderer Seed, andere Auswahl')

/* Ausschlüsse: Urteil am Weg, keine Adresse, Suchadresse, doppelte Adresse. */
const dazu = [
  { id: -9001, titleEn: 'Mit Urteil', streams: [{ platform: 'netflix', url: ADRESSE.netflix(9001), dub: true }] },
  { id: -9002, titleEn: 'Ohne Adresse', streams: [{ platform: 'netflix', url: '' }] },
  { id: -9003, titleEn: 'Suche', streams: [{ platform: 'primevideo', url: 'https://www.amazon.de/s?k=Cowboy' }] },
  { id: -9004, titleEn: 'Zweiter mit gleicher Adresse', streams: [{ platform: 'netflix', url: ADRESSE.netflix(1) }] },
]
const mehr = kandidaten([...cartoons, ...dazu], jw)
assert.ok(!mehr.some((k) => k.id <= -9001 && k.id !== -9004), 'Urteil, leere Adresse und Suchadresse sind keine Kandidaten')
const viele = waehleStichprobe(mehr)
pruefeInvarianten(viele, 'mit Ausschlüssen')

/* Fehlt es einem Anbieter an Wegen, füllen die übrigen der Gruppe auf — die Summe bleibt 50. */
const knapp = cartoons.filter((c) => c.streams[0].platform !== 'disneyplus' || Number(c.id) % 2 === 0).slice(0, 400)
pruefeInvarianten(waehleStichprobe(kandidaten(knapp, jw)), 'knapper Anbieter')

/* Neuer Titel mit hohem Schlüssel mischt die übrigen nicht um. */
const spaeter = waehleStichprobe(kandidaten([...cartoons, { id: -9100, titleEn: 'Neu', streams: [{ platform: 'netflix', url: ADRESSE.netflix(9100) }] }], { ...jw, '-9100': { angebote: [] } }))
assert.ok(wahl.filter((e) => spaeter.some((s) => s.id === e.id && s.plattform === e.plattform)).length >= 99, 'ein neuer Titel verdrängt höchstens einen')

/* Die eingefrorene Datei hält dieselben Regeln ein; der Bestand selbst darf sich verschoben haben. */
const datei = JSON.parse(readFileSync(resolve(WURZEL, ZIEL), 'utf8'))
pruefeInvarianten(datei.eintraege, 'eingefrorene Datei')

/* Mit den echten Dateien gerechnet: dieselben Invarianten, zweimal dasselbe Ergebnis. */
const heute = stichprobeDatei('2026-10-11')
pruefeInvarianten(heute.eintraege, 'echter Bestand')
assert.deepEqual(stichprobeDatei('2026-10-11'), heute, 'echter Bestand: deterministisch')

console.log('cartoon-jw-stichprobe: ok')
