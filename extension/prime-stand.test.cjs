/**
 * **Der Prime-Stand kommt aus dem Briefkasten, nicht aus der Token-Liste** (4.31.4, 15.10.2026).
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

/*
  Befund 2 des CI-Prüfers: Eigene Meldung „E1–12" lokal, fremde Teilmeldung mit höchster Folge 3 vom Worker.
  Die höhere Zahl gewinnt (E1–12 bleibt, mehr Wissen des Workers zählt), der Befund bleibt der lokale.
*/
const vereinige = sandkasten.akPrimeStandVereinigen
const lokal = { B0ABCDEFGH: { staffeln: { 1: '🇩🇪' }, folgen: { 1: 12 }, gesamt: 5, serie: 'Titel' } }
const fremdTeil = { B0ABCDEFGH: { staffeln: { 1: '✓' }, folgen: { 1: 3 }, gesamt: 1, serie: null } }
const nachTeil = vereinige(lokal, fremdTeil).B0ABCDEFGH
pruefe('vereinige: fremde Teilmeldung (E1–3) überschreibt die eigene (E1–12) nicht', nachTeil.folgen[1] === 12, nachTeil.folgen)
pruefe('vereinige: der lokale Befund bleibt', nachTeil.staffeln[1] === '🇩🇪', nachTeil.staffeln)
const fremdMehr = { B0ABCDEFGH: { staffeln: { 1: '✓' }, folgen: { 1: 24 }, gesamt: 1, serie: null } }
pruefe('vereinige: weiß der Worker mehr (E1–24), zählt das', vereinige(lokal, fremdMehr).B0ABCDEFGH.folgen[1] === 24)
const fremdAndere = { B0ABCDEFGH: { staffeln: { 2: '✓' }, folgen: { 2: 7 }, gesamt: 2, serie: null } }
const nachAndere = vereinige(lokal, fremdAndere).B0ABCDEFGH
pruefe('vereinige: Staffeln nur des Workers kommen dazu', nachAndere.folgen[2] === 7 && nachAndere.folgen[1] === 12 && nachAndere.staffeln[2] === '✓', nachAndere)
pruefe('vereinige: ohne lokale Folgenzahl gilt die des Workers', vereinige({}, fremdTeil).B0ABCDEFGH.folgen[1] === 3)
pruefe('vereinige: ohne Worker-Folgenzahl bleibt die lokale', vereinige(lokal, { B0ABCDEFGH: { staffeln: { 1: '✓' } } }).B0ABCDEFGH.folgen[1] === 12)
pruefe('vereinige: ohne Worker-Stand bleibt der lokale', vereinige(lokal, null) === lokal)

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

/* Tab-Eintrag gegen Speicher-Eintrag (akPrimeEintragVereinigen): Speicher größer, dann Tab größer, Streit um s1. */
const frischEintrag = { staffeln: { s1: '✓', s2: '🇩🇪' }, folgen: { s1: 20, s2: 9 }, gesamt: 5, serie: 'A' }
const tabEintrag = { staffeln: { s1: '🇩🇪' }, folgen: { s1: 7 }, gesamt: 2, serie: 'B' }
const v1 = sandkasten.akPrimeEintragVereinigen(frischEintrag, tabEintrag)
pruefe('Eintrag: Tab gesamt 2, Speicher 5 → 5', v1.gesamt === 5, v1.gesamt)
pruefe('Eintrag: Tab gesamt 8, Speicher 5 → 8', sandkasten.akPrimeEintragVereinigen(frischEintrag, { ...tabEintrag, gesamt: 8 }).gesamt === 8)
pruefe('Eintrag: fremde Staffel-Folgenzahl bleibt', v1.folgen.s2 === 9, v1.folgen)
pruefe('Eintrag: Streit um dieselbe Staffel gewinnt der Tab (Folgen und Befund)', v1.folgen.s1 === 7 && v1.staffeln.s1 === '🇩🇪', v1)
pruefe('Eintrag: ohne Speicher-Eintrag gilt der Tab', sandkasten.akPrimeEintragVereinigen(undefined, tabEintrag).folgen.s1 === 7 && sandkasten.akPrimeEintragVereinigen(undefined, tabEintrag).gesamt === 2)

if (fehler.length) {
  console.log(`\n${fehler.length} Prüfung(en) rot.`)
  process.exit(1)
}
