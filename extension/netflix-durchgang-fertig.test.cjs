/**
 * **Der Durchgang hakt einen Titel erst ab, wenn die Prüfliste ihn nicht mehr führt** (29.09.2026).
 *
 * Daniels zweiter Bericht (`anime-kalender-netflix-2026-09-29T20-44-36-051Z.json`): Der Durchgang
 * lief über Chihiro, My Hero Academia und The Dangers in My Heart, meldete MHA „25" und Dangers
 * „12" (nur den lokalen Abhakstand), hakte alle drei ab — und endete mit **zwei offenen Titeln** auf
 * der Prüfliste. Der Titel wurde „fertig", weil die Staffeln im lokalen Zustand als geprüft galten,
 * nicht weil `?stand` ihn nicht mehr führte.
 *
 * Zwei Riegel, beide im Quelltext geprüft (die Entscheidung entsteht mitten in
 * `selbstStartenSchritt`, einem sehr großen Sandkasten-Objekt):
 *
 * 1. **Eine Wiedervorlage wird abgearbeitet** — `gruppeOffen` ließ MHA/Dangers liegen.
 * 2. **Fertig nach der Prüfliste**, mit einem zweiten Anlauf und danach überspringen.
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

console.log('Netflix: fertig heißt „nicht mehr auf der Prüfliste"')

pruefe(
  'eine Wiedervorlage gilt als offen und läuft',
  quelle.includes("if (offene.some((st) => st.zustand === 'erneut')) return true"),
)
pruefe(
  'vor dem Abhaken wird der Stand der Prüfliste geholt',
  quelle.includes('await standHolen()') && quelle.includes('!fertig(reihe, offeneTitel[String(reihe)])'),
)
pruefe(
  'ein noch offener Titel bekommt einen zweiten Anlauf, danach eine Grenze',
  quelle.includes('SELBST_VERSUCHE') && quelle.includes('selbstVersuche.get(String(reihe))') && quelle.includes('versuche < SELBST_VERSUCHE'),
)
pruefe('die Zahl der Versuche wird je Lauf zurückgesetzt', quelle.includes('selbstVersuche.clear()'))

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Durchgangs-Ende halten.')
