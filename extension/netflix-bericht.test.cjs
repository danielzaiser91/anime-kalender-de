/**
 * Bausteine des Netflix-Berichts (`netflix-bericht.js`) im Sandkasten: dieselben Antworten, die
 * `nfBericht()` vor der Auslagerung aus `melder.js` gab (13.10.2026).
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function bericht(el) {
  const kontext = {
    Math,
    Number,
    String,
    Map,
    Set,
    Array,
    Object,
    JSON,
    window: { innerWidth: 1200, innerHeight: 800 },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', zIndex: '9', position: 'fixed', backgroundColor: 'red' }),
    document: {
      querySelector: (wahl) => (wahl === '.ak-uebersicht' ? el : null),
      elementFromPoint: () => el,
    },
  }
  kontext.globalThis = kontext
  vm.runInNewContext(readFileSync(__dirname + '/netflix-bericht.js', 'utf8'), kontext)
  return kontext.akNetflixBericht
}

console.log('Netflix-Bericht im Sandkasten\n')
{
  const b = bericht(null)
  pruefe('Prüfliste nicht im DOM: { imDom: false }', JSON.stringify(b.uebersicht()) === '{"imDom":false}')
  const gruppen = new Map([
    ['s1', [{ nummer: 2, titel: 'B' }, { nummer: 1, titel: 'A' }]],
    ['s2', []],
  ])
  const g = b.geladen(gruppen)
  pruefe('geladen: Anzahl, von/bis und erster Titel je Staffel', JSON.stringify(g[0]) === '{"seasonId":"s1","anzahl":2,"von":1,"bis":2,"ersterTitel":"B"}', g[0])
  pruefe('geladen: leere Staffel ohne Nummern', g[1].von === null && g[1].bis === null && g[1].ersterTitel === null, g[1])
}
{
  const el = {
    textContent: 'Anime-Kalender 2',
    className: 'ak-uebersicht',
    getBoundingClientRect: () => ({ top: 10.4, left: 20.6, width: 100.2, height: 30 }),
  }
  const u = bericht(el).uebersicht()
  pruefe('Prüfliste im DOM: Text, gerundete Lage, Fenster', u.imDom === true && u.text === 'Anime-Kalender 2' && u.lage.top === 10 && u.lage.left === 21 && u.lage.breite === 100 && u.fenster.breite === 1200, u)
  pruefe('… und wer oben liegt: sie selbst', u.obenLiegt.istErSelbst === true && u.stil.position === 'fixed', u.obenLiegt)
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
