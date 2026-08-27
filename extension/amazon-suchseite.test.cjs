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

console.log('Zusicherungen für die Prime-Suchseiten\n')

// --- 1. Die gelistete Suche bekommt ihren Hinweis -------------------------

const treffer = lauf('/s', '?k=Cowboy+Bebop&i=instant-video&crid=2XYZ')
pruefe('Aufbau auf der Suchseite läuft durch', !treffer.absturz, treffer.absturz?.message)

const kasten = treffer.angehaengt.find((e) => /Anime-Kalender sucht/.test(e.textContent || ''))
pruefe('Hinweis erscheint auf einer gelisteten Suchseite', Boolean(kasten))
pruefe(
  'der Hinweis nennt den gemeinten Titel',
  /Cowboy Bebop/.test(kasten?.textContent ?? ''),
  kasten?.textContent,
)
pruefe(
  'der Hinweis nennt die Folgenzahl aus unserem Bestand',
  /26 Folgen/.test(kasten?.textContent ?? ''),
  kasten?.textContent,
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
  !fremd.angehaengt.some((e) => /Anime-Kalender sucht/.test(e.textContent || '')),
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
const merker = alsTitel.angehaengt.find((e) => /Meldung läuft als/.test(e.textContent || ''))
pruefe('die Titelseite nennt den Titel, unter dem gemeldet wird', Boolean(merker))
pruefe(
  'und die erwartete Folgenzahl als Erkennungsmerkmal',
  /26 Folgen/.test(merker?.textContent ?? ''),
  merker?.textContent,
)

/* Ohne Auftrag bleibt die Titelseite still — der Regelfall. */
const ohne = lauf('/dp/B000W9GBW6', '')
pruefe(
  'ohne Suchauftrag steht dort nichts',
  !ohne.angehaengt.some((e) => /Meldung läuft als/.test(e.textContent || '')),
)
console.log()
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen erfüllt.')
