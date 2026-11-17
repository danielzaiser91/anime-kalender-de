/**
 * Der Knopf, wenn noch keine Folge gelesen ist, die Seite aber eine Folgenzahl zeigt
 * (`ungeladenLautSeite` in `amazon-knopf-zeichnen.js`).
 *
 * Vor acht Sekunden heißt es „Folgen werden geladen …", danach „Tonspuren nicht gefunden — Seite neu
 * laden" samt Vorfall `ohne_tonspur`. Auf einer Fehler-, Region- oder Nicht-verfügbar-Seite greift der
 * Zweig nicht. Die Funktion wird wörtlich aus dem Quelltext geschnitten und in einer Attrappen-Welt
 * gespielt, wie `amazon.js` sie über `AK_ZEICHNEN_WELT` bereitstellt.
 */
const { readFileSync } = require('node:fs')

const quelltext = readFileSync(__dirname + '/amazon-knopf-zeichnen.js', 'utf8')
const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
function schneide(name) {
  const anfang = `  const ${name} = `
  const start = quelltext.indexOf(anfang)
  if (start < 0) throw new Error(`${name} nicht gefunden`)
  return quelltext.slice(start + anfang.length, quelltext.indexOf('\n  }\n', start) + 4)
}

/* Die Aufrufe: ohne sie oder mit vertauschten Werten wäre der geprüfte Zweig nie erreicht. */
pruefe(
  'zeichnenRoh übergibt die sechs Werte an zeichnenUngeladen',
  quelltext.includes('if (!geladen) return zeichnenUngeladen({ stoerung, fehlerseite, regionWeg, nichtAbrufbar, wartet, ladeFristReif })'),
)
pruefe(
  'zeichnenUngeladen ruft ungeladenLautSeite mit allen fünf Werten',
  quelltext.includes('if (ungeladenLautSeite({ regionWeg, nichtAbrufbar, fehlerseite, wartet, ladeFristReif })) return'),
)
pruefe(
  'zeichnenUngeladen nimmt ladeFristReif unter seinem Namen entgegen',
  quelltext.includes('const zeichnenUngeladen = ({ stoerung, fehlerseite, regionWeg, nichtAbrufbar, wartet, ladeFristReif }) => {'),
)

const quelleLautSeite = schneide('ungeladenLautSeite')

function lauf(werte, { folgenLautSeite = 48 } = {}) {
  const knopf = { dataset: {}, disabled: false, textContent: '' }
  const vorfaelle = []
  const welt = {
    knopf,
    seitenLage: () => ({ folgenLautSeite }),
    vorfallMelden: async (art, angaben) => { vorfaelle.push({ art, angaben }) },
  }
  // eslint-disable-next-line no-new-func
  const ungeladenLautSeite = new Function('welt', `with (welt) { return (${quelleLautSeite}) }`)(welt)
  const ergebnis = ungeladenLautSeite({ regionWeg: false, nichtAbrufbar: false, fehlerseite: false, wartet: true, ladeFristReif: false, ...werte })
  return { ergebnis, knopf, vorfaelle }
}

{
  const { ergebnis, knopf, vorfaelle } = lauf({ ladeFristReif: false })
  pruefe('vor acht Sekunden: Zweig greift', ergebnis === true)
  pruefe('vor acht Sekunden: „Folgen werden geladen …"', knopf.textContent === 'Folgen werden geladen …', knopf.textContent)
  pruefe('vor acht Sekunden: Knopf gesperrt, nicht tot', knopf.disabled === true && knopf.dataset.tot === 'false', knopf)
  pruefe('vor acht Sekunden: kein Vorfall', vorfaelle.length === 0, vorfaelle)
}
{
  const { ergebnis, knopf, vorfaelle } = lauf({ ladeFristReif: true, wartet: false })
  pruefe('nach acht Sekunden: Zweig greift', ergebnis === true)
  pruefe('nach acht Sekunden: „Tonspuren nicht gefunden — Seite neu laden"', knopf.textContent === 'Tonspuren nicht gefunden — Seite neu laden', knopf.textContent)
  pruefe('nach acht Sekunden: Knopf gesperrt, nicht tot', knopf.disabled === true && knopf.dataset.tot === 'false', knopf)
  pruefe('nach acht Sekunden: genau ein Vorfall ohne_tonspur', vorfaelle.length === 1 && vorfaelle[0].art === 'ohne_tonspur', vorfaelle)
}
for (const [name, werte] of [['Region weg', { regionWeg: true }], ['nicht abrufbar', { nichtAbrufbar: true }], ['Fehlerseite', { fehlerseite: true }]]) {
  const { ergebnis, knopf, vorfaelle } = lauf({ ...werte, ladeFristReif: true })
  pruefe(`${name}: Zweig greift nicht, Knopf unberührt`, ergebnis === false && knopf.textContent === '' && vorfaelle.length === 0, { ergebnis, text: knopf.textContent })
}
{
  const { ergebnis, knopf } = lauf({ ladeFristReif: true }, { folgenLautSeite: 0 })
  pruefe('ohne Folgenzahl auf der Seite: Zweig greift nicht', ergebnis === false && knopf.textContent === '', { ergebnis, text: knopf.textContent })
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('Ungeladen, Folgenzahl auf der Seite: alle Zusicherungen erfüllt.')
