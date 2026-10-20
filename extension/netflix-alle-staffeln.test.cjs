/**
 * **„Alle Folgen anzeigen“: „gemeldet“ heißt gemeldet, nicht „nicht auf der Prüfliste“.**
 *
 * Daniel am 20.10.2026: Edgerunners (2 Staffeln, nur Staffel 1 gemeldet, Titel unter dieser
 * Netflix-Kennung nicht auf der Prüfliste) zeigte „✓ 2 Staffeln gemeldet“. Eingeführt in 4.22.1
 * (24.09.2026) ohne Fall für „nicht auf der Prüfliste“.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
const modul = readFileSync(resolve(__dirname, 'netflix-alle-staffeln.js'), 'utf8')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Alle Staffeln: Beschriftung bei nichts offen')

const schneide = (name) => {
  const i = quelle.search(new RegExp(`\\n(?:async )?function ${name}\\(`))
  if (i < 0) return ''
  const j = quelle.indexOf('\n}\n', i + 1)
  return quelle.slice(i + 1, j + 3)
}

/* 1. Der Baustein allein. */
const baustein = () => {
  const k = { globalThis: {} }
  k.globalThis = k
  vm.createContext(k)
  vm.runInContext(modul, k)
  return k.akAlleStaffelnFertig
}
const bausteinFn = baustein()
const fertig = (gruppen, ids) => bausteinFn(new Map(gruppen.map((x, i) => [i, x])), new Map(ids.map((i) => [String(i), 1])))
const g = (...ids) => ids.map((videoId) => ({ videoId }))
const meldung = (...ids) => ids
pruefe('beide gemeldet → „2 Staffeln gemeldet“', fertig([g(1, 2), g(3)], meldung(1, 2, 3)).text === 'Alle Staffeln · ✓ 2 Staffeln gemeldet')
pruefe('eine von zwei gemeldet → „1 von 2“', fertig([g(1, 2), g(3)], meldung(1, 2)).text === 'Alle Staffeln · ✓ 1 von 2 Staffeln gemeldet')
pruefe('zwei von drei gemeldet → „2 von 3“ (Zähler ≠ Nenner)', fertig([g(1), g(2), g(3)], meldung(1, 3)).text === 'Alle Staffeln · ✓ 2 von 3 Staffeln gemeldet')
pruefe('keine gemeldet → „nichts offen“', fertig([g(1), g(2)], meldung()).text === 'Alle Staffeln · ✓ nichts offen')
pruefe('eine Folge fehlt → Staffel zählt nicht', fertig([g(1, 2), g(3)], meldung(1, 3)).text === 'Alle Staffeln · ✓ 1 von 2 Staffeln gemeldet')
pruefe('leere Gruppe zählt nicht als gemeldet', fertig([[], g(3)], meldung(3)).text === 'Alle Staffeln · ✓ 1 von 2 Staffeln gemeldet')
pruefe('eine einzige Staffel, gemeldet → „1 Staffel gemeldet“', fertig([g(1)], meldung(1)).text === 'Alle Staffeln · ✓ 1 Staffel gemeldet')

pruefe(
  'im Lauf gemeldete Folgen (Set) zählen mit',
  bausteinFn(new Map([[0, g(1)], [1, g(2)]]), undefined, new Set([1])).text === 'Alle Staffeln · ✓ 1 von 2 Staffeln gemeldet',
)

/* 2. Der Knopf selbst, mit den echten Funktionen aus melder.js. */
const code = ['durchlaufKnopfZeigen', 'offeneGruppen', 'gruppeOffen', 'folgenJeStaffel'].map(schneide)
pruefe('Funktionen des Knopfes auffindbar', code.every(Boolean))

function knopfText({ offeneStaffeln, gemeldet, imLauf = [] }) {
  const knopf = { textContent: '', title: '', disabled: false, classList: { remove() {}, toggle() {}, add() {} } }
  const folgen = [
    { videoId: 1, seasonId: 'a', nummer: 1 },
    { videoId: 2, seasonId: 'a', nummer: 2 },
    { videoId: 3, seasonId: 'b', nummer: 1 },
  ]
  const kontext = {
    DURCHLAUF: { folgen, alleFolgen: folgen, knopf, laeuft: false, mehrfach: null, gemeldet: new Set(imLauf) },
    MELDUNGEN: new Map([['1', { jeFolge: new Map(gemeldet.map((id) => [String(id), { am: '2026-10-20' }])) }]]),
    offeneTitel: offeneStaffeln ? { 1: { titel: 'T', staffeln: [{ nr: 1, offen: true, folgen: 2 }] } } : {},
    folgenFuerFilmErgaenzen: () => {},
    imPlayer: () => false,
    durchlaufOffen: () => [],
    alleStaffelnAnsicht: () => true,
    gemeinteReihe: () => 1,
    ergebnis: null,
  }
  kontext.globalThis = kontext
  vm.createContext(kontext)
  vm.runInContext(modul, kontext)
  vm.runInContext(`${code.join('\n\n')}\ndurchlaufKnopfZeigen()`, kontext)
  return knopf
}
let k
try {
  k = knopfText({ offeneStaffeln: false, gemeldet: [1, 2] })
} catch (e) {
  pruefe('Knopf läuft in der Kulisse', false, String(e))
}
if (k) {
  pruefe('Edgerunners: nicht auf der Prüfliste, eine von zwei gemeldet → „1 von 2“', k.textContent === 'Alle Staffeln · ✓ 1 von 2 Staffeln gemeldet', k.textContent)
  pruefe('… und der Knopf bleibt gesperrt', k.disabled === true)
  k = knopfText({ offeneStaffeln: false, gemeldet: [] })
  pruefe('nicht auf der Prüfliste, nichts gemeldet → „nichts offen“', k.textContent === 'Alle Staffeln · ✓ nichts offen', k.textContent)
  k = knopfText({ offeneStaffeln: false, gemeldet: [1, 2, 3] })
  pruefe('alles gemeldet → „2 Staffeln gemeldet“', k.textContent === 'Alle Staffeln · ✓ 2 Staffeln gemeldet', k.textContent)
  pruefe('… mit dem Hinweis „Alles gemeldet.“', k.title === 'Alles gemeldet.', k.title)
  k = knopfText({ offeneStaffeln: false, gemeldet: [1, 2], imLauf: [3] })
  pruefe('im Durchgang gemeldet (nicht in MELDUNGEN) zählt', k.textContent === 'Alle Staffeln · ✓ 2 Staffeln gemeldet', k.textContent)
  k = knopfText({ offeneStaffeln: false, gemeldet: [1, 2] })
  pruefe('Teilmeldung: Hinweis nennt die Prüfliste', /Prüfliste/.test(k.title), k.title)
  k = knopfText({ offeneStaffeln: true, gemeldet: [] })
  pruefe('offene Staffel → Prüf-Beschriftung unverändert', k.textContent === 'Alle Staffeln · ▶ 4 Folgen prüfen (2 von 2 Staffeln offen)', k.textContent)
}

if (fehler.length) {
  console.log(`\n${fehler.length} Fehler`)
  process.exit(1)
}
console.log('\nAlle Staffeln: Beschriftung geprüft')
