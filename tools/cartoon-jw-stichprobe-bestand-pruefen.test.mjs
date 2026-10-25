/**
 * Test von `pruefeBestand` (cartoon-jw-stichprobe-bestand-pruefen.mjs) mit eingespeister Welt statt der echten Dateien:
 * Schlusszeile `VERSTÖSSE: <n>` und Rückgabe stimmen im grünen wie im roten Fall.
 */
import assert from 'node:assert/strict'
import { kandidaten, waehleStichprobe, SEED, QUOTEN } from './cartoon-jw-stichprobe.mjs'
import { pruefeBestand } from './cartoon-jw-stichprobe-bestand-pruefen.mjs'

const ADRESSE = {
  netflix: (i) => `https://www.netflix.com/title/${80000000 + i}`,
  primevideo: (i) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.${String(i).padStart(8, '0')}-aaaa`,
  disneyplus: (i) => `https://www.disneyplus.com/browse/entity-${String(i).padStart(8, '0')}-0000-0000`,
}
const JW_ANBIETER = { netflix: 'Netflix', primevideo: 'Amazon Prime Video', disneyplus: 'Disney Plus' }

/** 60 künstliche Cartoons je Anbieter und Tonangabe (deutsch, leer, englisch). */
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

/** Führt `pruefeBestand` aus und sammelt die Konsolenzeilen. */
function lauf(lade, datei) {
  const zeilen = []
  const original = console.log
  console.log = (...a) => zeilen.push(a.join(' '))
  let rueck
  try {
    rueck = pruefeBestand(lade, datei)
  } finally {
    console.log = original
  }
  return { rueck, zeilen }
}

const welt = erfundeneWelt()
const dateiAusWelt = (w) => (heute) => ({ seed: SEED, erzeugt: heute, quoten: QUOTEN, eintraege: waehleStichprobe(kandidaten(w.cartoons, w.jw)) })

/* Grün: gültige Welt, deterministische Auswahl. */
const gruen = lauf(() => welt, dateiAusWelt(welt))
assert.equal(gruen.rueck, 0, `grün: Rückgabe 0 (${gruen.zeilen.join(' | ')})`)
assert.equal(gruen.zeilen.at(-1), 'VERSTÖSSE: 0')
assert.ok(!gruen.zeilen.some((z) => z.startsWith('FEHLER')), 'grün: keine FEHLER-Zeile')
assert.ok(gruen.zeilen.some((z) => z.startsWith('cartoon-jw-stichprobe-bestand-pruefen: ok')), 'grün: ok-Zeile')

/* Rot: leerer Bestand (Grundmenge je Gruppe unter 50) – Vorbild aus der Abnahme von PR 2017. */
const leer = { cartoons: [], jw: {} }
const rot = lauf(() => leer, dateiAusWelt(leer))
assert.ok(rot.rueck >= 1, `rot: Rückgabe > 0 (${rot.rueck})`)
const fehlerZeilen = rot.zeilen.filter((z) => z.startsWith('FEHLER: '))
assert.ok(fehlerZeilen.length >= 1, 'rot: mindestens eine FEHLER-Zeile')
assert.equal(rot.zeilen.at(-1), `VERSTÖSSE: ${rot.rueck}`, 'rot: Schlusszeile nennt die Zahl')
assert.equal(rot.rueck, fehlerZeilen.length, 'rot: Rückgabe = Zahl der FEHLER-Zeilen')
assert.ok(!rot.zeilen.some((z) => z.includes(': ok')), 'rot: keine ok-Zeile')

/* Rot, nur die Invarianten: Grundmenge reicht, die Auswahl ist aber leer. */
const leereWahl = lauf(() => welt, (heute) => ({ ...dateiAusWelt(welt)(heute), eintraege: [] }))
assert.equal(leereWahl.rueck, 1, `leere Auswahl: genau 1 Verstoß (${leereWahl.zeilen.join(' | ')})`)
assert.equal(leereWahl.zeilen.at(-1), 'VERSTÖSSE: 1')

/* Rot, anderer Weg: nicht deterministische Datei (zweiter Aufruf liefert anderes) genau ein Verstoß mehr. */
let aufrufe = 0
const wackelt = (heute) => ({ ...dateiAusWelt(welt)(heute), erzeugt: `${heute}-${aufrufe++}` })
const wackel = lauf(() => welt, wackelt)
assert.equal(wackel.rueck, 1, `nicht deterministisch: genau 1 Verstoß (${wackel.zeilen.join(' | ')})`)
assert.equal(wackel.zeilen.at(-1), 'VERSTÖSSE: 1')

console.log('cartoon-jw-stichprobe-bestand-pruefen: ok')
