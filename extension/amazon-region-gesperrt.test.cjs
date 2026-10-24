/**
 * Regionsgesperrte Folgen sind gelesen, nicht offen (Beyblade Burst S1, Daniel 21.10. und 24.10.2026).
 *
 * Fall A: 27 lesbare + 24 gesperrte von 51 — der Klick verlangte 51 lesbare ("für „kein Deutsch" fehlen 24").
 * Fall B: 24 von 24 gesperrt — der Knopf stand auf "kein Deutsch · 24 gesperrt · melden", der Klick kehrte still zurück.
 * Gegenfall: offene, nicht gesperrte Folgen sperren weiter.
 * Die Entscheidungsfunktionen werden aus `amazon.js` geschnitten, nicht nachgebaut.
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

const quelle = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')
const kasten = {}
kasten.globalThis = kasten
vm.runInNewContext(readFileSync(resolve(__dirname, 'prime-region.js'), 'utf8'), kasten)
const gesperrteZahl = kasten.akPrimeGesperrteZahl
const meldungVollstaendig = kasten.akPrimeMeldungVollstaendig
const staffelRegionWeg = kasten.akPrimeStaffelRegionWeg
const karte = (n) => new Map(Array.from({ length: n }, (_, i) => [i + 1, {}]))

console.log('Regionsgesperrte Folgen zählen nicht als offen\n')

/* Zählung: größeres von JSON und DOM, nie die Summe */
pruefe('24 im JSON, 0 im DOM → 24', gesperrteZahl(karte(24), []) === 24)
pruefe('0 im JSON, 5 im DOM → 5', gesperrteZahl(undefined, [1, 2, 3, 4, 5]) === 5)
pruefe('24 im JSON, 7 im DOM → 24 (keine Summe)', gesperrteZahl(karte(24), [1, 2, 3, 4, 5, 6, 7]) === 24)
pruefe('nichts bekannt → 0', gesperrteZahl(undefined, undefined) === 0)

/* Fall A */
pruefe('A: 27 lesbar + 24 gesperrt von 51 → vollständig', meldungVollstaendig(51, 27, 24) === true)
/* Gegenfall: nicht gesperrt, offen */
pruefe('Gegenfall: 27 lesbar + 10 gesperrt von 51 → offen', meldungVollstaendig(51, 27, 10) === false)
pruefe('Gegenfall: 27 lesbar, 0 gesperrt von 51 → offen', meldungVollstaendig(51, 27, 0) === false)
pruefe('genau 1 fehlt → offen', meldungVollstaendig(51, 27, 23) === false)
pruefe('ohne Folgenzahl → vollständig', meldungVollstaendig(0, 0, 0) === true)

/* Fall B und Mahouka */
pruefe('B: 24 gesperrt, 0 lesbar → regionWeg', staffelRegionWeg(24, 0, false) === true)
pruefe('A: 24 gesperrt, 27 lesbar → nicht regionWeg', staffelRegionWeg(24, 27, true) === false)
pruefe('Mahouka: 3 gesperrt, 10 lesbar → nicht regionWeg', staffelRegionWeg(3, 10, true) === false)
pruefe('genau 1 gesperrt, 0 lesbar, Seitentext ohne Region → regionWeg', staffelRegionWeg(1, 0, false) === true)
pruefe('1 lesbar, 0 gesperrt, Seitentext Region → nicht regionWeg', staffelRegionWeg(0, 1, true) === false)
pruefe('nichts bekannt: Seitentext entscheidet (true)', staffelRegionWeg(0, 0, true) === true)
pruefe('nichts bekannt: Seitentext entscheidet (false)', staffelRegionWeg(0, 0, false) === false)

/* Verdrahtung: Knopf und Klick benutzen die Helfer und der Regionsknopf braucht keine Unvollständigkeit */
pruefe('Klick: vollständig über meldungVollstaendig mit Sperrenzahl',
  /const vollstaendig = globalThis.akPrimeMeldungVollstaendig\(sollFolgen, geladen, gesperrtN\)/.test(quelle))
pruefe('Knopf: Region-Zweig ohne !vollstaendig', /if \(regionWeg && !deutsch\) \{/.test(quelle))
pruefe('Knopf: wegInRegion zählt JSON-Sperren', /wegInRegion = globalThis.akPrimeGesperrteZahl\(gesehen\.gesperrt,/.test(quelle))
pruefe('Knopf: regionWeg über staffelRegionWeg',
  /const regionWeg = globalThis.akPrimeStaffelRegionWeg\(gesperrteFolgen, offeneFolgen, lage\.regionWeg\)/.test(quelle))
pruefe('Notiz nennt die gesperrten Folgen', /\$\{gesperrtN\} in der Region gesperrt/.test(quelle))

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
