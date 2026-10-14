// Zusicherung: Cover-Vorschau der Listenzeilen (web/src/lib/hover-cover.ts) — nur Maus/Stift, Frist, Lage im Fenster.
import assert from 'node:assert/strict'
import { VORSCHAU_BREITE, VORSCHAU_FRIST_MS, VORSCHAU_HOEHE, vorschauLage, zeigtVorschau } from '../web/src/lib/hover-cover.ts'

assert.equal(zeigtVorschau('mouse'), true, 'Maus zeigt')
assert.equal(zeigtVorschau('pen'), true, 'Stift zeigt')
assert.equal(zeigtVorschau('touch'), false, 'Touch zeigt nie (kein Abruf am Handy)')
assert.equal(zeigtVorschau(''), false, 'unbekannte Zeigerart zeigt nicht')

/* Die Frist ist kurz genug, dass die Vorschau „spätestens nach 300 ms" steht, und lang genug, dass Durchfahren nichts lädt. */
assert.ok(VORSCHAU_FRIST_MS >= 100 && VORSCHAU_FRIST_MS <= 300, `Frist ${VORSCHAU_FRIST_MS} ms außerhalb 100–300`)

const fenster = { breite: 1280, hoehe: 900 }
const zeile = { top: 400, bottom: 424 }

const mitte = vorschauLage(zeile, 300, fenster)
assert.equal(mitte.left, 316, 'rechts neben dem Zeiger')
assert.equal(mitte.top, 432, 'unter der Zeile, den Titel nicht verdeckend')

const rechterRand = vorschauLage(zeile, 1250, fenster)
assert.equal(rechterRand.left, 1250 - 16 - VORSCHAU_BREITE, 'am rechten Rand links vom Zeiger')
assert.ok(rechterRand.left + VORSCHAU_BREITE <= fenster.breite, 'ganz im Fenster')

const knapp = vorschauLage(zeile, 1280 - 16 - VORSCHAU_BREITE - 8, fenster)
assert.equal(knapp.left, 1280 - VORSCHAU_BREITE - 8, 'genau bis zum Rand rechts bleibt rechts')

const schmal = vorschauLage(zeile, 40, { breite: 150, hoehe: 900 })
assert.equal(schmal.left, 8, 'kein Platz auf beiden Seiten: am linken Rand gehalten')

assert.equal(vorschauLage({ top: 880, bottom: 900 }, 300, fenster).top, 880 - 8 - VORSCHAU_HOEHE, 'kein Platz darunter: über der Zeile')
assert.equal(vorschauLage({ top: 692, bottom: 714 }, 300, fenster).top, 722, 'Platz darunter bis auf 8 px genau reicht')
assert.equal(vorschauLage({ top: 693, bottom: 715 }, 300, fenster).top, 693 - 8 - VORSCHAU_HOEHE, 'einen Pixel zu knapp: darüber')
assert.equal(vorschauLage({ top: 20, bottom: 40 }, 300, { breite: 1280, hoehe: 150 }).top, 8, 'weder darunter noch darüber Platz: oben im Fenster gehalten')

console.log('hover-cover: ok')
