/**
 * Was außerhalb der Anbieterzählung steht, überlebt sie.
 *
 * Daniel am 10.09.2026 mit Bild aus der Netflix-Prüfliste: „Dorohedoro",
 * „Hi Score Girl", „Mushoku Tensei" und „Baki-Dou" zeigten ihre Nebenausgabe
 * als benannte Pille mit ✕ — „Haikyu!!" zeigte nur S1 bis S4, obwohl dort
 * **vier** Nebenausgaben offen sind.
 *
 * Der Unterschied lag nicht am Titel, sondern daran, ob Netflix seine eigene
 * Staffelzählung schon gemeldet hatte: `staffelnVon()` übernahm sie und
 * **ersetzte** damit unsere Liste. Genau die Einträge, die es beim Anbieter
 * nicht als Staffel gibt (`ausserhalb: true`), fielen dabei weg — und sie
 * stehen nur deshalb dort, weil seine Zählung sie nicht kennt.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen zu Nebenausgaben in der Anbieterzählung (Haikyu!!, 10.09.2026)\n')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')

const stueck = quelle.match(/function staffelnVon\(id, eintrag\) \{[\s\S]*?\n\}/)
pruefe('staffelnVon() ist im Quelltext auffindbar', Boolean(stueck))

if (stueck) {
  const bauen = (gemeldet, staffeln) => {
    const lauf = new Function(
      'gemeldet',
      'staffeln',
      `const anbieterStaffeln = { '80090673': gemeldet }
       ${stueck[0]}
       return staffelnVon('80090673', { staffeln })`,
    )
    return lauf(gemeldet, staffeln)
  }

  /* Haikyu!! wörtlich aus der Prüfliste: vier eigene Staffeln, vier Nebenausgaben. */
  const unsere = [
    { nr: 1, name: 'St. 1', folgen: 26, erste: 1, offen: false },
    { nr: 2, name: 'St. 2', folgen: 26, erste: 1, offen: false },
    { nr: 3, name: 'St. 3', folgen: 11, erste: 1, offen: false },
    { nr: 4, name: 'St. 4', folgen: 27, erste: 1, offen: false },
    { nr: 5, name: 'Haikyu!! Lev ist hier!', folgen: 1, erste: 1, id: 20884, offen: true, ausserhalb: true },
    { nr: 6, name: 'Haikyu!! Kampf gegen ungenügende Noten', folgen: 1, erste: 1, id: 21348, offen: true, ausserhalb: true },
    { nr: 7, name: 'Haikyu!! Sonderbeitrag', folgen: 1, erste: 1, id: 107351, offen: true, ausserhalb: true },
    { nr: 8, name: 'Haikyu!! An Land vs. In der Luft', folgen: 2, erste: 1, id: 111790, offen: true, ausserhalb: true },
  ]
  /* Was Netflix im Wähler zeigt — genau die vier, Folgenzahlen aus dem Bild. */
  const vonNetflix = [
    { seq: 1, name: 'Haikyu!!', folgen: 26, erste: 1 },
    { seq: 2, name: 'Haikyu!! II', folgen: 26, erste: 1 },
    { seq: 3, name: 'Haikyu!! Karasuno High School vs Shiratorizawa Academy', folgen: 11, erste: 1 },
    { seq: 4, name: 'Haikyu!! Staffel 4', folgen: 27, erste: 1 },
  ]

  const raus = bauen(vonNetflix, unsere)
  pruefe('Die Anbieterzählung plus die Nebenausgaben ergeben acht Pillen', raus.length === 8, raus.length)
  pruefe(
    'Netflix bestimmt weiterhin die Aufteilung seiner eigenen Staffeln',
    raus[3]?.name === 'Haikyu!! Staffel 4' && raus[3]?.folgen === 27,
    raus[3],
  )
  const nebenaus = raus.filter((st) => st.ausserhalb)
  pruefe('Alle vier Nebenausgaben sind noch da', nebenaus.length === 4, nebenaus.length)
  pruefe(
    'und sie tragen ihre Kennung weiter — ohne sie gäbe es kein ✕',
    nebenaus.every((st) => typeof st.id === 'number'),
    nebenaus.map((st) => st.id),
  )
  pruefe('Sie stehen hinter der Anbieterzählung', raus.slice(4).every((st) => st.ausserhalb))

  /* Ohne Meldung des Anbieters bleibt alles, wie es war — der Weg der vier anderen Titel. */
  const ohne = new Function(
    'staffeln',
    `const anbieterStaffeln = {}
     ${stueck[0]}
     return staffelnVon('80991903', { staffeln })`,
  )(unsere)
  pruefe('Ohne Anbietermeldung bleibt unsere Liste unverändert', ohne === unsere, ohne?.length)
}

/* Und der Tooltip nennt die Sache, nicht eine Nummer, die es beim Anbieter nicht gibt. */
pruefe(
  'Das ✕ an einer Nebenausgabe nennt ihren Namen',
  quelle.includes('st.ausserhalb && st.name') && quelle.includes('gibt es hier nicht — nur diese Ausgabe melden'),
)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zu den Nebenausgaben halten.')
