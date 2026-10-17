/**
 * Die Bewertung von `kachel-ecken-messen.mjs` (Daniel, 17.10.2026): Jeder Fehler der Anbieter-Leiste wird gefunden, jedes Gutes bleibt still.
 * Die Kulisse hat drei Kacheln, die schadhafte steht in der Mitte (nicht am Rand), und je Stelle (Ecken, Seitenrand, Raum unter der Leiste,
 * Unterkante) ein eigener Fall; die Pixel sind Zahlen, kein Browser nötig. Der Lauf im Browser steht in `check:ansichten-desktop`.
 */
import assert from 'node:assert/strict'
import { bewerte } from './kachel-ecken-messen.mjs'

const LEISTE = [200, 20, 20]
const COVER = [70, 90, 130]
const GRUND = [13, 15, 20]
const GOLD = [245, 197, 66]

/** Pixel einer gesunden Kachel in der Reihenfolge von `stellen`: Ecken, innen, drei unter der Leiste, Seitenränder oben, Referenz oben. */
const gesund = () => [LEISTE, LEISTE, LEISTE, LEISTE, GRUND, GRUND, GRUND, COVER, COVER, COVER, COVER]
const kachel = (x, favorit = false) => ({ x, w: 100, oben: 100, unten: 250, favorit })
const lauf = (kacheln, farben) => ({ kacheln, farben: farben.flat() })

function basis() {
  const kacheln = [kachel(0), kachel(200), kachel(400)]
  return { ohne: lauf(kacheln, [gesund(), gesund(), gesund()]), mit: lauf(kacheln.map((k) => ({ ...k, favorit: true })), [gesund(), gesund(), gesund()]) }
}

/** Setzt Pixel `n` der mittleren Kachel (Index 1) im Lauf `art`. */
function mitFehler(art, n, farbe) {
  const b = basis()
  const farben = [gesund(), gesund(), gesund()]
  farben[1][n] = farbe
  b[art] = lauf(b[art].kacheln, farben)
  return bewerte('t', b.ohne, b.mit, 1)
}

assert.deepEqual(bewerte('t', basis().ohne, basis().mit, 1), [], 'gesunde Kacheln bleiben still')

for (const art of ['ohne', 'mit']) {
  assert.match(mitFehler(art, 0, GRUND).join('\n'), /Kachel 1: untere Ecke links/, `runde Ecke links (${art})`)
  assert.match(mitFehler(art, 1, GRUND).join('\n'), /Kachel 1: untere Ecke rechts/, `runde Ecke rechts (${art})`)
  assert.match(mitFehler(art, 7, GRUND).join('\n'), /Kachel 1: Seitenrand links/, `Seitenrand links eingezogen (${art})`)
  assert.match(mitFehler(art, 8, GRUND).join('\n'), /Kachel 1: Seitenrand rechts/, `Seitenrand rechts eingezogen (${art})`)
}
for (const n of [4, 5, 6]) {
  assert.match(mitFehler('mit', n, GOLD).join('\n'), new RegExp(`Kachel 1: ${n - 2} px unter der Leiste`), `Goldstreifen ${n - 2} px unter der Leiste`)
}
assert.equal(mitFehler('mit', 0, GRUND).filter((f) => /Kachel [02]/.test(f)).length, 0, 'nur die schadhafte Kachel wird gemeldet')

const tiefer = basis()
tiefer.mit.kacheln[1] = { ...tiefer.mit.kacheln[1], unten: 251 }
assert.match(bewerte('t', tiefer.ohne, tiefer.mit, 1).join('\n'), /Kachel 1: Leiste sitzt mit Favorit 1.00 px tiefer/, 'Leiste 1 px tiefer')
const hoeher = basis()
hoeher.mit.kacheln[1] = { ...hoeher.mit.kacheln[1], unten: 249 }
assert.match(bewerte('t', hoeher.ohne, hoeher.mit, 1).join('\n'), /Kachel 1: Leiste sitzt mit Favorit -1.00 px tiefer/, 'Leiste 1 px höher')

// Eine Kachel direkt darunter zeigt mit Favorit ihren eigenen Rand an dieser Stelle: kein Fehler; steht sie weiter weg, wohl.
const darunter = basis()
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], x: 250, oben: 252 }
darunter.ohne.kacheln[2] = darunter.mit.kacheln[2]
const farbenDarunter = [gesund(), gesund(), gesund()]
farbenDarunter[1][5] = GOLD
darunter.mit.farben = farbenDarunter.flat()
assert.deepEqual(bewerte('t', darunter.ohne, darunter.mit, 1), [], 'Nachbarkachel darunter erklärt den Streifen')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 270 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /2 px unter der Leiste|3 px unter der Leiste/, 'Nachbar 20 px tiefer erklärt nichts')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 252, x: 500 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /px unter der Leiste/, 'Nachbar daneben erklärt nichts')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 252, x: 50 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /px unter der Leiste/, 'Nachbar links daneben (endet vor der Kachel) erklärt nichts')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 200, x: 250 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /px unter der Leiste/, 'Nachbar, der mitten in der Kachel beginnt, erklärt nichts')

// Seitenpixel über der Leiste dürfen sich zwischen den Läufen unterscheiden (Rand ist Sache der Seitenprüfung), solange Rand und Referenz gleich bleiben.
const seiten = basis()
const farbenSeiten = [gesund(), gesund(), gesund()]
for (const n of [7, 8, 9, 10]) farbenSeiten[1][n] = GOLD
seiten.mit.farben = farbenSeiten.flat()
assert.deepEqual(bewerte('t', seiten.ohne, seiten.mit, 1), [], 'Seitenpixel gelten nicht als Streifen unter der Leiste')

// Leerer Vergleich: zu wenige Favoriten oder verschiedene Kachelzahl.
const leer = basis()
leer.mit.kacheln = leer.mit.kacheln.map((k) => ({ ...k, favorit: false }))
assert.match(bewerte('t', leer.ohne, leer.mit, 1).join('\n'), /nur 0 Kacheln mit Favoritenrand/, 'ohne Favoriten kein Vergleich')
const zuWenig = basis()
assert.match(bewerte('t', zuWenig.ohne, zuWenig.mit, 4).join('\n'), /nur 3 Kacheln mit Favoritenrand \(mindestens 4\)/, 'Mindestzahl gilt')
assert.match(bewerte('t', basis().ohne, { kacheln: [kachel(0, true)], farben: gesund() }, 1).join('\n'), /Kachelzahl 3 → 1/, 'Kachelzahl ungleich')
assert.match(bewerte('t', { kacheln: [], farben: [] }, { kacheln: [], farben: [] }, 0).join('\n'), /Kachelzahl 0 → 0/, 'keine Kacheln')

console.log('kachel-ecken-messen.test: ok')
