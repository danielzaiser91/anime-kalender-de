/**
 * Die Erweiterung darf beim normalen Fernsehen nicht auffallen.
 *
 * Am 22.08.2026 meldete sie „Heroes" — eine amerikanische Serie —, während
 * Daniel dort einfach etwas ansah. Sein Urteil: „die extension stört beim
 * gucken und will ich da nicht sehen."
 *
 * Geprüft wird die Entscheidungslogik, nicht die Anzeige: Erkennt sie einen
 * Titel als gesucht, und schweigt sie bei allem anderen?
 */
const { readFileSync } = require('node:fs')
const liste = (() => { const g = {}; new Function('globalThis', readFileSync(__dirname + '/offene-netflix.js', 'utf8'))(g); return g.AK_OFFENE_TITEL })()

let stand = {}
let offeneTitel = liste
function istGesucht() {
  return Boolean(stand.reihe && offeneTitel && offeneTitel[String(stand.reihe)] !== undefined)
}

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push({ name, ok })
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

// „Heroes" — der reale Fehlschlag.
stand = { reihe: '70136130' }
pruefe('„Heroes" gilt nicht als gesucht', !istGesucht())

// Ein Titel, der wirklich auf der Liste steht.
const ersterOffener = Object.keys(liste)[0]
stand = { reihe: ersterOffener }
pruefe(`ein offener Titel gilt als gesucht (${ersterOffener} = ${liste[ersterOffener]})`, istGesucht())

// Eine Zahl statt eines Textes darf nichts ändern.
stand = { reihe: Number(ersterOffener) }
pruefe('die Kennung wird als Zahl genauso erkannt', istGesucht())

// Kein Titel erkannt.
stand = {}
pruefe('ohne erkannten Titel bleibt es still', !istGesucht())

// Und der Fall, der beim Ladefehler greift: leere Liste heißt schweigen,
// nicht alles melden.
offeneTitel = {}
stand = { reihe: ersterOffener }
pruefe('mit leerer Liste schweigt sie ebenfalls', !istGesucht())

// Sword Art Online steht nicht mehr drauf — die Synchro ist belegt.
offeneTitel = liste
stand = { reihe: '70302573' }
pruefe('ein bereits belegter Titel braucht keinen Knopf mehr', !istGesucht())

const fehler = faelle.filter((f) => !f.ok).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Sie meldet nur, wo etwas zu holen ist')
process.exit(fehler ? 1 : 0)
