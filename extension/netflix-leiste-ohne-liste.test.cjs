/**
 * Netflix-Leiste „Folge prüfen“ ohne Folgenliste (Rest aus PR 4190, Punkt 4): bleibt sichtbar und abgeblendet, wie der Melde-Knopf.
 * Die echte `melder.js` im Sandkasten (Aufruf in `durchlaufKnopfZeigen`), dazu die reine Entscheidung mit ihren Gegenfällen.
 */
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')
const { baueUmgebung, suche, alleElemente } =require('./test-melder-sandkasten.cjs')

const tick = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r))
}

async function seite(pfad) {
  const { umgebung, body } = baueUmgebung(pfad, '', {})
  umgebung.AbortController = AbortController
  umgebung.setTimeout = (fn) => { if (typeof fn === 'function') setImmediate(fn); return 0 }
  umgebung.history = { pushState() {}, replaceState() {} }
  umgebung.PopStateEvent = class { constructor(t) { this.type = t } }
  umgebung.fetch = async () => ({ ok: true, json: async () => ({}), text: async () => '' })
  const kontext = vm.createContext(umgebung)
  ladeSkripte(kontext, skripteBis('melder.js'))
  await tick()
  vm.runInContext('durchlaufKnopfZeigen()', kontext)
  await tick()
  return { body, im: (code) => vm.runInContext(code, kontext) }
}

;(async () => {
  /* Titelseite ohne Folgenliste: Leiste da, Knopf abgeblendet mit Grund, „alle“ versteckt. */
  const titel = await seite('/title/80000001')
  const leiste = suche(titel.body, 'ak-durchlauf-leiste')
  assert.ok(leiste, 'Leiste bleibt auf einer Titelseite ohne Folgenliste')
  assert.equal(titel.im('DURCHLAUF.knopf.disabled'), true)
  assert.match(titel.im('DURCHLAUF.knopf.textContent'), /^Keine Folgenliste/)
  assert.equal(titel.im('DURCHLAUF.nochmalKnopf.hidden'), true)
  assert.equal(titel.im('DURCHLAUF.knopf.classList.contains("ak-fertig")'), false)
  assert.equal(titel.im('schutzflaeche'), null, 'keine Schutzfläche ohne Lauf (der Sandkasten räumt Elemente nie aus dem body)')
  /* Zweiter Takt: keine zweite Leiste. */
  titel.im('durchlaufKnopfZeigen()')
  /* Der Sandkasten setzt kein `parentElement`; derselbe Knoten darf deshalb mehrfach hängen, aber nie ein zweiter gebaut werden. */
  assert.equal(new Set(alleElemente(titel.body).filter((e) => String(e.className).includes('ak-durchlauf-leiste'))).size, 1, 'nur eine Leiste')
  /* Im Player räumt der Takt die Leiste weiter ab. */
  const player = await seite('/watch/80000001')
  assert.ok(!player.im('DURCHLAUF.leiste'), 'im Player keine Leiste ohne Lauf')

  /* Die Entscheidung: nur ohne Folgen, ohne Lauf, außerhalb des Players und der Alle-Staffeln-Ansicht. */
  const k = { globalThis: null }
  k.globalThis = k
  vm.createContext(k)
  vm.runInContext(readFileSync(resolve(__dirname, 'netflix-durchgang-steuerung.js'), 'utf8'), k)
  const fall = (d, anderswo = false) => {
    let gebaut = 0
    const D = { laeuft: false, mehrfach: null, folgen: [], knopf: null, leiste: null, nochmalKnopf: null, ...d }
    const el = () => ({ hidden: false, disabled: false, textContent: '', title: '', parentElement: null, classList: { remove() {} }, appendChild() {} })
    const ergebnis = k.akNetflixLeisteOhneListe(D, anderswo, () => { gebaut++; D.knopf = el(); D.leiste = el() }, () => null)
    return { ergebnis, gebaut, D }
  }
  assert.equal(fall({}).ergebnis, true, 'Grundfall')
  assert.equal(fall({}).gebaut, 1)
  assert.equal(fall({ folgen: [{ nummer: 1 }] }).ergebnis, false, 'mit Folgenliste zeichnet der Rest')
  assert.equal(fall({ folgen: [{ nummer: 1 }] }).gebaut, 0)
  assert.equal(fall({ laeuft: true }).ergebnis, false, 'im Lauf')
  assert.equal(fall({ mehrfach: { gesamt: 2 } }).ergebnis, false, 'zwischen zwei Staffeln')
  assert.equal(fall({}, true).ergebnis, false, 'im Player oder in der Alle-Staffeln-Ansicht')
  assert.equal(fall({}, true).gebaut, 0)

  console.log('netflix-leiste-ohne-liste.test: ok')
})().catch((e) => { console.error(e); process.exit(1) })
