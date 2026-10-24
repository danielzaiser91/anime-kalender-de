/**
 * `akNetflixRohStaffel` (extension/netflix-staffel.js): Staffelnummer und Menütext einer Rohfolge, 16.10.2026.
 * Jede Auswahlstelle mit dem Treffer vorn, in der Mitte und hinten; die Nummer stammt nie aus unserer Zählung,
 * wenn der Text aus Netflix' Menü kommt (Prüfer Runde 2, PR 1390).
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const kontext = vm.createContext({ globalThis: null })
kontext.globalThis = kontext
vm.runInContext(readFileSync(__dirname + '/netflix-staffel.js', 'utf8'), kontext, { filename: 'netflix-staffel.js' })

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}
const eintrag = (text, nr, folgen) => ({ text, nr, folgen })
const roh = (ziel, menue, label, seasonId) => JSON.parse(JSON.stringify(kontext.akNetflixRohStaffel(ziel, menue, label, seasonId)))

console.log('Netflix: Staffelnummer und Menütext der Rohfolge\n')

// Drei Staffeln gleicher Länge: nur die Anzeige im Feld unterscheidet sie.
const drei = [eintrag('Staffel 1 (24 Folgen)', 1, 24), eintrag('Staffel 2 (24 Folgen)', 2, 24), eintrag('Staffel 3 (24 Folgen)', 3, 24)]
for (const nr of [1, 2, 3]) {
  const r = roh({ folgen: 24, staffel: 9, ausKennung: false }, drei, `Staffel ${nr}`)
  pruefe(`gleich lange Staffeln, Anzeige „Staffel ${nr}“: Nummer ${nr}, Text derselben Staffel`, r.staffelNr === nr && r.staffelText === `Staffel ${nr} (24 Folgen) · von 3`, r)
}
const ohneAnzeige = roh({ folgen: 24, staffel: 2, ausKennung: false }, drei, null)
pruefe('gleich lange Staffeln ohne Anzeige: nichts geraten, Text ohne Folgenzahl', ohneAnzeige.staffelText === null && ohneAnzeige.staffelNr === 2, ohneAnzeige)

// Sichere Nummer aus den Kennungen: der Eintrag mit dieser Nummer, vorn, Mitte, hinten.
for (const nr of [1, 2, 3]) {
  const r = roh({ folgen: 24, staffel: nr, ausKennung: true }, drei, null)
  pruefe(`Kennungen nennen Staffel ${nr}: Text derselben Staffel`, r.staffelNr === nr && r.staffelText === `Staffel ${nr} (24 Folgen) · von 3`, r)
}

// Benannte Staffeln haben keine Nummer: unsere Zählung (`ziel.staffel`) darf nicht neben Netflix' Text stehen.
const benannt = [eintrag('Golden Wind (39 Folgen)', null, 39), eintrag('Stone Ocean (38 Folgen)', null, 38), eintrag('Steel Ball Run (24 Folgen)', null, 24)]
const eindeutig = roh({ folgen: 38, staffel: 3, ausKennung: false }, benannt, null)
pruefe('benannter Eintrag über die Folgenzahl: Netflix-Text, keine Nummer', eindeutig.staffelNr === null && eindeutig.staffelText === 'Stone Ocean (38 Folgen) · von 3', eindeutig)

// Zwei benannte Einträge gleicher Länge und eine Anzeige ohne Zahl: kein Treffer über „nr == null“.
const zweiGleich = [eintrag('Golden Wind (39 Folgen)', null, 39), eintrag('Stone Ocean (39 Folgen)', null, 39), eintrag('Steel Ball Run (24 Folgen)', null, 24)]
const keiner = roh({ folgen: 39, staffel: 3, ausKennung: false }, zweiGleich, 'Golden Wind')
pruefe('zwei benannte gleicher Länge, Anzeige ohne Zahl: kein Eintrag gewählt', keiner.staffelText === 'Golden Wind', keiner)

// Die Anzeige nennt Staffel 2, deren Folgenzahl (12) ist aber nicht die der geladenen Gruppe (30): kein Eintrag.
const andereLaenge = roh({ folgen: 30, staffel: 2, ausKennung: false }, [eintrag('Staffel 1 (24 Folgen)', 1, 24), eintrag('Staffel 2 (12 Folgen)', 2, 12)], 'Staffel 2')
pruefe('Anzeige passt, Folgenzahl nicht: kein Menütext', andereLaenge.staffelText === 'Staffel 2' && !/Folgen/.test(andereLaenge.staffelText), andereLaenge)

// Kein Menü gelesen: Text ist die Anzeige oder die Kennung der Staffel, die Nummer unsere.
const keinMenue = roh({ folgen: 12, staffel: 4, ausKennung: false }, null, null, 81)
pruefe('ohne Menü: Kennung als Text, unsere Nummer', keinMenue.staffelNr === 4 && keinMenue.staffelText === '81', keinMenue)
const ohneAlles = roh({ folgen: 12, staffel: null, ausKennung: false }, [], null, undefined)
pruefe('ohne Menü, Nummer und Kennung: beides leer', ohneAlles.staffelNr === null && ohneAlles.staffelText === null, ohneAlles)

console.log('')
if (faelle.includes(false)) {
  console.error('Zusicherungen gerissen.')
  process.exit(1)
}
console.log('Alle Zusicherungen zur Rohfolgen-Staffel halten.')
