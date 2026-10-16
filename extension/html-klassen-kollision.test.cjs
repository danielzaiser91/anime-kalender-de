/**
 * Die Erweiterung darf die Fremdseite nicht umgestalten (Daniel, 16.10.2026, ADN): `box.js` setzte
 * `ak-zu` an `<html>`, und `melder.css` kannte `.ak-zu` als Stil des X-Knopfs (22px, line-height 1) —
 * die Regel traf das Wurzelelement, rem-Größen und Zeilenhöhen der ganzen Seite wechselten mit dem Icon.
 * Regel: Jede Klasse, die ein Skript an `<html>`/`<body>` hängt, darf in `melder.css` nie allein
 * (ohne Vorfahren-Selektor) als Ziel stehen.
 */
const { readFileSync, readdirSync } = require('node:fs')
const { resolve } = require('node:path')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Alle Klassen, die Erweiterungsskripte an html oder body setzen. */
function wurzelKlassen(quellen) {
  const treffer = /(?:documentElement|body|\bhtml)\.classList\.(?:add|toggle)\('([^']+)'/g
  const klassen = new Set()
  for (const text of quellen) for (const m of text.matchAll(treffer)) klassen.add(m[1])
  return klassen
}

/** Selektoren, die mit nur einem Teil (ohne Vorfahren) eine der Klassen als Ziel haben. */
function treffenWurzel(css, klassen) {
  const ohneKommentar = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const gefunden = []
  for (const m of ohneKommentar.matchAll(/([^{}]+)\{/g)) {
    if (m[1].trim().startsWith('@')) continue
    for (const sel of m[1].split(',').map((s) => s.trim())) {
      const teile = sel.split(/[\s>+~]+/).filter(Boolean)
      if (teile.length !== 1) continue
      for (const k of klassen) if (new RegExp(`\\.${k}(?![\\w-])`).test(teile[0])) gefunden.push(sel)
    }
  }
  return gefunden
}

const dir = __dirname
const quellen = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(resolve(dir, f), 'utf8'))
const css = readFileSync(resolve(dir, 'melder.css'), 'utf8')
const klassen = wurzelKlassen(quellen)

console.log('Zusicherungen: Wurzelklassen der Erweiterung kollidieren nicht mit Stilregeln (16.10.2026)\n')
pruefe('Wurzelklassen gefunden (Suche arbeitet)', klassen.has('ak-eingeklappt') && klassen.has('ak-durchgang'), [...klassen])
pruefe('keine Regel trifft html/body allein über eine Wurzelklasse', treffenWurzel(css, klassen).length === 0, treffenWurzel(css, klassen))
pruefe('das Einklappen blendet wirklich aus (Klasse aus box.js steht in melder.css)', css.includes('html.ak-icon-da.ak-eingeklappt .ak-box'))
pruefe('Gegenprobe: die alte Kollision (.ak-zu bei Klasse ak-zu) wird erkannt', treffenWurzel('.ak-zu { font-size: 22px }', new Set(['ak-zu'])).length === 1)
pruefe('Gegenprobe: Regel mit Vorfahr bleibt erlaubt', treffenWurzel('html.ak-eingeklappt .ak-box { opacity: 0 }', new Set(['ak-eingeklappt'])).length === 0)

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('\nalle Zusicherungen bestanden')
