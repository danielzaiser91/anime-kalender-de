/**
 * **Der Serientitel einer Meldung darf nicht aus einer früheren Seite stammen** (29.09.2026).
 *
 * Gefunden beim Nachsehen der Dangers-Meldungen: Die 25 Meldungen auf
 * `netflix.com/title/81788312` (**The Dangers in My Heart**) trugen alle den Serientitel
 * „Shangri-La Frontier" — den der zuletzt **gespielten** Seite derselben Sitzung. Sie kamen aus der
 * **Randprobe** (`notiz: „ANGENOMMEN aus Randprobe"`), und `stand.serientitel` gehörte noch zur
 * vorigen Reihe. Auf einer Titelseite entscheidet die Adresse, welche Reihe gemeint ist
 * (`gemeinteReihe()`); der Leser schickt dort aber weiter die Spuren der zuletzt gespielten Seite.
 *
 * Der Riegel steht **inline** in beiden Meldestellen — kein eigener Helfer, sonst wächst `melder.js`
 * über die Codegestalt-Grenze. Geprüft wird sein Wortlaut, weil die Zuordnung in einer Meldung
 * entsteht; die Begründung steht in `docs/wissen/erweiterung.md`.
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

/* Die Randprobe: ein fremder Leserstand liefert weder Titel noch Staffelstruktur. */
pruefe(
  'die Randprobe hält einen fremden Stand beim Titel zurück',
  quelle.includes('titel: stand.reihe && String(stand.reihe) === String(reihe) ? (stand.serientitel ?? null) : null'),
)
pruefe(
  'und bei der Staffelstruktur ebenso',
  quelle.includes('staffeln: stand.reihe && String(stand.reihe) === String(reihe) ? ohneKennungen(stand.staffeln) : null'),
)

/* Der Durchgang: dieselbe Frage gegen die gemeinte Reihe, die aus der Adresse kommt. */
pruefe(
  'der Durchgang vergleicht mit `gemeinteReihe()`',
  quelle.includes('staffeln: stand.reihe && String(stand.reihe) === String(gemeinteReihe()) ? ohneKennungen(stand.staffeln) : null'),
)
pruefe(
  'und meldet den Titel nur aus dem eigenen Stand',
  quelle.includes('titel: (stand.reihe && String(stand.reihe) === String(gemeinteReihe()) ? stand.serientitel : null) ?? folge.titel ?? null'),
)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Serientitel halten.')
