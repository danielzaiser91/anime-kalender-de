/**
 * **Der Prime-Stand kommt aus dem Briefkasten, nicht aus der Token-Liste** (4.31.2, 15.10.2026).
 *
 * Geprüft wird `prime-stand.js` (Umrechnung der Meldungen in `erledigt`-Einträge) und dass
 * `amazon.js` dieselbe gecachte Adresse wie `disney.js` abruft — nur dann teilen beide den Edge-Cache.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Prime: Stand aus dem Briefkasten')
const sandkasten = {}
sandkasten.globalThis = sandkasten
vm.runInNewContext(readFileSync(__dirname + '/prime-stand.js', 'utf8'), sandkasten)
const stand = sandkasten.akPrimeStandAusBriefkasten

const ergebnis = stand([
  { url: 'https://www.amazon.de/gp/video/detail/B0ABCDEFGH/ref=x', folge_nr: 3, staffel: 1 },
  { url: 'https://www.amazon.de/gp/video/detail/B0ABCDEFGH/ref=x', folge_nr: 12, staffel: 1 },
  { url: 'https://www.amazon.de/gp/video/detail/B0ABCDEFGH/ref=x', folge_nr: 5, staffel: 1 },
  { url: 'https://www.amazon.de/gp/video/detail/B0ABCDEFGH/ref=x', folge_nr: null, staffel: 201 },
  { url: 'https://www.amazon.de/dp/B0FILM00001', folge_nr: null, staffel: null },
  { url: 'https://www.disneyplus.com/series/x/ABCDEFGHIJKL', folge_nr: 1, staffel: 1 },
  { url: 'https://www.netflix.com/title/81234567', folge_nr: 1, staffel: 1 },
  { url: null, folge_nr: 1, staffel: 1 },
  null,
])
const serie = ergebnis.B0ABCDEFGH
pruefe('Kennung aus /gp/video/detail/', Boolean(serie), Object.keys(ergebnis))
pruefe('Staffeln gemeldet, Band als „2, Vol. 1"', JSON.stringify(serie?.staffeln) === JSON.stringify({ 1: '✓', '2, Vol. 1': '✓' }), serie?.staffeln)
pruefe('Folgen: höchste gemeldete Nummer je Staffel', JSON.stringify(serie?.folgen) === JSON.stringify({ 1: 12 }), serie?.folgen)
pruefe('gesamt = Zahl der gemeldeten Staffeln', serie?.gesamt === 2, serie?.gesamt)
pruefe('Film ohne Staffel: „ohne Nummer"', ergebnis.B0FILM00001?.staffeln?.['ohne Nummer'] === '✓', ergebnis.B0FILM00001)
pruefe('Disney+, Netflix und leere Adressen fallen heraus', Object.keys(ergebnis).length === 2, Object.keys(ergebnis))
pruefe('Ohne Meldungen leer', JSON.stringify(stand(undefined)) === '{}', stand(undefined))
const bisher = { staffeln: { 1: '✓' }, folgen: { 1: 3 } }
sandkasten.akPrimeMeldungEintragen(bisher, 2, '🇩🇪', 12)
const erwartet = { staffeln: { 1: '✓', 2: '🇩🇪' }, folgen: { 1: 3, 2: 12 } }
pruefe('Eigene Meldung: Befund und Folgenzahl lokal, Vorhandenes bleibt', JSON.stringify(bisher) === JSON.stringify(erwartet), bisher)

const amazon = readFileSync(__dirname + '/amazon.js', 'utf8')
const disney = readFileSync(__dirname + '/disney.js', 'utf8')
pruefe('amazon.js ruft dieselbe Cache-Adresse wie disney.js', amazon.includes('${WORKER}?zaehlen=1&nummern=1`') && disney.includes('${WORKER}?zaehlen=1&nummern=1`'))
/*
  Die Edge hält `?zaehlen=1…` 7200 s und löscht es beim Melden nicht: `no-store` holte nichts Frischeres,
  nur dieselben Megabytes erneut. Ohne Optionen greift der Browser-Cache nach dem max-age der Edge.
*/
const zaehlAbrufe = amazon.split('\n').filter((z) => z.includes('${WORKER}?zaehlen='))
const ohneOptionen = 'const antwort = await fetch(`${WORKER}?zaehlen=1&nummern=1`)'
pruefe('standVomWorker und briefkastenHolen: dieselbe Adresse, ohne no-store', zaehlAbrufe.length === 2 && zaehlAbrufe.every((z) => z.trim() === ohneOptionen), zaehlAbrufe)
pruefe('amazon.js rechnet die Meldungen über prime-stand.js um', amazon.includes('return globalThis.akPrimeStandAusBriefkasten(eintraege)'))
pruefe('amazon.js liest keine Token-Liste mehr', !/\?token=\$\{/.test(amazon))
const js = JSON.parse(readFileSync(__dirname + '/manifest.json', 'utf8')).content_scripts.find((g) => g.js.includes('amazon.js')).js
pruefe('Manifest: prime-stand.js lädt vor amazon.js', js.indexOf('prime-stand.js') >= 0 && js.indexOf('prime-stand.js') < js.indexOf('amazon.js'), js)

if (fehler.length) {
  console.log(`\n${fehler.length} Prüfung(en) rot.`)
  process.exit(1)
}
