import assert from 'node:assert/strict'
import { fensterUrteil, schneidetBildschirm } from './lauf-status-fenster-urteil.mjs'

const schirm = [{ x: 0, y: 0, width: 1920, height: 1080 }]
const gut = { schneidet: false, fokus: false, sichtbar: true, bounds: { x: -20000, y: -20000, width: 420, height: 760 } }
const rot = (lage) => fensterUrteil(lage).filter(([, ok]) => !ok).map(([was]) => was)

assert.deepEqual(rot(gut), [])
assert.deepEqual(rot({ ...gut, schneidet: true }), ['Testfenster liegt außerhalb aller Bildschirme'])
assert.deepEqual(rot({ ...gut, fokus: true }), ['ohne Fokus'])
assert.deepEqual(rot({ ...gut, sichtbar: false }), ['und gilt trotzdem als sichtbar'])

assert.equal(schneidetBildschirm({ x: -20000, y: -20000, width: 420, height: 760 }, schirm), false)
assert.equal(schneidetBildschirm({ x: 100, y: 100, width: 420, height: 760 }, schirm), true)
assert.equal(schneidetBildschirm({ x: -419, y: 0, width: 420, height: 760 }, schirm), true)
assert.equal(schneidetBildschirm({ x: -420, y: 0, width: 420, height: 760 }, schirm), false)
assert.equal(schneidetBildschirm({ x: 0, y: 1080, width: 420, height: 760 }, schirm), false)
assert.equal(schneidetBildschirm({ x: 1920, y: 0, width: 420, height: 760 }, schirm), false)
assert.equal(schneidetBildschirm({ x: 100, y: 100, width: 420, height: 760 }, []), false)

console.log('lauf-status-fenster-urteil: 4 Urteilsfälle, 7 Schnittfälle ok')
