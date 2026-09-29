/**
 * **Ein Film fällt nicht durch den Durchgang** (29.09.2026).
 *
 * Daniel ließ Netflix „▶ alle durchgehen" laufen und lud den Bericht
 * (`anime-kalender-netflix-2026-09-29T20-25-55-692Z.json`): Chihiros Reise ins Zauberland stand mit
 * „gesammelt staffeln: []" und „Titel fertig, gemeldet: 0" in der Spur — der Durchgang tat auf der
 * Filmseite **gar nichts** und hakte den Titel trotzdem ab. Der Knopf daneben („▶ 1 Folge prüfen")
 * konnte ihn die ganze Zeit; er liest `DURCHLAUF.folgen`, nicht `alleFolgen`.
 *
 * Ursache: Der Durchgang gruppiert über `DURCHLAUF.alleFolgen` — die vom Leser gesammelten
 * **Serienfolgen**. Ein Film hat keine Staffelliste, der Leser legt ihn nur in `DURCHLAUF.folgen`.
 * Deshalb greift der Durchgang jetzt auf `DURCHLAUF.folgen` zurück, wenn `alleFolgen` leer ist und
 * dort genau ein Film steht.
 *
 * Geprüft wird der Wortlaut (die Zuordnung entsteht mitten in `selbstStartenSchritt`, einem sehr
 * großen Sandkasten-Objekt), dazu die reine Gruppierung `folgenJeStaffel` selbst.
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

console.log('Netflix: ein Film geht durch den Durchgang')

pruefe(
  'der Durchgang fällt auf einen einzelnen Film in `DURCHLAUF.folgen` zurück',
  quelle.includes('DURCHLAUF.alleFolgen?.length ? DURCHLAUF.alleFolgen : DURCHLAUF.folgen.length === 1 && DURCHLAUF.folgen[0]?.film'),
)
pruefe('und erkennt einen Film an `film`', quelle.includes('DURCHLAUF.folgen[0]?.film'))
pruefe(
  'und der Knopf bietet ihn als „1 Folge prüfen" an (Einzahl-Fall)',
  /offen === 1 \? 'Folge' : 'Folgen'/.test(quelle),
)

/* Die reine Gruppierung — sie macht aus Folgen Staffeln; ein Film ist eine Gruppe. */
const code = /function folgenJeStaffel\([\s\S]*?\n\}/.exec(quelle)?.[0]
if (!code) {
  console.error('folgenJeStaffel() nicht gefunden')
  process.exit(1)
}
const folgenJeStaffel = new Function(`${code}; return folgenJeStaffel`)()
const film = { videoId: 60023642, nummer: 1, film: true, seasonId: null }
pruefe(
  'eine Filmfolge ergibt genau eine Gruppe',
  folgenJeStaffel([film]).size === 1 && [...folgenJeStaffel([film]).values()][0].length === 1,
)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Film-Durchgang halten.')
