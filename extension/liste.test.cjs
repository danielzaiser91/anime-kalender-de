/**
 * Die Erweiterung darf beim normalen Fernsehen nicht auffallen.
 *
 * Am 22.08.2026 meldete sie „Heroes" — eine amerikanische Serie —, während
 * Daniel dort einfach etwas ansah. Sein Urteil: „die extension stört beim
 * gucken und will ich da nicht sehen."
 *
 * Geprüft wird die Entscheidungslogik, nicht die Anzeige: Erkennt sie einen
 * Titel als gesucht, und schweigt sie bei allem anderen?
 *
 * **Die Prüfliste ist dabei Kulisse, keine Grundlage** — und das war sie bis
 * zum 01.09.2026 nicht. Die Fälle nahmen `Object.keys(liste)[0]`, den ersten
 * echten Eintrag aus `offene-netflix.js`. An dem Tag wurde der letzte Titel
 * gemeldet, die Liste fiel auf null, und zwei Fälle wurden rot: „ein offener
 * Titel gilt als gesucht (undefined = undefined)". Der Deploy stand.
 *
 * Genau dieselbe Falle hatte am 25.08.2026 schon die Prime-Zusicherungen
 * getroffen (siehe CLAUDE.md, „Eine Prüfung, die rot wird, weil die Arbeit
 * erledigt ist, misst das Falsche") — dort behoben, hier stehen geblieben.
 * **Leer ist bei einer Arbeitsliste der Normalfall am Ende.**
 */
const { readFileSync } = require('node:fs')

/** Die echte Liste — nur noch dafür, dass sie sich überhaupt laden lässt. */
const echteListe = (() => {
  const g = {}
  new Function('globalThis', readFileSync(__dirname + '/offene-netflix.js', 'utf8'))(g)
  return g.AK_OFFENE_TITEL
})()

/** Die Kulisse für die Logikfälle: unabhängig vom Tagesstand. */
const liste = {
  '80175351': { titel: 'Kakegurui: Das Leben ist ein Spiel' },
  '81943491': { titel: 'Dragon Ball DAIMA' },
}

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

// Ein Titel, der auf der Liste steht.
stand = { reihe: '80175351' }
pruefe('ein offener Titel gilt als gesucht', istGesucht())

// Eine Zahl statt eines Textes darf nichts ändern.
stand = { reihe: 80175351 }
pruefe('die Kennung wird als Zahl genauso erkannt', istGesucht())

// Kein Titel erkannt.
stand = {}
pruefe('ohne erkannten Titel bleibt es still', !istGesucht())

// Und der Fall, der beim Ladefehler greift: leere Liste heißt schweigen,
// nicht alles melden.
offeneTitel = {}
stand = { reihe: '80175351' }
pruefe('mit leerer Liste schweigt sie ebenfalls', !istGesucht())

// Sword Art Online steht nicht drauf — die Synchro ist belegt.
offeneTitel = liste
stand = { reihe: '70302573' }
pruefe('ein bereits belegter Titel braucht keinen Knopf mehr', !istGesucht())

/*
  Was an der **echten** Datei zusicherbar ist, ohne vom Tagesstand abzuhängen:
  dass sie sich laden lässt und ein Objekt ergibt. Ob null oder hundert Einträge
  darin stehen, ist eine Frage des Datenstands, keine der Logik.
*/
pruefe(
  `die echte Prüfliste lädt (${Object.keys(echteListe ?? {}).length} Einträge)`,
  echteListe !== null && typeof echteListe === 'object',
  echteListe,
)
offeneTitel = echteListe
stand = { reihe: '70136130' }
pruefe('und auch mit ihr gilt „Heroes" nicht als gesucht', !istGesucht())

const fehler = faelle.filter((f) => !f.ok).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Sie meldet nur, wo etwas zu holen ist')
process.exit(fehler ? 1 : 0)
