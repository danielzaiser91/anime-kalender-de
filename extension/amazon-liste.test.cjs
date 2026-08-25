/**
 * Der Schlüssel der Prüfliste muss die Kennung sein, die in seiner Adresse steht.
 *
 * Am 25.08.2026 stand „Babylon" in der Liste und galt trotzdem als „nicht auf
 * der Prüfliste". Grund: Beide Seiten kürzten die Kennung auf zehn Zeichen —
 * die Länge einer ASIN. Prime Video führt daneben GTIs mit 26, und aus
 * `0J16B1NAB82TO0O5A5Q8TLG1VP` wurde beidseitig `0J16B1NAB8`.
 *
 * **Zwei gleich falsche Seiten sehen aus wie eine richtige.** Aufgefallen ist
 * es erst, als die Erweiterung die volle Kennung las und der gekürzte Schlüssel
 * der Liste nicht mehr passte. Diese Zusicherung vergleicht beide direkt
 * miteinander, damit sie nie wieder gemeinsam abdriften — betroffen waren 38
 * der 85 Einträge.
 */
const { readFileSync } = require('node:fs')

const liste = (() => {
  const g = {}
  new Function('globalThis', readFileSync(__dirname + '/offene-amazon.js', 'utf8'))(g)
  return g.AK_OFFENE_AMAZON ?? {}
})()

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen für die Amazon-Prüfliste\n')

const schluessel = Object.keys(liste)
/*
  Eine leere Liste ist der **Normalfall am Ende** — sie heißt, dass alles
  geprüft ist. Sie darf diesen Lauf deshalb nicht rot machen; sie überspringt
  ihn (siehe „Testdaten gehören in den Test" in CLAUDE.md).
*/
if (!schluessel.length) {
  console.log('  – Liste ist leer, nichts zu prüfen (das ist der Normalfall am Ende)\n')
  console.log('Alle Zusicherungen erfüllt.')
  process.exit(0)
}

const abweichend = []
for (const k of schluessel) {
  const url = liste[k]?.url ?? ''
  const ausAdresse = /\/(?:dp|detail)\/([A-Z0-9]{10,32})/.exec(url)?.[1]
  if (ausAdresse !== k) abweichend.push({ schluessel: k, ausAdresse, url: url.slice(-46) })
}
pruefe(
  `jeder der ${schluessel.length} Schlüssel entspricht der Kennung in seiner Adresse`,
  abweichend.length === 0,
  abweichend.slice(0, 3),
)

// Und die lange Form kommt wirklich vor — sonst prüft die Zusicherung oben ins Leere.
const lange = schluessel.filter((k) => k.length > 10)
pruefe(
  'lange Prime-Kennungen (GTIs) sind vertreten',
  lange.length > 0 || schluessel.every((k) => k.length === 10),
  { lang: lange.length, gesamt: schluessel.length },
)

console.log()
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen erfüllt.')
