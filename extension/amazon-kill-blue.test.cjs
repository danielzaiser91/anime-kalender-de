/**
 * Ein einziger Fall, komplett durchgeprüft: **Kill Blue** (`B0GTN94C9M`).
 *
 * Daniel am 25.08.2026, nachdem die Erweiterung „🇩🇪 Deutsch · 12 Folgen"
 * gemeldet hatte: „auf prime sind es 12 mit crunchy abo. […] adn hat dub bis
 * einschließlich folge 4. crunchy hat 0 folgen deutsch. […] auf netflix gibt es
 * 4 folgen für kill blue auf deutsch."
 *
 * Drei unabhängige Quellen sagen vier. Die Antwort von
 * `getDetailWidgets?titleID=B0GTN94C9M` sagt dasselbe — Amazon liefert es je
 * Folge und liefert es richtig:
 *
 *     Folge 1–4    "audioTracks": ["Deutsch","日本語"]
 *     Folge 5–12   "audioTracks": ["日本語"]
 *
 * Der Fehler lag allein bei uns: `spuren()` warf alle Sprachen in ein Set, und
 * eine einzige deutsche Folge machte daraus eine deutsche Staffel.
 *
 * Diese Datei prüft **nur diesen Fall**, dafür vollständig: vom Quelltext über
 * die Erkennung bis zu dem, was am Ende an den Worker ginge. Erst wenn er steht,
 * geht der Umbau auf alle Titel (Daniel: „immer an einem beispiel erstmal
 * komplett durchtesten").
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen für Kill Blue (B0GTN94C9M)\n')

/**
 * Der Quelltext, wie ihn die echte Antwort trägt.
 *
 * Aufgebaut aus den gemessenen Werten: je Folge ein `audioTracks`-Feld, danach
 * — mit reichlich Abstand, wie im Original — die `episodeNumber`. Dazwischen
 * steht bei Amazon der ganze Aktionsblock mit Kanal-Karten; hier vertritt ihn
 * ein Füllstück derselben Größenordnung, damit die Paarung über die Reihenfolge
 * geprüft wird und nicht über die Nähe.
 */
const DEUTSCH_BIS = 4
const FOLGEN = 12

function killBlueQuelltext() {
  const teile = [
    '<link rel="canonical" href="https://www.amazon.de/gp/video/detail/B0GTN94C9M"/>',
    '<title>Amazon.de: Kill Blue ansehen | Prime Video</title>',
    '{"titleID":"B0GTN94C9M","seasonNumber":1,',
    '"episodeCount":12,',
  ]
  for (let n = 1; n <= FOLGEN; n++) {
    const spuren = n <= DEUTSCH_BIS ? '"Deutsch","日本語"' : '"日本語"'
    teile.push(`"audioTracks":[${spuren}],`)
    /* Der Aktionsblock zwischen Tonspur und Nummer — im Original rund 33.000 Zeichen. */
    teile.push(`"cardOptions":[${'{"benefitId":"animedigitalde"},'.repeat(40)}{"benefitId":"crunchyrollde"}],`)
    teile.push(`"enhancedSubtitles":[{"text":"Deutsch"}],"subtitles":["Deutsch"],`)
    teile.push(`"episodeNumber":${n},"titleType":"episode",`)
  }
  teile.push('"benefitId":"animedigitalde"}')
  return teile.join('')
}

/* --- Der Sandkasten ------------------------------------------------------ */

const LISTE = {
  B0GTN94C9M: {
    titel: 'Kill Blue',
    url: 'https://www.amazon.de/dp/B0GTN94C9M',
    eintraege: [{ id: 990001, name: 'Kill Blue', folgen: 12, offen: true }],
  },
}

function starte() {
  const alle = []
  function element(tag) {
    const el = {
      tag,
      className: '',
      dataset: {},
      disabled: false,
      title: '',
      placeholder: '',
      style: {},
      _text: '',
      children: [],
      hoerer: {},
      classList: {
        toggle(name, an) {
          const hat = el.className.split(' ').includes(name)
          const soll = an === undefined ? !hat : an
          const teile = el.className.split(' ').filter((t) => t && t !== name)
          if (soll) teile.push(name)
          el.className = teile.join(' ')
          return soll
        },
        add(name) { el.classList.toggle(name, true) },
        remove(name) { el.classList.toggle(name, false) },
        contains: (name) => el.className.split(' ').includes(name),
      },
      appendChild(kind) { el.children.push(kind); return kind },
      remove() {},
      addEventListener(art, fn) { el.hoerer[art] = fn },
      focus() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      get textContent() { return el._text + el.children.map((k) => k.textContent).join(' ') },
      set textContent(v) { el._text = v; el.children = [] },
    }
    alle.push(el)
    return el
  }

  const angehaengt = []
  const gemeldet = []
  const uhr = { jetzt: 1_756_080_000_000 }
  const takte = []
  const body = element('body')
  body.appendChild = (kind) => { angehaengt.push(kind); return kind }

  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: LISTE,
    location: { pathname: '/gp/video/detail/B0GTN94C9M', search: '' },
    document: {
      documentElement: { innerHTML: killBlueQuelltext() },
      body,
      title: 'Amazon.de: Kill Blue ansehen | Prime Video',
      createElement: (tag) => element(tag),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      head: element('head'),
    },
    chrome: {
      runtime: { id: 'test-erweiterung' },
      storage: {
        local: { get: (k, cb) => cb({}), set: (v, cb) => cb && cb() },
        sync: { get: () => Promise.resolve({ token: 'test-token' }) },
      },
    },
    window: { addEventListener() {} },
    fetch: (url, opts) => {
      /* Nur POSTs sind Meldungen — der GET davor fragt den Melde-Status ab. */
      if ((opts?.method ?? 'GET') === 'POST') gemeldet.push({ url, koerper: JSON.parse(opts?.body ?? '{}') })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    },
    setInterval: (fn) => { takte.push(fn); return takte.length },
    setTimeout: (fn) => { return 0 },
    clearInterval() {},
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => uhr.jetzt },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    Date: new Proxy(Date, { apply: () => new Date(uhr.jetzt), get: (z, p) => (p === 'now' ? () => uhr.jetzt : z[p]) }),
    JSON, Math, Set, Map, Number, String, Object, Array, Boolean, RegExp, Promise, Error,
    encodeURIComponent, decodeURIComponent,
  }
  sandkasten.globalThis = sandkasten
  sandkasten.window.document = sandkasten.document

  vm.runInNewContext(readFileSync('extension/amazon.js', 'utf8'), sandkasten, { filename: 'amazon.js' })
  return { angehaengt, sandkasten, takte, gemeldet, uhr }
}

function takten(takte, uhr, wie_oft = 14) {
  for (let i = 0; i < wie_oft; i++) {
    uhr.jetzt += 500
    for (const t of takte) t()
  }
}

/* --- Die Prüfungen ------------------------------------------------------- */

const { angehaengt, takte, gemeldet, uhr } = starte()
takten(takte, uhr)

const knopf = angehaengt.find((e) => (e.className || '').includes('ak-amazon-knopf'))

pruefe('der Knopf erscheint', Boolean(knopf), knopf?.className)

/*
  Der Zählstand steht im Diagnosefeld — dort liegt die Karte, aus der die
  Bereiche entstehen. Sie zu prüfen ist genauer als der Knopftext: Sie sagt,
  welche Folge welche Sprachen trägt.
*/
const diag = JSON.parse(knopf?.dataset?.diag ?? '{}')

pruefe('alle 12 Folgen sind gelesen', diag.folgen === 12, diag.folgen)
pruefe('die Staffel nennt 12 Folgen', diag.gesamt === 12, diag.gesamt)
pruefe('der Quelltext gilt als passend', diag.quelltextPasst === true, diag)

/*
  Der Kern des Umbaus: Deutsch steht bei 1 bis 4, nicht bei 5 bis 12. Vor dem
  25.08.2026 hätte die Erweiterung hier zwölf deutsche Folgen behauptet.
*/
const jeFolge = diag.jeFolge ?? {}
const mitDeutsch = Object.keys(jeFolge)
  .map(Number)
  .filter((n) => (jeFolge[n] ?? []).some((s) => /deutsch|german/i.test(s)))
  .sort((a, b) => a - b)

pruefe(
  'genau die Folgen 1 bis 4 tragen Deutsch',
  JSON.stringify(mitDeutsch) === JSON.stringify([1, 2, 3, 4]),
  mitDeutsch,
)
pruefe(
  'Folge 5 trägt nur Japanisch',
  JSON.stringify(jeFolge[5] ?? []) === JSON.stringify(['日本語']),
  jeFolge[5],
)
pruefe(
  'Folge 12 trägt nur Japanisch',
  JSON.stringify(jeFolge[12] ?? []) === JSON.stringify(['日本語']),
  jeFolge[12],
)

/*
  Und der Knopf darf nicht mehr „12 Folgen deutsch" versprechen. Was genau er
  sagt, entscheidet der zweite Teil des Umbaus; hier steht nur, was er **nicht**
  behaupten darf.
*/
pruefe(
  'der Knopf behauptet keine 12 deutschen Folgen',
  !/🇩🇪[^·]*·\s*12 Folgen/.test(knopf?.textContent ?? ''),
  knopf?.textContent,
)

/* --- Was am Ende gemeldet würde ------------------------------------------ */

/*
  **Eine gemischte Staffel wird je Folge gemeldet, eine einheitliche nicht.**

  Der Worker kennt das Feld `folge_nr` bereits, und `fetch-pruefungen.ts` baut
  daraus die Bereiche für `dubRanges`. Es braucht also keine neue Spalte — nur,
  dass die Erweiterung die Aufteilung überhaupt mitschickt.

  Damit der Briefkasten nicht anschwillt, gilt das **nur bei Mischung**: Trägt
  jede Folge dieselben Sprachen, bleibt es bei einer Meldung wie bisher.
*/
knopf?.hoerer?.click?.()

setTimeout(() => {
  pruefe('es geht eine Meldung je Folge raus', gemeldet.length === 12, gemeldet.length)

  const nachNr = new Map(gemeldet.map((m) => [m.koerper.folge_nr, m.koerper]))
  pruefe(
    'Folge 1 wird als dub gemeldet',
    nachNr.get(1)?.befund === 'dub',
    nachNr.get(1)?.befund,
  )
  pruefe(
    'Folge 4 wird als dub gemeldet',
    nachNr.get(4)?.befund === 'dub',
    nachNr.get(4)?.befund,
  )
  pruefe(
    'Folge 5 wird als kein_dub gemeldet',
    nachNr.get(5)?.befund === 'kein_dub',
    nachNr.get(5)?.befund,
  )
  pruefe(
    'Folge 12 wird als kein_dub gemeldet',
    nachNr.get(12)?.befund === 'kein_dub',
    nachNr.get(12)?.befund,
  )
  pruefe(
    'jede Meldung trägt ihre eigenen Sprachen',
    JSON.stringify(nachNr.get(1)?.sprachen) === JSON.stringify(['Deutsch', '日本語']) &&
      JSON.stringify(nachNr.get(12)?.sprachen) === JSON.stringify(['日本語']),
    [nachNr.get(1)?.sprachen, nachNr.get(12)?.sprachen],
  )

  ergebnis()
}, 0)

/* --- Ergebnis ------------------------------------------------------------ */

function ergebnis() {
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) rot.`)
    process.exit(1)
  }
  console.log('\nKill Blue: alle Zusicherungen erfüllt.')
}

/*
  Der Knopftext ist das, was Daniel sieht — er darf nichts anderes sagen als
  die Meldung. Geprüft wird mit einem eigenen Start, bei dem der gespeicherte
  Stand sofort da ist; sonst hängt der Knopf bei „prüfe Melde-Status …".
*/
{
  const zweiter = starte()
  takten(zweiter.takte, zweiter.uhr)
  const k = zweiter.angehaengt.find((e) => (e.className || '').includes('ak-amazon-knopf'))
  const d = JSON.parse(k?.dataset?.diag ?? '{}')
  pruefe(
    'auch der zweite Durchlauf liest die Aufteilung',
    Object.keys(d.jeFolge ?? {}).length === 12,
    Object.keys(d.jeFolge ?? {}).length,
  )
}
