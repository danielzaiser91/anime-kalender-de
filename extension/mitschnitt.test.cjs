/**
 * Beide Pfade prüfen — der letzte Test sah nur `fetch` und ließ genau den
 * Fehler durch, der Netflix lahmgelegt hat.
 *
 * Nachgestellt wird die echte Reihenfolge: unser Skript zuerst, danach setzt
 * die Seite ihre eigenen Wrapper. Verlangt wird beides — wir sehen die Antwort,
 * **und** der Wrapper der Seite läuft.
 */
const { readFileSync } = require('node:fs')
const quelle = readFileSync('extension/leser.js', 'utf8')
const von = quelle.indexOf('  const INTERESSANT =')
const bis = quelle.indexOf('  // --- Takt')
if (von < 0 || bis < 0) { console.error('Block nicht gefunden'); process.exit(1) }

const gesehen = []
function lesMetadaten(text) { gesehen.push(text.length) }

// Eine Umgebung, die sich wie ein Browser verhält.
let xhrGeladen = null
class XMLHttpRequest {
  open(methode, url) { this._url = url }
  addEventListener(art, fn) { if (art === 'load') xhrGeladen = fn.bind(this) }
  get responseText() { return '{"video":{"id":1,"seasons":[]}}' }
}
XMLHttpRequest.prototype.open = XMLHttpRequest.prototype.open
const window = {
  fetch: async () => ({ clone: () => ({ text: async () => '{"video":{"id":1,"seasons":[]}}' }) }),
}
const urFetch = window.fetch
const urOeffnen = XMLHttpRequest.prototype.open

eval(quelle.slice(von, bis))

;(async () => {
  const ergebnis = {}

  // --- fetch, vor und nach dem Überschreiben durch die Seite ---------------
  await window.fetch('/nq/website/memberapi/release/metadata?movieid=1')
  await new Promise((r) => setTimeout(r, 10))
  ergebnis.fetchVorher = gesehen.length

  let seitenFetchRief = 0
  window.fetch = async function (...a) { seitenFetchRief++; return urFetch.apply(this, a) }
  await window.fetch('/nq/website/memberapi/release/metadata?movieid=2')
  await new Promise((r) => setTimeout(r, 10))
  ergebnis.fetchNachher = gesehen.length - ergebnis.fetchVorher
  ergebnis.seitenFetchRief = seitenFetchRief

  // --- XHR, dasselbe Spiel -------------------------------------------------
  const vorXhr = gesehen.length
  const x1 = new XMLHttpRequest()
  x1.open('GET', '/nq/website/memberapi/release/metadata?movieid=3')
  xhrGeladen?.()
  ergebnis.xhrVorher = gesehen.length - vorXhr

  let seitenOeffnenRief = 0
  XMLHttpRequest.prototype.open = function (...a) { seitenOeffnenRief++; return urOeffnen.apply(this, a) }
  const vor2 = gesehen.length
  const x2 = new XMLHttpRequest()
  x2.open('GET', '/nq/website/memberapi/release/metadata?movieid=4')
  xhrGeladen?.()
  ergebnis.xhrNachher = gesehen.length - vor2
  ergebnis.seitenOeffnenRief = seitenOeffnenRief

  console.log(ergebnis)
  const ok =
    ergebnis.fetchVorher === 1 && ergebnis.fetchNachher === 1 && ergebnis.seitenFetchRief === 1 &&
    ergebnis.xhrVorher === 1 && ergebnis.xhrNachher === 1 && ergebnis.seitenOeffnenRief === 1
  console.log(ok
    ? '\n✓ Beide Pfade: Antwort gesehen UND der Wrapper der Seite läuft'
    : '\n✗ Ein Pfad hängt — genau der Fehler, der NSES-UHX ausgelöst hat')
  process.exit(ok ? 0 : 1)
})()
