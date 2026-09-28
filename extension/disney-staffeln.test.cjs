/**
 * **Die Staffelnummer der Seite ist nicht unsere Nummer.**
 *
 * Disney+ führt „Mission: Yozakura Family" als Staffel 1 (27 Folgen, kein Deutsch) und
 * Staffel 2 (12 Folgen, deutsch). Unser Bestand kennt an dieser Adresse nur die zweite —
 * die Prüfliste zählt ihre Staffeln als Positionsindex über `titles.json`, also als
 * `nr: 1`. Am 27.09.2026 wurden deshalb die 27 Folgen der ersten Staffel auf 182578
 * gemeldet (Kennungen 8405–8431, verworfen), und die richtigen zwölf kamen mit
 * `titel_id: null` an.
 *
 * `titelIdFuer()` nimmt seither die Folgenzahl der Seite dazu: sie widerlegt eine Nummer,
 * die nicht passt, und belegt eine fehlende — aber nur, wenn sie auf beiden Seiten genau
 * einmal vorkommt.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const quelle = readFileSync(resolve(__dirname, 'disney-staffeln.js'), 'utf8')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Disney+: Staffelnummer und Folgenzahl')

/* Beide Funktionen enden auf der Einrückungsebene der Datei — der erste Treffer ist das Ende. */
const schneide = (name) => {
  const i = quelle.indexOf(`function ${name}(`)
  if (i < 0) return ''
  const j = quelle.indexOf('\n  }\n', i)
  return j < 0 ? '' : quelle.slice(i, j + 5)
}

const teile = ['titelIdFuer', 'folgenDerSeite'].map(schneide)
pruefe('titelIdFuer und folgenDerSeite auffindbar', teile.every(Boolean))

/** `seite` ist die Staffelliste, wie der Leser sie liefert (Platz 1 = Staffel 1). */
function titelId({ eigene, seite = [], staffelNr }) {
  const kontext = { ergebnis: null }
  vm.createContext(kontext)
  vm.runInContext(
    `${teile.join('\n\n')}\nergebnis = titelIdFuer(${JSON.stringify(eigene)}, ${staffelNr}, ${JSON.stringify(seite)})`,
    kontext,
  )
  return kontext.ergebnis
}

const YOZAKURA = [{ nr: 1, id: 182578, folgen: 12 }]
const DISNEY_YOZAKURA = [
  { name: 'Staffel 1', gesamt: 27 },
  { name: 'Staffel 2', gesamt: 12 },
]

/* Der Fall, der die Verwechslung ausgelöst hat. */
pruefe('Yozakura: Staffel 1 der Seite (27) trifft unsere Staffel 1 nicht → keine Kennung',
  titelId({ eigene: YOZAKURA, seite: DISNEY_YOZAKURA, staffelNr: 1 }) === null)
pruefe('Yozakura: die 12 Folgen der Seite gehören zu 182578',
  titelId({ eigene: YOZAKURA, seite: DISNEY_YOZAKURA, staffelNr: 2 }) === 182578)

/* Ohne Staffelliste der Seite gilt die Nummer allein — wie vor dem 28.09.2026. */
pruefe('ohne Liste der Seite bleibt die Nummer maßgeblich',
  titelId({ eigene: YOZAKURA, seite: [], staffelNr: 1 }) === 182578)

/* Regelfall: Nummer und Folgenzahl stimmen überein. */
const BLEACH = [
  { nr: 1, id: 185874, folgen: 13 },
  { nr: 2, id: 186118, folgen: 13 },
  { nr: 3, id: 189046, folgen: 14 },
]
const DISNEY_BLEACH = [
  { name: 'Staffel 1', gesamt: 13 },
  { name: 'Staffel 2', gesamt: 13 },
  { name: 'Staffel 3', gesamt: 14 },
]
pruefe('Bleach: Staffel 2 → 186118', titelId({ eigene: BLEACH, seite: DISNEY_BLEACH, staffelNr: 2 }) === 186118)
pruefe('Bleach: Staffel 3 → 189046', titelId({ eigene: BLEACH, seite: DISNEY_BLEACH, staffelNr: 3 }) === 189046)

/* Eine widersprechende Folgenzahl widerlegt auch die passende Nummer. */
pruefe('Nummer stimmt, Folgenzahl der Seite nicht → keine Kennung',
  titelId({ eigene: BLEACH, seite: [{ name: 'Staffel 1', gesamt: 39 }], staffelNr: 1 }) === null)

/* Die Folgenzahl belegt nur, wenn sie auf beiden Seiten genau einmal vorkommt. */
pruefe('Folgenzahl doppelt auf der Seite → keine Kennung',
  titelId({
    eigene: YOZAKURA,
    seite: [{ name: 'Staffel 1', gesamt: 12 }, { name: 'Staffel 2', gesamt: 12 }],
    staffelNr: 2,
  }) === null)
pruefe('Folgenzahl doppelt bei uns → keine Kennung',
  titelId({
    eigene: [{ nr: 1, id: 11, folgen: 12 }, { nr: 3, id: 22, folgen: 12 }],
    seite: DISNEY_YOZAKURA,
    staffelNr: 2,
  }) === null)

/* Nennt der Name eine andere Nummer als der Platz, wird die Reihenfolge nicht befragt. */
pruefe('Reihenfolge der Seite widerspricht dem Namen → Nummer entscheidet',
  titelId({ eigene: YOZAKURA, seite: [{ name: 'Staffel 5', gesamt: 27 }, { name: 'Staffel 2', gesamt: 12 }], staffelNr: 1 }) === 182578)
pruefe('und keine Folgenzahl als Notnagel',
  titelId({ eigene: YOZAKURA, seite: [{ name: 'Staffel 5', gesamt: 12 }], staffelNr: 2 }) === null)

/* Ohne Staffelangabe bleibt es beim Alten: genau ein Werk, sonst keines. */
pruefe('ohne Staffelangabe: genau ein Werk → dessen Kennung',
  titelId({ eigene: YOZAKURA, seite: DISNEY_YOZAKURA, staffelNr: null }) === 182578)
pruefe('ohne Staffelangabe: zwei Werke → keine Kennung',
  titelId({ eigene: BLEACH, seite: DISNEY_BLEACH, staffelNr: null }) === null)

console.log()
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) verletzt: ${fehler.join(', ')}`)
  process.exit(1)
}
console.log('Disney-Staffeln: alle Zusicherungen erfüllt.')
