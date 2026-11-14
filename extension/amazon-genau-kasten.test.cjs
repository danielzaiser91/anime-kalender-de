/**
 * Der Kasten bei genauem Treffer auf der Prime-Suchseite (`genauZeigen` in `amazon.js`).
 *
 * Die drei Funktionen werden wörtlich aus dem Quelltext geschnitten und gegen Attrappen gespielt:
 * Kauftitel vor Kanal-Titel, die weiteren Ausgaben als `weitere=` im Suchauftrag, die Kennung des
 * Ziels als `zielAsin`, der Sprungknopf nur bei einer Karte und der Meldeknopf am Ende.
 */
const { readFileSync } = require('node:fs')

const quelltext = readFileSync(__dirname + '/amazon.js', 'utf8')
const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
function schneide(name) {
  const start = quelltext.indexOf(`  function ${name}(`)
  if (start < 0) throw new Error(`${name} nicht gefunden`)
  return quelltext.slice(start, quelltext.indexOf('\n  }\n', start) + 4)
}
function zeile(anfang) {
  const start = quelltext.indexOf(anfang)
  if (start < 0) throw new Error(`${anfang} nicht gefunden`)
  return quelltext.slice(start, quelltext.indexOf('\n', start))
}

/* Der Aufruf im Suchkasten: ohne ihn bliebe der Kasten bei genauem Treffer leer. */
pruefe(
  'zeichnen() ruft genauZeigen mit allen fünf Werten in dieser Reihenfolge',
  quelltext.includes("if (befund.art === 'genau') return genauZeigen(auftrag, zeichnen, befund, begriffZeile, folgen)"),
)

const bau = new Function(
  'umwelt',
  [
    'let weitereAusgaben = []',
    'const { hinweisKasten, kastenKnopf, kastenZeile, erwartungsAuswahl, istGemeldet, nichtBeiPrimeMelden, suchauftragMerken, location } = umwelt',
    zeile('  const ohneParameter = '),
    schneide('kennungAus'),
    schneide('genauZeigen'),
    schneide('genauSortiert'),
    schneide('genauZusatz'),
    'return { genauZeigen, weitere: () => weitereAusgaben }',
  ].join('\n'),
)

function lauf(treffer, { gemeldet = false } = {}) {
  const protokoll = { kasten: null, gemerkt: [], auswahl: null, gemeldetMit: null }
  const umwelt = {
    location: { href: 'https://www.amazon.de/s?k=x' },
    hinweisKasten: (...args) => { protokoll.kasten = args },
    kastenKnopf: (text, tun, kennung) => ({ knopf: text, tun, kennung }),
    kastenZeile: (klasse, text) => ({ zeile: text, klasse }),
    erwartungsAuswahl: (auftrag, sortiert) => {
      protokoll.auswahl = sortiert.map((k) => k.titel)
      return [{ auswahl: sortiert.length }]
    },
    istGemeldet: () => gemeldet,
    nichtBeiPrimeMelden: (...args) => { protokoll.gemeldetMit = args },
    suchauftragMerken: (a) => protokoll.gemerkt.push(a),
  }
  const { genauZeigen, weitere } = bau(umwelt)
  const auftrag = { titel: 'One Punch Man', suchUrl: 'https://www.amazon.de/s?k=One+Punch+Man' }
  const befund = { art: 'genau', treffer }
  const zeichnen = () => 'zeichnen'
  const rueckgabe = genauZeigen(auftrag, zeichnen, befund, [{ begriff: 'gesucht als: One Punch Man' }], '24 Folgen')
  return { protokoll, umwelt, auftrag, befund, zeichnen, rueckgabe, weitere: weitere() }
}

const KANAL = { titel: 'One Punch Man (Kanal)', zugang: 'Subscription_crunchyroll', url: 'https://www.amazon.de/gp/video/detail/B0KANAL001?ref=x' }
const KAUF = { titel: 'One Punch Man (Kauf)', zugang: 'Entitled', url: 'https://www.amazon.de/gp/video/detail/B0KAUFT001?ref=y' }

/* Zwei Karten, der Kanal-Titel zuerst gelistet. */
{
  const { protokoll, auftrag, befund, zeichnen, rueckgabe, weitere } = lauf([KANAL, KAUF])
  const [titel, folgen, ...rest] = protokoll.kasten ?? []
  pruefe('der Kasten nennt Titel und Folgen', titel === 'One Punch Man' && folgen === '24 Folgen', [titel, folgen])
  pruefe('die Suchzeile steht zuerst', rest[0]?.begriff === 'gesucht als: One Punch Man', rest[0])
  pruefe('der Kauftitel steht in der Auswahl vor dem Kanal-Titel', protokoll.auswahl?.join('|') === 'One Punch Man (Kauf)|One Punch Man (Kanal)', protokoll.auswahl)
  pruefe('danach die Auswahl', rest[1]?.auswahl === 2, rest[1])
  pruefe('bei zwei Karten kein Sprungknopf', rest[2] === null, rest[2])
  pruefe('ein Platzhalter vor dem Meldeknopf', rest[3] === null && rest.length === 5, rest.length)
  pruefe('am Ende der Meldeknopf', rest[4]?.knopf === 'Nicht bei Prime — melden', rest[4])
  rest[4]?.tun?.('k')
  pruefe('der Meldeknopf meldet Auftrag, Befund, Knopf und Neuzeichnen', protokoll.gemeldetMit?.[0] === auftrag && protokoll.gemeldetMit?.[1] === befund && protokoll.gemeldetMit?.[2] === 'k' && protokoll.gemeldetMit?.[3] === zeichnen, protokoll.gemeldetMit?.length)
  pruefe('die weitere Ausgabe ist der Kanal-Titel', weitere.join() === 'B0KANAL001', weitere)
  pruefe('zuerst wird `weitere=` gemerkt', protokoll.gemerkt[0]?.weitere?.join() === 'B0KANAL001' && protokoll.gemerkt[0]?.suchUrl === auftrag.suchUrl, protokoll.gemerkt[0])
  pruefe('danach das Ziel als `zielAsin` (Kauftitel, ohne Parameter)', protokoll.gemerkt[1]?.zielAsin === 'B0KAUFT001' && protokoll.gemerkt.length === 2, protokoll.gemerkt[1])
  pruefe('genauZeigen liefert nichts zurück', rueckgabe === undefined)
}

/* Eine Karte: Sprungknopf statt Auswahl, kein `weitere=`. */
{
  const { protokoll, umwelt, weitere } = lauf([KAUF])
  const rest = (protokoll.kasten ?? []).slice(2)
  pruefe('eine Karte: nur `zielAsin` wird gemerkt', protokoll.gemerkt.length === 1 && protokoll.gemerkt[0].zielAsin === 'B0KAUFT001', protokoll.gemerkt)
  pruefe('eine Karte: keine weiteren Ausgaben', weitere.length === 0, weitere)
  pruefe('eine Karte: Sprungknopf nennt die Karte', rest[2]?.knopf === 'Suchtreffer anklicken: One Punch Man (Kauf)', rest[2]?.knopf)
  pruefe('eine Karte: Sprungknopf trägt die Kennung', rest[2]?.kennung === 'B0KAUFT001', rest[2]?.kennung)
  rest[2]?.tun?.()
  pruefe('eine Karte: Sprung geht zur Adresse ohne Parameter', umwelt.location.href === 'https://www.amazon.de/gp/video/detail/B0KAUFT001', umwelt.location.href)
}

/* Schon gemeldet: statt des Knopfs eine Zeile. */
{
  const rest = (lauf([KAUF], { gemeldet: true }).protokoll.kasten ?? []).slice(2)
  pruefe('schon gemeldet: Zeile „gemeldet ✓"', rest[4]?.zeile === 'gemeldet ✓' && rest[4]?.klasse === 'ak-such-fertig', rest[4])
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('Genauer Treffer: alle Zusicherungen erfüllt.')
