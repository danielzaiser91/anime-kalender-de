/**
 * **Der Serientitel einer Meldung darf nicht aus einer früheren Seite stammen** (29.09.2026).
 *
 * Gefunden beim Nachsehen der Dangers-Meldungen: Die 25 Netflix-Meldungen auf
 * `netflix.com/title/81788312` (**The Dangers in My Heart**) trugen alle den Serientitel
 * „Shangri-La Frontier" — den der zuletzt **gespielten** Seite derselben Sitzung.
 *
 * Der Weg dahin: Auf einer Titelseite entscheidet die Adresse, welche Reihe gemeint ist
 * (`gemeinteReihe()`), aber der Leser schickt dort weiter die Spuren der zuletzt gespielten Seite.
 * Der Stand (`stand.serientitel`, `stand.staffeln`) gehörte also zu einer anderen Reihe, und nur
 * die Zuordnung lief über die Adresse — falsch war der gespeicherte Titel.
 *
 * Geprüft wird der Riegel `standGehoert()` selbst, dazu die beiden Meldestellen, die ihn benutzen.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Netflix: der Titel gehört zur gemeinten Reihe')

const code = /function standGehoert\([\s\S]*?\n\}/.exec(quelle)?.[0]
if (!code) {
  console.error('standGehoert() nicht gefunden — ohne die Funktion prüft der Rest nichts.')
  process.exit(1)
}
const bauen = (standReihe) => new Function('stand', `${code}\nreturn standGehoert`)({ reihe: standReihe })

pruefe('derselbe Leserstand gehört zur Reihe', bauen('81278456')('81278456') === true)
pruefe(
  'eine andere Reihe gehört nicht dazu (Shangri-La auf der Dangers-Seite)',
  bauen('81186100')('81788312') === false,
)
pruefe('ohne Reihenkennung im Leserstand gilt er nicht', bauen(null)('81788312') === false)
pruefe('ohne gemeinte Reihe gilt er nicht', bauen('81788312')(null) === false)
pruefe('Zahl und Zeichenkette sind dieselbe Reihe', bauen(81278456)('81278456') === true)

pruefe(
  'der Durchgang meldet den Titel nur aus dem eigenen Stand',
  quelle.includes('titel: (standPasst ? stand.serientitel : null) ?? folge.titel ?? null'),
)
pruefe(
  'und die Staffelstruktur ebenso',
  quelle.includes('staffeln: standPasst ? ohneKennungen(stand.staffeln) : null'),
)
pruefe(
  'die Randprobe prüft denselben Riegel',
  quelle.includes('titel: standGehoert(reihe) ? (stand.serientitel ?? null) : null'),
)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Serientitel halten.')
