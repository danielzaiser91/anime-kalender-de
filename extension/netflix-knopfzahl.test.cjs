/**
 * Netflix: die Knopfzahl ändert sich nur mit einem Eintrag im Zustandsprotokoll (Issue 4071, Schnitt 3, Befund 8).
 *
 * Anlass: „Anime-Kalender 3“ wurde ohne Seitenwechsel zu „5“, im Protokoll stand nichts. Jetzt zeichnet `netflix-protokoll.js` jede Änderung der
 * Zahl auf: Auslöser (Titel kamen oder gingen, Merkliste, gemeldet), Titel, Zahl vorher und nachher.
 *
 * Geprüft mit der echten `offeneTitelZahl` aus `melder.js` und dem echten `netflix-protokoll.js`; die Zahl am Knopf kommt aus einer Attrappe von
 * `uebersichtZeigen`, die wie das Original `offeneTitelZahl()` anzeigt.
 *
 * Aufruf: `node extension/netflix-knopfzahl.test.cjs`
 */
const vm = require('node:vm')
const { lies, funktion } = require('./test-durchgang-welt.cjs')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

/** Eine Seite mit Prüfliste (Kennung → Eintrag), Merkliste und Worker-Stand als Mengen; Protokoll und Knopf als Attrappe. */
function seiteBauen() {
  const welt = { liste: {}, zurueck: new Set(), fertig: new Set(), protokoll: [], knopf: [] }
  const k = {
    console: { log() {} },
    window: { addEventListener() {} },
    location: { pathname: '/title/1' },
    document: { querySelector: () => null },
    akProtokoll: (art, daten) => welt.protokoll.push({ art, ...daten }),
  }
  k.globalThis = k
  k.akKontext = { version: () => 'test' }
  vm.createContext(k)
  vm.runInContext(
    `var DURCHLAUF = {}
var offeneTitel = {}
var selbstUebersprungen = { zurueckgestellt: (id) => welt.zurueck.has(id), nichtOffen: (id) => welt.zurueck.has(id) || welt.fertig.has(id) }
function fertig(id) { return welt.fertig.has(id) }
${funktion('offeneTitelZahl')}
function uebersichtZeigen() { welt.knopf.push(offeneTitelZahl()) }`,
    Object.assign(k, { welt }),
  )
  vm.runInContext('offeneTitel = welt.liste', k)
  vm.runInContext(lies('netflix-protokoll.js'), k)
  const zeigen = () => vm.runInContext('uebersichtZeigen()', k)
  const eintraege = () => welt.protokoll.filter((e) => e.art === 'knopfzahl')
  return { welt, zeigen, eintraege }
}

function teilAusloeser() {
  const s = seiteBauen()
  for (const id of ['1', '2', '3', '4', '5']) s.welt.liste[id] = {}
  s.zeigen()
  pruefe('Start: die erste Zahl steht im Protokoll (vorher leer)', s.eintraege().length === 1 && s.eintraege()[0].nachher === 5 && s.eintraege()[0].vorher === null, s.eintraege())
  s.zeigen()
  pruefe('Gleiche Zahl: kein neuer Eintrag', s.eintraege().length === 1, s.eintraege())
  s.welt.zurueck.add('1')
  s.zeigen()
  const m = s.eintraege().at(-1)
  pruefe('Merkliste: Art „merkliste“, Titel 1, 5 → 4', m.ausloeser === 'merkliste' && m.ids.join() === '1' && m.vorher === 5 && m.nachher === 4, m)
  s.welt.fertig.add('2')
  s.zeigen()
  const g = s.eintraege().at(-1)
  pruefe('Gemeldet: Art „gemeldet“, Titel 2, 4 → 3', g.ausloeser === 'gemeldet' && g.ids.join() === '2' && g.vorher === 4 && g.nachher === 3, g)
  s.welt.liste['6'] = {}
  s.zeigen()
  const l = s.eintraege().at(-1)
  pruefe('Liste: ein neuer Titel kommt, Art „liste“, 3 → 4', l.ausloeser === 'liste' && l.ids.join() === '6' && l.vorher === 3 && l.nachher === 4, l)
  s.welt.zurueck.delete('1')
  s.welt.fertig.add('3')
  s.zeigen()
  const z = s.eintraege().at(-1)
  pruefe('Zwei Auslöser, die sich aufheben (Zahl 4 → 4): kein Eintrag', s.eintraege().length === 4 && z.ausloeser === 'liste', [s.eintraege().length, z])
  s.welt.zurueck.add('4')
  s.zeigen()
  const n = s.eintraege().at(-1)
  pruefe('Danach zählt nur, was neu ist: Titel 4 (nicht die beiden aufgehobenen), 4 → 3', n.ausloeser === 'merkliste' && n.ids.join() === '4' && n.vorher === 4 && n.nachher === 3, n)
}

/** Ein Zufallsweg über Liste, Merkliste und Worker-Stand: jede Änderung der angezeigten Zahl hat genau einen Eintrag mit passendem vorher/nachher. */
function teilNieOhneEintrag() {
  const s = seiteBauen()
  let r = 12345
  const zufall = (n) => (r = (r * 1103515245 + 12345) % 2147483648) % n
  const ids = Array.from({ length: 9 }, (_, i) => String(i + 1))
  for (const id of ids.slice(0, 6)) s.welt.liste[id] = {}
  s.zeigen()
  let angezeigt = s.welt.knopf.at(-1)
  let aenderungen = 0
  let ohne = 0
  for (let schritt = 0; schritt < 300; schritt++) {
    const id = ids[zufall(ids.length)]
    const wahl = zufall(3)
    const menge = wahl === 0 ? s.welt.zurueck : s.welt.fertig
    if (wahl === 2) {
      if (id in s.welt.liste) delete s.welt.liste[id]
      else s.welt.liste[id] = {}
    } else if (menge.has(id)) menge.delete(id)
    else menge.add(id)
    const vorher = s.eintraege().length
    s.zeigen()
    const jetzt = s.welt.knopf.at(-1)
    if (jetzt !== angezeigt) {
      aenderungen++
      const e = s.eintraege().at(-1)
      if (s.eintraege().length !== vorher + 1 || e.vorher !== angezeigt || e.nachher !== jetzt) ohne++
    } else if (s.eintraege().length !== vorher) ohne++
    angezeigt = jetzt
  }
  pruefe('Zufallsweg (300 Schritte): jede Änderung der Zahl hat genau einen passenden Eintrag, sonst keiner', aenderungen > 30 && ohne === 0, { aenderungen, ohne })
}

console.log('Netflix: Knopfzahl nur mit Protokolleintrag (4071, Schnitt 3)')
teilAusloeser()
teilNieOhneEintrag()
if (fehler.length) {
  console.log(`\n${fehler.length} Fall/Fälle rot`)
  process.exit(1)
}
console.log('\nKnopfzahl: alle Fälle grün')
