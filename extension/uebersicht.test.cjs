/**
 * Die Übersicht: erscheint sie zur richtigen Zeit, und stimmt, was sie sagt?
 *
 * Daniels Auftrag vom 22.08.2026: Beim Fernsehen nichts, auf den Übersichts-
 * und Stöberseiten ein Knopf mit der Zahl der offenen Titel, dahinter eine
 * Liste mit Verweisen und den Folgen, die anzuklicken sind.
 */
const { readFileSync } = require('node:fs')
const quelle = readFileSync(__dirname + '/melder.js', 'utf8')
const liste = (() => { const g = {}; new Function('globalThis', readFileSync(__dirname + '/offene-netflix.js', 'utf8'))(g); return g.AK_OFFENE_TITEL })()

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
/**
 * Eine Staffel mit einer einzigen Folge ist in aller Regel ein Film oder ein
 * Special — dort gibt es nichts auszuwählen. Bis zum 22.08.2026 stand hier
 * „1e01", was Daniel zu Recht als Unsinn meldete: „filme in der liste werden
 * als 1e01 gemeldet, obwohl es filme und keine serien sind."
 */
/**
 * **Das Format entscheidet, nicht die Folgenzahl.** Zwei Faelle machen das
 * noetig, beide vom 22.08.2026: Ein Film hat keine Folge zum Auswaehlen — aber
 * „ONE PIECE" laeuft noch und hat bei AniList gar keine Folgenzahl. Die alte
 * Bedingung „hoechstens eine Folge" machte daraus einen Film.
 */
pruefe('ein Film bleibt ein Film',
  JSON.stringify(empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 1, film: true, offen: true }] })) === JSON.stringify(['Film']))
pruefe('eine laufende Serie ohne Folgenzahl nennt die erste Folge',
  JSON.stringify(empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 0, film: false, offen: true }] })) === JSON.stringify(['1e01']),
  empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 0, film: false, offen: true }] }))
pruefe('ein Special mit einer Folge ist kein Film',
  JSON.stringify(empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 1, film: false, offen: true }] })) === JSON.stringify(['1e01']))

// Die Faelle, an denen die Einfaerbung scheiterte (Daniel, 22.08.2026).
pruefe('durchgezaehlte Staffeln bekommen die Nummern des Anbieters',
  JSON.stringify(empfohleneFolgen({ staffeln: [{ nr: 7, folgen: 25, erste: 146, offen: true }] })) === JSON.stringify(['7e146', '7e170']),
  empfohleneFolgen({ staffeln: [{ nr: 7, folgen: 25, erste: 146, offen: true }] }))
pruefe('ein Film bekommt kein Folgenkuerzel',
  JSON.stringify(empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 1, film: true, offen: true }] })) === JSON.stringify(['Film']),
  empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 1, film: true, offen: true }] }))
pruefe('ohne Anbieterangabe beginnt es bei 1',
  JSON.stringify(empfohleneFolgen({ staffeln: [{ nr: 1, folgen: 13, offen: true }] })) === JSON.stringify(['1e01', '1e13']))

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

/*
  **Ohne Auftrag zeigt die Erweiterung beim Fernsehen gar nichts.**

  Daniel am 30.08.2026, mit Bild aus „Heroes", Folge 4, mitten im laufenden
  Player: „i am just watching something, there should be no elements from the
  extension on screen." Unten rechts stand „Steht nicht auf der Prüfliste".

  Der Hinweis war zwei Stunden vorher bewusst eingebaut worden — für den Fall,
  dass Netflix einen Klick aus der Prüfliste woandershin leitet. Nur galt er
  dort für **jede** Titel- und Player-Seite statt nur für die eine, auf der ein
  Auftrag verfolgt wird.

  Verhaltensecht ist das schwer zu prüfen: `knopfZeigen()` hängt an einem
  halben Dutzend Zuständen. Die Reihenfolge im Quelltext lässt sich dagegen
  ablesen, und sie ist die ganze Aussage — der Ausstieg muss **vor** dem
  Einhängen des Knopfes stehen.
*/
{
  const zweig = quelle.indexOf('if (!istGesucht()) {')
  const abschnitt = quelle.slice(zweig, zweig + 3000)
  const ausstieg = abschnitt.indexOf('if (!kamAusListe) {')
  const einhaengen = abschnitt.indexOf('document.body.appendChild(knopf)')
  pruefe('der Zweig ohne Auftrag existiert', zweig > 0)
  pruefe('er steigt ohne Auftrag aus', ausstieg > 0)
  pruefe(
    '… und zwar bevor ein Knopf in die Seite kommt',
    ausstieg > 0 && einhaengen > 0 && ausstieg < einhaengen,
    { ausstieg, einhaengen },
  )
  pruefe(
    'kein „Steht nicht auf der Prüfliste" mehr im Code',
    !/knopf\.textContent = [^\n]*Steht nicht auf der Prüfliste/.test(quelle),
  )
}

const fehler = faelle.filter((x) => !x).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Die Übersicht sagt das Richtige')
process.exit(fehler ? 1 : 0)
