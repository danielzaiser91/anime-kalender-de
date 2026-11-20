/**
 * Jede Meldung an den Worker, die eine `seitenAdresse` trägt, trägt auch die Erweiterungsversion (20.11.2026).
 *
 * Anlass: `pruefung.ext_version` war bei allen 58 Prime-Zeilen seit 18.11. NULL, weil die beiden Prime-Rümpfe in `amazon.js` nur
 * `seitenAdresse` setzten. Geprüft wird der Quelltext aller Erweiterungsdateien: jedes Objektliteral mit `seitenAdresse` (oder `meldungKopf()`, das beides liefert) muss im
 * selben Literal `version` führen (`mitSeite` in `adn.js` setzt beides gemeinsam). Netflix (`melder.js`) setzt `version` über eine
 * Variable im Rumpf davor, dafür gilt `netflix-meldung-version.test.cjs`; hier zählt, dass die Stelle `version` im Literal oder
 * im Zeilenumfeld davor nennt.
 */
const { readFileSync, readdirSync } = require('node:fs')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}

/** Das umschließende `{ … }` um Position `pos`; bei `mitSeite`-Form (`({ ...meldung, … })`) ebenso. */
function literalUm(text, pos) {
  let tiefe = 0
  let von = pos
  for (; von > 0; von--) {
    if (text[von] === '}') tiefe++
    if (text[von] === '{') {
      if (tiefe === 0) break
      tiefe--
    }
  }
  tiefe = 0
  let bis = von
  for (; bis < text.length; bis++) {
    if (text[bis] === '{') tiefe++
    if (text[bis] === '}' && --tiefe === 0) break
  }
  return text.slice(von, bis + 1)
}

const dateien = readdirSync(__dirname).filter((n) => n.endsWith('.js') && !n.startsWith('offene-') && n !== 'kontext.js')
let stellen = 0
for (const datei of dateien) {
  const text = readFileSync(__dirname + '/' + datei, 'utf8')
  const muster = /seitenAdresse:|meldungKopf\(\)/g
  let t
  while ((t = muster.exec(text))) {
    stellen++
    const zeile = text.slice(0, t.index).split('\n').length
    const literal = literalUm(text, t.index)
    const umfeld = text.slice(Math.max(0, t.index - 400), t.index)
    pruefe(`${datei}:${zeile}: Meldung mit seitenAdresse trägt version`, /\bversion\b|meldungKopf\(\)/.test(literal) || /const version = globalThis\.akKontext\.version\(\)/.test(umfeld), literal.slice(0, 120))
  }
}
pruefe('Stellen gefunden (nicht leer)', stellen >= 6, stellen)
console.log(`meldung-version-alle.test.cjs — ${faelle.length} Zusicherungen`)
process.exit(faelle.some((ok) => !ok) ? 1 : 0)
