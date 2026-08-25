/**
 * Die Serie kommt aus demselben Block wie der Film — geprüft an
 * **Yu-Gi-Oh! ZEXAL Staffel 2** (`B0GV8N71SL`).
 *
 * Daniel am 25.08.2026, nachdem er den Netzwerk-Tab gelesen hatte: „ich merke
 * gerade das hydration steht auch 1:1 genauso bei serien, also brauchen wir das
 * widget überhaupt nicht und können immer auf hydration gehen."
 *
 * Er hat recht, und dieser Fall zeigt zugleich, warum die Verfügbarkeit je
 * Folge dazugehört: **Zwölf der vierundzwanzig Folgen sind hier gesperrt**, und
 * ihre `audioTracks` sind leer. Wer sie mitzählt, meldet für die halbe Staffel
 * ein Nein, das keine Quelle deckt — „In deiner Region nicht mehr auf Prime
 * Video verfügbar" heißt *hier nicht*, nicht *gibt es nicht*.
 *
 * `zexal-hydration.fixture.json` ist ein Auszug aus der echten Seite: dieselben
 * Felder, dieselben Werte, 65 KB statt 544.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen für den Serien-Weg (Yu-Gi-Oh! ZEXAL S2, B0GV8N71SL)\n')

const fixture = readFileSync(resolve(__dirname, 'zexal-hydration.fixture.json'), 'utf8')
const quelle = readFileSync(resolve(__dirname, 'amazon-leser.js'), 'utf8')

/* Geprüft wird der Produktivcode: die Funktionen werden aus ihm geschnitten. */
function schneide(name) {
  const start = quelle.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Funktion ${name} nicht gefunden`)
  let tiefe = 0
  let i = quelle.indexOf('{', start)
  for (; i < quelle.length; i++) {
    if (quelle[i] === '{') tiefe++
    else if (quelle[i] === '}' && --tiefe === 0) return quelle.slice(start, i + 1)
  }
  throw new Error(`Funktion ${name} endet nicht`)
}

const sandkasten = {
  document: {
    getElementById: (id) => (id === 'dv-web-page-hydration-data' ? { textContent: fixture } : null),
  },
  JSON,
  Object,
  Array,
  Number,
  String,
  Set,
  Boolean,
  RegExp,
  console: { log() {}, warn() {}, error() {} },
}
sandkasten.globalThis = sandkasten
vm.runInNewContext(
  `${schneide('namenAus')}\n${schneide('ausHydration')}\n;globalThis.__seite = ausHydration();`,
  sandkasten,
  { filename: 'amazon-leser.js (Auszug)' },
)

const s = sandkasten.__seite

/* --- Die Seite ----------------------------------------------------------- */

pruefe('der Block wird gelesen', Boolean(s), s)
pruefe('die Kennung stimmt', s?.kennung === 'B0GV8N71SL', s?.kennung)
pruefe('als Serie erkannt', s?.art === 'TV Show' && s?.sorte === 'season', [s?.art, s?.sorte])

/*
  Serientitel und Staffelnummer — die beiden Felder, für die es bis zum
  25.08.2026 vier Muster über 2,2 Millionen Zeichen brauchte.
*/
pruefe('der Serientitel steht getrennt vom Staffelnamen', s?.serie === 'Yu-Gi-Oh! ZEXAL [OV]', s?.serie)
pruefe('die Staffelnummer kommt aus dem JSON', s?.staffel === 2, s?.staffel)
pruefe('die Folgenzahl der Reihe ist 74', s?.folgenGesamt === 74, s?.folgenGesamt)
pruefe('der Zugang ist der Crunchyroll-Kanal', JSON.stringify(s?.zugaenge) === JSON.stringify(['crunchyrollde']), s?.zugaenge)
pruefe('alle sechs Staffeln stehen mit eigener Kennung da', s?.staffeln?.length === 6, s?.staffeln?.length)
pruefe(
  'die gewählte Staffel ist als solche markiert',
  s?.staffeln?.filter((x) => x.gewaehlt).length === 1 &&
    s.staffeln.find((x) => x.gewaehlt)?.kennung === 'B0GV8N71SL',
  s?.staffeln?.filter((x) => x.gewaehlt),
)

/* --- Die Folgen ---------------------------------------------------------- */

pruefe('vierundzwanzig Folgen sind gelesen', s?.folgen?.length === 24, s?.folgen?.length)

const gesperrt = (s?.folgen ?? []).filter((f) => !f.verfuegbar)
const offen = (s?.folgen ?? []).filter((f) => f.verfuegbar)

pruefe('zwölf davon sind in dieser Region gesperrt', gesperrt.length === 12, gesperrt.length)
pruefe('zwölf sind abrufbar', offen.length === 12, offen.length)

/*
  **Der Kern: leere Tonspuren sind kein Nein.**

  Alle zwölf gesperrten Folgen tragen `audioTracks: []`. Ohne die
  Verfügbarkeitsprüfung sähen sie aus wie „keine deutsche Fassung" — und die
  Erweiterung meldete für die halbe Staffel ein unbelegtes Nein.
*/
pruefe(
  'jede gesperrte Folge hat leere Tonspuren',
  gesperrt.length > 0 && gesperrt.every((f) => f.sprachen.length === 0),
  gesperrt.map((f) => f.sprachen),
)
pruefe(
  'und jede abrufbare hat welche',
  offen.length > 0 && offen.every((f) => f.sprachen.length > 0),
  offen.filter((f) => !f.sprachen.length).map((f) => f.nummer),
)
pruefe(
  'der Grund steht im Klartext dabei',
  /Region nicht mehr/.test(gesperrt[0]?.hinweis ?? ''),
  gesperrt[0]?.hinweis,
)

/*
  **Und die Folgennummer allein ist kein Schlüssel.**

  Amazon mischt hier zwei Ausgaben in einer Liste: Jede Nummer von 1 bis 12
  kommt zweimal vor, einmal abrufbar und einmal gesperrt. Wer nach Nummer
  zuordnet, überschreibt die eine mit der anderen.
*/
const nummern = (s?.folgen ?? []).map((f) => f.nummer)
pruefe(
  'jede Nummer kommt doppelt vor — die Kennung unterscheidet sie',
  new Set(nummern).size === 12 && nummern.length === 24,
  { verschiedene: new Set(nummern).size, gesamt: nummern.length },
)
pruefe(
  'jede Folge trägt ihre eigene Kennung',
  new Set((s?.folgen ?? []).map((f) => f.kennung)).size === 24,
  new Set((s?.folgen ?? []).map((f) => f.kennung)).size,
)

/* --- Was der Kalender sonst bekommt -------------------------------------- */

const erste = (s?.folgen ?? [])[0]
pruefe('Folgentitel gelesen', typeof erste?.titel === 'string' && erste.titel.length > 2, erste?.titel)
pruefe('Erscheinungsdatum gelesen', /\d{4}/.test(erste?.erschienen ?? ''), erste?.erschienen)
pruefe('Laufzeit gelesen', /Min/.test(erste?.laufzeit ?? ''), erste?.laufzeit)
pruefe('FSK je Folge gelesen', Boolean(erste?.fsk), erste?.fsk)
pruefe('Beschreibung gelesen', (erste?.beschreibung ?? '').length > 40, (erste?.beschreibung ?? '').length)

/**
 * **Der Quelltext wird im Takt nicht mehr gelesen.**
 *
 * Daniel am 25.08.2026: „wieso reagiert der button immer noch auf folgen wenn
 * ich ausklappe? der parser muss aus, das haben wir über das hydrated."
 *
 * `spuren()` lief bis dahin in jedem Takt über 2,2 Millionen Zeichen. Beim
 * Ausklappen eines Abschnitts änderte sich der gerenderte Inhalt — und damit,
 * was das Muster fand. Der Knopf zuckte, obwohl die Daten längst aus dem
 * Hydration-Block kamen.
 *
 * Geprüft wird am Quelltext von `amazon.js`: In `zeichnen()` darf `spuren()`
 * nicht mehr vorkommen. Das ist eine Aussage über den Aufbau, und die lässt
 * sich nur dort prüfen — ein Sandkasten sähe nur das Ergebnis, nicht den Weg.
 */
{
  const amazon = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')
  const von = amazon.indexOf('function zeichnen() {')
  pruefe('zeichnen() ist auffindbar', von > 0, von)

  /* Bis zum Ende der Funktion — über die Klammertiefe, nicht über eine Zeilenzahl. */
  let tiefe = 0
  let bis = amazon.indexOf('{', von)
  for (let i = bis; i < amazon.length; i++) {
    if (amazon[i] === '{') tiefe++
    else if (amazon[i] === '}' && --tiefe === 0) {
      bis = i
      break
    }
  }
  const koerper = amazon.slice(von, bis)

  /* Kommentare zählen nicht — dort steht die Begründung, warum es weg ist. */
  const ohneKommentare = koerper
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\*.*$/gm, '')

  pruefe(
    'zeichnen() ruft spuren() nicht mehr',
    !/\bspuren\(\)/.test(ohneKommentare),
    (ohneKommentare.match(/.{0,40}spuren\(\).{0,40}/) ?? [])[0],
  )
  pruefe(
    'und die Gesamtzahl kommt aus dem Hydration-Block',
    /gesehen\.seite\?\.folgenGesamt/.test(ohneKommentare),
    undefined,
  )
}

/**
 * **Prime teilt eine Staffel in Bände — dann gilt die Zahl für beide.**
 *
 * Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 3, Band 2 (`B0FHGJ7KS1`),
 * mit Bild: „extension erwartet 96, ausklappbar sind nur 48, weil prime es in
 * 2 volumes gesplittet hat."
 *
 * Die Staffelliste im Hydration-Block nennt die Bände selbst — und mischt
 * dabei zwei Schreibweisen in **einer** Liste: „Staffel 1, Band 2" neben
 * „Season 1, Volume 2". Ein Textmuster darauf wäre also von vornherein
 * unzuverlässig; entschieden wird stattdessen an den Abschnitten.
 */
{
  const namen = (s?.staffeln ?? []).map((x) => x.name)
  pruefe(
    'die Staffelliste führt Bände, nicht Staffeln',
    namen.some((n) => /Band|Volume/.test(n ?? '')),
    namen,
  )
  pruefe(
    'und beide Schreibweisen stehen nebeneinander',
    namen.some((n) => /Band/.test(n ?? '')) && namen.some((n) => /Volume/.test(n ?? '')),
    namen,
  )

  /* Die Entscheidung selbst — geschnitten aus `amazon.js`, nicht nachgebaut. */
  const amazon = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')
  const von = amazon.indexOf('function istVollstaendig(')
  pruefe('istVollstaendig() ist auffindbar', von > 0, von)

  let tiefe = 0
  let bis = amazon.indexOf('{', von)
  for (let i = bis; i < amazon.length; i++) {
    if (amazon[i] === '{') tiefe++
    else if (amazon[i] === '}' && --tiefe === 0) {
      bis = i + 1
      break
    }
  }
  const kasten = { console: { log() {}, error() {} } }
  vm.runInNewContext(
    `${amazon.slice(von, bis)}\n;globalThis.__voll = istVollstaendig;`,
    kasten,
    { filename: 'amazon.js (Auszug)' },
  )
  const voll = kasten.__voll

  /* Daniels Fall: 49 gezählt, 96 behauptet, alle vier Abschnitte durch. */
  pruefe(
    'alle Abschnitte durch heißt vollständig — auch bei 49 von 96',
    voll({ gesamt: 4, offen: 0 }, 49, 96) === true,
    voll({ gesamt: 4, offen: 0 }, 49, 96),
  )
  pruefe(
    'ein offener Abschnitt heißt unvollständig — auch wenn die Zahl passt',
    voll({ gesamt: 4, offen: 1 }, 96, 96) === false,
    voll({ gesamt: 4, offen: 1 }, 96, 96),
  )

  /* Ohne Abschnitte (Film, kurze Staffel) bleibt es beim Zahlenvergleich. */
  pruefe('ohne Abschnitte entscheidet die Zahl', voll(null, 12, 24) === false, voll(null, 12, 24))
  pruefe('und sie darf auch erfüllt sein', voll(null, 24, 24) === true, voll(null, 24, 24))
  pruefe('ohne Folgenzahl gilt die Liste als vollständig', voll(null, 1, null) === true, voll(null, 1, null))
}

/**
 * **Prime nutzt `sequenceNumber` als Sortierschlüssel, nicht als Staffelnummer.**
 *
 * Daniel am 25.08.2026, mit Bild des Auswahlfelds: „yu gi oh zexal has weird
 * seasons." Sechs Einträge, drei Staffeln, gemischte Schreibweisen — und die
 * beiden Bände 1 tragen 101 und 201.
 *
 * Die Adresse trägt genau diese Zahl (`?ref_=atv_dp_season_select_s101`). Ein
 * Klick auf „Season 1, Volume 1" hätte damit **Staffel 101** gemeldet, solange
 * `staffelAusAdresse()` vorn stand.
 */
{
  const seq = (s?.staffeln ?? []).map((x) => x.nummer)
  pruefe('dreistellige Sortierschlüssel stehen in der Liste', seq.some((n) => n > 50), seq)
  pruefe(
    'aber die Staffelnummer der Seite ist zweistellig oder kleiner',
    s?.staffel === 2,
    s?.staffel,
  )

  /* Der Band steht als eigenes Feld da — nicht aus dem Titel geschnitten. */
  pruefe('der Band wird gemeldet', s?.band === 'Season 2, Volume 2', s?.band)
  pruefe(
    'und er kommt aus der Staffelliste, nicht aus dem Seitentitel',
    !/Yu-Gi-Oh/.test(s?.band ?? ''),
    s?.band,
  )

  /* Die Vorrangkette in `amazon.js`: erst das JSON, dann die Adresse. */
  const amazon = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')
  const von = amazon.indexOf('function staffelNummer() {')
  pruefe('staffelNummer() ist auffindbar', von > 0, von)

  let tiefe = 0
  let bis = amazon.indexOf('{', von)
  for (let i = bis; i < amazon.length; i++) {
    if (amazon[i] === '{') tiefe++
    else if (amazon[i] === '}' && --tiefe === 0) {
      bis = i + 1
      break
    }
  }
  const koerper = amazon.slice(von, bis)
  pruefe(
    'das JSON steht vor der Adresse',
    koerper.indexOf('gemeldeteStaffelNummer') < koerper.indexOf('staffelAusAdresse'),
    koerper.replace(/\s+/g, ' ').slice(0, 100),
  )
  pruefe(
    'und eine dreistellige Zahl aus der Adresse wird verworfen',
    /<=\s*50/.test(koerper),
    koerper.replace(/\s+/g, ' ').slice(0, 200),
  )
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('\nSerien-Weg: alle Zusicherungen erfüllt.')
