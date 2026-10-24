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
pruefe('5 lesbar, 0 gesperrt, Seitentext Region → nicht regionWeg', staffelRegionWeg(0, 5, true) === false)
pruefe('0 gesperrt, 5 lesbar, Seitentext ohne Region → nicht regionWeg', staffelRegionWeg(0, 5, false) === false)
pruefe('ohne Folgenzahl, nichts gelesen → vollständig (kein Sperrfall)', meldungVollstaendig(0, 0, 0) === true && meldungVollstaendig(0, 5, 0) === true)
pruefe('Folgenzahl 51, nichts gelesen, nichts gesperrt → offen', meldungVollstaendig(51, 0, 0) === false)
pruefe('1 lesbar, 0 gesperrt, Seitentext Region → nicht regionWeg', staffelRegionWeg(0, 1, true) === false)
pruefe('nichts bekannt: Seitentext entscheidet (true)', staffelRegionWeg(0, 0, true) === true)
pruefe('nichts bekannt: Seitentext entscheidet (false)', staffelRegionWeg(0, 0, false) === false)

/* Verdrahtung: Knopf und Klick benutzen die Helfer und der Regionsknopf braucht keine Unvollständigkeit */
pruefe('Klick: vollständig über meldungVollstaendig mit Sperrenzahl',
  /const vollstaendig = globalThis.akPrimeMeldungVollstaendig\(sollFolgen, geladen, gesperrtN\)/.test(quelle) &&
  /akPrimeMeldungErlaubt\(\{ nichtAbrufbar, deutsch, \.\.\.keinDeutschDaten \}\)/.test(quelle))
pruefe('Knopf: Region-Zweig bleibt an die Liste gebunden',
  /if \(regionWeg && !deutsch && \(!vollstaendig \|\| gesperrteFolgen > 0\)\) \{/.test(quelle))
pruefe('Knopf: wegInRegion zählt JSON-Sperren', /wegInRegion = globalThis.akPrimeGesperrteZahl\(gesehen\.gesperrt,/.test(quelle))
pruefe('Knopf: regionWeg über staffelRegionWeg',
  /const regionWeg = globalThis.akPrimeStaffelRegionWeg\(gesperrteFolgen, offeneFolgen, lage\.regionWeg\)/.test(quelle))

/* --- Aufrufseiten, wirklich ausgeführt: der Quelltext der Stellen wird geschnitten und mit Attrappen gespielt --- */
function stueck(von, bis) {
  const a = quelle.indexOf(von)
  const b = quelle.indexOf(bis, a)
  if (a < 0 || b < 0) throw new Error(`Marke fehlt: ${von} / ${bis}`)
  return quelle.slice(a, b)
}

/** Klick-Handler: ab `nichtAbrufbar` bis vor den „Jeder Schritt"-Block. Ergebnis 'weiter' = es wird gesendet. */
const klickCode = stueck("const nichtAbrufbar = knopf.dataset.tot === 'true'", '    /**\n     * Jeder Schritt sagt')
function klick({ tot = 'false', geladen, gesperrt, soll, deutsch = false, regionDom = [] }) {
  const knopf = { dataset: { tot }, textContent: '', title: '' }
  const f = new Function(
    'knopf', 'sprachenAusFolgen', 'geladeneFolgen', 'deutschInFolgen', 'gesehen', 'seitenLage', 'ueberKanal', 'setTimeout', 'zeichnen', 'abweisen', 'globalThis',
    `let letzterStand = ''\n${klickCode}\nreturn 'weiter'`,
  )
  const ergebnis = f(
    knopf, () => [], () => geladen, () => deutsch,
    { gesamt: soll, gesperrt: gesperrt ? karte(gesperrt) : undefined },
    () => ({ folgenLautSeite: 0, regionFolgen: regionDom }), () => false, () => 0, () => {}, () => {}, kasten,
  )
  return { ergebnis, text: knopf.textContent }
}
{
  const a = klick({ geladen: 27, gesperrt: 24, soll: 51 })
  pruefe('Klick A: 27 lesbar + 24 gesperrt von 51, kein Deutsch → es wird gesendet', a.ergebnis === 'weiter', a)
  const a2 = klick({ geladen: 27, gesperrt: 10, soll: 51 })
  pruefe('Klick Gegenfall: 27 lesbar + 10 gesperrt von 51 → gesperrt mit „fehlen 14"', a2.ergebnis === undefined && /fehlen 14/.test(a2.text), a2)
  const a3 = klick({ geladen: 27, soll: 51 })
  pruefe('Klick Gegenfall: nichts gesperrt → „fehlen 24"', a3.ergebnis === undefined && /fehlen 24/.test(a3.text), a3)
  const a4 = klick({ geladen: 27, gesperrt: 10, soll: 51, regionDom: new Array(24) })
  pruefe('Klick: Sperren aus dem DOM zählen ebenfalls', a4.ergebnis === 'weiter', a4)
  const b = klick({ tot: 'true', geladen: 0, gesperrt: 24, soll: 24 })
  pruefe('Klick B: Knopf stand auf „nicht mehr verfügbar" (tot) → es wird gesendet', b.ergebnis === 'weiter', b)
  const b2 = klick({ tot: 'false', geladen: 0, gesperrt: 24, soll: 24 })
  pruefe('Klick: ohne lesbare Folge und ohne tot-Marke bleibt es still (Knopf muss tot setzen)', b2.ergebnis === undefined && b2.text === '', b2)
}

/** Knopf: regionWeg aus Zählwerk, dann der Regionszweig. */
const regionCode = stueck('const gesperrteFolgen = gesehen.gesperrt?.size ?? 0', '\n\n') + '\n'
const zweigCode = stueck('if (regionWeg && !deutsch && (!vollstaendig || gesperrteFolgen > 0)) {', '    /**\n     * Fehlende Folgen auf einer Seite')
function knopfLage({ gesperrt, offen, deutsch, textRegionWeg = false, vollstaendig = true }) {
  const knopf = { dataset: {}, textContent: '', disabled: true }
  const f = new Function(
    'knopf', 'gesehen', 'lage', 'deutsch', 'vollstaendig', 'globalThis',
    `${regionCode}\n${zweigCode}\nreturn 'weiter'`,
  )
  const ergebnis = f(
    knopf,
    { gesperrt: gesperrt ? karte(gesperrt) : undefined, nummern: karte(offen) },
    { regionWeg: textRegionWeg }, deutsch, vollstaendig, kasten,
  )
  return { ergebnis, tot: knopf.dataset.tot, text: knopf.textContent }
}
{
  const b = knopfLage({ gesperrt: 24, offen: 0, deutsch: false })
  pruefe('Knopf B: 24 von 24 gesperrt, kein Deutsch → „nicht mehr verfügbar", tot', b.ergebnis === undefined && b.tot === 'true' && /nicht mehr verfügbar/.test(b.text), b)
  const a = knopfLage({ gesperrt: 24, offen: 27, deutsch: false })
  pruefe('Knopf A: 24 gesperrt + 27 lesbar → Regionszweig greift nicht', a.ergebnis === 'weiter', a)
  const c = knopfLage({ gesperrt: 24, offen: 0, deutsch: true })
  pruefe('Knopf: alles gesperrt, aber Deutsch belegt → Regionszweig greift nicht', c.ergebnis === 'weiter', c)
  /* Mahouka nur über den Kachelhinweis im Text (Zählwerk leer), Liste gilt als vollständig: kein Totmelden. */
  const k = knopfLage({ gesperrt: 0, offen: 0, deutsch: false, textRegionWeg: true, vollstaendig: true })
  pruefe('Knopf Mahouka-Kachelhinweis: nichts im Zählwerk, Text meldet Region, Liste vollständig → weiter', k.ergebnis === 'weiter' && k.tot === undefined, k)
  /* Chaika S1: Seitentext meldet Region, Liste unvollständig → tot. */
  const ch = knopfLage({ gesperrt: 0, offen: 0, deutsch: false, textRegionWeg: true, vollstaendig: false })
  pruefe('Knopf Chaika: nichts im Zählwerk, Text meldet Region, Liste unvollständig → tot', ch.tot === 'true' && ch.ergebnis === undefined, ch)
  const w = knopfLage({ gesperrt: 0, offen: 5, deutsch: false, textRegionWeg: true, vollstaendig: false })
  pruefe('Knopf: 5 lesbar, Seitentext meldet Region, Liste unvollständig → weiter', w.ergebnis === 'weiter', w)
  const m = knopfLage({ gesperrt: 3, offen: 10, deutsch: false, textRegionWeg: true })
  pruefe('Knopf Mahouka: 3 gesperrt, 10 lesbar, Seitentext meldet Region → Regionszweig greift nicht', m.ergebnis === 'weiter', m)
}

{
  const t = klick({ tot: 'true', geladen: 3, soll: 24 })
  pruefe('Klick: tot-Marke + unvollständige Liste → es wird gesendet (nicht abrufbar braucht keine Folgen)', t.ergebnis === 'weiter', t)
}

/** Knopf, „fehlen noch"-Zeile: gesperrte Folgen fehlen nicht. */
const fehlenCode = stueck('if (!nichtAbrufbar && !istFilm && !vollstaendig && gesehen.gesamt) {', '      knopf.title =')
function fehlenText({ geladen, wegInRegion, gesamt, deutsch = false }) {
  const knopf = { dataset: {}, textContent: '', disabled: false }
  const f = new Function('knopf', 'gesehen', 'geladen', 'wegInRegion', 'deutsch', `const nichtAbrufbar = false, istFilm = false, vollstaendig = false\n${fehlenCode}\n      return }\nreturn 'weiter'`)
  f(knopf, { gesamt }, geladen, wegInRegion, deutsch)
  return knopf.textContent
}
pruefe('Knopf: 27 gelesen + 24 gesperrt von 52 → „1 fehlen noch"',
  /— 1 fehlen noch$/.test(fehlenText({ geladen: 27, wegInRegion: 24, gesamt: 52, deutsch: true })), fehlenText({ geladen: 27, wegInRegion: 24, gesamt: 52, deutsch: true }))
pruefe('Knopf: nichts gesperrt → „25 fehlen noch"',
  /— 25 fehlen noch$/.test(fehlenText({ geladen: 27, wegInRegion: 0, gesamt: 52, deutsch: true })))

/** Notiz der Meldung: der Ausdruck aus `amazon.js` wird ausgewertet, nicht per Regex gesucht. */
const notizAusdruck = stueck('(vollstaendig\n              ? geladen === 1 && !gesehen.gesamt', 'Rest ungeprüft`)') + 'Rest ungeprüft`)'
function notiz({ vollstaendig, geladen, gesperrtN, gesamt }) {
  const f = new Function('vollstaendig', 'geladen', 'gesperrtN', 'gesehen', `return ${notizAusdruck}`)
  return f(vollstaendig, geladen, gesperrtN, { gesamt })
}
pruefe('Notiz: 27 gelesen, 24 gesperrt → nennt „24 in der Region gesperrt"', notiz({ vollstaendig: true, geladen: 27, gesperrtN: 24, gesamt: 51 }) === 'alle 27 Folgen geprüft, 24 in der Region gesperrt')
pruefe('Notiz: genau 1 gesperrt → nennt „1 in der Region gesperrt"', notiz({ vollstaendig: true, geladen: 12, gesperrtN: 1, gesamt: 13 }) === 'alle 12 Folgen geprüft, 1 in der Region gesperrt')
pruefe('Notiz: nichts gesperrt → kein Zusatz', notiz({ vollstaendig: true, geladen: 12, gesperrtN: 0, gesamt: 12 }) === 'alle 12 Folgen geprüft')
pruefe('Notiz: unvollständig → „nur … geladen"', notiz({ vollstaendig: false, geladen: 5, gesperrtN: 2, gesamt: 12 }) === 'nur 5 von 12 Folgen geladen — Rest ungeprüft')

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
