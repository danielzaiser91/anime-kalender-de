/**
 * Der Zielmerker von Disney+ (`zielFuer` in `disney.js`) im Sandkasten.
 *
 * Der Fall vom 28.09.2026: Der Durchgang öffnete „Mission: Yozakura Family Season 2", Disney+ leitete
 * auf die Startseite um, Daniel öffnete von Hand einen anderen Titel — und dessen 25 Folgen wurden
 * unter Yozakura gemeldet, weil der Merker zehn Minuten für jede Seite galt. Gegenprobe: die echte
 * Umleitung (`/series/…` → `/browse/entity-…`) muss den Titel weiter kennen.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = readFileSync(__dirname + '/disney.js', 'utf8')
const von = quelle.indexOf('  function zielFuer(jetzt) {')
const bis = quelle.indexOf('  function istFehlerseite() {')
const kennungVon = quelle.indexOf('  function kennung(url) {')
const kennungBis = quelle.indexOf('  /**', kennungVon)

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
console.log('Disney+-Zielmerker im Sandkasten\n')
pruefe('zielFuer und kennung in disney.js gefunden', von > 0 && bis > von && kennungVon > 0 && kennungBis > kennungVon)

const YOZAKURA = { titel: 'Mission: Yozakura Family Season 2', url: 'https://www.disneyplus.com/de-de/browse/entity-ac689bea-f955-4d95-8693-7b87b5a309cb' }
const BRIGHT = { titel: 'Bright Sun: Dark Shadows', url: 'https://www.disneyplus.com/de-de/series/summer-time-rendering/3AHbeFV7Lqvn' }

function welt() {
  const m = new Map()
  const w = { uhr: 1_000_000 }
  const kontext = {
    JSON,
    Date: class extends Date {
      static now() {
        return w.uhr
      }
    },
    sessionStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) },
    ZIEL_SCHLUESSEL: 'ak-disney-ziel',
    liste: { 'ac689bea-f955-4d95-8693-7b87b5a309cb': YOZAKURA, '3AHbeFV7Lqvn': BRIGHT },
  }
  vm.runInNewContext(quelle.slice(kennungVon, kennungBis) + quelle.slice(von, bis) + '\nthis.zielFuer = zielFuer; this.kennung = kennung', kontext)
  w.merke = (id) => m.set('ak-disney-ziel', JSON.stringify({ id, zeit: w.uhr }))
  w.ziel = (url) => kontext.zielFuer(kontext.kennung(url))?.titel ?? null
  return w
}

{
  const w = welt()
  w.merke('ac689bea-f955-4d95-8693-7b87b5a309cb')
  pruefe('Eigene Adresse des Titels → der Titel', w.ziel(YOZAKURA.url) === YOZAKURA.titel)
  w.uhr += 2000
  pruefe('Umleitung auf die Startseite → kein Titel', w.ziel('https://www.disneyplus.com/de-de/home') === null)
  w.uhr += 5000
  const fremd = 'https://www.disneyplus.com/de-de/browse/entity-11111111-2222-3333-4444-555555555555'
  pruefe('Danach von Hand geöffneter Titel → NICHT Yozakura (Fall 28.09.2026)', w.ziel(fremd) === null, w.ziel(fremd))
}
{
  const w = welt()
  w.merke('3AHbeFV7Lqvn')
  pruefe('Bright Sun: eigene Adresse', w.ziel(BRIGHT.url) === BRIGHT.titel)
  w.uhr += 3000
  const umgeleitet = 'https://www.disneyplus.com/de-de/browse/entity-ad803e91-0000-4000-8000-000000000000'
  pruefe('Bright Sun: Umleitung in den ersten 20 s → derselbe Titel', w.ziel(umgeleitet) === BRIGHT.titel)
  w.uhr += 60_000
  pruefe('Bright Sun: dieselbe umgeleitete Seite später → weiter derselbe Titel', w.ziel(umgeleitet) === BRIGHT.titel)
  const fremd = 'https://www.disneyplus.com/de-de/browse/entity-99999999-2222-3333-4444-555555555555'
  pruefe('Bright Sun: danach eine andere Seite → kein Titel', w.ziel(fremd) === null)
}
{
  const w = welt()
  w.merke('3AHbeFV7Lqvn')
  w.uhr += 30_000
  const spaet = 'https://www.disneyplus.com/de-de/browse/entity-77777777-2222-3333-4444-555555555555'
  pruefe('Andere Seite erst nach 20 s → kein Titel', w.ziel(spaet) === null)
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
