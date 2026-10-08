/**
 * Auf der Wiedergabeseite ist der Kasten weg (Daniel, 08.10.2026, Disney+).
 * Prüft die URL-Muster und dass ein SPA-Wechsel die Marke nachzieht.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen zum Ausblenden des Kastens im Player (08.10.2026)\n')

const marken = new Set()
const loeschen = []
const ort = { hostname: 'www.disneyplus.com', pathname: '/de-de/browse/entity-abc12345' }
let beiWechsel = null
const kontext = {
  location: ort,
  document: {
    documentElement: {
      classList: {
        toggle: (k, an) => (an ? marken.add(k) : marken.delete(k)),
      },
    },
  },
  window: { addEventListener: () => {}, navigation: { addEventListener: (art, f) => art === 'currententrychange' && (beiWechsel = f) } },
}
vm.createContext(kontext)
vm.runInContext(readFileSync(resolve(__dirname, 'box.js'), 'utf8') + '\nthis.akPlayerSeite = akPlayerSeite', kontext)

const faelle = [
  ['www.disneyplus.com', '/de-de/play/0f1e2d3c-aaaa-bbbb-cccc-1234567890ab', true],
  ['www.disneyplus.com', '/play/0f1e2d3c', true],
  ['www.disneyplus.com', '/de-de/browse/entity-0f1e2d3c', false],
  ['www.disneyplus.com', '/de-de/play-along/x', false],
  ['www.netflix.com', '/watch/81670593', true],
  ['www.netflix.com', '/title/81670593', false],
  ['www.amazon.de', '/gp/video/detail/B0H1R24SVB', false],
  ['www.amazon.de', '/watch/123', false],
]
for (const [host, pfad, soll] of faelle) pruefe(`${host}${pfad} -> ${soll ? 'ausgeblendet' : 'sichtbar'}`, kontext.akPlayerSeite(host, pfad) === soll)

pruefe('Start auf Detailseite: keine Marke', !marken.has('ak-im-player'))
pruefe('Navigation-Beobachter ist eingehängt', typeof beiWechsel === 'function')
ort.pathname = '/de-de/play/0f1e2d3c-aaaa-bbbb-cccc-1234567890ab'
beiWechsel()
pruefe('Wechsel in den Player setzt die Marke', marken.has('ak-im-player'))
ort.pathname = '/de-de/browse/entity-abc12345'
beiWechsel()
pruefe('Zurück zur Detailseite nimmt die Marke weg', !marken.has('ak-im-player'))

const css = readFileSync(resolve(__dirname, 'melder.css'), 'utf8')
pruefe('CSS blendet .ak-box im Player aus, außer im Durchgang', /html\.ak-im-player:not\(\.ak-durchgang\) \.ak-box\s*\{\s*display: none !important/.test(css))
const melder = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
pruefe('Netflix setzt/entfernt ak-durchgang', melder.includes("classList.add('ak-durchgang')") && melder.includes("classList.remove('ak-durchgang')"))

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlles grün.')
