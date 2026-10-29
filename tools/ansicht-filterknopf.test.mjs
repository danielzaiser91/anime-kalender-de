import assert from 'node:assert/strict'
import { knopfAbweichungen } from './ansicht-filterknopf.mjs'

const zu = { x: 1200, y: 800, width: 90, height: 44 }
let faelle = 0
function fall(name, boxen, erwartet) {
  const a = knopfAbweichungen('t', boxen)
  assert.equal(a.length, erwartet.length, `${name}: ${JSON.stringify(a)}`)
  erwartet.forEach((teil, i) => assert.ok(a[i].includes(teil), `${name}: ${a[i]}`))
  faelle += 1
}

fall('gleich', { zu, offen: { ...zu }, danach: { ...zu } }, [])
fall('Unterschied unter Toleranz', { zu, offen: { ...zu, x: 1200.4 }, danach: { ...zu } }, [])
fall('Sprung nach links (Mockup)', { zu, offen: { ...zu, x: 700 }, danach: { ...zu } }, ['offen: x 700 statt 1200'])
fall('Sprung nach oben', { zu, offen: { ...zu }, danach: { ...zu, y: 790 } }, ['nach dem Schließen: y 790 statt 800'])
fall('Breite genau 1 px', { zu, offen: { ...zu, width: 91 }, danach: { ...zu } }, ['width 91 statt 90'])
fall('Höhe', { zu, offen: { ...zu }, danach: { ...zu, height: 46 } }, ['height 46 statt 44'])
fall('alles anders', { zu, offen: { x: 1, y: 2, width: 3, height: 4 }, danach: { ...zu } }, ['x', 'y', 'width', 'height'])
console.log(`ansicht-filterknopf.test: ${faelle} Fälle ok`)
