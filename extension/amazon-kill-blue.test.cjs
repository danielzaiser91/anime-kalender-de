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
    /*
      **Im Quelltext trägt jede Folge Deutsch — auch die acht ohne.**

      So sieht die Seite bei einem Kanal-Titel wirklich aus: Amazon wiederholt
      dort die Sprachen des Kanals je Folge. Die Wahrheit steht allein in der
      Widget-Antwort, die `starte()` unten einspeist (1–4 deutsch, 5–12 nicht).

      Damit prüft diese Datei die Regel, um die es geht: Der Quelltext darf den
      Zählstand nicht anfassen. Führte er ihn, stünden hier zwölf deutsche
      Folgen — und der Knopf verspräche dreimal so viel, wie da ist.
    */
    teile.push('"audioTracks":["Deutsch","日本語"],')
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
    /* Der Browser hat sie; ohne sie stirbt jede Adressauswertung im Sandkasten. */
    URLSearchParams,
    sessionStorage: { getItem: () => null, setItem() {} },
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
    window: {
      addEventListener(art, fn) {
        /* Der Test stellt den Titelwechsel nach — dafür braucht er den Hörer. */
        if (art === 'message') sandkasten.__nachrichtenHoerer = fn
      },
    },
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

  /**
   * **So kommen die Folgen wirklich an: als Widget-Antwort, nicht als Quelltext.**
   *
   * Seit 2.3 füttert der Seiten-Quelltext den Zählstand nicht mehr — er führt
   * bei einem Kanal-Titel für jede Folge dieselben Sprachen und machte die
   * korrekte Aufteilung im nächsten Takt wieder platt (Meldung id1347,
   * 25.08.2026: zwölf Folgen pauschal `dub`).
   *
   * Die Nutzlast ist Zeichen für Zeichen die, die `amazon-leser.js` aus
   * `getDetailWidgets` baut.
   */
  const antwortSenden = () =>
    sandkasten.__nachrichtenHoerer?.({
      source: sandkasten.window,
      data: {
        marke: 'ak-amazon-folgen',
        fuerAdresse: sandkasten.location.pathname,
        gesamt: FOLGEN,
        ersetzt: true,
        asin: 'B0GTN94C9M',
        funde: Array.from({ length: FOLGEN }, (_, i) => ({
          nummer: i + 1,
          sprachen: i + 1 <= DEUTSCH_BIS ? ['Deutsch', '日本語'] : ['日本語'],
          titel: `Folge ${i + 1}`,
          zugaenge: ['animedigitalde'],
        })),
      },
    })
  antwortSenden()

  return { angehaengt, sandkasten, takte, gemeldet, uhr, antwortSenden }
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

/**
 * **Ein Titelwechsel darf keine einzige Zahl der vorigen Seite überleben.**
 *
 * Daniel am 25.08.2026: „warum schmeißt du alt daten nach erkanntem wechsel
 * nicht direkt weg und hörst nur auf widget, sobald neues widget reinkommt
 * alte daten rausschmeißen, dann kann das nie passieren."
 *
 * Der Zählstand hängt seit 2.3 an der Adresse. Diese Zusicherung stellt den
 * Wechsel nach: erst Kill Blue mit zwölf Folgen, dann eine Antwort für eine
 * andere Adresse mit dreien. Danach dürfen es drei sein, nicht fünfzehn.
 */
{
  const { angehaengt, sandkasten, takte, uhr } = starte()
  takten(takte, uhr)

  const k = angehaengt.find((e) => (e.className || '').includes('ak-amazon-knopf'))
  const vorher = JSON.parse(k?.dataset?.diag ?? '{}')
  pruefe('vor dem Wechsel stehen 12 Folgen', vorher.folgen === 12, vorher.folgen)

  /* Die Seite wandert — die Antwort danach gehört zur neuen Adresse. */
  sandkasten.location.pathname = '/gp/video/detail/B0FREMD1234'
  const hoerer = sandkasten.__nachrichtenHoerer
  hoerer?.({
    source: sandkasten.window,
    data: {
      marke: 'ak-amazon-folgen',
      fuerAdresse: '/gp/video/detail/B0FREMD1234',
      gesamt: 3,
      funde: [
        { nummer: 1, sprachen: ['Deutsch'] },
        { nummer: 2, sprachen: ['Deutsch'] },
        { nummer: 3, sprachen: ['Deutsch'] },
      ],
    },
  })
  takten(takte, uhr, 2)

  const nachher = JSON.parse(k?.dataset?.diag ?? '{}')
  pruefe(
    'nach dem Wechsel stehen genau 3 Folgen, nicht 15',
    nachher.folgen === 3,
    nachher.folgen,
  )
  pruefe(
    'und keine Folge der vorigen Seite ist übrig',
    Object.keys(nachher.jeFolge ?? {}).length === 3,
    Object.keys(nachher.jeFolge ?? {}).length,
  )
}

/**
 * **Ein Staffelwechsel wandert oft nur im Parameter — und zählt trotzdem.**
 *
 * Daniel am 25.08.2026 an „Golden Kamuy" Staffel 3, mit Bild: Der Knopf blieb
 * auf „Staffel wird geladen …" stehen.
 *
 * `fuerAdresse` trug bis dahin nur `location.pathname`. Amazon hängt die
 * gewählte Staffel aber als `?ref_=…_sN` an, der Pfad bleibt gleich. Für den
 * Empfänger sah der alte Stand damit weiter gültig aus, während der Wächter
 * davor die Staffelnummern im Quelltext verglich und den Knopf sperrte —
 * beides Reste des Weges, den es seit 2.3 nicht mehr gibt.
 */
{
  const { angehaengt, sandkasten, takte, uhr } = starte()
  takten(takte, uhr)
  const k = angehaengt.find((e) => (e.className || '').includes('ak-amazon-knopf'))
  pruefe('Staffel 1 steht mit 12 Folgen', JSON.parse(k?.dataset?.diag ?? '{}').folgen === 12)

  /* Der Wechsel: gleicher Pfad, andere Staffel im Parameter. */
  sandkasten.location.search = '?ref_=atv_dp_season_select_s3'
  sandkasten.__nachrichtenHoerer?.({
    source: sandkasten.window,
    data: {
      marke: 'ak-amazon-folgen',
      fuerAdresse: sandkasten.location.pathname + sandkasten.location.search,
      gesamt: 5,
      funde: Array.from({ length: 5 }, (_, i) => ({ nummer: i + 1, sprachen: ['Deutsch'] })),
    },
  })
  takten(takte, uhr, 2)

  const d = JSON.parse(k?.dataset?.diag ?? '{}')
  pruefe('nach dem Staffelwechsel stehen 5 Folgen, nicht 17', d.folgen === 5, d.folgen)
  pruefe(
    'und der Knopf hängt nicht auf „Staffel wird geladen"',
    !/wird geladen/.test(k?.textContent ?? ''),
    k?.textContent,
  )
}

/**
 * **Die Kennung der Meldung kommt aus der Adresse, nie aus dem Quelltext.**
 *
 * Daniel am 25.08.2026: „falsche asin darf nie passieren, das ist wieder eine
 * altlast von geparsedtem code."
 *
 * Belegt an zwei Meldungen von 20:20 Uhr. Für „PAC-MAN und die
 * Geisterabenteuer" — beide Staffeln — stand in der Notiz „Amazon-Seite
 * B0FFRD3ZRL". Das ist „New PANTY & STOCKING", der Titel achtzehn Sekunden
 * davor. Die Sprachen stimmten (26 Folgen, alle nur Deutsch, an der Seite
 * nachgemessen) — allein die Kennung stammte vom vorigen Titel.
 *
 * `asin()` las bis dahin `asinAusSeite()` zuerst. Das war die Reihenfolge aus
 * der Zeit, als der Quelltext die einzige Quelle war; er wandert beim Wechsel
 * aber nicht mit, die Adresse schon.
 */
{
  const { angehaengt, sandkasten, takte, uhr, gemeldet } = starte()
  /* Der Quelltext gehört zu einem anderen Titel — wie nach jedem Wechsel. */
  sandkasten.document.documentElement.innerHTML =
    '<link rel="canonical" href="https://www.amazon.de/gp/video/detail/B0FFRD3ZRL"/>' +
    '{"titleID":"B0FFRD3ZRL","seasonNumber":1,"episodeCount":13}'
  takten(takte, uhr)

  const k = angehaengt.find((e) => (e.className || '').includes('ak-amazon-knopf'))
  const d = JSON.parse(k?.dataset?.diag ?? '{}')

  pruefe('die Adresse nennt B0GTN94C9M', d.ausAdresse === 'B0GTN94C9M', d.ausAdresse)
  pruefe(
    'und die gemischte Kennung folgt der Adresse, nicht dem Quelltext',
    d.asinGemischt === 'B0GTN94C9M',
    { asinGemischt: d.asinGemischt, ausSeite: d.ausSeite },
  )

  gemeldet.length = 0
  k?.hoerer?.click?.()
  setTimeout(() => {
    const notizen = gemeldet.map((m) => m.koerper?.notiz ?? '')
    pruefe(
      'keine Meldung nennt die fremde Kennung',
      notizen.length > 0 && !notizen.some((n) => n.includes('B0FFRD3ZRL')),
      notizen[0]?.slice(0, 80),
    )
    ergebnis()
  }, 0)
}

/**
 * **Eine gesperrte Folge sperrt nicht die Staffel.**
 *
 * Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 2, mit Bild: Der Knopf
 * schrieb „✕ in dieser Region nicht mehr verfügbar — melden", obwohl
 * „1. Party Panic" und „2. Roller Duel!" direkt daneben abrufbar sind.
 *
 * Die Prüfung suchte die Sperrmeldung im **ganzen** Quelltext. Bei dieser
 * Staffel steht sie zwölfmal — für zwölf von vierundzwanzig Folgen. Weg ist
 * die Staffel aber nur, wenn keine übrig bleibt.
 */
{
  /* Gemischt: Folge 1 und 2 abrufbar, 3 und 4 gesperrt. */
  const gemischt = starte()
  /* Eigene Adresse: sonst ergaenzt die Antwort den Stand, den starte() schon gesetzt hat. */
  gemischt.sandkasten.location.search = '?ref_=atv_dp_season_select_s9'
  /*
    **Der Quelltext traegt die Sperrmeldung — wie in Wirklichkeit.**

    Bei ZEXAL Staffel 2 steht sie zwoelfmal im Quelltext, fuer zwoelf von
    vierundzwanzig Folgen. Ohne sie im Test pruefte diese Zusicherung nur die
    Haelfte: Sie zeigte nicht, dass die alte Quelltext-Suche die ganze Seite
    gesperrt haette.
  */
  gemischt.sandkasten.document.documentElement.innerHTML =
    '<link rel="canonical" href="https://www.amazon.de/gp/video/detail/B0GTN94C9M"/>' +
    'In deiner Region nicht mehr auf Prime Video verfügbar'.repeat(12)
  takten(gemischt.takte, gemischt.uhr, 2)
  gemischt.sandkasten.__nachrichtenHoerer?.({
    source: gemischt.sandkasten.window,
    data: {
      marke: 'ak-amazon-folgen',
      fuerAdresse: gemischt.sandkasten.location.pathname + gemischt.sandkasten.location.search,
      gesamt: 4,
      funde: [
        { nummer: 1, kennung: 'B000A', sprachen: ['Deutsch'], verfuegbar: true },
        { nummer: 2, kennung: 'B000B', sprachen: ['Deutsch'], verfuegbar: true },
        { nummer: 3, kennung: 'B000C', sprachen: [], verfuegbar: false, hinweis: 'In deiner Region nicht mehr auf Prime Video verfügbar' },
        { nummer: 4, kennung: 'B000D', sprachen: [], verfuegbar: false, hinweis: 'In deiner Region nicht mehr auf Prime Video verfügbar' },
      ],
    },
  })
  takten(gemischt.takte, gemischt.uhr, 8)

  const kg = gemischt.angehaengt.find((e) => (e.className || '').includes('ak-amazon-knopf'))
  const dg = JSON.parse(kg?.dataset?.diag ?? '{}')

  pruefe('nur die abrufbaren Folgen zählen', dg.folgen === 2, dg.folgen)
  pruefe(
    'der Knopf meldet die Staffel nicht als gesperrt',
    !/Region nicht mehr/.test(kg?.textContent ?? ''),
    kg?.textContent,
  )
  pruefe(
    'und die gesperrten gelten nicht als „ohne Deutsch"',
    !Object.values(dg.jeFolge ?? {}).some((s) => Array.isArray(s) && s.length === 0),
    dg.jeFolge,
  )

  /* Vollständig gesperrt: dann ist die Staffel wirklich weg. */
  const ganzWeg = starte()
  ganzWeg.sandkasten.location.search = '?ref_=atv_dp_season_select_s8'
  takten(ganzWeg.takte, ganzWeg.uhr, 2)
  ganzWeg.sandkasten.__nachrichtenHoerer?.({
    source: ganzWeg.sandkasten.window,
    data: {
      marke: 'ak-amazon-folgen',
      fuerAdresse: ganzWeg.sandkasten.location.pathname + ganzWeg.sandkasten.location.search,
      gesamt: 2,
      funde: [
        { nummer: 1, kennung: 'B000E', sprachen: [], verfuegbar: false, hinweis: 'In deiner Region nicht mehr auf Prime Video verfügbar' },
        { nummer: 2, kennung: 'B000F', sprachen: [], verfuegbar: false, hinweis: 'In deiner Region nicht mehr auf Prime Video verfügbar' },
      ],
    },
  })
  takten(ganzWeg.takte, ganzWeg.uhr, 8)

  const kw = ganzWeg.angehaengt.find((e) => (e.className || '').includes('ak-amazon-knopf'))
  pruefe(
    'ist keine Folge übrig, meldet der Knopf die Sperre',
    /Region nicht mehr/.test(kw?.textContent ?? ''),
    kw?.textContent,
  )
}
