/**
 * Der Test, den die beiden Abstürze verlangt haben.
 *
 * Er prüft drei Dinge, und das dritte ist das, was zweimal gefehlt hat:
 *
 * 1. Wir sehen die Metadaten-Antwort.
 * 2. Der native Wert kommt unverändert beim Leser an.
 * 3. **Die Seite bleibt heil**, auch wenn sie selbst wrappt — kein
 *    Stapelüberlauf, egal in welcher Reihenfolge.
 */
const { readFileSync } = require('node:fs')
const quelle = readFileSync(__dirname + '/leser.js', 'utf8')
const von = quelle.indexOf('  const METADATEN_ADRESSE')
const bis = quelle.indexOf('  function melden()')
if (von < 0 || bis < 0) { console.error('Block nicht gefunden'); process.exit(1) }

const gelesen = []
function lesMetadaten(text) { gelesen.push(text.length) }

// Ein XMLHttpRequest, wie ihn der Browser mitbringt: responseText ist ein
// Getter auf dem Prototyp.
class XMLHttpRequest {}
Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
  configurable: true,
  enumerable: false,
  get() { return this._text ?? '' },
})
const window = {}

eval(quelle.slice(von, bis))

const ergebnis = {}

// 1. Eine Metadaten-Antwort.
const a = new XMLHttpRequest()
a._text = JSON.stringify({ video: { id: 1, seasons: [] } }).padEnd(200, ' ')
a.responseURL = 'https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=1'
ergebnis.text = a.responseText.length > 0
ergebnis.gesehen = gelesen.length

// 2. Eine fremde Antwort bleibt unbeachtet.
const b = new XMLHttpRequest()
b._text = 'x'.repeat(500)
b.responseURL = 'https://www.netflix.com/irgendwas'
b.responseText
ergebnis.fremdeIgnoriert = gelesen.length === 1

// 3. Die Seite wrappt selbst — wie Netflix es tut.
let seiteRief = 0
const unsererGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText').get
Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
  configurable: true,
  get() { seiteRief++; return unsererGetter.call(this) },
})
const c = new XMLHttpRequest()
c._text = JSON.stringify({ video: { id: 2, seasons: [] } }).padEnd(200, ' ')
c.responseURL = 'https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=2'
let absturz = null
try { c.responseText } catch (err) { absturz = err.message }
ergebnis.nachWrappenGesehen = gelesen.length === 2
ergebnis.seiteRief = seiteRief
ergebnis.absturz = absturz

console.log(ergebnis)
const ok =
  ergebnis.text && ergebnis.gesehen === 1 && ergebnis.fremdeIgnoriert &&
  ergebnis.nachWrappenGesehen && ergebnis.seiteRief === 1 && ergebnis.absturz === null
console.log(ok ? '\n✓ Gesehen, unverändert durchgereicht, kein Stapelüberlauf' : '\n✗ durchgefallen')
process.exit(ok ? 0 : 1)
