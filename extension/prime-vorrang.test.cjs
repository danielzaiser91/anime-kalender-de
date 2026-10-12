/**
 * Reihenfolge des Prime-Durchgangs (12.10.2026): Einträge mit `vorrang` kommen vor allen anderen,
 * gleicher Rang nach Titel. Ohne Feld bleibt es bei der alphabetischen Folge.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const sandkasten = { globalThis: null }
sandkasten.globalThis = sandkasten
vm.runInNewContext(readFileSync(__dirname + '/prime-titelseite.js', 'utf8'), sandkasten)

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const liste = {
  a1: { titel: 'Akame ga Kill' },
  b1: { titel: 'Bleach', vorrang: 2 },
  c1: { titel: 'Clannad', vorrang: 1 },
  d1: { titel: 'Dr. Stone', vorrang: 1 },
  e1: { titel: 'Eden', vorrang: 2 },
}
const folge = Object.keys(liste).sort(sandkasten.akPrimeVergleich(liste))

pruefe('Rang 1 zuerst, nach Titel', folge[0] === 'c1' && folge[1] === 'd1', folge)
pruefe('Rang 2 danach, nach Titel', folge[2] === 'b1' && folge[3] === 'e1', folge)
pruefe('ohne Vorrang zuletzt', folge[4] === 'a1', folge)

const ohne = { x: { titel: 'Zebra' }, y: { titel: 'Anker' } }
pruefe('ohne jeden Vorrang alphabetisch wie bisher', Object.keys(ohne).sort(sandkasten.akPrimeVergleich(ohne)).join() === 'y,x')

if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Die Reihenfolge des Durchgangs hält.')
