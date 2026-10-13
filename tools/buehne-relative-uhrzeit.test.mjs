/**
 * Test der Zustandsrechnung des Bühnen-Mockups „Relative Uhrzeit" (`web/buehne/mockups/relative-uhrzeit-zeit.ts`):
 * Bündel, Mitternacht, ohne Sendungen, geschätzt, verpasst, Schwellen und die Jetzt-Linie (Spezifikation Abschnitte 3, 4, 10).
 */
import assert from 'node:assert/strict'
import { dStand, fruehesteKommende, kachelAngabe, kastenZustand, kopfzeile, restText } from '../web/buehne/mockups/relative-uhrzeit-zeit.ts'

const T = '2026-10-16'
const tv = (time, extra = {}) => ({ date: T, time, platform: 'tv', ...extra })
const sendung = (von, bis, nr) => ({ start: `${T}T${von}`, ende: `${T}T${bis}`, ...(nr ? { nr } : {}) })
const zeilen = (gruppen, sendungen, jetzt) => kastenZustand(gruppen, sendungen, T, jetzt)

// Schwellen: unter einer Stunde Minuten, bis drei Stunden Stunden (und Minuten, wenn welche übrig sind).
assert.equal(restText(5), 'in 5 Min')
assert.equal(restText(59), 'in 59 Min')
assert.equal(restText(60), 'in 1 Std')
assert.equal(restText(65), 'in 1 Std 5 Min')
assert.equal(restText(120), 'in 2 Std')
assert.equal(restText(180), 'in 3 Std')

// Bündelzeile One Piece 18:25 (Folge 31) und 18:50 (Folge 32): bei 18:55 läuft die zweite, mit Folge und Ende.
const buendel = [tv('18:25', { episode: 31 }), tv('18:50', { episode: 32 })]
const buendelSendungen = [sendung('18:25', '18:50', 1104), sendung('18:50', '19:15', 1105)]
assert.deepEqual(zeilen([buendel], [buendelSendungen], '18:55').zeilen, [{ art: 'laeuft', bis: '19:15', folge: 32 }])
// Läuft die erste, steht keine Folge dabei (sie steht ohnehin in der Zeile).
assert.deepEqual(zeilen([buendel], [buendelSendungen], '18:30').zeilen, [{ art: 'laeuft', bis: '18:50' }])
// Auf die Minute: Die erste Sendung endet um 18:50, die zweite beginnt — es läuft die zweite, nie keine Lücke.
assert.deepEqual(zeilen([buendel], [buendelSendungen], '18:50').zeilen, [{ art: 'laeuft', bis: '19:15', folge: 32 }])
// Nach dem Ende der zweiten ist die Zeile vorbei.
assert.deepEqual(zeilen([buendel], [buendelSendungen], '19:15').zeilen, [{ art: 'vorbei' }])

// Mitternacht: Eine Sendung von 23:50 bis 00:20 läuft um 23:55; das Ende steht als „00:20".
const spaet = [tv('23:50', { episode: 3 })]
const ueberMitternacht = [{ start: `${T}T23:50`, ende: '2026-10-17T00:20' }]
assert.deepEqual(zeilen([spaet], [ueberMitternacht], '23:55').zeilen, [{ art: 'laeuft', bis: '00:20' }])
assert.deepEqual(zeilen([spaet], [ueberMitternacht], '23:30').zeilen, [{ art: 'naechste', minuten: 20 }])

// Ohne Sendungen kennt die Seite kein Ende: nie „läuft"; vor dem Beginn „nächste", ab dem Beginn vorbei (auch auf die Minute).
const ohne = [tv('18:00')]
assert.deepEqual(zeilen([ohne], [[]], '17:40').zeilen, [{ art: 'naechste', minuten: 20 }])
assert.deepEqual(zeilen([ohne], [[]], '18:00').zeilen, [{ art: 'vorbei' }])
assert.deepEqual(zeilen([ohne], [[]], '18:10').zeilen, [{ art: 'vorbei' }])

// Geschätzte Zeit: nie „läuft", nie „nächste" (auch wenn eine Sendung zur Zeit passen würde).
const geschaetzt = [tv('18:00', { timeEstimated: true })]
assert.deepEqual(zeilen([geschaetzt], [[sendung('18:00', '18:30')]], '18:10').zeilen, [{ art: 'vorbei' }])
assert.deepEqual(zeilen([[tv('18:00', { estimated: true })]], [[]], '17:50').zeilen, [{ art: 'spaeter' }])

// Nur die erste ausstehende Zeile ist „nächste", und nur bis drei Stunden.
const drei = [[tv('18:00')], [tv('18:30')], [tv('19:00')]]
assert.deepEqual(zeilen(drei, [[], [], []], '17:50').zeilen, [{ art: 'naechste', minuten: 10 }, { art: 'spaeter' }, { art: 'spaeter' }])
assert.deepEqual(zeilen(drei, [[], [], []], '14:00').zeilen, [{ art: 'spaeter' }, { art: 'spaeter' }, { art: 'spaeter' }])
assert.deepEqual(zeilen(drei, [[], [], []], '15:00').zeilen[0], { art: 'naechste', minuten: 180 })

// Jetzt-Linie: vor der ersten nicht vorbeien Zeile — nicht, wenn noch nichts vorbei ist oder alles vorbei ist.
assert.equal(zeilen(drei, [[], [], []], '14:00').linieVor, undefined)
assert.equal(zeilen(drei, [[], [], []], '18:10').linieVor, 1)
assert.equal(zeilen(drei, [[], [], []], '19:30').linieVor, undefined)
assert.equal(zeilen(drei, [[], [], []], '19:30').alleVorbei, true)
assert.equal(zeilen(drei, [[], [], []], '18:10').alleVorbei, false)
assert.equal(zeilen([[tv('18:00')]], [[sendung('18:00', '18:30')]], '18:10').linieVor, 0)
assert.equal(zeilen([], [], '12:00').alleVorbei, false)

// Variante B: läuft vor nächste vor „nichts mehr"; ab drei Stunden keine Zeile.
const sendungen3 = [[sendung('18:00', '18:30')], [], []]
assert.deepEqual(kopfzeile(zeilen(drei, sendungen3, '18:10'), ['Conan', 'X', 'Y']), { art: 'laeuft', name: 'Conan', bis: '18:30' })
assert.deepEqual(kopfzeile(zeilen(drei, [[], [], []], '17:17'), ['A', 'B', 'C']), { art: 'naechste', minuten: 43 })
assert.deepEqual(kopfzeile(zeilen(drei, [[], [], []], '19:30'), ['A', 'B', 'C']), { art: 'nichts' })
assert.equal(kopfzeile(zeilen(drei, [[], [], []], '14:00'), ['A', 'B', 'C']), undefined)

// Kacheln: „seit" für Vergangenes mit fester Uhrzeit, „in" nur an der frühsten kommenden Kachel bis drei Stunden.
const kachel = (time, extra = {}) => ({ date: T, time, platform: 'crunchyroll', releaseType: 'weekly', ...extra })
const tag = [kachel('17:00'), kachel('19:00'), kachel('19:00'), kachel('22:00'), tv('18:00')]
const fruehste = fruehesteKommende(tag, T, '18:48')
assert.equal(fruehste, '19:00')
assert.deepEqual(kachelAngabe(tag[0], T, '18:48', fruehste), { seit: '17:00' })
assert.deepEqual(kachelAngabe(tag[1], T, '18:48', fruehste), { in: 'in 12 Min' })
assert.deepEqual(kachelAngabe(tag[2], T, '18:48', fruehste), { in: 'in 12 Min' })
assert.deepEqual(kachelAngabe(tag[3], T, '18:48', fruehste), {})
assert.deepEqual(kachelAngabe(kachel('19:00'), T, '15:30', fruehesteKommende(tag, T, '15:30')), {})
assert.deepEqual(kachelAngabe(kachel('17:00'), T, '17:00', undefined), { seit: '17:00' })

// Geschätzt, verpasst, ohne Uhrzeit, anderer Tag: nie „seit", nie „in" — und eine Schätzung bestimmt auch nicht die „frühste".
const unsicher = [kachel('17:00', { estimated: true }), kachel('17:00', { timeEstimated: true }), kachel('17:00', { verpasst: {} }), kachel(undefined), kachel('17:00', { date: '2026-10-15' })]
for (const t of unsicher) assert.deepEqual(kachelAngabe(t, T, '18:00', '19:00'), {})
assert.equal(fruehesteKommende([kachel('19:00', { estimated: true }), kachel('20:00')], T, '18:00'), '20:00')
assert.equal(fruehesteKommende([kachel('19:00', { zweitanbieter: true }), kachel('20:00', { releaseType: 'disc' })], T, '18:00'), undefined)

// Variante D: Linie auch vor der ersten und nach der letzten Zeile; Minuten bis zur ersten Sendung ohne Dreistundengrenze.
const dStandBei = (gruppen, sendungen, jetzt) => dStand(zeilen(gruppen, sendungen, jetzt), gruppen, jetzt)
const keine = [[], [], []]
assert.deepEqual(dStandBei(drei, keine, '14:00'), { linieVor: 0, ersteIn: 240, nichtsMehr: false })
assert.equal(restText(dStandBei(drei, keine, '14:00').ersteIn), 'in 4 Std')
assert.equal(restText(dStandBei(drei, keine, '14:50').ersteIn), 'in 3 Std 10 Min')
assert.equal(restText(dStandBei(drei, keine, '17:20').ersteIn), 'in 40 Min')
assert.equal(restText(dStandBei(drei, keine, '17:59').ersteIn), 'in 1 Min')
// Nach dem letzten Eintrag: Linie hinter der letzten Zeile mit „heute nichts mehr", ohne Minuten.
assert.deepEqual(dStandBei(drei, keine, '19:30'), { linieVor: 3, nichtsMehr: true })
// Mittendrin wie bisher (Linie vor der ersten nicht vorbeien Zeile), ohne „erste Sendung".
assert.deepEqual(dStandBei(drei, keine, '18:10'), { linieVor: 1, nichtsMehr: false })
// Läuft die erste Zeile, steht die Linie davor — ohne „erste Sendung in …".
assert.deepEqual(dStandBei([[tv('18:00')]], [[sendung('18:00', '18:30')]], '18:10'), { linieVor: 0, nichtsMehr: false })
// Läuft die zweite Sendung eines Bündels, trägt die Zeile ihre Folge (die Senderzeile zeigt sie).
assert.deepEqual(zeilen([buendel], [buendelSendungen], '18:55').zeilen[0], { art: 'laeuft', bis: '19:15', folge: 32 })
// Geschätzte oder fehlende Uhrzeit der ersten Zeile: keine Linie davor.
assert.equal(dStandBei([[tv('18:00', { timeEstimated: true })]], [[]], '14:00'), undefined)
assert.equal(dStandBei([[tv(undefined)]], [[]], '14:00'), undefined)
assert.equal(dStandBei([], [], '14:00'), undefined)

console.log('buehne-relative-uhrzeit.test: ok')
