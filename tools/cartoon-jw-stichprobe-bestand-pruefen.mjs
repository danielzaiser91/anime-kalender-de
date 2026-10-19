/**
 * Bestandsteil von `cartoon-jw-stichprobe.test.mjs`: die Auswahl, gerechnet aus den echten Dateien (`public/data/cartoons.json`, `data/justwatch-audio.json`),
 * hält dieselben Invarianten und ist deterministisch. Gehört in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück, 12.10.2026).
 * Jedes Urteil (`dub`) nimmt einen Weg aus dem Pool, darum ist die Sollzahl je Gruppe min(50, Pool), nicht fest 50 (19.10.2026: im Bau-Lauf 42 statt 50).
 * Aufruf: node tools/cartoon-jw-stichprobe-bestand-pruefen.mjs
 */
import assert from 'node:assert/strict'
import { kandidaten, ladeBestand, stichprobeDatei } from './cartoon-jw-stichprobe.mjs'
import { pruefeInvarianten, sollAusPool } from './cartoon-jw-stichprobe-invarianten.mjs'

/* Mit den echten Dateien gerechnet: dieselben Invarianten, zweimal dasselbe Ergebnis. */
const { cartoons, jw } = ladeBestand()
const soll = sollAusPool(kandidaten(cartoons, jw))
const heute = stichprobeDatei('2026-10-11')
pruefeInvarianten(heute.eintraege, 'echter Bestand', soll)
assert.deepEqual(stichprobeDatei('2026-10-11'), heute, 'echter Bestand: deterministisch')

console.log(`cartoon-jw-stichprobe-bestand-pruefen: ok (Soll ${JSON.stringify(soll)})`)
