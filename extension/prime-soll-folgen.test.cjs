/**
 * Soll-Folgenzahl für „kein Deutsch" (24.10.2026): Bei Band-Staffeln nennt die Seite die ganze Staffel
 * (ZEXAL: 96, erreichbar 48), „fehlen 48" hielt die Meldung für immer auf. Sind alle Abschnitte wirklich
 * gelesen, gilt das Gelesene; ein offener Abschnitt (Dai: 75 von 99, vierter Abschnitt nie gelesen) hält die Seitenzahl.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kasten = {}
kasten.globalThis = kasten
vm.runInNewContext(readFileSync(resolve(__dirname, 'prime-region.js'), 'utf8'), kasten)
const soll = (o) => kasten.akPrimeSollFolgen({ gesamt: o.gesamt, abschnitte: o.abschnitte }, o.lautSeite, o.gelesen)

console.log('Zusicherungen für die Soll-Folgenzahl\n')
pruefe('Band-Staffel: zwei Abschnitte gelesen, Seite nennt 96 → 48', soll({ gesamt: 96, lautSeite: 96, abschnitte: { gesamt: 2, offen: 0 }, gelesen: 48 }) === 48)
pruefe('Dai: Abschnitt offen → Seitenzahl 99 bleibt', soll({ gesamt: 99, lautSeite: 99, abschnitte: { gesamt: 5, offen: 1 }, gelesen: 75 }) === 99)
pruefe('ein einziger Abschnitt: Seitenzahl gilt (Block kann noch wachsen)', soll({ gesamt: 24, lautSeite: 24, abschnitte: { gesamt: 1, offen: 0 }, gelesen: 12 }) === 24)
pruefe('genau zwei Abschnitte zählen schon', soll({ gesamt: 60, lautSeite: 50, abschnitte: { gesamt: 2, offen: 0 }, gelesen: 40 }) === 40)
pruefe('keine Abschnitte bekannt: größere von Zählwerk und Seite', soll({ gesamt: 10, lautSeite: 13, abschnitte: null, gelesen: 10 }) === 13)
pruefe('nichts gelesen: Seitenzahl bleibt', soll({ gesamt: 48, lautSeite: 48, abschnitte: { gesamt: 2, offen: 0 }, gelesen: 0 }) === 48)
pruefe('mehr gelesen als genannt: genannte Zahl', soll({ gesamt: 30, lautSeite: 0, abschnitte: { gesamt: 2, offen: 0 }, gelesen: 36 }) === 30)
pruefe('genau ein Abschnitt offen von drei: Seitenzahl', soll({ gesamt: 72, lautSeite: 72, abschnitte: { gesamt: 3, offen: 1 }, gelesen: 48 }) === 72)

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen erfüllt.')
