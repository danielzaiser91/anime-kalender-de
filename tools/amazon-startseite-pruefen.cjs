/**
 * Läuft amazon.js auf der Startseite durch — und öffnet die Liste dort?
 *
 * Aufruf aus dem Repo-Wurzelverzeichnis: node tools/amazon-startseite-pruefen.cjs
 *
 *
 * Alle vorhandenen Zusicherungen starten mit einer Adresse der Form
 * `/dp/<ASIN>`. Daniels Fehlerbild vom 25.08.2026 stammt aber von
 * `https://www.amazon.de/` — dort gibt es keine Kennung in der Adresse.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

/* `box.js` lädt im Browser vor `amazon.js` — hier genauso, sonst fehlt akBox(). */
const quelle = readFileSync('extension/box.js', 'utf8') + String.fromCharCode(10) + readFileSync('extension/amazon.js', 'utf8')
const liste = JSON.parse(
  readFileSync('extension/offene-amazon.js', 'utf8')
    .replace(/^globalThis\.AK_OFFENE_AMAZON\s*=\s*/, '')
    .replace(/;?\s*$/, ''),
)

/*
  **Ein Suchauftrag als Kulisse — die echte Liste hat gerade keinen.**

  Der Suchkasten mit seinen Ankreuz-Feldern entsteht nur, wenn ein Auftrag auf
  **diese** Suchadresse zeigt. `extension/offene-amazon.js` ist eine
  Arbeitsliste: Sie schwankt täglich und ist am Ende leer — sie als Kulisse zu
  nehmen hieße, die Prüfung an den Datenstand zu hängen (CLAUDE.md, 25.08.2026:
  „Testdaten gehören in den Test, nicht in den Datenbestand").

  Die Werte sind Daniels echter Fall vom 09.09.2026: „Death Note: Relight" ist
  **ein** Eintrag mit zwei Folgen, den Prime als zwei Kauftitel führt.
*/
const SUCH_ADRESSE = 'https://www.amazon.de/s?k=Death%20Note%20Relight&i=instant-video'
liste[SUCH_ADRESSE] = {
  titel: 'Death Note: Relight',
  url: SUCH_ADRESSE,
  suchUrl: SUCH_ADRESSE,
  eintraege: [{ id: 2994, name: 'Death Note: Relight', folgen: 2, offen: true }],
}

/*
  **Eine eigene Liste für die Stand-Probe — der echte Bestand schwankt.**

  Am 14.09.2026 zeigte die Statusanzeige „Amazon 6", der Knopf „2 Prime-Titel"
  (Daniel: „das sollte doch single source of truth sein"). Seitdem fragt
  `fertig()` zuerst den Worker-Stand. Die Probe: drei Einträge, der Briefkasten
  leer, der Stand nennt **einen** als offen — der Knopf muss 1 zählen. Die
  alte Rechnung (Briefkasten aller Zeiten) käme auf 3; so fällt die Gegenprobe.
*/
const STAND_LISTE = {
  B0PROBEAAA: { titel: 'Probe A', url: 'https://www.amazon.de/dp/B0PROBEAAA', eintraege: [{ id: 1, name: 'Probe A', folgen: 12, offen: true }] },
  B0PROBEBBB: {
    titel: 'Probe B',
    url: 'https://www.amazon.de/dp/B0PROBEBBB',
    erneut: 'Zuordnung: Probe',
    eintraege: [{ id: 2, name: 'Probe B', folgen: 12, offen: true }],
  },
  B0PROBECCC: { titel: 'Probe C', url: 'https://www.amazon.de/dp/B0PROBECCC', eintraege: [{ id: 3, name: 'Probe C', folgen: 12, offen: true }] },
}
/*
  **Und dieselbe Probe für die Suchen (15.09.2026).** Statusanzeige „3 Suchen",
  Erweiterung „2 Suchen offen": Eine Ausgaben-Suche trug die Adresse einer
  Wochen vorher gemeldeten Suche. Hier stehen beide Suchen im Briefkasten aller
  Zeiten, der Stand nennt eine als offen — der Knopf muss „1 Suchen offen" sagen.
  Die alte Rechnung käme auf keine offene Suche.
*/
const STAND_SUCHE_A = 'https://www.amazon.de/s?k=Probe%20Suche%20A&i=instant-video'
const STAND_SUCHE_B = 'https://www.amazon.de/s?k=Probe%20Suche%20B&i=instant-video'
const STAND_SUCHE = {
  [STAND_SUCHE_A]: { titel: 'Probe Suche A', suchbegriff: 'Probe Suche A', id: 11, folgen: 12 },
  [STAND_SUCHE_B]: { titel: 'Probe Suche B', suchbegriff: 'Probe Suche B', id: 12, folgen: 12 },
}
const STAND_ANTWORT = {
  anbieter: [
    {
      plattform: 'primevideo',
      ziele: [
        { url: 'https://www.amazon.de/dp/B0PROBEBBB', titel: 'Probe B' },
        { url: STAND_SUCHE_A, titel: '' },
      ],
    },
  ],
}
/** Prüfungen, die erst nach den asynchronen Abrufen laufen können. */
const nachDenAbrufen = []

function baueDom() {
  /**
   * **`querySelector` muss wirklich suchen — sonst endet der Ablauf im Nichts.**
   *
   * Bis zum 09.09.2026 gab jeder Mock-Knoten hier `null` zurück. `hinweisKasten()`
   * holt sich damit kein `.ak-z-inhalt`, und **alle** Zeilen des Kastens —
   * Befund, Ankreuz-Felder, Melde-Knopf — werden nie eingehängt. Die Prüfung lief
   * grün, weil sie nichts erreichte: Die Gegenprobe (den Fehler wieder einbauen)
   * blieb ebenfalls grün, und genau daran ist am selben Tag ein Absturz
   * vorbeigelaufen.
   *
   * Gesucht wird, was `amazon.js` wirklich benutzt: Klassennamen (`.ak-z-inhalt`)
   * und Attribut-Auswahl über `data-testid`. Mehr braucht es nicht — und mehr
   * wäre eine DOM-Nachbildung, die selbst Fehler haben kann.
   */
  const passt = (knoten, wahl) => {
    const w = String(wahl).trim()
    if (w.startsWith('.')) return String(knoten.className || '').split(/\s+/).includes(w.slice(1))
    const attr = /^\[([\w-]+)="?([^\]"]+)"?\]$/.exec(w)
    if (attr) return knoten.getAttribute?.(attr[1]) === attr[2]
    return false
  }
  const suche = (knoten, wahl) => {
    for (const k of knoten.kinder ?? []) {
      if (passt(k, wahl)) return k
      const tiefer = suche(k, wahl)
      if (tiefer) return tiefer
    }
    return null
  }
  const mach = () => ({
    className: '',
    /* Angehaengt gilt als verbunden — akBox() prueft es, seit es den Kasten merkt. */
    isConnected: true,
    style: {},
    dataset: {},
    textContent: '',
    title: '',
    type: '',
    disabled: false,
    kinder: [],
    hoerer: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    /*
      Die festen Zeilen des Kastens werden geleert statt gelöscht — sie bleiben
      stehen, damit die Höhe steht (siehe `kastenSkelett()`).
    */
    replaceChildren(...neu) { this.kinder = neu; return undefined },
    appendChild(k) { this.kinder.push(k); return k },
    /* Die Ankreuz-Zeile hängt Feld und Text in einem Aufruf ein. */
    append(...neu) { this.kinder.push(...neu) },
    /* Gemerkt, nicht verworfen: Der Takt entfernt den Kasten auf fremden Seiten (16.09.2026). */
    remove() { this.entfernt = true },
    addEventListener(art, fn) { this.hoerer[art] = fn },
    querySelector(wahl) { return suche(this, wahl) },
    querySelectorAll: () => [],
    focus() {},
insertBefore(k) { this.kinder.push(k); return k },
  })
  const body = mach()
  return { mach, body }
}

/*
  **Die Suchseite gehört dazu — dort war die Erweiterung am 09.09.2026 weg.**

  Geprüft wurden bis dahin Startseite, Storefront und eine Titelseite. Der
  Suchkasten mit seinen Ankreuz-Feldern läuft aber nur auf `/s?k=…`, und genau
  dort warf ein `const`, das vor seiner Deklaration gelesen wurde: „Cannot
  access 'istKanalKarte' before initialization" (Daniel, mit Bild aus der
  Fehlerliste).

  Vierter Fall dieser Klasse — `listenId` (25.08.), `knopf` (28.08.),
  `wiedervorlageBeantwortet` (01.09.). Die drei davor hat diese Datei gefangen,
  diesen nicht: Sie kannte die Seite nicht, auf der er auftritt.

  `search` gehört mit in die Kulisse: Ohne den Suchbegriff hält `amazon.js` die
  Adresse für eine leere Suche und baut den Kasten gar nicht erst.
*/
let fehlgeschlagen = false
const PFADE = [
  { pfad: '/', suche: '' },
  { pfad: '/gp/video/storefront', suche: '' },
  { pfad: '/dp/B0DJYJBNWF', suche: '' },
  { pfad: '/s', suche: '?k=Death%20Note%20Relight&i=instant-video' },
  /* Eine Suche ohne Treffer — dort fehlt Amazons Seitenblock (16.09.2026, Yu-Gi-Oh! Capsule Monsters). */
  { pfad: '/s', suche: '?k=Death%20Note%20Relight&i=instant-video', leer: true },
  /* Die Stand-Probe vom 14.09.2026 — eigene Liste, eigene Abruf-Antworten (siehe `STAND_LISTE`). */
  { pfad: '/gp/video/storefront', suche: '', stand: true },
]

/**
 * Zwei Trefferkarten, wie Amazon sie auf einer Suchseite ausliefert.
 *
 * Gelesen werden genau drei Dinge: `data-card-title`, `data-card-entitlement`
 * und der Verweis auf die Titelseite. Die Werte sind Daniels echter Fall vom
 * 09.09.2026 — „Death Note: Relight" ist ein Eintrag mit zwei Folgen, den Prime
 * als zwei Kauftitel mit eigenen Kennungen führt.
 */
function baueKarten(mach) {
  const karte = (titel, kennung) => {
    const k = mach()
    const attr = {
      'data-card-title': titel,
      'data-card-entitlement': 'Purchase',
      'data-testid': 'card',
    }
    k.getAttribute = (n) => attr[n] ?? null
    k.querySelector = (sel) =>
      sel.includes('/gp/video/detail/')
        ? { getAttribute: () => `https://www.amazon.de/gp/video/detail/${kennung}` }
        : null
    k.querySelectorAll = () => []
    /*
      **`closest` gehört dazu — hier ist der Ablauf gestorben.**

      `suchTreffer()` zählt über `k.closest('ul')?.getAttribute('aria-label')`,
      wie viele Karten in der echten Ergebnisliste stehen. Ohne die Methode wirft
      es „k.closest is not a function", der Wurf steht auf oberster Ebene des
      Skripts (Zeile 4502, `const aufSuchseite = zeigeSuchhinweis() || …`) — und
      **damit endet die Erweiterung**: kein Knopf, kein Takt, kein Kasten.

      Gemessen am 09.09.2026, nachdem drei andere Mängel der Kulisse behoben
      waren. Genau dieser Wurf ist der Grund, warum die Gegenprobe zum
      `istKanalKarte`-Absturz grün blieb: Auf der Suchseite kam das Skript nie
      bis zu dem Zweig, der ihn ausgelöst hätte.
    */
    k.closest = (wahl) =>
      wahl === 'ul' ? { getAttribute: (n) => (n === 'aria-label' ? 'Beste Ergebnisse' : null) } : null
    return k
  }
  return [
    karte('Death Note Relight 1: Visions of a God', 'B0FVDZ286F'),
    karte("Death Note Relight 2: L's Successors", 'B0FWYWSS3M'),
  ]
}

for (const { pfad, suche, stand, leer } of PFADE) {
  const { mach, body } = baueDom()
  /* Amazons eigener Satz auf einer leeren Suche — ohne ihn gilt sie als ungelesen. */
  if (leer) body.innerText = 'Für „Death Note Relight“ wurden keine Ergebnisse gefunden.'
  /* Karten gibt es nur auf der Suchseite — sonst wäre der Kasten dort falsch. */
  const karten = pfad === '/s' && !leer ? baueKarten(mach) : []
  /* Der Takt sammelt sich hier; ausgelöst wird er nach dem Laden. */
  const takte = []
  const angehaengt = []
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: stand ? STAND_LISTE : liste,
    /*
      **Die Prüfliste der Suchen ist eine eigene Liste — gemessen am 09.09.2026.**

      `offeneSuche()` liest `suchliste`, und die kommt aus `AK_PRIME_SUCHE`, nicht
      aus `AK_OFFENE_AMAZON`. Ohne sie findet die Erweiterung auf `/s?k=…` keinen
      Auftrag, `zeigeSuchhinweis()` steigt sofort aus, und der ganze Kasten
      entsteht nie. Genau hier ist der Ablauf ausgestiegen, während die Prüfung
      grün meldete.
    */
    AK_PRIME_SUCHE: stand ? STAND_SUCHE : { [SUCH_ADRESSE]: liste[SUCH_ADRESSE] },
    /*
      **Und ein Sitzungsspeicher — ohne ihn wirft schon `seiteGehtUnsAn()`.**

      Der gemerkte Suchauftrag liegt im `sessionStorage`; jeder Zugriff darauf
      wirft in einem nackten `vm`-Kontext. `eintragFuer()` fängt das ab, gibt
      „unbekannt" zurück, und die Erweiterung hält die Seite für eine, die sie
      nichts angeht: Sie steigt aus, bevor sie einen Takt startet. Auf der
      Suchseite war das genau der Ausstieg, den niemand gesehen hat.
    */
    sessionStorage: (() => {
      const werte = new Map()
      return {
        getItem: (k) => (werte.has(k) ? werte.get(k) : null),
        setItem: (k, v) => werte.set(k, String(v)),
        removeItem: (k) => werte.delete(k),
      }
    })(),
    localStorage: (() => {
      const werte = new Map()
      return {
        getItem: (k) => (werte.has(k) ? werte.get(k) : null),
        setItem: (k, v) => werte.set(k, String(v)),
        removeItem: (k) => werte.delete(k),
      }
    })(),
    location: { pathname: pfad, search: suche, href: 'https://www.amazon.de' + pfad + suche },
    document: {
      /*
        `classList` gehört dazu: `amazon.js` markiert seine Seiten seit dem
        06.09.2026 mit `ak-amazon` am `<html>`, damit eine CSS-Regel für Amazons
        Hinweiskasten nicht auch Netflix trifft. Ohne diese Zeile wirft der
        Aufruf beim Laden, das Skript bricht ab, und vier Zusicherungen der
        Übersicht fallen mit — genau das hat der Sandkasten gemeldet.
      */
      documentElement: {
        innerHTML: '<html></html>',
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      },
      body: { ...body, appendChild(k) { angehaengt.push(k); return k } },
      title: 'Amazon.de',
      createElement: () => mach(),
      /*
        Textknoten sind der zweite Baustein des Kastens: Die Ankreuz-Zeilen
        setzen ihren Text über , nicht über .
        Ohne ihn wirft  — und damit endet wieder das ganze
        Skript (gemessen 09.09.2026, direkt hinter dem -Fund).
      */
      createTextNode: (t) => ({ textContent: String(t), kinder: [] }),
      querySelector: () => null,
      /* Der Takt fragt danach; ohne sie wirft er, bevor er etwas prüft. */
      getElementById: () => null,
      /*
        **Auf der Suchseite stehen Trefferkarten — sonst läuft der halbe
        Suchkasten nie.**

        `suchTreffer()` liest `article[data-testid="card"]` und daraus
        `data-card-title`, `data-card-entitlement` und den Verweis auf die
        Titelseite. Ohne Karten steigt die Auswertung sofort aus, und alles
        dahinter — Trefferbewertung, Ankreuz-Felder, der Kasten selbst — wird
        nie ausgeführt.

        Genau daran ist am 09.09.2026 ein Absturz vorbeigelaufen: `istKanalKarte`
        wurde vor seiner Deklaration gerufen, die Erweiterung war auf jeder
        Suchseite weg, und dieser Sandkasten meldete grün. Die Gegenprobe (den
        Fehler wieder einbauen) blieb ebenfalls grün — der Zweig war unerreichbar.

        Die beiden Karten sind Daniels echter Fall: „Death Note: Relight" ist
        **ein** Eintrag mit zwei Folgen, den Prime als zwei Kauftitel führt.
      */
      querySelectorAll: (sel) => (sel === 'article[data-testid="card"]' ? karten : []),
    focus() {},
      addEventListener() {},
      head: mach(),
    },
    chrome: {
      runtime: { id: 'test' },
      storage: { local: { get: (k, cb) => cb({}), set: (v, cb) => cb && cb() } },
    },
    window: { addEventListener() {}, location: { pathname: pfad, search: '' } },
    /* In der Stand-Probe: leerer Briefkasten, der Worker-Stand nennt einen Eintrag. */
    fetch: (u) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            stand && String(u).includes('stand=1')
              ? STAND_ANTWORT
              : stand && String(u).includes('zaehlen=1')
                ? { adressen: [], gemeldet: [STAND_SUCHE_A, STAND_SUCHE_B], gemeldeteSuchen: [STAND_SUCHE_A, STAND_SUCHE_B] }
                : {},
          ),
      }),
    /*
      **Was der Browser mitbringt, muss der Sandkasten auch mitbringen.**

      Am 28.08.2026 brach die Prüfung mit „URLSearchParams is not defined" ab —
      und zwar an einer Zeile, die im Browser seit Wochen einwandfrei läuft. Eine
      Prüfung, die an ihrer eigenen Umgebung scheitert, meldet einen Fehler, den
      es nicht gibt, und verdeckt die, die es gibt.
    */
    URLSearchParams,
    URL,
    /*
      **Der Takt wird gesammelt, nicht gestartet.**

      `amazon.js` baut seinen Hinweiskasten nicht beim Laden, sondern im Takt —
      ohne ihn bleibt der halbe Suchkasten unerreicht, und genau dort lag am
      09.09.2026 der Absturz, den dieser Sandkasten grün gemeldet hat.

      Sofort auszuführen wäre falsch: Der Takt ruft sich über `setTimeout`
      selbst wieder auf, und die Prüfung liefe endlos. Gesammelt wird deshalb,
      und der erste Durchlauf wird unten einmal von Hand ausgelöst.
    */
    setInterval: (fn) => {
      if (typeof fn === 'function') takte.push(fn)
      return 0
    },
    setTimeout: (fn) => {
      if (typeof fn === 'function') takte.push(fn)
      return 0
    },
    clearInterval() {},
    console,
    performance: { now: () => Date.now() },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    Date,
    JSON,
    Math,
    Set,
    Map,
    Number,
    String,
    Object,
    Array,
    Boolean,
    RegExp,
    Promise,
    Error,
    encodeURIComponent,
    decodeURIComponent,
  }
  sandkasten.globalThis = sandkasten
  sandkasten.window.document = sandkasten.document

  let fehler = null
  try {
    vm.runInNewContext(quelle, sandkasten, { filename: 'amazon.js' })
  } catch (err) {
    fehler = err
  }

  /*
    **Ein Takt-Durchlauf von Hand — dort entsteht der Kasten.**

    Das Laden allein baut nur den Übersichts-Knopf. Alles Weitere — Hinweiskasten,
    Trefferbewertung, Ankreuz-Felder — hängt am Takt, und der ist im Sandkasten
    eine Attrappe. Ein einziger Durchlauf genügt und kann nicht in eine Schleife
    geraten: Was er selbst wieder einplant, sammeln wir nur.

    Ein Wurf hier ist genau der Fund, um den es geht — er wird gezählt, nicht
    verschluckt.
  */
  let taktFehler = null
  for (const fn of takte.slice(0, 3)) {
    try {
      const r = fn()
      if (r && typeof r.catch === 'function') r.catch((e) => { taktFehler ??= e })
    } catch (err) {
      taktFehler ??= err
    }
  }

  const uebersicht = angehaengt.find((e) => (e.className || '').includes('ak-amazon-uebersicht'))
  if (stand) {
    nachDenAbrufen.push(() => {
      const text = String(uebersicht?.textContent ?? '')
      const passt = /(^|\D)1 Prime-Titel · 1 Suchen offen/.test(text)
      console.log(`\n=== Stand-Probe ${pfad} ===`)
      console.log(`  Knopf nach dem Abruf: ${JSON.stringify(text)} — ${passt ? 'ok, zählt den Worker-Stand' : 'FALSCH, erwartet „1 Prime-Titel · 1 Suchen offen“'}`)
      if (!passt) fehlgeschlagen = true
    })
  }
  let klickFehler = null
  if (uebersicht?.hoerer?.click) {
    try { uebersicht.hoerer.click() } catch (err) { klickFehler = err }
  }

  console.log(`\n=== Adresse ${pfad} ===`)
  console.log('  Aufbau:', fehler ? 'FEHLER — ' + fehler.message : 'durchgelaufen')
  console.log('  Knopf:', uebersicht ? JSON.stringify(uebersicht.textContent) : 'FEHLT')
  console.log('  Takt:', taktFehler ? 'FEHLER — ' + taktFehler.message : takte.length + ' gesammelt, ' + Math.min(3, takte.length) + ' gelaufen')
  console.log('  Klick:', klickFehler ? 'FEHLER — ' + klickFehler.message : uebersicht?.hoerer?.click ? 'ok' : 'kein Handler')

  /*
    **Und der Kasten selbst — er ist der Zweck des Ganzen.**

    Bis zum 09.09.2026 endete die Prüfung beim Übersichts-Knopf, und der entsteht
    **vor** allem Interessanten. Der Suchkasten mit Befund, Ankreuz-Feldern und
    Melde-Knopf wurde nie erreicht: Erst fehlten die Trefferkarten, dann die
    Suchseite, dann ein `querySelector`, das wirklich sucht. Jeder dieser drei
    Schritte war nötig, keiner allein genügte — und solange die Gegenprobe grün
    blieb, war es keine Prüfung, sondern eine Kulisse.

    Gezählt werden deshalb die Zeilen im Kasten. Null Zeilen auf der Suchseite
    heißt: Der Ablauf steigt vorher aus, und die Prüfung sagt es jetzt.
  */
  const kasten = angehaengt.find((e) => (e.className || '').includes('ak-amazon-suchhinweis'))
  const inhalt = kasten?.querySelector?.('.ak-z-inhalt') ?? null
  const zeilen = inhalt?.kinder?.length ?? 0
  const texte = (inhalt?.kinder ?? []).map((k) => String(k.textContent ?? '').slice(0, 40)).filter(Boolean)
  console.log('  Kasten:', kasten ? `${zeilen} Zeile(n)${kasten.entfernt ? ', vom Takt ENTFERNT' : ''}` : 'FEHLT')
  for (const t of texte.slice(0, 4)) console.log('        ·', t)
  if (leer && !texte.some((t) => /Nicht bei Prime/.test(t))) {
    console.log('  ⚠ Auf der leeren Suche fehlt „Nicht bei Prime — melden“.')
    fehlgeschlagen = true
  }
  /*
    Auf einer Prime-Video-Seite ohne Titel (Startseite, Serien, Filme) gehört die Prüfliste
    in den Kasten. Bis 4.23.3 entstand er dort nie — die Seite wartete auf eine Kennung, und
    der Knopf hatte keinen Platz (Daniel, 26.09.2026, mit Bild der Startseite). Die Prüfung
    zeigte „Kasten: FEHLT“ und blieb grün.
  */
  if (pfad.startsWith('/gp/video/') && !kasten) {
    console.log('  ⚠ Auf der Prime-Video-Seite fehlt der Kasten — die Prüfliste ist nicht erreichbar.')
    fehlgeschlagen = true
  }
  if (pfad === '/s' && (!kasten || zeilen === 0)) {
    console.log('  ⚠ Auf der Suchseite bleibt der Kasten leer — der Ablauf steigt vor dem Befund aus.')
    fehlgeschlagen = true
  }
}

/*
  **Und das ist der Riegel, um den es die ganze Zeit ging.**

  Am 09.09.2026 waren fünf Mängel dieser Kulisse zu beheben, jeder einzeln
  gemessen — und keiner davon war zu erraten:

  | fehlte | Wirkung |
  |---|---|
  | `querySelector`, das wirklich sucht | der Kasten bekam nie sein `.ak-z-inhalt` |
  | `AK_PRIME_SUCHE` | `offeneSuche()` liest **diese** Liste, nicht `AK_OFFENE_AMAZON` |
  | `sessionStorage` | schon `seiteGehtUnsAn()` lief in seinen Fangzweig |
  | `closest` an den Trefferkarten | `suchTreffer()` warf — auf oberster Ebene, das Skript endete |
  | `createTextNode` und `append` | die Ankreuz-Zeilen warfen an derselben Stelle |

  **Die Gegenprobe fällt jetzt** (den `istKanalKarte`-Fehler wieder einbauen —
  `function` zu `const` machen): „Cannot access 'istKanalKarte' before
  initialization", wörtlich Daniels Fehlerbild vom selben Tag. Bis dahin war
  diese Datei keine Prüfung, sondern eine Kulisse, die grün meldete, weil sie
  nichts erreichte.
*/
/*
  **Die Stand-Probe zählt erst nach den Abrufen.** Briefkasten und Worker-Stand
  kommen über `fetch`, also asynchron — gezählt wird deshalb nach einem echten
  Timer, nicht im Durchlauf selbst.
*/
setTimeout(() => {
  for (const pruefung of nachDenAbrufen) pruefung()
  if (fehlgeschlagen) {
    console.error('\nDer Suchkasten wird nicht erreicht oder die Stand-Probe zählt falsch — die Prüfung misst dann nichts.')
    process.exit(1)
  }
}, 50)
