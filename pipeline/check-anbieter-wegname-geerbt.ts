/**
 * Beweistest: `plattformVonWegName()` (web/src/lib/anbieter-wegname.ts) trifft nur eigene Einträge der Alias-Liste, keine geerbten
 * Schlüssel des Objekts („constructor“ lieferte eine Funktion, „__proto__“ ein Objekt). Läuft in `check:logic`.
 */
import { plattformVonWegName } from '../web/src/lib/anbieter-wegname.ts'

let fehler = 0
for (const name of ['constructor', 'Constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
  const ist = plattformVonWegName(name)
  if (ist !== undefined) {
    fehler++
    console.error(`FEHLER ${JSON.stringify(name)}: ${typeof ist} statt undefined`)
  }
}
if (plattformVonWegName('Disney Plus') !== 'disneyplus') {
  fehler++
  console.error('FEHLER „Disney Plus“ trifft nicht mehr')
}

if (fehler) {
  console.error(`check-anbieter-wegname-geerbt: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-anbieter-wegname-geerbt: ok')
