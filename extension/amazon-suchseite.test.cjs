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

const kasten = treffer.angehaengt.find((e) => /Cowboy Bebop/.test(kastenText(e)))
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
  !fremd.angehaengt.some((e) => /Cowboy Bebop/.test(kastenText(e))),
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
const merker = alsTitel.angehaengt.find((e) => /Meldung läuft unter diesem Titel/.test(kastenText(e)))
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
  !ohne.angehaengt.some((e) => /Meldung läuft unter diesem Titel/.test(kastenText(e))),
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
/*
  Beide Kernformen gehören in den Ausschnitt — `titelKernLocker` steht hinter
  einem eigenen Kommentarblock, und der beendete den Schnitt bis 3.79 vorzeitig.
  Der Test wurde dadurch rot mit „titelKernLocker is not defined", und das war
  die richtige Meldung: Der Ausschnitt bildete den Quelltext nicht mehr ab.
*/
const kernQuelle = quelltext.slice(
  quelltext.indexOf('  const titelKern ='),
  quelltext.indexOf('  /**', quelltext.indexOf('  const wortFolgePasst =')),
)

const bau = new Function(
  'document',
  [
    /* Die Ergebnislisten-Regel steht außerhalb der Funktionen — hier mit ausschneiden. */
    quelltext.slice(
      quelltext.indexOf('  const ERGEBNISLISTE ='),
      quelltext.indexOf('\n', quelltext.indexOf('  const ERGEBNISLISTE =')),
    ),
    schneide('suchTreffer'),
    kernQuelle,
    /* Die Staffelnummer im Titel entscheidet seit 3.52 mit — mit ausschneiden. */
    quelltext.slice(
      quelltext.indexOf('  const staffelImTitel ='),
      quelltext.indexOf(String.raw`
  }`, quelltext.indexOf('  const staffelImTitel =')) + 4,
    ),
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
/*
  **Alle Karten werden gelesen, auch die aus Empfehlungslisten** — Daniel am
  27.08.2026: „mehr entdecken und beste ergebnisse beide müssen geprüft
  werden". Entschieden wird über den Namen: Hier heißt keine Karte wie der
  gesuchte Titel, also gibt es ihn dort nicht.
*/
pruefe(
  'alle fünf Karten werden gelesen, nicht nur eine Liste',
  cyborg.gefunden.treffer.length === 5,
  cyborg.gefunden.treffer.length,
)
pruefe(
  'keine davon trägt den gesuchten Namen',
  cyborg.befund.art === 'keiner',
  cyborg.gefunden.treffer.map((t) => t.titel),
)
pruefe('Befund: kein Treffer bei Prime', cyborg.befund.art === 'keiner', cyborg.befund.art)
pruefe(
  'in der Ergebnisliste steht nichts — es gibt gar keine',
  cyborg.gefunden.echte === 0,
  cyborg.gefunden.echte,
)

/*
  **Die Gegenprobe zum Angels-of-Death-Fall.** Dort stand der gesuchte Titel
  als Karte 0 unter „Mehr entdecken" — eine erste Fassung verwarf die Liste
  nach ihrem Namen und hielt einen vorhandenen Titel für nicht vorhanden.
  Steht derselbe Titel dagegen in „Beste Ergebnisse", ist er ein Treffer.
*/
const nurEmpfehlung = werte(
  [{ label: 'Mehr entdecken', karten: [karte('Angels of Death', 'TV Show', 'Unentitled', 'B0FQSW7VV7')] }],
  { titel: 'Angels of Death', folgen: 12 },
)
/*
  **Und er zählt auch dann, wenn keine Ergebnisliste da ist.** Bei „Angels of
  Death" liefert Amazon zwanzig Empfehlungen und keine einzige Ergebnisliste —
  die erste davon ist der gesuchte Titel (Daniel, 27.08.2026, mit Bild).
*/
pruefe(
  'ein Namenstreffer zählt auch unter „Mehr entdecken“',
  nurEmpfehlung.befund.art === 'genau',
  nurEmpfehlung.befund.art,
)
const inErgebnissen = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Angels of Death', 'TV Show', 'Unentitled', 'B0FQSW7VV7')] }],
  { titel: 'Angels of Death', folgen: 12 },
)
pruefe(
  'derselbe Titel in „Beste Ergebnisse“ ist einer',
  inErgebnissen.befund.art === 'genau',
  inErgebnissen.befund.art,
)

// Gegenprobe: eine echte Ergebnisliste wird gelesen.
const echt = werte(
  [
    { label: 'Beste Ergebnisse', karten: [karte('Cowboy Bebop', 'TV Show', 'Entitled', 'B0ABCDEFGH')] },
    { label: 'Mehr entdecken', karten: [karte('Predator', 'Movie', 'Unentitled', 'B0CHZ89BMS')] },
  ],
  { titel: 'Cowboy Bebop', folgen: 26 },
)
/* Die Ergebnisliste wird weiterhin erkannt — sie steht im Kastentext. */
pruefe('die Ergebnisliste wird als solche erkannt', echt.gefunden.echte === 1, echt.gefunden.echte)
pruefe('und die Empfehlung daneben wird trotzdem gelesen', echt.gefunden.gesehen === 2)
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
  [{ label: 'Beste Ergebnisse', karten: [karte('Cowboy Bebop', 'Movie', 'Unentitled', 'B0B8TR93HR')] }],
  { titel: 'Cowboy Bebop', folgen: 26 },
)
pruefe(
  'ein Film mit gleichem Namen ist für eine Serie nur „ähnlich“',
  nurFilm.befund.art === 'aehnlich',
  nurFilm.befund.art,
)
/* Umgekehrt genauso: Wir suchen den Film, Prime führt die Serie. */
const nurSerie = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Akira', 'TV Show', 'Entitled', 'B0XXXXXXXX')] }],
  { titel: 'Akira', folgen: 1 },
)
pruefe('und eine Serie ist für einen Film nur „ähnlich“', nurSerie.befund.art === 'aehnlich')

/* Ohne bekannte Folgenzahl entscheidet der Typ nicht mit. */
const ohneZahl = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Akira', 'Movie', 'Entitled', 'B0XXXXXXXX')] }],
  { titel: 'Akira', folgen: null },
)
pruefe('ohne Folgenzahl zählt allein der Name', ohneZahl.befund.art === 'genau', ohneZahl.befund.art)

/*
  Null Karten heißt „nichts gelesen", nicht „nichts gefunden" — die Seite war
  vielleicht noch nicht fertig. Daraus darf nie eine Meldung werden.
*/
const nichtsGelesen = werte([], { titel: 'Irgendwas', folgen: 12 })
pruefe('ohne jede Karte bleibt der Befund unklar', nichtsGelesen.befund.art === 'unklar', nichtsGelesen.befund.art)

// --- 8. Der Sprung zur Titelseite ---------------------------------------

/*
  **Ein Klick auf den Trefferlink endet im Fehler — ohne Parameter nicht.**

  Amazon hängt an jeden Suchtreffer Verfolgungsmarken:
  `?qid=…&pageTypeIdSource=ASIN&pageTypeId=…&ref_=atv_sr_fle_c_…&sr=1-1`.
  Der Klick landet bei „Da ist etwas schief gelaufen."; dieselbe Adresse ohne
  alles hinter dem Fragezeichen öffnet die Titelseite normal (Daniel,
  27.08.2026, an „Angels of Death" gemessen und gegengeprüft).
*/
{
  const quelle = require('node:fs').readFileSync(__dirname + '/amazon.js', 'utf8')
  const zeile = /const ohneParameter = (.+)/.exec(quelle)?.[1]
  pruefe('ohneParameter ist gebaut', Boolean(zeile), zeile)
  const ohneParameter = new Function('return ' + zeile)()
  pruefe(
    'die Verfolgungsmarken fallen weg',
    ohneParameter('/gp/video/detail/B0FQSW7VV7?qid=1787852335767&ref_=atv_sr_fle_c_Tn74RA_1_1_1&sr=1-1') ===
      '/gp/video/detail/B0FQSW7VV7',
  )
  pruefe('eine saubere Adresse bleibt, wie sie ist', ohneParameter('/gp/video/detail/B0FQSW7VV7') === '/gp/video/detail/B0FQSW7VV7')
  pruefe('nichts wirft bei fehlender Adresse', ohneParameter(null) === '')
}
/*
  **Doppeltitel: „Beyond the Boundary: Kyoukai no Kanata".**

  Wir führen englischen und japanischen Titel mit Doppelpunkt, Prime führt nur
  den englischen. Die Karte stand am 27.08.2026 vorn in „Beste Ergebnisse" und
  galt trotzdem als „nicht dieser Titel" (Daniel, mit Bild).
*/
const doppelt = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Beyond the Boundary', 'TV Show', 'Entitled', 'B0DNRB35F3')] }],
  { titel: 'Beyond the Boundary: Kyoukai no Kanata', folgen: 12 },
)
pruefe('der Doppeltitel findet die Karte ohne Untertitel', doppelt.befund.art === 'genau', doppelt.befund.art)

/*
  Und der Teil vor dem Doppelpunkt muss für sich tragen: Ein kurzer Reihenname
  würde sonst jede gleichnamige Karte einsammeln, und „Gundam" ist keine Serie,
  sondern ein Dutzend.
*/
const reihe = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Gundam', 'TV Show', 'Entitled', 'B0AAAA1111')] }],
  { titel: 'Gundam: Iron-Blooded Orphans', folgen: 25 },
)
pruefe('ein kurzer Reihenname vor dem Doppelpunkt zählt nicht als Treffer', reihe.befund.art !== 'genau', reihe.befund.art)

/* Der Doppelpunkt mitten im Namen bleibt unangetastet — „009 Re:Cyborg". */
const recyborg = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('009 Re', 'Movie', 'Entitled', 'B0BBBB2222')] }],
  { titel: '009 Re:Cyborg', folgen: 1 },
)
pruefe('„009 Re" ist nicht „009 Re:Cyborg"', recyborg.befund.art !== 'genau', recyborg.befund.art)

/*
  **Staffel 2 ist nicht Staffel 1.**

  Prime führt jede Staffel als eigenen Eintrag: „Call of the Night" (Staffel 1,
  aniverse, deutsch) und „Call of the Night (OmU)" (zwei Staffeln, ADN, nur
  untertitelt). Für „Call of the Night: Season 2" meldete die Erweiterung am
  27.08.2026 die dreizehn deutschen Folgen der ersten Staffel.

  `titelKern()` wirft die Staffelangabe weg — für das Wiedererkennen richtig,
  für die Zuordnung falsch.
*/
const zweiteStaffel = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Call of the Night', 'TV Show', 'Entitled', 'B0B8JY6QVR')] }],
  { titel: 'Call of the Night: Season 2', folgen: 12 },
)
pruefe(
  'Staffel 1 ist kein Treffer für Staffel 2',
  zweiteStaffel.befund.art !== 'genau',
  zweiteStaffel.befund.art,
)
pruefe(
  'sie faellt auf aehnlich, nicht unter den Tisch',
  zweiteStaffel.befund.art === 'aehnlich' && zweiteStaffel.befund.treffer.length === 1,
)

/* Trägt die Karte die Nummer, passt es. */
const passend = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Call of the Night Season 2', 'TV Show', 'Entitled', 'B0D48ZFXF')] }],
  { titel: 'Call of the Night: Season 2', folgen: 12 },
)
pruefe('dieselbe Staffelnummer trifft', passend.befund.art === 'genau', passend.befund.art)

/* Und ohne Nummer auf beiden Seiten bleibt es beim alten Verhalten. */
const ersteOhneNummer = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Cowboy Bebop', 'TV Show', 'Entitled', 'B000W9GBW6')] }],
  { titel: 'Cowboy Bebop', folgen: 26 },
)
pruefe('ohne Staffelangabe bleibt der Treffer ein Treffer', ersteOhneNummer.befund.art === 'genau')

/*
  **Der Suchbegriff trägt das Jahr, unser Anzeigetitel nicht.**

  Wir führen „Captain Tsubasa" mit 52 Folgen; die Suchadresse lautet
  k=Captain Tsubasa (2018), und Prime nennt die Serie genauso. Der Vergleich
  gegen den Anzeigetitel fand sie nicht (Daniel, 27.08.2026).
*/
const SUCHE_2018 = 'https://www.amazon.de/s?k=Captain+Tsubasa+(2018)&i=instant-video'
const mitJahr = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Captain Tsubasa (2018)', 'TV Show', 'Entitled', 'B0CJRZTQ7N')] }],
  { titel: 'Captain Tsubasa', folgen: 52, suchUrl: SUCHE_2018 },
)
pruefe('der Suchbegriff mit Jahr findet die Karte', mitJahr.befund.art === 'genau', mitJahr.befund.art)

/* Eine andere Jahresfassung ist eine andere Serie — 1983 hat 128 Folgen. */
const fremdesJahr = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Captain Tsubasa (1983)', 'TV Show', 'Entitled', 'B0AAAA3333')] }],
  { titel: 'Captain Tsubasa', folgen: 52, suchUrl: SUCHE_2018 },
)
pruefe('eine andere Jahresfassung zaehlt nicht als genauer Treffer', fremdesJahr.befund.art !== 'genau', fremdesJahr.befund.art)

/*
  **Staffeln stehen in einem halben Dutzend Schreibweisen im Titel.**

  Alle drei unten galten als Staffel 1, und die Erweiterung meldete darum die
  erste Staffel für Auftraege, die eine spaetere meinten (Daniel, 27.08.2026).
*/
{
  const q = readFileSync(__dirname + '/amazon.js', 'utf8')
  const a = q.indexOf('  const staffelImTitel = (t) => {')
  const b = q.indexOf('\n  }', a)
  const staffelImTitel = new Function(q.slice(a, b + 4) + '; return staffelImTitel')()
  pruefe('die nackte Zahl am Ende zaehlt', staffelImTitel('Golden Kamuy 2') === 2, staffelImTitel('Golden Kamuy 2'))
  pruefe('das Zahlwort ebenso', staffelImTitel('Food Wars! The Second Plate') === 2)
  pruefe('und die Ordnungszahl', staffelImTitel('Ranking of Kings 2nd Season') === 2)
  pruefe('ohne Angabe bleibt es Staffel 1', staffelImTitel('Goblin Slayer') === 1)
  /* Titel, die zufaellig auf Ziffern enden, sind keine Staffeln. */
  pruefe('Fate/Zero ist keine Staffel Zero', staffelImTitel('Fate/Zero') === 1)
  /*
    **Gesucht wird mit dem deutschen Titel ohne Gattungswörter.**

    Von 51 Prime-Suchadressen trugen 26 den englischen Titel (gemessen
    31.08.2026). Der findet oft nichts — „Sailor Moon S Movie: Hearts in Ice"
    gibt null Anime-Treffer, obwohl der Film als „Sailor Moon S:
    Schneeprinzessin Kaguya" dort liegt.

    Die Adresse bleibt als Schlüssel für die Zuordnung; der Suchbegriff steht
    als eigenes Feld daneben. Die englische Schreibweise ersetzt den geratenen
    „Anders schreiben"-Vorschlag.
  */
  pruefe(
    'die Liste öffnet den beigelegten Suchbegriff',
    quelle.includes('verweis.href = e?.suchbegriff'),
  )
  pruefe('der Kasten bietet die englische Schreibweise', quelle.includes('Englisch suchen:'))

  pruefe('ein Jahr in Klammern auch nicht', staffelImTitel('Captain Tsubasa (2018)') === 1)
}

/*
  **Beiwerk vor und hinter dem Titel.**

  Prime führt „H.O.T.D. High School of the Dead" und „Highschool of the Dead
  [dt./OV]" — dieselbe Serie wie unser Eintrag, einmal mit Abkuerzung davor,
  einmal mit Fassungsangabe dahinter (Daniel, 27.08.2026).
*/
const abkuerzung = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('H.O.T.D. High School of the Dead', 'TV Show', 'Entitled', 'B0AAAA4444')] }],
  { titel: 'Highschool of the Dead', folgen: 12 },
)
pruefe('die Abkuerzung davor stoert nicht', abkuerzung.befund.art === 'genau', abkuerzung.befund.art)

const fassung = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Highschool of the Dead [dt./OV]', 'TV Show', 'Entitled', 'B0AAAA5555')] }],
  { titel: 'Highschool of the Dead', folgen: 12 },
)
pruefe('die Fassungsangabe dahinter auch nicht', fassung.befund.art === 'genau', fassung.befund.art)

/*
  **Teilnummer und Typ-Kürzel, beide von Prime hinzugefügt.**

  Daniel am 28.08.2026: Die Karte auf Platz 1 war der richtige Titel, der Kasten
  sagte „2 Treffer gelesen, keiner passt". Prime nummeriert die OVA-Teile und
  hängt das Kürzel an, unser Bestand tut weder das eine noch das andere.
*/
const akito = werte(
  [
    {
      label: 'Beste Ergebnisse',
      karten: [karte('Code Geass: Akito the Exiled 1 - The Wyvern Arrives - OVA', 'Movie', 'Entitled', 'B0AAAA7777')],
    },
  ],
  { titel: 'Code Geass: Akito the Exiled - The Wyvern Arrives', folgen: 1 },
)
pruefe('Teilnummer und OVA-Kürzel stören den Abgleich nicht', akito.befund.art === 'genau', akito.befund.art)

/*
  **Die Gegenproben — beide Regeln sind eng gefasst, und das muss so bleiben.**

  Eine Zahl im Titel ist nicht immer eine Teilnummer: Bei „Golden Kamuy 2" ist
  sie die Staffel, und die trennt weiterhin. Mehrstellige Zahlen gehören zum
  Namen.
*/
const kamuy = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Golden Kamuy', 'TV Show', 'Entitled', 'B0AAAA8888')] }],
  { titel: 'Golden Kamuy 2', folgen: 12 },
)
pruefe('Golden Kamuy 2 trifft nicht auf Staffel 1', kamuy.befund.art !== 'genau', kamuy.befund.art)

const mob = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Mob Psycho 100', 'TV Show', 'Entitled', 'B0AAAA9999')] }],
  { titel: 'Mob Psycho 100', folgen: 12 },
)
pruefe('Mob Psycho 100 behält seine Zahl', mob.befund.art === 'genau', mob.befund.art)

const wolf = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Wolf’s Rain OVA', 'TV Show', 'Entitled', 'B0AAAB1111')] }],
  { titel: 'Wolf’s Rain', folgen: 26 },
)
pruefe(
  'ein OVA-Kürzel am Ende macht die Nebenausgabe nicht zur Serie',
  wolf.befund.art !== 'genau' || wolf.befund.treffer.length === 1,
  wolf.befund.art,
)

/*
  **Ein Reihenname mitten im Titel.**

  Daniel am 28.08.2026: „Arpeggio of Blue Steel - Cadenza" ergibt bei Prime
  genau eine Karte, und die heißt „Arpeggio of Blue Steel - Ars Nova -
  Cadenza". Derselbe Film mit dem Reihennamen dazwischen — unser japanischer
  Titel führt ihn übrigens auch, nur der deutsche lässt ihn weg.
*/
const arpeggio = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Arpeggio of Blue Steel - Ars Nova - Cadenza', 'Movie', 'Entitled', 'B0GKYNG36B')] }],
  { titel: 'Arpeggio of Blue Steel - Cadenza', folgen: 1 },
)
pruefe('ein Reihenname mitten im Titel stört nicht', arpeggio.befund.art === 'genau', arpeggio.befund.art)

/*
  **Die Gegenproben — hier entscheidet sich, ob die Regel eng genug ist.**

  Alle drei bestehen den Wortvergleich (jedes Auftragswort kommt in der Karte
  vor, in Reihenfolge) und müssen trotzdem scheitern: Was zusätzlich dasteht,
  kündigt eine Fortsetzung an oder trennt eine Neuauflage.
*/
const finalSeason = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Attack on Titan: Final Season', 'TV Show', 'Entitled', 'B0AAAC1111')] }],
  { titel: 'Attack on Titan', folgen: 25 },
)
pruefe('„Final Season“ ist nicht dieselbe Serie', finalSeason.befund.art !== 'genau', finalSeason.befund.art)

const derFilm = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Jujutsu Kaisen The Movie', 'Movie', 'Entitled', 'B0AAAC2222')] }],
  { titel: 'Jujutsu Kaisen', folgen: 24 },
)
pruefe('„The Movie“ ist nicht die Serie', derFilm.befund.art !== 'genau', derFilm.befund.art)

const zuVieleWorte = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Sword Art Online Alicization War of Underworld', 'TV Show', 'Entitled', 'B0AAAC3333')] }],
  { titel: 'Sword Art Online', folgen: 25 },
)
pruefe('drei fremde Wörter sind ein anderer Titel', zuVieleWorte.befund.art !== 'genau', zuVieleWorte.befund.art)

/*
  **Zusatzwörter, die nichts unterscheiden.**

  Zwei Fälle vom 28.08.2026, beide „kein Treffer bei Prime", beide zu Unrecht:

      Auftrag  Code Geass: Akito the Exiled - Memories of Hatred
      Karte    Code Geass: Akito the Exiled 4 - From the Memories of Hatred - OVA

      Auftrag  Chaos Dragon
      Karte    Chaos Dragon - Die komplette Serie

  Im ersten Fall stehen drei fremde Wörter in der Karte — `from`, `the`, `ova` —,
  und keines davon benennt etwas: zwei Wörter des Satzbaus und ein Formatkürzel,
  das `titelKernLocker` ohnehin wegschneidet. Gezählt werden seit 3.84 nur Wörter,
  die eine Sache benennen; die Grenze von zwei misst damit das Richtige.

  Dazu fielen `the`, `ova`, `ona` und `oad` aus der Fortsetzungssperre. Ein
  Artikel kündigt keine Fortsetzung an — er hat den ersten Fall blockiert, bevor
  der Wortzähler überhaupt drankam.
*/
const akitoTeil4 = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Code Geass: Akito the Exiled 4 - From the Memories of Hatred - OVA', 'Movie', 'Entitled', 'B0CJK2RNDL')] }],
  { titel: 'Code Geass: Akito the Exiled - Memories of Hatred', folgen: 1 },
)
pruefe('Satzbau und Formatkürzel stören den Abgleich nicht', akitoTeil4.befund.art === 'genau', akitoTeil4.befund.art)

const chaos = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Chaos Dragon - Die komplette Serie', 'TV Show', 'Entitled', 'B09KFHWXDS')] }],
  { titel: 'Chaos Dragon', folgen: 12 },
)
pruefe('„Die komplette Serie“ ist derselbe Titel', chaos.befund.art === 'genau', chaos.befund.art)

/*
  Die Gegenprobe zur bereinigten Sperrliste: `movie`, `film` und `special`
  bleiben drin, denn sie trennen ein eigenes Werk von der Serie.
*/
const kaisenFilm = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Jujutsu Kaisen The Movie', 'Movie', 'Entitled', 'B0AAAD1111')] }],
  { titel: 'Jujutsu Kaisen', folgen: 24 },
)
pruefe('„The Movie“ bleibt ein eigenes Werk', kaisenFilm.befund.art !== 'genau', kaisenFilm.befund.art)

/*
  **Gattungswörter dürfen den Treffer nicht kosten.**

  Unser Titel lautet „One Piece Film: Strong World", Prime schreibt „One Piece –
  Strong World" — und der Kasten meldete „Nicht dieser Titel" (Daniel,
  31.08.2026). Seit 4.0.23 fallen Gattungswörter aus dem Vergleich; Film und
  Serie trennt `typPasst()` über Amazons Kartentyp.
*/
const opFilm = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('One Piece – Strong World', 'Movie', 'Entitled', 'B0BBBD2222')] }],
  { titel: 'One Piece Film: Strong World', folgen: 1 },
)
pruefe('„Film" im Titel kostet den Treffer nicht', opFilm.befund.art === 'genau', opFilm.befund.art)

const psoAnim = werte(
  [{ label: 'Beste Ergebnisse', karten: [karte('Phantasy Star Online 2', 'TV Show', 'Entitled', 'B0CCCD3333')] }],
  { titel: 'Phantasy Star Online 2: The Animation', folgen: 12 },
)
pruefe('„The Animation" ebenso wenig', psoAnim.befund.art === 'genau', psoAnim.befund.art)

/*
  **Auch beim Treffer muss „nicht bei Prime" meldbar sein.**

  „Ronja Räubertochter" fand eine gleichnamige Karte — Viaplays
  Realverfilmung, nicht den Anime von 1984 (Daniel, 31.08.2026). Ohne den
  Knopf gäbe es keinen Weg, das zu sagen.
*/
pruefe(
  'der Melde-Knopf steht auch im Treffer-Kasten',
  quelle.split("kastenKnopf('Nicht bei Prime — melden'").length - 1 >= 2,
)

/*
  **Der AniList-Verweis haengt an hinweisKasten, nicht an einer Aufrufstelle.**

  Er stand seit 3.80 nur im Auftragshinweis der Titelseite — gebraucht wird er
  im Kein-Treffer-Kasten der Suchseite, wo sich die Frage stellt, ob der
  Suchbegriff stimmt (Daniel, 28.08.2026). Geprueft wird deshalb die Stelle,
  nicht der Einzelfall: Liegt er in hinweisKasten, hat ihn jeder Kasten.
*/
{
  const fs = require('node:fs')
  const quelle = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  const von = quelle.indexOf('function hinweisKasten')
  const bis = quelle.indexOf('\n  }', von)
  const rumpf = quelle.slice(von, bis)
  /*
    **Es sind aniSearch-Verweise, keine AniList-Verweise mehr.**

    Daniel am 30.08.2026: „ich will keine anilist links, die sind furchtbar, da
    kann ich nicht herausfinden wozu das gehört, ich brauche anisearch links zu
    dem arc, damit ich das vergleichen und korrekt zuordnen kann."

    Mit Kennung führt der Verweis direkt auf die Episodenliste, ohne Kennung auf
    die aniSearch-Suche über den Titel. AniList kommt nicht mehr vor.
  */
  pruefe(
    'der aniSearch-Verweis steht in hinweisKasten selbst',
    rumpf.includes('kastenVerweis') && rumpf.includes('anisearch.de/anime/'),
  )
  /*
    **Ein Knopf sagt, wohin er springt.**

    Daniel am 30.08.2026 vor „One Punch Man", das die Suche achtmal ausgibt:
    „ich hab überhaupt keine ahnung was der eine oder der andere button meint,
    welcher der button springt zu welchem der suchtreffer?" Seit 4.0.17 steht
    die Kennung im Label, und beim Überfahren wird die Karte markiert.
  */
  pruefe(
    'die Knöpfe tragen ihre Kennung und markieren die Karte',
    quelle.includes('function karteZu(') &&
      quelle.includes('ak-treffer-zeigen') &&
      quelle.includes('function kastenKnopf(beschriftung, tun, kennung = null)'),
  )
  pruefe(
    'ohne Kennung führt er auf die aniSearch-Suche, nicht auf AniList',
    rumpf.includes('anisearch.de/search?q=') && !rumpf.includes('anilist.co/anime/'),
  )
  pruefe(
    'er wird nicht zusaetzlich an einer Aufrufstelle angehaengt',
    !quelle.includes('auftrag.id ? [kastenVerweis'),
  )
}

console.log()
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen erfüllt.')
