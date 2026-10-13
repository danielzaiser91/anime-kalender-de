/**
 * Test von `shared/laeuft-jetzt.ts` — „was läuft, wo steht die Linie" (Variante D, Daniel 13.10.2026):
 * Die Linie „jetzt HH:MM" steht nur, solange nichts läuft; mehrere Zeilen können gleichzeitig laufen;
 * bei geschätzter Uhrzeit keine Restzeit. Dazu: die Kacheln lesen dieselbe Rechnung (`kachelAngabe`).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { kachelAngabe, kastenZustand, linienStand, restText } from '../shared/laeuft-jetzt.ts'

const T = '2026-10-16'
const tv = (time, extra = {}) => ({ date: T, time, platform: 'tv', ...extra })
const sendung = (von, bis, nr) => ({ start: `${T}T${von}`, ende: `${T}T${bis}`, ...(nr ? { nr } : {}) })

/** Freitag-Fall wie im Mockup: Yashahime 15:10, Dragon Ball 17:10 bis 17:40, Conan 18:00, One Piece 18:25 und 18:50 (Bündel). */
const gruppen = [[tv('17:10')], [tv('18:00')], [tv('18:25', { episode: 31 }), tv('18:50', { episode: 32 })]]
const sendungen = [[sendung('17:10', '17:40')], [sendung('18:00', '18:25')], [sendung('18:25', '18:50', 1104), sendung('18:50', '19:15', 1105)]]

function stand(gr, se, jetzt) {
  const zustand = kastenZustand(gr, se, T, jetzt)
  return { zustand, linie: linienStand(zustand, gr, jetzt) }
}
const art = (s) => s.zustand.zeilen.map((z) => z.art)

// Vor der ersten Sendung: Linie davor, Minuten bis zur ersten für die Kopfzeile (auch jenseits von drei Stunden), keine Restzeit an einer Zeile.
const vorher = stand(gruppen, sendungen, '13:30')
assert.deepEqual(vorher.linie, { linieVor: 0, ersteIn: 220, nichtsMehr: false, restInZeile: false })
assert.equal(restText(vorher.linie.ersteIn), 'in 3 Std 40 Min')
assert.deepEqual(art(vorher), ['spaeter', 'spaeter', 'spaeter'])
// Genau eine Stunde / eine Minute davor.
assert.equal(restText(stand(gruppen, sendungen, '16:10').linie.ersteIn), 'in 1 Std')
assert.equal(restText(stand(gruppen, sendungen, '17:09').linie.ersteIn), 'in 1 Min')

// Eine Sendung läuft (Daniels Bild um 17:42 mit der Dragon-Ball-Zeile): keine Linie, „in … Min" an der nächsten Zeile.
const eine = stand(gruppen, sendungen.map((s, i) => (i === 0 ? [sendung('17:10', '17:45')] : s)), '17:42')
assert.deepEqual(art(eine), ['laeuft', 'naechste', 'spaeter'])
assert.deepEqual(eine.zustand.zeilen[0], { art: 'laeuft', bis: '17:45' })
assert.deepEqual(eine.zustand.zeilen[1], { art: 'naechste', minuten: 18 })
assert.deepEqual(eine.linie, { nichtsMehr: false, restInZeile: true })

// Auf die Minute: Das Ende der Sendung ist nicht mehr „läuft" — Linie zwischen den Sendungen, nie beides.
const luecke = stand(gruppen, sendungen, '17:40')
assert.deepEqual(art(luecke), ['vorbei', 'naechste', 'spaeter'])
assert.deepEqual(luecke.linie, { linieVor: 1, nichtsMehr: false, restInZeile: true })
// Der Beginn der Sendung: läuft, keine Linie.
assert.deepEqual(stand(gruppen, sendungen, '17:10').linie, { nichtsMehr: false, restInZeile: true })
assert.equal(stand(gruppen, sendungen, '17:10').zustand.zeilen[0].art, 'laeuft')

// Zwei Sender zur selben Zeit: beide Zeilen laufen, keine Linie.
const gleichzeitig = [[tv('18:00', { sender: 'A' })], [tv('18:00', { sender: 'B' })], [tv('19:00')]]
const beide = stand(gleichzeitig, [[sendung('18:00', '18:30')], [sendung('18:00', '18:45')], []], '18:10')
assert.deepEqual(art(beide), ['laeuft', 'laeuft', 'naechste'])
assert.equal(beide.linie.linieVor, undefined)
// Endet eine früher, läuft die andere allein weiter — weiter ohne Linie.
const einzeln = stand(gleichzeitig, [[sendung('18:00', '18:30')], [sendung('18:00', '18:45')], []], '18:35')
assert.deepEqual(art(einzeln), ['vorbei', 'laeuft', 'naechste'])
assert.equal(einzeln.linie.linieVor, undefined)

// Läuft die zweite Sendung eines Bündels, trägt die Zeile ihre Folge und ihr Ende; die erste trägt keine Folge.
assert.deepEqual(stand(gruppen, sendungen, '18:55').zustand.zeilen[2], { art: 'laeuft', bis: '19:15', folge: 32 })
assert.deepEqual(stand(gruppen, sendungen, '18:30').zustand.zeilen[2], { art: 'laeuft', bis: '18:50' })
assert.equal(stand(gruppen, sendungen, '18:55').linie.linieVor, undefined)

// Zwischen zwei Sendungen (Conan endet 18:25 nahtlos in One Piece; hier mit Lücke), Linie vor der nächsten, „in … Min" dort.
const mitLuecke = stand([[tv('17:00')], [tv('18:00')]], [[sendung('17:00', '17:30')], [sendung('18:00', '18:30')]], '17:45')
assert.deepEqual(mitLuecke.linie, { linieVor: 1, nichtsMehr: false, restInZeile: true })

// Nach der letzten Sendung: Linie hinter der letzten Zeile mit „Heute nichts mehr", ohne Restzeit.
const danach = stand(gruppen, sendungen, '21:00')
assert.deepEqual(art(danach), ['vorbei', 'vorbei', 'vorbei'])
assert.deepEqual(danach.linie, { linieVor: 3, nichtsMehr: true, restInZeile: false })
// Die letzte Sendung läuft noch: keine Linie, kein „nichts mehr".
assert.deepEqual(stand(gruppen, sendungen, '19:14').linie, { nichtsMehr: false, restInZeile: false })
assert.deepEqual(stand(gruppen, sendungen, '19:15').linie, { linieVor: 3, nichtsMehr: true, restInZeile: false })

// Geschätzte oder fehlende Uhrzeit der ersten Zeile: keine Linie davor, keine Restzeit, nie „läuft".
const geschaetzt = [[tv('18:00', { timeEstimated: true })], [tv('19:00')]]
const sendungenG = [[sendung('18:00', '18:30')], []]
for (const jetzt of ['14:00', '18:10']) {
  const s = stand(geschaetzt, sendungenG, jetzt)
  assert.ok(s.zustand.zeilen.every((z) => z.art !== 'laeuft'), `geschätzt läuft nie (${jetzt})`)
}
assert.deepEqual(stand(geschaetzt, sendungenG, '14:00').linie, { nichtsMehr: false, restInZeile: false })
assert.deepEqual(stand(geschaetzt, sendungenG, '16:30').linie, { nichtsMehr: false, restInZeile: false })
assert.equal(stand(geschaetzt, sendungenG, '16:30').zustand.zeilen[1].art, 'naechste')
assert.deepEqual(stand([[tv(undefined)]], [[]], '14:00').linie, { nichtsMehr: false, restInZeile: false })
assert.deepEqual(stand([], [], '14:00').linie, { nichtsMehr: false, restInZeile: false })
// Läuft etwas, steht „in … Min" trotzdem nicht an einer Zeile hinter einer geschätzten, die früher kommen könnte.
const dahinter = [[tv('17:00')], [tv('18:00', { estimated: true })], [tv('18:30')]]
const sd = stand(dahinter, [[sendung('17:00', '17:50')], [], []], '17:30')
assert.deepEqual(art(sd), ['laeuft', 'spaeter', 'naechste'])
assert.equal(sd.linie.restInZeile, false)

// Mitternacht: Eine Sendung von 23:50 bis 00:20 läuft um 23:55.
const spaet = stand([[tv('23:50')]], [[{ start: `${T}T23:50`, ende: '2026-10-17T00:20' }]], '23:55')
assert.deepEqual(spaet.zustand.zeilen[0], { art: 'laeuft', bis: '00:20' })

// Die Kacheln lesen dieselbe Rechnung: „seit" und „in", nie bei Schätzung.
assert.deepEqual(kachelAngabe({ date: T, time: '17:00' }, T, '17:42', undefined), { seit: '17:00' })
assert.deepEqual(kachelAngabe({ date: T, time: '18:00' }, T, '17:42', '18:00'), { in: 'in 18 Min' })
assert.deepEqual(kachelAngabe({ date: T, time: '18:00', timeEstimated: true }, T, '17:42', '18:00'), {})

// Wie schnell die Seite eine Änderung zeigt: Die Woche zieht „jetzt" einmal je Minute nach (`useSprungZuHeute`);
// die Rechnung hängt nur an der Minute, also steht „Läuft" spätestens 60 Sekunden nach dem Ende der Sendung nicht mehr da.
const takt = /window\.setInterval\(\(\) => setNow\(nowHhMm\(\)\), (\d[\d_]*)\)/.exec(readFileSync(new URL('../web/src/lib/woche-sprung.ts', import.meta.url), 'utf8'))
assert.ok(takt, 'die Woche zieht "jetzt" in einem Intervall nach')
assert.ok(Number(takt[1].replaceAll('_', '')) <= 60_000, 'höchstens eine Minute Abstand')
assert.equal(art(stand(gruppen, sendungen, '17:39'))[0], 'laeuft')
assert.equal(art(stand(gruppen, sendungen, '17:40'))[0], 'vorbei')

console.log('laeuft-jetzt.test: ok')
