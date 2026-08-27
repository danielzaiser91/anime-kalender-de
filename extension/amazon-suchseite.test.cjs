/**
 * Der Weg von der Suchseite zur Titelseite.
 *
 * **118 unserer Prime-Verweise sind Suchen, keine Titelseiten** — weder AniList
 * noch aniSearch führen für diese Titel eine Produktseite, und weder MOTN noch
 * TMDB kennen eine (beides am 27.08.2026 gemessen, beides null Treffer). Auf
 * einer Trefferliste gibt es keine Tonspuren zu lesen; was die Erweiterung dort
 * kann, ist den Weg zu zeigen.
 *
 * Geprüft wird gegen **eigene Testdaten**, nicht gegen
 * `extension/offene-amazon-suche.js`. Der Grund steht in `CLAUDE.md`: Eine
 * Zusicherung, die am echten Bestand hängt, wird rot, sobald die Arbeit erledigt
 * ist — am 25.08.2026 hat genau das den Deploy drei Läufe lang aufgehalten.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = readFileSync(__dirname + '/amazon.js', 'utf8')

const SUCHLISTE = {
  'https://www.amazon.de/s?k=Cowboy%20Bebop&i=instant-video': {
    titel: 'Cowboy Bebop',
    id: 1,
    folgen: 26,
  },
}

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function element() {
  const e = {
    className: '',
    style: { cssText: '' },
    dataset: {},
    textContent: '',
    title: '',
    type: '',
    disabled: false,
    kinder: [],
    hoerer: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(k) { this.kinder.push(k); return k },
    insertBefore(k) { this.kinder.push(k); return k },
    remove() {},
    addEventListener(art, fn) { this.hoerer[art] = fn },
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() {},
  }
  return e
}

/** Lädt amazon.js einmal für die angegebene Adresse und gibt zurück, was ankam. */
function lauf(pfad, suche, { auftrag = null, liste = {}, suchStand = {} } = {}) {
  const angehaengt = []
  const speicher = auftrag ? { 'ak-prime-suchauftrag': JSON.stringify(auftrag) } : {}
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: liste,
    AK_PRIME_SUCHE: SUCHLISTE,
    URLSearchParams,
    URL,
    location: { pathname: pfad, search: suche, href: 'https://www.amazon.de' + pfad + suche },
    sessionStorage: {
      getItem: (k) => speicher[k] ?? null,
      setItem: (k, v) => { speicher[k] = v },
    },
    document: {
      documentElement: { innerHTML: '<html></html>' },
      body: { ...element(), appendChild(k) { angehaengt.push(k); return k } },
      title: 'Amazon.de',
      createElement: () => element(),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      head: element(),
    },
    chrome: {
      runtime: { id: 'test' },
      storage: {
        local: {
          /*
            Synchron, weil der Sandkasten keine Microtasks abarbeitet — siehe
            den Kommentar an `speicherLesen` in amazon.js.
          */
          get: () => ({ amazonErledigt: {}, amazonSuche: suchStand }),
          set: () => Promise.resolve(),
        },
      },
    },
    window: { addEventListener() {}, location: { pathname: pfad, search: suche } },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    setInterval: () => 0,
    setTimeout: () => 0,
    clearInterval() {},
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => Date.now() },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    Date, JSON, Math, Set, Map, Number, String, Object, Array, Boolean, RegExp,
    Promise, Error, encodeURIComponent, decodeURIComponent,
  }
  sandkasten.globalThis = sandkasten
  sandkasten.window.document = sandkasten.document

  let absturz = null
  try {
    vm.runInNewContext(quelle, sandkasten, { filename: 'amazon.js' })
  } catch (err) {
    absturz = err
  }
  return { absturz, angehaengt, speicher }
}

/**
 * Der sichtbare Text eines Kastens — samt Kindern.
 *
 * Seit 3.41 baut `hinweisKasten()` den Text in ein Kind-Element und hängt
 * einen Knopf daneben. Das Sandkasten-Element leitet `textContent` nicht aus
 * seinen Kindern ab, wie ein echtes DOM es täte — hier wird es zusammengesetzt.
 */
function kastenText(e) {
  const eigen = e?.textContent ?? ''
  const kinder = (e?.kinder ?? []).map(kastenText).join(' ')
  return (eigen + ' ' + kinder).trim()
}

console.log('Zusicherungen für die Prime-Suchseiten\n')

// --- 1. Die gelistete Suche bekommt ihren Hinweis -------------------------

const treffer = lauf('/s', '?k=Cowboy+Bebop&i=instant-video&crid=2XYZ')
pruefe('Aufbau auf der Suchseite läuft durch', !treffer.absturz, treffer.absturz?.message)

const kasten = treffer.angehaengt.find((e) => /Anime-Kalender sucht/.test(kastenText(e)))
pruefe('Hinweis erscheint auf einer gelisteten Suchseite', Boolean(kasten))
pruefe(
  'der Hinweis nennt den gemeinten Titel',
  /Cowboy Bebop/.test(kastenText(kasten)),
  kastenText(kasten),
)
pruefe(
  'der Hinweis nennt die Folgenzahl aus unserem Bestand',
  /26 Folgen/.test(kastenText(kasten)),
  kastenText(kasten),
)

/*
  Amazon hängt beim Aufruf eigene Parameter an (`crid`, `sprefix`). Die Adresse
  oben trägt eins — verglichen wird deshalb der Suchbegriff, nicht die Adresse.
*/
pruefe(
  'ein angehängtes crid verhindert den Treffer nicht',
  Boolean(kasten),
)

// --- 2. Der Auftrag überlebt den Klick auf den Treffer --------------------

const gemerkt = JSON.parse(treffer.speicher['ak-prime-suchauftrag'] ?? 'null')
pruefe('der Suchauftrag wird hinterlegt', Boolean(gemerkt), gemerkt)
pruefe(
  'er trägt die Suchadresse aus unserem Bestand, nicht die aufgerufene',
  gemerkt?.suchUrl === Object.keys(SUCHLISTE)[0],
  gemerkt?.suchUrl,
)
pruefe('er trägt den Titel', gemerkt?.titel === 'Cowboy Bebop', gemerkt?.titel)

// --- 3. Eine fremde Suche bleibt still ------------------------------------

const fremd = lauf('/s', '?k=Kaffeemaschine&i=aps')
pruefe(
  'eine Suche außerhalb der Liste erzeugt keinen Hinweis',
  !fremd.angehaengt.some((e) => /Anime-Kalender sucht/.test(kastenText(e))),
)
pruefe(
  'und hinterlegt keinen Auftrag',
  !fremd.speicher['ak-prime-suchauftrag'],
  fremd.speicher['ak-prime-suchauftrag'],
)

// --- 4. Auf der Titelseite gilt der hinterlegte Auftrag -------------------

/*
  Die Titelseite steht in keiner Liste — sie ist ja gerade das, was wir suchen.
  Ohne Auftrag bleibt es dabei; mit Auftrag erbt sie den Titel, und gemeldet
  wird unter der **Suchadresse**, denn nur die kennt unser Datensatz.
*/
const titelSeite = lauf('/dp/B000W9GBW6', '', {
  auftrag: {
    titel: 'Cowboy Bebop',
    id: 1,
    suchUrl: Object.keys(SUCHLISTE)[0],
    zeit: Date.now(),
  },
})
pruefe('Aufbau auf der Titelseite läuft durch', !titelSeite.absturz, titelSeite.absturz?.message)

const alt = lauf('/dp/B000W9GBW6', '', {
  auftrag: {
    titel: 'Cowboy Bebop',
    id: 1,
    suchUrl: Object.keys(SUCHLISTE)[0],
    /* Zehn Minuten sind die Frist — was älter ist, gilt nicht mehr. */
    zeit: Date.now() - 11 * 60 * 1000,
  },
})
pruefe('auch mit abgelaufenem Auftrag läuft der Aufbau durch', !alt.absturz, alt.absturz?.message)


// --- 5. Die Übersicht führt die Suchadressen mit ------------------------

/*
  **Ein Zähler, der einen Stapel Arbeit verschweigt, ist schlimmer als keiner.**

  Daniel am 27.08.2026, nach der ersten Runde: „golden kamui stand auch in der
  liste, hab ich gemeldet, mehr seh ich in der liste nicht." Der Knopf zählte
  zwei Titelseiten und schrieb danach „Prime: alles geprüft" — während 118
  Suchadressen unbearbeitet dastanden, sichtbar nur für den, der zufällig auf
  einer davon landet.
*/
const leer = lauf('/dp/B000W9GBW6', '')
const knopf = leer.angehaengt.find((e) => (e.className || '').includes('ak-amazon-uebersicht'))
pruefe(
  'der Knopf zählt die offenen Suchen, auch ohne offene Titelseite',
  /1 Prime-Suche.? offen/.test(knopf?.textContent ?? ''),
  knopf?.textContent,
)

/*
  Und er schweigt erst, wenn wirklich nichts mehr offen ist. Ohne diese
  Gegenprobe könnte die Zeile darüber auch dann grün sein, wenn der Zähler
  schlicht immer eine Zahl zeigt.
*/
const durch = lauf('/dp/B000W9GBW6', '', { suchStand: { [Object.keys(SUCHLISTE)[0]]: '2026-08-27' } })
const knopfDurch = durch.angehaengt.find((e) => (e.className || '').includes('ak-amazon-uebersicht'))
pruefe(
  'ist die Suche abgehakt, steht wieder „alles geprüft“',
  /alles geprüft/.test(knopfDurch?.textContent ?? ''),
  knopfDurch?.textContent,
)

// --- 6. Auf der Titelseite steht, unter welchem Titel gemeldet wird ------

/*
  **Eine Suche liefert nicht immer das gesuchte Werk.** Daniel am 27.08.2026
  an „Cowboy Bebop": Prime führt die Serie nicht, nur den Film. Wer dort
  meldet, meldet die Tonspur des Films als die der Serie.

  Die Erweiterung kann das nicht entscheiden — aber sie kann die Frage
  stellen, und die Folgenzahl ist die Antwort: 26 gegen 1.
*/
const alsTitel = lauf('/dp/B000W9GBW6', '', {
  auftrag: {
    titel: 'Cowboy Bebop',
    id: 1,
    folgen: 26,
    suchUrl: Object.keys(SUCHLISTE)[0],
    zeit: Date.now(),
  },
})
const merker = alsTitel.angehaengt.find((e) => /Meldung läuft als/.test(kastenText(e)))
pruefe('die Titelseite nennt den Titel, unter dem gemeldet wird', Boolean(merker))
pruefe(
  'und die erwartete Folgenzahl als Erkennungsmerkmal',
  /26 Folgen/.test(kastenText(merker)),
  kastenText(merker),
)

/* Ohne Auftrag bleibt die Titelseite still — der Regelfall. */
const ohne = lauf('/dp/B000W9GBW6', '')
pruefe(
  'ohne Suchauftrag steht dort nichts',
  !ohne.angehaengt.some((e) => /Meldung läuft als/.test(kastenText(e))),
)

// --- 7. Trefferauswertung: Empfehlung ist kein Treffer -------------------

/*
  **Der Fall, an dem alles hängt.** Daniel suchte „009 Re:Cyborg"; Prime fand
  nichts und füllte die Seite trotzdem mit fünf Karten — Saber Rider, Hentai
  Kamen, Predator, zweimal Aliens. Sie stehen unter
  `ul[aria-label="Mehr entdecken"]`.

  Wer sie mitzählt, hält fünf Empfehlungen für fünf Treffer und meldet nie ein
  „gibt es dort nicht". Dieselbe Verwechslung hat bei Disney+ aus 86 Folgen 94
  gemacht.

  Geprüft wird gegen den Quelltext, den Daniel geschickt hat — nachgebaut sind
  genau die Attribute, die die Auswertung liest.
*/
function karte(titel, typ, zugang, asin) {
  return {
    attrs: {
      'data-card-title': titel,
      'data-card-entity-type': typ,
      'data-card-entitlement': zugang,
    },
    asin,
  }
}

/** Baut ein DOM, das nur kann, was `suchTreffer()` von ihm verlangt. */
function suchDom(gruppen) {
  const alle = []
  for (const g of gruppen) {
    const liste = { getAttribute: (n) => (n === 'aria-label' ? g.label : null) }
    for (const k of g.karten) {
      alle.push({
        getAttribute: (n) => k.attrs[n] ?? null,
        closest: (sel) => (sel === 'ul' ? liste : null),
        querySelector: () => (k.asin ? { getAttribute: () => `/gp/video/detail/${k.asin}?sr=1-1` } : null),
      })
    }
  }
  return alle
}

/*
  Die beiden Funktionen stecken im Modul-Scope von amazon.js. Statt die ganze
  Datei zu laden — sie braucht ein vollständiges DOM —, werden sie hier
  ausgeschnitten und in einem eigenen Kontext ausgewertet. Der Ausschnitt ist
  wörtlich derselbe Quelltext; ändert er sich, ändert sich der Test mit.
*/
const quelltext = require('node:fs').readFileSync(__dirname + '/amazon.js', 'utf8')
function schneide(name) {
  const start = quelltext.indexOf(`  function ${name}(`)
  if (start < 0) throw new Error(`${name} nicht gefunden`)
  const ende = quelltext.indexOf('\n  }\n', start)
  if (ende < 0) throw new Error(`Ende von ${name} nicht gefunden`)
  return quelltext.slice(start, ende + 4)
}
const kernQuelle = quelltext.slice(
  quelltext.indexOf('  const titelKern ='),
  quelltext.indexOf('  /**', quelltext.indexOf('  const titelKern =')),
)

const bau = new Function(
  'document',
  [
    schneide('suchTreffer'),
    kernQuelle,
    schneide('beurteileTreffer'),
    'return { suchTreffer, beurteileTreffer }',
  ].join('\n'),
)

function werte(gruppen, auftrag) {
  const knoten = suchDom(gruppen)
  const { suchTreffer, beurteileTreffer } = bau({ querySelectorAll: () => knoten })
  const gefunden = suchTreffer()
  return { gefunden, befund: beurteileTreffer(auftrag, gefunden) }
}

// Daniels Fall: fünf Empfehlungen, kein Treffer.
const cyborg = werte(
  [
    {
      label: 'Mehr entdecken',
      karten: [
        karte('Saber Rider and the Star Sheriffs', 'TV Show', 'Unentitled', 'B088PPNGFS'),
        karte('Hentai Kamen - Forbidden Superhero', 'Movie', 'Entitled', 'B0C7LLQPDN'),
        karte('Predator', 'Movie', 'Unentitled', 'B0CHZ89BMS'),
        karte('Aliens - Die Rückkehr', 'Movie', 'Unentitled', 'B0BXSMQM9K'),
        karte('Aliens - Die Rückkehr', 'Movie', 'Unentitled', 'B0CBKNMHN7'),
      ],
    },
  ],
  { titel: '009 Re:Cyborg', folgen: 1 },
)
pruefe('fünf Karten gesehen', cyborg.gefunden.gesehen === 5, cyborg.gefunden.gesehen)
pruefe(
  'keine davon zählt als Treffer — „Mehr entdecken“ ist Werbung',
  cyborg.gefunden.treffer.length === 0,
  cyborg.gefunden.treffer.map((t) => t.titel),
)
pruefe('Befund: kein Treffer bei Prime', cyborg.befund.art === 'keiner', cyborg.befund.art)

// Gegenprobe: eine echte Ergebnisliste wird gelesen.
const echt = werte(
  [
    { label: 'Ergebnisse', karten: [karte('Cowboy Bebop', 'TV Show', 'Entitled', 'B0ABCDEFGH')] },
    { label: 'Mehr entdecken', karten: [karte('Predator', 'Movie', 'Unentitled', 'B0CHZ89BMS')] },
  ],
  { titel: 'Cowboy Bebop', folgen: 26 },
)
pruefe('die echte Ergebnisliste wird gelesen', echt.gefunden.treffer.length === 1)
pruefe('und die Empfehlung daneben nicht', echt.gefunden.gesehen === 2)
pruefe('Befund: genauer Treffer', echt.befund.art === 'genau', echt.befund.art)
pruefe(
  'der Zugang wird mitgelesen',
  echt.gefunden.treffer[0].zugang === 'Entitled',
  echt.gefunden.treffer[0].zugang,
)

/*
  **Gleicher Name, falscher Typ ist kein Treffer.** Wir suchen die Serie mit
  26 Folgen; Prime führt einen Film desselben Namens. Ohne diese Trennung
  bekäme die Serie das Urteil ihres Films — und dessen Tonspur ist eine andere
  Frage.
*/
const nurFilm = werte(
  [{ label: 'Ergebnisse', karten: [karte('Cowboy Bebop', 'Movie', 'Unentitled', 'B0B8TR93HR')] }],
  { titel: 'Cowboy Bebop', folgen: 26 },
)
pruefe(
  'ein Film mit gleichem Namen ist für eine Serie nur „ähnlich“',
  nurFilm.befund.art === 'aehnlich',
  nurFilm.befund.art,
)
/* Umgekehrt genauso: Wir suchen den Film, Prime führt die Serie. */
const nurSerie = werte(
  [{ label: 'Ergebnisse', karten: [karte('Akira', 'TV Show', 'Entitled', 'B0XXXXXXXX')] }],
  { titel: 'Akira', folgen: 1 },
)
pruefe('und eine Serie ist für einen Film nur „ähnlich“', nurSerie.befund.art === 'aehnlich')

/* Ohne bekannte Folgenzahl entscheidet der Typ nicht mit. */
const ohneZahl = werte(
  [{ label: 'Ergebnisse', karten: [karte('Akira', 'Movie', 'Entitled', 'B0XXXXXXXX')] }],
  { titel: 'Akira', folgen: null },
)
pruefe('ohne Folgenzahl zählt allein der Name', ohneZahl.befund.art === 'genau', ohneZahl.befund.art)

/*
  Null Karten heißt „nichts gelesen", nicht „nichts gefunden" — die Seite war
  vielleicht noch nicht fertig. Daraus darf nie eine Meldung werden.
*/
const nichtsGelesen = werte([], { titel: 'Irgendwas', folgen: 12 })
pruefe('ohne jede Karte bleibt der Befund unklar', nichtsGelesen.befund.art === 'unklar', nichtsGelesen.befund.art)
console.log()
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen erfüllt.')
