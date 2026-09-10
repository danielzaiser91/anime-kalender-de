/**
 * Nach einem Staffelwechsel gehört der Kasten noch zur alten Seite.
 *
 * Daniel am 10.09.2026 mit einer Bildschirmaufnahme (Bungo Stray Dogs, Wechsel
 * von Staffel 1 auf Staffel 2): Die Adresse führte ab Bild 80 schon
 * `B0CHL21CT2`, die Kopfzeile des Kastens nannte bis Bild 320 weiter
 * `B0BZGQZCFT` — **vier Sekunden**, in denen der rote Melde-Knopf scharf stand.
 * Ein Klick darin meldet die verlassene Seite.
 *
 * Dass der Wächter das durchgelassen hat, war kein Versehen, sondern eine
 * Lücke in der Reihenfolge: `kennungImQuelltextBekannt()` fragt, ob die
 * Adress-Kennung **irgendwo** im Quelltext steht. Beim Staffelwechsel steht sie
 * dort immer — im Staffelwähler der alten Seite. Der Freibrief, der
 * Sammelseiten (Digimon Tamers, Death Note Relight) vom Fehlalarm befreit,
 * deckte damit genau den Fall zu, für den es den Wächter gibt.
 *
 * Geprüft wird deshalb dreierlei: dass die neue Unterscheidung beide Fälle
 * trennt, dass sie **vor** dem Freibrief steht, und dass der Knopf in dieser
 * Zeit gesperrt ist.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen zum Seitenwechsel (Bungo Stray Dogs, 10.09.2026)\n')

const quelle = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')

/* --- Die Unterscheidung selbst, wirklich ausgeführt --- */
const stueck = quelle.match(/function quelltextVonFruehererSeite\(\) \{[\s\S]*?\n  \}/)
pruefe('quelltextVonFruehererSeite() ist im Quelltext auffindbar', Boolean(stueck))

if (stueck) {
  const bauen = new Function(
    'ausSeite',
    'ausAdresse',
    'frueher',
    `${stueck[0]}
function asinAusSeite(){return ausSeite}
function asinAusAdresse(){return ausAdresse}
const fruehereAdressKennungen = new Set(frueher)
return quelltextVonFruehererSeite()`,
  )

  /* Daniels Fall, Kennungen wörtlich aus der Aufnahme. */
  pruefe(
    'Staffelwechsel: Quelltext nennt B0BZGQZCFT, Adresse B0CHL21CT2 — verlassene Seite',
    bauen('B0BZGQZCFT', 'B0CHL21CT2', ['B0BZGQZCFT']) === true,
    bauen('B0BZGQZCFT', 'B0CHL21CT2', ['B0BZGQZCFT']),
  )
  /*
    Der Fall, für den es den Freibrief gibt: Eine Sammelseite trägt im Quelltext
    eine `titleID`, die in der Adresse **nie** stand. Sie darf keinen Alarm
    auslösen — sonst steht der Fehlalarm vom 09.09.2026 wieder da.
  */
  pruefe(
    'Sammelseite: abweichende titleID, die die Adresse nie trug — kein Alarm',
    bauen('B0SAMMEL123', 'B0CHL21CT2', ['B0FRUEHER99']) === false,
    bauen('B0SAMMEL123', 'B0CHL21CT2', ['B0FRUEHER99']),
  )
  pruefe(
    'Gleiche Kennung in Quelltext und Adresse — kein Alarm',
    bauen('B0CHL21CT2', 'B0CHL21CT2', ['B0BZGQZCFT']) === false,
  )
  pruefe(
    'Ohne Kennung in der Adresse wird nichts behauptet',
    bauen('B0BZGQZCFT', null, ['B0BZGQZCFT']) === false,
  )
}

/* --- Die Reihenfolge im Wächter: verlassene Seite schlägt Freibrief --- */
const waechter = quelle.match(/function quelltextVeraltet\(\) \{[\s\S]*?\n  \}/)
pruefe('quelltextVeraltet() ist auffindbar', Boolean(waechter))
if (waechter) {
  const vonFrueher = waechter[0].indexOf('quelltextVonFruehererSeite()')
  const freibrief = waechter[0].indexOf('if (kennungImQuelltextBekannt()) return false')
  pruefe('Der Wächter fragt die verlassene Seite ab', vonFrueher >= 0)
  pruefe(
    'und zwar vor dem Freibrief — sonst deckt der Staffelwähler den Wechsel zu',
    vonFrueher >= 0 && freibrief >= 0 && vonFrueher < freibrief,
    { vonFrueher, freibrief },
  )
}

/* --- Der Knopf bleibt zu, und zwar vor jedem Zweig, der den Quelltext liest --- */
const sperre = quelle.indexOf("knopf.textContent = 'Seite wechselt …'")
const geladenZweig = quelle.indexOf("knopf.style.display = ''\n\n    /**")
pruefe('Der Knopf bekommt „Seite wechselt …"', sperre > 0)
pruefe(
  'und die Sperre steht direkt hinter dem Sichtbarmachen, vor allen Quelltext-Zweigen',
  geladenZweig > 0 && sperre > geladenZweig && sperre - geladenZweig < 1200,
  { geladenZweig, sperre },
)

/* --- Der Adresswechsel wirft den alten Quelltext weg --- */
const wache = quelle.match(/function adresseNeuPruefen\(\) \{[\s\S]*?\n  \}/)
pruefe('adresseNeuPruefen() ist auffindbar', Boolean(wache))
if (wache) {
  pruefe('Der Adresswechsel verwirft den Quelltext-Zwischenspeicher', wache[0].includes('htmlNeuLesen()'))
  pruefe('und schreibt die Adress-Kennung fort', wache[0].includes('adressKennungFortschreiben()'))
}

/*
  **Der sechste Fall der `let`-Klasse wird hier verhindert, nicht erlitten.**

  `quelltextVeraltet()` läuft schon beim Seitenaufbau, und es liest
  `fruehereAdressKennungen`. Steht die Deklaration unterhalb der ersten Nutzung,
  wirft sie — und der Kasten ist weg. Fünfmal passiert (`listenId`, `knopf`,
  `wiedervorlageBeantwortet`, `istKanalKarte`, `kennungBekanntSpeicher`).
*/
const deklaration = quelle.indexOf('const fruehereAdressKennungen = new Set()')
const ersteNutzung = quelle.indexOf('fruehereAdressKennungen.has(')
pruefe('fruehereAdressKennungen ist deklariert', deklaration > 0)
pruefe(
  'und zwar oberhalb jeder Nutzung — sonst wirft der Seitenaufbau',
  deklaration > 0 && ersteNutzung > 0 && deklaration < ersteNutzung,
  { deklaration, ersteNutzung },
)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Seitenwechsel halten.')
