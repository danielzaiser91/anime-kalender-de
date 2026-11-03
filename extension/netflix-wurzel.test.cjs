/**
 * **Die Erweiterung bleibt bedienbar, wenn Netflix die Seite sperrt** (03.11.2026).
 *
 * Daniel, netflix.com/browse: Tab etwa 30 Minuten inaktiv, danach zeigt Netflix „Wer schaut gerade?"
 * unter unserer Prüfliste — und kein Element der Erweiterung reagierte mehr („✕ nicht bei Netflix —
 * melden", „Bericht laden", das ✕ der Liste, der Einklapp-Knopf). Nach der Profilwahl ging alles wieder.
 * Eine Profilauswahl ist ein Modal: die Seite legt alles außer ihrem Dialog still (`inert`,
 * `pointer-events: none`), und zwar an `<body>` und dessen Kindern — dort hingen Kasten, Liste und Icon.
 *
 * Gemessen werden konnte die Sperre selbst nicht (kein Netflix-Abruf); der Test stellt sie nach und
 * fragt wie ein Browser beim Anklicken: Ist irgendein Vorfahre `inert`, oder ist der erste ausdrückliche
 * `pointer-events`-Wert auf dem Weg nach oben `none`? Echtes `box.js` läuft im Sandkasten, `melder.js`
 * wird am Quelltext gegengelesen (seine Wurzeln gehen über dieselbe Funktion).
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const lies = (n) => readFileSync(resolve(__dirname, n), 'utf8')

console.log('Netflix: Wurzeln der Erweiterung überleben die Sperre der Profilauswahl')

/** Ein Element mit Elternkette — mehr braucht die Trefferfrage nicht. */
function el() {
  const e = {
    parentNode: null,
    kinder: [],
    dataset: {},
    style: {},
    className: '',
    isConnected: true,
    inert: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(k) {
      k.parentNode = e
      e.kinder.push(k)
      return k
    },
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    remove() {},
  }
  return e
}

/** Was ein Klick erreicht: nichts `inert` auf dem Weg nach oben, und `pointer-events` nicht `none`. */
function klickbar(knoten) {
  let wert = null
  for (let k = knoten; k; k = k.parentNode) {
    if (k.inert) return false
    if (wert === null && k.style?.pointerEvents) wert = k.style.pointerEvents
  }
  return wert !== 'none'
}

/** Die Profilauswahl: alles im `<body>` außer ihrem Dialog wird still gelegt. */
function profilauswahlOeffnen(body) {
  const dialog = el()
  body.appendChild(dialog)
  for (const k of body.kinder) if (k !== dialog) k.inert = true
  body.style.pointerEvents = 'none'
  dialog.style.pointerEvents = 'auto'
  return dialog
}

function welt() {
  const html = el()
  const body = el()
  html.appendChild(body)
  const beobachtet = []
  const kontext = {
    location: { hostname: 'www.netflix.com', pathname: '/browse' },
    document: {
      documentElement: html,
      body,
      createElement: el,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: { addEventListener() {}, navigation: { addEventListener() {} } },
    chrome: {
      runtime: { getManifest: () => ({ version: '0.0.0' }) },
      storage: { local: { get: () => ({ then() {} }), set() {} }, onChanged: { addListener() {} } },
    },
    MutationObserver: class {
      observe(ziel, optionen) {
        beobachtet.push({ ziel, optionen })
      }
    },
    requestAnimationFrame: () => 0,
  }
  kontext.window.top = kontext.window
  vm.createContext(kontext)
  vm.runInContext(lies('box.js') + '\nthis.t = { akBox, akIconStarten, icon: () => akIcon }', kontext)
  return { html, body, beobachtet, ...kontext.t }
}

/* Kontrolle: so sähe die alte Bauweise aus — eine Wurzel am body ist unter der Sperre tot. */
{
  const w = welt()
  const alt = el()
  w.body.appendChild(alt)
  profilauswahlOeffnen(w.body)
  pruefe('Kontrolle: eine Wurzel am body ist unter der Profilauswahl nicht anklickbar', klickbar(alt) === false)
}

{
  const w = welt()
  const kasten = w.akBox('ak-netflix-kasten', '/browse')
  w.akIconStarten()
  const icon = w.icon()
  const dialog = profilauswahlOeffnen(w.body)
  pruefe('der Dialog der Seite bleibt anklickbar (Modell stimmt)', klickbar(dialog) === true)
  pruefe('der Kasten hängt an <html>', kasten.parentNode === w.html, kasten.parentNode === w.body ? 'body' : '?')
  pruefe('der Kasten ist unter der Profilauswahl anklickbar', klickbar(kasten) === true)
  pruefe('das Einklapp-Icon hängt an <html>', icon.parentNode === w.html)
  pruefe('das Einklapp-Icon ist unter der Profilauswahl anklickbar', klickbar(icon) === true)
  pruefe(
    'ein Kasten, der erst während der Sperre entsteht, hängt ebenfalls an <html>',
    w.akBox('ak-disney-kasten', '/browse').parentNode === w.html,
  )
  pruefe(
    'die Sichtbarkeit des Icons schaut auf <html>, nicht auf den body',
    w.beobachtet.some((b) => b.ziel === w.html && b.optionen?.childList) && !w.beobachtet.some((b) => b.ziel === w.body),
    w.beobachtet.map((b) => (b.ziel === w.html ? 'html' : b.ziel === w.body ? 'body' : '?')),
  )
}

/* melder.js: Schutzfläche und Prüfliste gehen über dieselbe Funktion; am body bleibt nur der Download-Link. */
{
  const melder = lies('melder.js')
  const box = lies('box.js')
  const roh = (t) => (t.match(/document\.body\.appendChild\(/g) ?? []).length
  pruefe('box.js hängt nichts mehr am body', roh(box) === 0, roh(box))
  pruefe('melder.js hängt am body nur den Download-Link (`a`)', roh(melder) === 1 && /document\.body\.appendChild\(a\)/.test(melder), roh(melder))
  pruefe('die Schutzfläche geht über akWurzelAnhaengen', /akWurzelAnhaengen\(schutzflaeche\)/.test(melder))
  pruefe('die Prüfliste geht über akWurzelAnhaengen', /akWurzelAnhaengen\(dialog\)/.test(melder))
  pruefe(
    'der Prüflisten-Knopf wird im Dokument gesucht, nicht im body',
    /!document\.contains\(uebersichtKnopf\)/.test(melder) && !/document\.body\.contains\(uebersichtKnopf\)/.test(melder),
  )
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Sperre der Profilauswahl halten.')
