/**
 * `akKontext.meldungKopf()` liefert Version und Seite für jeden Meldungsrumpf (20.11.2026; Anlass: Prime sendete keine Version).
 * Geprüft mit dem echten `kontext.js` (Kulisse: `chrome.runtime.getManifest`, `location`) und einem echten Prime-Rumpf
 * (`nichtBeiPrimeMelden` aus `amazon.js`), der mit diesem Kontext sendet. Quelltext-Wächter über alle Rümpfe:
 * `meldung-version-alle.test.cjs`.
 */
const vm = require('node:vm')
const { lies, ausschnitt } = require('./melde-geruest.cjs')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}

function kontextEcht(chrome, href) {
  const welt = vm.createContext({ chrome, location: { href } })
  vm.runInContext(lies('kontext.js'), welt)
  return welt.akKontext
}
const lebendig = (version) => ({ runtime: { id: 'x', getManifest: () => ({ version }) }, storage: { sync: { get: async () => ({ token: 'tok' }) } } })

function kopf() {
  console.log('kontext.js: meldungKopf()')
  const k = kontextEcht(lebendig('7.8.9'), 'https://www.amazon.de/dp/B0KOPF0001?ref_=x#a')
  const g = k.meldungKopf()
  pruefe('Version aus dem Manifest, Seite ohne Suchteil und Anker', g.version === '7.8.9' && g.seitenAdresse === 'https://www.amazon.de/dp/B0KOPF0001', g)
  const tot = kontextEcht({ runtime: {} }, 'https://x.test/a?b#c').meldungKopf()
  pruefe('toter Kontext: Version null, Seite bleibt', tot.version === null && tot.seitenAdresse === 'https://x.test/a', tot)
}

async function primeRumpf() {
  console.log('Prime: „nicht bei Prime“ sendet Version und Seite')
  const funktion = ausschnitt(lies('amazon.js'), 'async function nichtBeiPrimeMelden(auftrag, befund, knopf, nachher) {', '\n  }\n')
  pruefe('Funktion im Quelltext gefunden', funktion !== '', funktion.length)
  const gesendet = []
  const welt = {
    globalThis: { akKontext: kontextEcht(lebendig('7.8.9'), 'https://www.amazon.de/dp/B0KOPF0002?x=1') },
    WORKER: 'https://worker.test/pruefung',
    fetch: async (url, init) => (gesendet.push(JSON.parse(init.body)), { ok: true }),
    suchAbhaken: async () => {},
    uebersichtZeichnen: () => {},
  }
  const lauf = new Function(...Object.keys(welt), `return async function nichtBeiPrimeMelden(auftrag, befund, knopf, nachher) {${funktion}`)(...Object.values(welt))
  await lauf({ suchUrl: 'https://www.amazon.de/s?k=Kopf', titel: 'Kopf' }, { art: 'liste' }, { classList: { add() {} } }, null)
  const b = gesendet[0]
  pruefe('genau eine Meldung mit version und seitenAdresse', gesendet.length === 1 && b.version === '7.8.9' && b.seitenAdresse === 'https://www.amazon.de/dp/B0KOPF0002', gesendet)
}

async function lauf() {
  kopf()
  await primeRumpf()
  console.log(`meldung-kopf.test.cjs — ${faelle.length} Zusicherungen`)
  process.exit(faelle.some((ok) => !ok) ? 1 : 0)
}
lauf()
