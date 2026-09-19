/**
 * Wie viele Staffeln die Seite nennt — gelesen aus dem sichtbaren Text.
 *
 * Bei „Grisaia Phantom Trigger" (eine Staffel, 13 Folgen) verlangte die
 * Erweiterung „weiter mit Staffel 2" (Daniel, 19.09.2026). Der Diagnosebericht
 * zeigte `staffelZahl: 18`: Das Altersfeld „18" stand als Zeile vor der
 * Überschrift „Staffel 1", und `(\d+)\s*Staffeln?` lief über den Umbruch.
 *
 * Der Ausdruck wird aus dem Quelltext geschnitten und an echten Textformen
 * ausgeführt — eine Textprüfung auf seine Schreibweise würde nichts beweisen.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen zur Staffelzahl (Grisaia Phantom Trigger)\n')

const quelle = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')
const treffer = /const STAFFEL_ANZAHL = (\/.+\/)\n/.exec(quelle)
pruefe('STAFFEL_ANZAHL steht im Quelltext', treffer)
if (treffer) {
  const R = eval(treffer[1])
  const faelle = [
    ['Altersfeld vor der Überschrift (Grisaia)', 'IMDb 5,6/10\n2025\n18\nStaffel 1\nFolgen', null],
    ['Anzahl im Kopf, Plural', 'IMDb 8\n2 Staffeln\nStaffel 1', '2'],
    ['Anzahl im Kopf, Singular', '2007\n1 Staffel\nFolgen', '1'],
    ['Anzahl mit geschütztem Leerzeichen', '5 Staffeln', '5'],
    ['nur eine Überschrift', 'Staffel 1\nFolge 3', null],
    ['Überschrift mit Zahl davor auf derselben Zeile', '18 Staffel 1', null],
  ]
  for (const [name, text, erwartet] of faelle) {
    const gelesen = R.exec(text)?.[1] ?? null
    pruefe(name, gelesen === erwartet, gelesen)
  }
}
pruefe(
  'seitenLage liest die Staffelzahl nur über STAFFEL_ANZAHL',
  (quelle.match(/STAFFEL_ANZAHL\.exec\(/g) ?? []).length === 2 && !/\(\\d\+\)\\s\*Staffeln\?/.test(quelle),
)

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
