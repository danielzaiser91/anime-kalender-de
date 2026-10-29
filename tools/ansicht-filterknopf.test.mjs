import assert from 'node:assert/strict'
import { dockAbweichung, knopfAbweichungen } from './ansicht-filterknopf.mjs'
import { escapeAbweichungen } from './ansicht-filterknopf-escape.mjs'

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
function dock(name, dockBreite, anzahl) {
  assert.equal(dockAbweichung('t', { ...zu, dockBreite }).length, anzahl, name)
  faelle += 1
}
dock('Dock genau Knopf plus Rand', 104, 0)
dock('Dock 20 px breiter noch ok', 110, 0)
dock('Dock 21 px breiter zu viel', 111, 1)
dock('Dock mit Chips', 1180, 1)
const gut = { controlsGefunden: true, feldZu: true, feldFokusKnopf: true, sprecherGeleert: true, sprecherFeldOffen: true, sprecherZweiterZu: true }
function escape(name, aenderung, teil) {
  const a = escapeAbweichungen('t', { ...gut, ...aenderung })
  assert.equal(a.length, teil ? 1 : 0, `${name}: ${JSON.stringify(a)}`)
  if (teil) assert.ok(a[0].includes(teil), `${name}: ${a[0]}`)
  faelle += 1
}
escape('alles gut', {}, null)
escape('aria-controls ohne Ziel', { controlsGefunden: false }, 'aria-controls')
escape('Escape im Eingabefeld schließt nicht', { feldZu: false }, 'schließt es nicht')
escape('Fokus nicht zurück', { feldFokusKnopf: false }, 'Fokus kehrt')
escape('Sprecher nicht geleert', { sprecherGeleert: false }, 'leert die Sprecher-Eingabe nicht')
escape('Sprecher-Escape schließt das Feld mit', { sprecherFeldOffen: false }, 'schließt das ganze Feld mit')
escape('zweiter Escape schließt nicht', { sprecherZweiterZu: false }, 'zweiter Escape')
console.log(`ansicht-filterknopf.test: ${faelle} Fälle ok`)
