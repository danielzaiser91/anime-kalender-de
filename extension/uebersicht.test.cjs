/**
 * Die Übersicht: erscheint sie zur richtigen Zeit, und stimmt, was sie sagt?
 *
 * Daniels Auftrag vom 22.08.2026: Beim Fernsehen nichts, auf den Übersichts-
 * und Stöberseiten ein Knopf mit der Zahl der offenen Titel, dahinter eine
 * Liste mit Verweisen und den Folgen, die anzuklicken sind.
 */
const { readFileSync } = require('node:fs')
const quelle = readFileSync(__dirname + '/melder.js', 'utf8')
const liste = JSON.parse(readFileSync(__dirname + '/offene-netflix.json', 'utf8'))

// Die drei Funktionen aus der Quelle holen, statt sie hier nachzubauen — eine
// zweite Fassung liefe unweigerlich auseinander.
const teile = ['function imPlayer', 'function folgenKuerzel', 'function empfohleneFolgen', 'function istErledigt']
let code = ''
for (const t of teile) {
  const von = quelle.indexOf(t)
  if (von < 0) { console.error('nicht gefunden: ' + t); process.exit(1) }
  const bis = quelle.indexOf('\n}\n', von) + 3
  code += quelle.slice(von, bis) + '\n'
}
let location = { pathname: '/' }
let erledigt = {}
eval(code)

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

location = { pathname: '/watch/70302573' }
pruefe('im Player gilt die Seite als Player', imPlayer())
for (const pfad of ['/', '/browse', '/title/70302573', '/latest', '/search?q=x']) {
  location = { pathname: pfad.split('?')[0] }
  pruefe(`außerhalb des Players: ${pfad}`, !imPlayer())
}

pruefe('das Kürzel ist zweistellig', folgenKuerzel(1, 1) === '1e01' && folgenKuerzel(2, 25) === '2e25')

// Eine Serie mit mehreren Staffeln: erste und letzte je offener Staffel.
const mehrteilig = {
  titel: 'Test',
  staffeln: [
    { nr: 1, folgen: 13, offen: true },
    { nr: 2, folgen: 25, offen: false },
    { nr: 3, folgen: 12, offen: true },
  ],
}
pruefe('erste und letzte Folge je offener Staffel',
  JSON.stringify(empfohleneFolgen(mehrteilig)) === JSON.stringify(['1e01', '1e13', '3e01', '3e12']),
  empfohleneFolgen(mehrteilig))
pruefe('eine beantwortete Staffel taucht nicht auf',
  !empfohleneFolgen(mehrteilig).some((k) => k.startsWith('2e')))
pruefe('eine Staffel mit einer Folge bekommt einen Eintrag',
  JSON.stringify(empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 1, offen: true }] })) === JSON.stringify(['1e01']))

erledigt = { '12345': ['1e01'] }
pruefe('gemeldete Folgen gelten als erledigt', istErledigt('12345', '1e01'))
pruefe('die übrigen nicht', !istErledigt('12345', '1e13') && !istErledigt('99999', '1e01'))

// Und die echte Liste: Trägt jeder Eintrag, was der Dialog braucht?
const kaputt = Object.entries(liste).filter(
  ([, e]) => !e.titel || !Array.isArray(e.staffeln) || e.staffeln.some((s) => typeof s.folgen !== 'number'),
)
pruefe(`alle ${Object.keys(liste).length} Einträge tragen Titel und Staffeln`, kaputt.length === 0,
  kaputt.slice(0, 2))
const ohneEmpfehlung = Object.values(liste).filter((e) => empfohleneFolgen(e).length === 0)
pruefe('jeder Eintrag nennt mindestens eine Folge', ohneEmpfehlung.length === 0,
  ohneEmpfehlung.slice(0, 2))

const fehler = faelle.filter((x) => !x).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Die Übersicht sagt das Richtige')
process.exit(fehler ? 1 : 0)
