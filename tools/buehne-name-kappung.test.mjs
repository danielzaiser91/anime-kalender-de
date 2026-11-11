import assert from 'node:assert/strict'
import { gekappteNamenImRahmen, kappungsBefunde } from './buehne-name-kappung.mjs'

const name = (text, clientWidth, scrollWidth) => ({ textContent: ` ${text} `, clientWidth, scrollWidth })
const mitDokument = (elemente, selektoren) => {
  globalThis.document = { querySelectorAll: (s) => (selektoren.push(s), elemente) }
  try {
    return gekappteNamenImRahmen()
  } finally {
    delete globalThis.document
  }
}

const gefragt = []
const gekappt = mitDokument([name('ProSieben MAXX', 96, 116), name('Joyn', 80, 80), name('RTLZWEI', 60, 61), name('Netflix', 60, 62)], gefragt)
assert.deepEqual(gefragt, ['[data-termin-name]'])
assert.deepEqual(gekappt, [{ text: 'ProSieben MAXX', platz: 96, noetig: 116 }, { text: 'Netflix', platz: 60, noetig: 62 }], 'Grenze: 1 px Rundung zählt nicht, 2 px schon')
assert.deepEqual(mitDokument([], []), [], 'ohne Namen kein Befund')

const zellen = [
  { schluessel: 'nachher-375-hell', gekappt: [{ text: 'ProSieben MAXX', platz: 96, noetig: 116 }] },
  { schluessel: 'nachher-512-hell', gekappt: [] },
]
assert.deepEqual(kappungsBefunde(zellen), ['nachher-375-hell: „ProSieben MAXX“ gekappt (96 von 116 px)'])
assert.deepEqual(kappungsBefunde([zellen[1]]), [])
console.log('buehne-name-kappung.test: ok (Grenze 1/2 px, leer, Befundzeile je Zelle)')
