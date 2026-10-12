/**
 * Bestandsteil von `cartoon-jw-stichprobe.test.mjs`: die Auswahl, gerechnet aus den echten Dateien (`public/data/cartoons.json`, `data/justwatch-audio.json`),
 * hält dieselben Invarianten und ist deterministisch. Gehört in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück, 12.10.2026).
 * Aufruf: node tools/cartoon-jw-stichprobe-bestand-pruefen.mjs
 */
import assert from 'node:assert/strict'
import { stichprobeDatei } from './cartoon-jw-stichprobe.mjs'
import { pruefeInvarianten } from './cartoon-jw-stichprobe-invarianten.mjs'

/* Mit den echten Dateien gerechnet: dieselben Invarianten, zweimal dasselbe Ergebnis. */
const heute = stichprobeDatei('2026-10-11')
pruefeInvarianten(heute.eintraege, 'echter Bestand')
assert.deepEqual(stichprobeDatei('2026-10-11'), heute, 'echter Bestand: deterministisch')

console.log('cartoon-jw-stichprobe-bestand-pruefen: ok')
