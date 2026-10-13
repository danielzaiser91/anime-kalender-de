/**
 * **Das Warten auf die Folgenliste im Netflix-Durchgang** (Auslagerung nach `netflix-erinnern.js`, 13.10.2026).
 *
 * Die Wartelogik stand in `selbstStartenSchritt` (`melder.js`); sie ist unverändert, nur ausgelagert:
 * nach der Frist (20 s) gibt der Durchgang auf und springt weiter, ein Seitenwechsel beginnt neu.
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

console.log('Netflix: Warten auf die Folgenliste')

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(readFileSync(resolve(__dirname, 'netflix-erinnern.js'), 'utf8'), kontext)
const warte = kontext.akNetflixListeWarten
pruefe('Wartefunktion erreichbar', typeof warte === 'function')

/* Spiel: ein Titel, alle Takte eine Sekunde auseinander. */
function spiel(endeNach) {
  const w = { spuren: [], uebersprungen: new Set(), weiter: 0 }
  const tun = { spur: (was) => w.spuren.push(was), uebersprungen: w.uebersprungen, weiter: () => w.weiter++ }
  let wartet = null
  for (let s = 0; s <= endeNach; s++) {
    const ort = { seite: '70177034', reihe: '70177034', durchlauf: { folgen: [], listeFuer: null }, jetzt: 1_000_000 + s * 1000, frist: 20000 }
    wartet = warte(wartet, ort, tun)
  }
  return w
}

const vorFrist = spiel(19)
pruefe('in den ersten 19 s wartet der Durchgang weiter auf die Liste', vorFrist.weiter === 0, vorFrist.weiter)
const nachFrist = spiel(21)
pruefe('nach der Frist (20 s) gibt er auf, einmal', nachFrist.weiter === 1, nachFrist.weiter)
pruefe('… mit der Spur „keine Folgenliste"', nachFrist.spuren.includes('keine Folgenliste'), nachFrist.spuren)
pruefe('… und der Titel gilt als übersprungen', nachFrist.uebersprungen.has('70177034'))
pruefe('ein Seitenwechsel beginnt die Wartezeit neu', warte({ seite: 'a', seit: 0 }, { seite: 'b', jetzt: 99, frist: 20000 }, {}).seit === 99)

const start = /\nasync function selbstStartenSchritt\(\)[\s\S]*?\n\}\n/.exec(readFileSync(resolve(__dirname, 'melder.js'), 'utf8'))?.[0] ?? ''
pruefe('selbstStartenSchritt fragt akNetflixListeWarten', /akNetflixListeWarten\(selbstWartet/.test(start))
pruefe('netflix-erinnern.js lädt im Manifest vor melder.js', (() => {
  const js = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8')).content_scripts.find((c) => c.js.includes('melder.js')).js
  return js.indexOf('netflix-erinnern.js') >= 0 && js.indexOf('netflix-erinnern.js') < js.indexOf('melder.js')
})())

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
