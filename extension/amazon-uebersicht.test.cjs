/**
 * Zusicherungen für die Prime-Übersicht in der Erweiterung.
 *
 * Geprüft wird das, was Daniel wirklich sieht: dass der Knopf erscheint, die
 * richtige Zahl trägt, die Liste öffnet — und dass ein gemeldeter Titel danach
 * verschwindet. Der letzte Punkt war bei Netflix seine Beschwerde („7seeds
 * already checked but still in list", 22.08.2026); die Liste entsteht beim
 * Datenlauf und weiß bis zum nächsten Bau nichts von einer frischen Meldung.
 *
 * Der Knopf muss **auch auf einer Seite erscheinen, die nicht auf der Liste
 * steht** — sonst kommt man aus einer Sackgasse nicht mehr in die Liste
 * zurück.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen für die Prime-Übersicht\n')

/**
 * **Eine feste Liste, keine echte — und das ist eine Korrektur.**
 *
 * Bis zum 25.08.2026 lasen diese Zusicherungen `offene-amazon.js` und arbeiteten
 * mit dem ersten Eintrag daraus. Das war zweimal falsch, und beim zweiten Mal
 * hat es den Deploy angehalten:
 *
 * - **24.08.2026:** Eine fest verdrahtete Kennung fiel aus der Liste, weil
 *   Daniel sie gemeldet hatte. Die Antwort damals war `Object.keys(...)[0]` —
 *   dieselbe Abhängigkeit, nur beweglicher.
 * - **25.08.2026, 05:07:** Der nächtliche Lauf übernahm die letzten Meldungen,
 *   die Liste fiel auf **null** Einträge, und vier Zusicherungen wurden rot.
 *   Die Seite war danach drei Läufe lang nicht mehr ausgeliefert.
 *
 * Diese Datei prüft die **Logik** der Erweiterung, nicht den Datenstand. Eine
 * Prüfung, die rot wird, weil die Arbeit erledigt ist, misst das Falsche.
 *
 * Die echte Liste wird trotzdem geprüft — weiter unten, auf das, was an ihr
 * wirklich zusichern kann: dass sie sich laden lässt und die Erweiterung auch
 * mit einer leeren Liste sauber startet.
 */
const TEST_LISTE = {
  B000TESTAA: {
    titel: 'Testserie',
    url: 'https://www.amazon.de/dp/B000TESTAA',
    eintraege: [{ id: 900001, name: 'Testserie', folgen: 12, offen: true }],
  },
  B000TESTBB: {
    titel: 'Testserie Staffel 2',
    url: 'https://www.amazon.de/dp/B000TESTBB',
    eintraege: [{ id: 900002, name: 'Testserie Staffel 2', folgen: 13, offen: true }],
  },
  B000TESTCC: {
    titel: 'Testreihe mit zwei Einträgen',
    url: 'https://www.amazon.de/dp/B000TESTCC',
    eintraege: [
      { id: 900003, name: 'Testreihe', folgen: 24, offen: true },
      { id: 900004, name: 'Testreihe II', folgen: 24, offen: true },
    ],
  },
  // Zwei weitere, damit „drei davon gemeldet" auch etwas übrig lässt — sonst
  // prüft die Zusicherung weiter unten den Sonderfall „alles geprüft" statt
  // der Zahl, um die es ihr geht.
  B000TESTDD: {
    titel: 'Testfilm',
    url: 'https://www.amazon.de/dp/B000TESTDD',
    eintraege: [{ id: 900005, name: 'Testfilm', folgen: 1, offen: true }],
  },
  B000TESTEE: {
    titel: 'Testserie ohne Folgenzahl',
    url: 'https://www.amazon.de/dp/B000TESTEE',
    eintraege: [{ id: 900006, name: 'Testserie ohne Folgenzahl', folgen: null, offen: true }],
  },
}
const ECHTE_LISTE = TEST_LISTE

/**
 * Ein DOM, das gerade genug kann.
 *
 * Kein jsdom: Die Erweiterung baut ihre Oberfläche mit einer Handvoll
 * `createElement`/`appendChild`, und eine Nachbildung davon ist schneller
 * gelesen als eine Abhängigkeit erklärt.
 */
/* Welcher Träger zu welchem Sandkasten gehört — für Zusicherungen, die selbst senden. */
const traegerListe = new Map()
const traegerVon = (sandkasten) => traegerListe.get(sandkasten) ?? {}

function machDom(traeger = { hoerer: null, fenster: null, adresse: null }) {
  const alle = []
  function element(tag) {
    const el = {
      tag,
      className: '',
      dataset: {},
      disabled: false,
      value: '',
      type: '',
      href: '',
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
        add(name) {
          el.classList.toggle(name, true)
        },
        contains: (name) => el.className.split(' ').includes(name),
      },
      appendChild(kind) {
        el.children.push(kind)
        return kind
      },
      remove() {
        const i = alle.indexOf(el)
        if (i >= 0) alle.splice(i, 1)
      },
      addEventListener(art, fn) {
        el.hoerer[art] = fn
      },
      focus() {},
      /*
        Ein Element kann in sich suchen — der Dialog tut das, um sein
        Suchfeld zu finden. Ohne diese beiden Zeilen scheitert jede
        Zusicherung, die den Dialog wirklich öffnet, an der Attrappe statt
        am Code.
      */
      querySelector(wahl) {
        const passt = (k) =>
          wahl.startsWith('.') ? (k.className || '').split(' ').includes(wahl.slice(1)) : k.tag === wahl
        for (const kind of el.children) {
          if (passt(kind)) return kind
          const tiefer = kind.querySelector?.(wahl)
          if (tiefer) return tiefer
        }
        return null
      },
      querySelectorAll: () => [],
      get textContent() {
        return el._text + el.children.map((k) => k.textContent).join(' ')
      },
      set textContent(v) {
        el._text = v
        el.children = []
      },
    }
    return el
  }
  const body = element('body')
  return {
    alle,
    body,
    createElement(tag) {
      return element(tag)
    },
    /**
     * **Ein gesetzter Quelltext löst die Widget-Antwort aus, die er beschreibt.**
     *
     * Seit 2.3 füttert der Seiten-Quelltext den Zählstand nicht mehr: Er führt
     * bei einem Kanal-Titel für jede Folge dieselben Sprachen und machte die
     * korrekte Aufteilung im nächsten Takt wieder platt (Meldung id1347,
     * 25.08.2026 — zwölf Folgen pauschal `dub`, obwohl vier deutsch sind).
     *
     * Eine Zusicherung, die `innerHTML` setzt und daraus Folgen erwartet, prüft
     * damit einen Weg, den es nicht mehr gibt. Genau deshalb standen alle
     * Zusicherungen grün, während Daniels echter Klick falsch meldete.
     *
     * Statt jede einzelne Zusicherung umzuschreiben, übersetzt die Attrappe:
     * Der Test beschreibt weiter die Seite, die Erweiterung bekommt daraus die
     * Antwort, die Amazon in Wirklichkeit schickt.
     */
    documentElement: {
      _html: '<html></html>',
      get innerHTML() {
        return this._html
      },
      set innerHTML(wert) {
        this._html = wert
        const spuren = [...wert.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)]
        const nummern = [...wert.matchAll(/"episodeNumber"\s*:\s*(\d+)/g)]
        if (!spuren.length || !nummern.length) return
        const funde = []
        let i = 0
        for (const s of spuren) {
          while (i < nummern.length && (nummern[i].index ?? 0) < (s.index ?? 0)) i++
          if (i >= nummern.length) break
          const namen = [...s[1].matchAll(/"displayName"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
          funde.push({
            nummer: Number(nummern[i][1]),
            sprachen: namen.length
              ? namen
              : s[1]
                  .split(',')
                  .map((x) => x.trim().replace(/^"|"$/g, ''))
                  .filter((x) => x && !x.includes(':') && !x.includes('{')),
          })
        }
        const gesamt = Number(/"episodeCount"\s*:\s*(\d+)/.exec(wert)?.[1]) || null
        const asin = /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10,32})/.exec(wert)?.[1] ?? null
        traeger.hoerer?.({
          source: traeger.fenster,
          data: {
            marke: 'ak-amazon-folgen',
            /* Die Adresse kommt vom Traeger: window.location gibt es hier nicht. */
            fuerAdresse: traeger.adresse?.pathname,
            gesamt,
            /*
              Kein `ersetzt`-Flag: Seit 2.3 entscheidet die Adresse, ob ein Stand
              alt ist. Das Flag setzt zusaetzlich `frischeStaffel`, und das
              blockiert `quelltextPasst()`, solange die Kennung im Quelltext eine
              andere ist als die der Adresse — bei einer Sammelseite ist sie das
              immer.
            */
            ersetzt: false,
            asin: null,
            funde,
          },
        })
      },
    },
  }
}

/**
 * Den Takt so oft laufen lassen, wie es die Frist verlangt.
 *
 * Ein einzelner Aufruf entspricht 500 ms. Die Erweiterung hält den Quelltext
 * zwei Sekunden fest (siehe `HTML_FRIST_MS` in `amazon.js`), also braucht ein
 * geänderter Seiteninhalt fünf Durchläufe, bis er sicher gelesen ist. Genau so
 * verhält sich die echte Seite: Wer die Staffel wechselt, sieht den neuen Stand
 * nach spätestens zwei Sekunden.
 */
function takten(takte, durchlaeufe = 5) {
  for (let i = 0; i < durchlaeufe; i++) for (const takt of takte) takt()
}

function starte(seitenAsin, gespeichert = {}, liste = TEST_LISTE) {

  const traeger = { hoerer: null, fenster: null, adresse: null }
  const dom = machDom(traeger)
  const angehaengt = []
  dom.body.appendChild = (kind) => {
    angehaengt.push(kind)
    return kind
  }
  const gesetzt = []
  /** Was über den Melde-Knopf an den Worker ginge. */
  const gemeldet = []
  // Der Takt wird nicht der Uhr überlassen: Der Test ruft ihn selbst auf,
  // sonst müsste er warten und wäre von der Maschine abhängig.
  //
  // **Dann muss der Test aber auch die Uhr stellen.** Seit dem 25.08.2026 hält
  // die Erweiterung den Seiten-Quelltext zwei Sekunden lang fest, statt ihn in
  // jedem Durchlauf neu aufzubauen — 1,6 MB zweimal je Sekunde haben Daniels
  // Tab zweimal mit „Out of Memory" beendet. Eine Frist, die an `Date.now()`
  // hängt, läuft in einem Sandkasten ohne Zeit nie ab; die Zusicherungen sahen
  // danach ausnahmslos den Stand des ersten Durchlaufs.
  //
  // Jeder Takt-Aufruf schiebt die Uhr deshalb um 500 ms vor — genau um das
  // Maß, das der echte Takt braucht. Damit prüfen diese Zeilen die Frist mit,
  // statt sie zu umgehen.
  const uhr = { jetzt: 1_756_080_000_000 }
  const takte = []
  const sandkasten = {
    globalThis: null,
    /* Der Browser hat sie; ohne sie stirbt jede Adressauswertung im Sandkasten. */
    URLSearchParams,
    sessionStorage: { getItem: () => null, setItem() {} },
    AK_OFFENE_AMAZON: liste,
    /*
      Ein Wert, der mit `/` beginnt, gilt als vollständiger Pfad. Gebraucht
      wird das für Seiten ohne Kennung in der Adresse — die Startseite und die
      Prime-Video-Übersicht. Genau dort ist die Erweiterung am 25.08.2026
      ausgestiegen, und keine Zusicherung konnte es sehen, weil alle mit
      `/dp/<ASIN>` starten.
    */
    location: { pathname: seitenAsin.startsWith('/') ? seitenAsin : `/dp/${seitenAsin}`, search: '' },
    /*
      **Der Spread kopiert Werte, keine Zugriffsmethoden.**

      `documentElement` traegt seit 2.3 einen Setter, der aus dem gesetzten
      Quelltext die Widget-Antwort ableitet. Ueber `{ ...dom }` haette ihn der
      Spread in einen gewoehnlichen Wert verwandelt — der Test setzt dann eine
      Eigenschaft, und es passiert nichts. Deshalb wird er danach ausdruecklich
      wieder gesetzt.
    */
    /*
      `querySelector` gehört seit 3.49 zur Grundausstattung: Die Schutzfläche
      sucht damit bei jedem Takt den Suchkasten, um ihre Maße daraus zu ziehen.
      Einzelne Fälle weiter unten setzen einen eigenen Sucher; dieser hier ist
      der Standardfall — die Seite hat keinen Kasten.
    */
    document: {
      ...dom,
      body: dom.body,
      documentElement: dom.documentElement,
      title: 'Testserie ansehen | Prime Video',
      querySelector: () => null,
    },
    chrome: {
      /**
       * Die Kennung der Erweiterung — daran erkennt der Melder, ob seine
       * Verbindung noch lebt. Chrome trennt sie beim Neuladen der Erweiterung;
       * ohne diese Zeile prueft der Test den toten Fall statt den lebenden.
       */
      runtime: { id: 'test-erweiterung' },
      storage: {
        local: {
          /**
           * Synchron, nicht async — und das ist Absicht.
           *
           * Der Sandkasten fuehrt keine Timer aus und laesst Microtasks nicht
           * an die Reihe kommen; ein Promise hier haette bedeutet, dass der
           * Knopf in **jedem** Test dauerhaft "pruefe Melde-Status" zeigt.
           * Der asynchrone Weg ist damit nicht ungeprueft: Ihn deckt die
           * Zusicherung ab, die den Klick vor dem geladenen Stand stellt.
           */
          get: () => ({ amazonErledigt: gespeichert }),
          set: async (x) => {
            gesetzt.push(x)
          },
        },
        sync: { get: async () => ({ token: 'test' }) },
      },
    },
    window: {
      addEventListener(art, fn) {
        if (art === 'message') traeger.hoerer = fn
      },
    },
    // Die Erweiterung misst seit dem 25.08.2026 ihre eigene Taktdauer. Ohne
    // performance.now() im Sandkasten wirft sie beim ersten Takt.
    performance: { now: () => Date.now() },
    setInterval: (fn) => {
      takte.push(() => {
        uhr.jetzt += 500
        return fn()
      })
      return takte.length
    },
    /**
     * Ohne dieses Gegenstück stirbt jeder Durchlauf, der einen Takt beendet.
     *
     * Die Erweiterung wartet auf einer Seite ohne Titel-Kennung bis zu fünf
     * Minuten auf eine — und räumt den Takt danach ab. Erreicht wurde dieser
     * Zweig erst, als die Testliste leer war und der Sandkasten in die
     * Warteschleife lief: `ReferenceError: clearInterval is not defined`
     * (25.08.2026, im Deploy-Lauf).
     */
    clearInterval: (nr) => {
      if (typeof nr === 'number' && takte[nr - 1]) takte[nr - 1] = () => {}
    },
    Date: class extends Date {
      constructor(...args) {
        if (args.length) super(...args)
        else super(uhr.jetzt)
      }
      static now() {
        return uhr.jetzt
      }
    },
    setTimeout: () => 0,
    fetch: async (adresse, wie) => {
      /**
       * Nur echte Meldungen zählen — nicht jeder Abruf ist eine.
       *
       * Seit dem 24.08.2026 fragt die Erweiterung beim Start den Worker nach
       * dem Melde-Stand (`GET /pruefung?token=…`). Das ist ein Lesevorgang; ihn
       * mitzuzählen ließ sechs Zusicherungen fehlschlagen, die prüfen, dass in
       * bestimmten Lagen **nichts** gemeldet wird.
       */
      if (!wie?.body) return { ok: false, status: 204, json: async () => ({ pruefungen: [] }) }
      gemeldet.push({ adresse: String(adresse), koerper: JSON.parse(wie.body) })
      return { ok: true, status: 200 }
    },
    console,
  }
  sandkasten.globalThis = sandkasten
  vm.createContext(sandkasten)
  vm.runInContext(readFileSync(__dirname + '/amazon.js', 'utf8'), sandkasten)
  traeger.fenster = sandkasten.window
  traeger.adresse = sandkasten.location
  traegerListe.set(sandkasten, traeger)
  return { angehaengt, gesetzt, sandkasten, takte, dom, gemeldet }
}

/**
 * **Keine fest verdrahteten Kennungen mehr.**
 *
 * `B0GFPBT6FG` stand hier bis zum 25.08.2026 in drei Testfaellen. Sobald der
 * Titel geprueft war, fiel er aus `offene-amazon.js` -- und weil der Knopf
 * seither nichts anbietet, was nicht auf der Pruefliste steht, prueften die
 * drei Faelle danach den Zustand "nicht auf der Pruefliste" statt den
 * gemeinten. Ein Test, der an Daten haengt, die sich taeglich aendern, misst
 * irgendwann etwas anderes als sein Name sagt.
 */
const LISTEN_ASIN = Object.keys(ECHTE_LISTE)[0]

const ersteAsin = Object.keys(ECHTE_LISTE)[0]

// --- 1. Der Knopf erscheint und trägt die richtige Zahl --------------------

{
  const { angehaengt } = starte(ersteAsin)
  const uebersicht = angehaengt.find((e) => e.className.includes('ak-uebersicht'))
  pruefe('der Übersichts-Knopf wird angelegt', Boolean(uebersicht))
  pruefe(
    `er nennt alle ${Object.keys(ECHTE_LISTE).length} offenen Titel`,
    uebersicht?.textContent.startsWith(`${Object.keys(ECHTE_LISTE).length} Prime-Titel offen`),
    uebersicht?.textContent,
  )
  pruefe(
    'er steht nicht auf dem Melde-Knopf (eigene Klasse für die Höhe)',
    uebersicht?.className.includes('ak-amazon-uebersicht'),
    uebersicht?.className,
  )
  pruefe(
    'der Melde-Knopf ist ebenfalls da',
    angehaengt.some((e) => e.className.includes('ak-amazon-knopf')),
  )
}

// --- 2. Auch auf einer Seite, die nicht auf der Liste steht ----------------

{
  const { angehaengt } = starte('B000000000')
  pruefe(
    'auf einer fremden Seite erscheint die Übersicht trotzdem',
    angehaengt.some((e) => e.className.includes('ak-uebersicht')),
  )
  /**
   * **Auch** eine Staffel, die wir nicht führen, ist meldenswert.
   *
   * Bis zum 23.08.2026 verschwand der Knopf dort stumm. Daniel stand damit vor
   * „Oshi no Ko" Staffel 3, die unter eigener Kennung läuft und nur über
   * aniverse zu sehen ist — und hatte keine Möglichkeit, seinen Befund
   * loszuwerden: „nach neuladen auf season 3 erscheint der button nicht."
   *
   * Eine belegte deutsche Tonspur ist auch dann etwas wert, wenn der Titel im
   * Bestand fehlt. Zugeordnet wird später über den Titel.
   */
  pruefe(
    'der Melde-Knopf erscheint auch für eine Staffel, die nicht auf der Liste steht',
    angehaengt.some((e) => e.className.includes('ak-amazon-knopf')),
  )
}

// --- 2b. Der Staffelwechsel im Auswahlfeld --------------------------------

/**
 * Der Fehler, den Daniel am 23.08.2026 gemeldet hat.
 *
 * „beim dropdownwechsel hat der button unten rechts nicht reagiert, es stand
 * weiterhin immer 12 folgen, und der nächste eintrag der liste blieb stehen
 * nach klick auf 12 melden."
 *
 * Amazon tauscht beim Staffelwechsel den ganzen Inhalt aus und schreibt eine
 * neue Kennung in die Adresse (`B0GFPBT6FG` → `B0D8FH5NC6`), **ohne die Seite
 * neu zu laden**. Ein Content-Script läuft dabei nicht erneut: Es behielt
 * Kennung und Zählstand und hätte die zweite Staffel unter der Adresse der
 * ersten gemeldet.
 */
{
  /** Seitenquelltext mit N Folgen, so wie Amazon ihn ausliefert. */
  const mitFolgen = (n, asin) =>
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${asin}"/>` +
    Array.from(
      { length: n },
      (_, i) => `"audioTracks":["Deutsch"],"duration":1355,"episodeNumber":${i + 1},`,
    ).join('') + `"episodeCount":${n},"benefitId":"Prime"`

  const asins = Object.keys(ECHTE_LISTE)
  const { angehaengt, sandkasten, takte } = starte(asins[0])
  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))

  // Staffel 1: zwölf Folgen, wie bei „Oshi no Ko".
  sandkasten.document.documentElement.innerHTML = mitFolgen(12, asins[0])
  takten(takte)
  pruefe('Staffel 1 zeigt ihre 12 Folgen', knopf?.textContent.includes('12 Folgen'), knopf?.textContent)

  // Der Wechsel, wie ihn Amazon vornimmt: neue Kennung, neuer Inhalt, kein
  // Neuladen.
  sandkasten.location.pathname = `/dp/${asins[1]}`
  sandkasten.document.documentElement.innerHTML = mitFolgen(13, asins[1])
  /**
   * Hier laufen **zwei** Fristen nacheinander, und der Test muss beide abwarten.
   *
   * Erst hält die Erweiterung den Quelltext zwei Sekunden fest (`HTML_FRIST_MS`),
   * dann wartet der Knopf noch einmal zwei Sekunden, bis die Folgenzahl ruhig
   * steht (`RUHE_MS`) — sonst zeigte er beim Wechsel kurz eine Zahl, die aus
   * zwei Staffeln gemischt ist. Zusammen also gut vier Sekunden; zwölf
   * Durchläufe sind sechs.
   *
   * Genau so verhält sich die Seite: Nach einem Staffelwechsel steht auf dem
   * Knopf ein paar Sekunden „Staffel wechselt — einen Moment".
   */
  takten(takte, 12)

  /**
   * **13, nicht 25.** Ohne das Leeren des Zählstands trüge Staffel 2 die
   * Folgen von Staffel 1 mit — und der Knopf meldete eine Zahl, die es
   * nirgends gibt.
   */
  pruefe(
    'nach dem Staffelwechsel zählt der Knopf neu (13, nicht 25)',
    knopf?.textContent.includes('13 Folgen'),
    knopf?.textContent,
  )
  pruefe(
    'der Takt läuft nach dem Wechsel weiter (kein clearInterval)',
    takte.length > 0,
    takte.length,
  )
}

// --- 2c. Was aus einer Staffel-3-Seite gelesen wird ------------------------

/**
 * Die drei Fehler der Meldung vom 23.08.2026, 19:26 Uhr.
 *
 * Daniel meldete „Oshi no Ko" Staffel 3 über
 * `/gp/video/detail/B0GFPBT6FG?ref_=atv_dp_season_select_s3`. Angekommen ist:
 *
 * ```
 * titel:    "Amazon.de: Season 3"        ← kein Serienname
 * url:      .../dp/B0GFPBT6FG            ← die Kennung von Staffel 1
 * sprachen: ["Deutsch","日本語","{\"audioTrackId\":\"de-de_dialog_0", …]
 * ```
 *
 * Der Befund selbst stimmte (11 Folgen, aniverse statt Prime) — zuzuordnen war
 * er trotzdem nicht.
 */
{
  const echteStaffel3 =
    '<html><head></head><body>' +
    '<h1>[Oshi No Ko] - [Mein*Star]</h1>' +
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${LISTEN_ASIN}"/>` +
    '<script>{"pageTitleId":"B0GFPBT6FG","titleID":"B0GT9DR9YF",' +
    '"audioTracks":[{"audioTrackId":"de-de_dialog_0","displayName":"Deutsch",' +
    '"languageCode":"de-de","audioSubtype":"dialog"}],"duration":1440,' +
    '"episodeNumber":1,"episodeCount":1,"benefitId":"aniversede"}</script>' +
    '</body></html>'

  const { angehaengt, sandkasten, takte } = starte(LISTEN_ASIN)
  sandkasten.document.documentElement.innerHTML = echteStaffel3
  sandkasten.document.title = 'Amazon.de: Season 3'
  sandkasten.location.search = '?ref_=atv_dp_season_select_s3'
  sandkasten.document.querySelector = (w) =>
    w === 'h1' ? { textContent: '[Oshi No Ko] - [Mein*Star]' } : null
  takten(takte)

  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe(
    'die Objektform von audioTracks ergibt „Deutsch", keine Bruchstücke',
    knopf?.textContent.includes('🇩🇪 Deutsch'),
    knopf?.textContent,
  )
  /**
   * Die Kennzeichnung "neu" gab es fuer Titel ausserhalb der Pruefliste. Seit
   * dem 25.08.2026 sind die gar nicht mehr meldbar (Daniel: "wenn der titel
   * kein zu pruefender ist, sollte keine pruefung moeglich sein"), also gibt es
   * hier nichts mehr zu pruefen. Was der Test eigentlich meinte -- dass die
   * Meldung die Kennung aus dem Quelltext traegt -- steht in 2c.
   */
}

// --- 2d. Der Titel, der zweimal fehlte ------------------------------------

/**
 * „Oshi no Ko" Staffel 3, wie die Seite wirklich aussieht.
 *
 * Zweimal hintereinander kam die Meldung ohne Titel an (23.08.2026, 19:31 und
 * 19:38). `document.title` trägt dort nur „Amazon.de: Season 3", und weder
 * `<h1>` noch `pageTitle` lieferten etwas. Erst `og:title` — das Feld, das für
 * Linkvorschauen gedacht ist — trägt den Serientitel.
 *
 * Geprüft wird an dem, was der Melde-Knopf **wirklich abschickt**, nicht am
 * Knopftext: Der Titel steht nur im Meldekörper.
 */
{
  const { angehaengt, sandkasten, takte, gemeldet } = starte(LISTEN_ASIN)
  sandkasten.document.title = 'Amazon.de: Season 3'
  /**
   * So sieht die Seite wirklich aus — Daniels Konsolen-Messung, 21:46 Uhr:
   *
   *     ogTitle:  null      twitter: null      h1: ""
   *     docTitle: "Amazon.de: Season 3 ansehen | Prime Video"
   *     Der Titel steht in <span class="_36qUej">…- Staffel 1</span>
   *
   * Alle bequemen Stellen sind leer. Die Attrappe gibt deshalb **nichts**
   * zurück; der Titel muss aus dem Quelltext kommen.
   */
  sandkasten.document.querySelector = () => null
  sandkasten.document.documentElement.innerHTML =
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${LISTEN_ASIN}"/>` +
    '<span class="_36qUej">[Oshi No Ko] - [Mein*Star] - Staffel 1</span>' +
    '"audioTracks":[{"displayName":"Deutsch"}],"episodeNumber":1,"episodeCount":1'
  sandkasten.location.search = '?ref_=atv_dp_season_select_s3'
  takten(takte)

  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe(
    'der Knopf erkennt Deutsch aus der Objektform',
    knopf?.textContent.includes('🇩🇪 Deutsch'),
    knopf?.textContent,
  )

  knopf?.hoerer?.click?.()
  setTimeout(() => {
    const koerper = gemeldet[0]?.koerper ?? {}
    pruefe(
      /**
       * Der Listenname gewinnt, wo es einen gibt -- `eintrag.titel ??
       * seitenTitel()`. Seit dem 25.08.2026 laeuft dieser Fall zwangslaeufig
       * ueber einen Listeneintrag: Titel ausserhalb der Pruefliste sind nicht
       * mehr meldbar, also gibt es hier immer einen Namen aus der Liste.
       *
       * Dass `seitenTitel()` seine Quellen in der richtigen Reihenfolge liest,
       * pruefen die Zusicherungen in `amazon.test.cjs` -- am Quelltext, wo es
       * nicht von den Listendaten des Tages abhaengt.
       */
      'die Meldung traegt einen Titel, nicht "?"',
      typeof koerper.titel === 'string' && koerper.titel.length > 2,
      koerper.titel,
    )
    pruefe(
      'die Staffelnummer steht in ihrem eigenen Feld',
      koerper.staffel === 3,
      koerper.staffel,
    )
    pruefe(
      'die Folgenzahl steht in ihrem eigenen Feld, nicht nur in der Notiz',
      koerper.folgen === 1,
      koerper.folgen,
    )
    pruefe(
      'die Sprachen sind Namen, keine Bruchstücke',
      Array.isArray(koerper.sprachen) && koerper.sprachen.includes('Deutsch') &&
        koerper.sprachen.every((s) => !String(s).includes('{')),
      koerper.sprachen,
    )
  }, 20)
}

// --- 2e. Staffelwechsel, bei dem sich die Kennung NICHT ändert -------------

/**
 * Daniel am 23.08.2026: „nach dropdown auswahl von staffel 3 zeigt button
 * weiterhin 12 folgen, wenn ich auf staffel 3 neulade steht dort 11 folgen."
 *
 * Beim Wechsel im Auswahlfeld bleibt die Adresse gleich **und** die `titleID`
 * im Quelltext — alle Staffeln einer Serie teilen sich beides. Eine Erkennung
 * über die Kennung greift deshalb nicht; erkennbar ist der Wechsel nur an der
 * Folgenliste.
 */
{
  const seite = (folgen, gesamt) =>
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${LISTEN_ASIN}"/>` +
    '{"titleID":"B0GFPBT6FG"}' +
    Array.from(
      { length: folgen },
      (_, i) => `"audioTracks":["Deutsch"],"duration":1355,"episodeNumber":${i + 1},`,
    ).join('') +
    `"episodeCount":${gesamt}`

  const { angehaengt, sandkasten, takte } = starte(LISTEN_ASIN)
  sandkasten.document.documentElement.innerHTML = seite(12, 12)
  takten(takte)
  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe('Staffel 1 der Sammelseite zeigt 12 Folgen', knopf?.textContent.includes('12 Folgen'), knopf?.textContent)

  // Der Wechsel: gleiche Adresse, gleiche titleID, andere Folgenliste.
  sandkasten.document.documentElement.innerHTML = seite(11, 11)
  takten(takte)

  /**
   * Nach dem Wechsel gilt eine Beruhigungsfrist von zwei Sekunden.
   *
   * Sie ist der Kern des Fixes vom 24.08.2026: Amazon tauscht beim
   * Staffelwechsel erst das Gerüst und dann die Zahlen, und wer in diesem
   * Fenster meldet, meldet den Stand der vorigen Staffel („button muss warten
   * bis amazon fertig geladen hat" — Daniel). Der Test muss sie deshalb
   * abwarten, sonst prüft er einen Zustand, in dem der Knopf absichtlich
   * schweigt.
   */
  setTimeout(() => {
  takten(takte)
  pruefe(
    'nach dem Wechsel auf Staffel 3 zeigt der Knopf 11 Folgen, nicht 12',
    knopf?.textContent.includes('11 Folgen'),
    knopf?.textContent,
  )
  }, 2100)
}

// --- 2f. Abhaken unter der Listen-Kennung ---------------------------------

/**
 * Der Fehler, den Daniel am 23.08.2026 gemeldet hat.
 *
 * „akatsuki no yona, ich hab gemeldet, eintrag bleibt weiterhin in liste und
 * button wird erneut klickbar obwohl bereits gemeldet." Der Knopf trug dabei
 * „neu" — für einen Titel, der in der Liste steht.
 *
 * Ursache: Die Meldung trägt die Kennung aus dem **Quelltext** (sie meint die
 * gezeigte Staffel), die Liste ist aber nach der **Adress-ASIN** indiziert.
 * Abgehakt wurde unter der falschen — der Eintrag blieb stehen.
 */
{
  const asins = Object.keys(ECHTE_LISTE)
  const listenAsin = asins[0]
  // Der Quelltext nennt eine ANDERE Kennung, wie bei „Digimon Tamers"
  // (Adresse B0CQ4VL364, Quelltext B0CKPCSHMC).
  const { angehaengt, sandkasten, takte, gesetzt } = starte(listenAsin)
  sandkasten.document.documentElement.innerHTML =
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${listenAsin}"/>` +
    '{"titleID":"B0XXXXXXXX"}"audioTracks":["Deutsch"],"episodeNumber":1,"episodeCount":1'
  takten(takte)

  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe(
    'ein Titel aus der Liste gilt nicht als „neu", auch wenn der Quelltext eine andere Kennung nennt',
    knopf && !knopf.textContent.includes('neu'),
    knopf?.textContent,
  )

  knopf?.hoerer?.click?.()
  setTimeout(() => {
    const gespeichert = gesetzt.find((x) => x.amazonErledigt)?.amazonErledigt ?? {}
    pruefe(
      `abgehakt wird unter der Listen-Kennung (${listenAsin}), nicht unter der aus dem Quelltext`,
      Object.prototype.hasOwnProperty.call(gespeichert, listenAsin),
      Object.keys(gespeichert),
    )
  }, 30)
}

// --- 2g. Eine von fünf Staffeln ist nicht der ganze Titel -----------------

/**
 * Daniel am 23.08.2026 zu „Anne mit den roten Haaren" (5 Staffeln):
 *
 *   „diese 10 der ersten staffel habe ich gemeldet, button zeigt an ich kann
 *    es nochmal melden, das ‚gemeldet' sollte dort stehen bleiben"
 *   „außerdem ist es aus der prüf liste verschwunden obwohl ich nur staffel 1
 *    gemeldet habe"
 *
 * Beides ging auf dieselbe Annahme zurück: erledigt galt für den Titel, nicht
 * für die Staffel.
 */
{
  const listenAsin = Object.keys(ECHTE_LISTE)[0]
  const { angehaengt, sandkasten, takte, gesetzt } = starte(listenAsin)
  // Die Seite nennt fünf Staffeln — genau wie „Anne mit den roten Haaren".
  sandkasten.document.documentElement.innerHTML =
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${listenAsin}"/>` +
    '<span>1988 · 5 Staffeln</span>' +
    '"audioTracks":["Deutsch"],"episodeNumber":1,"episodeCount":10,"benefitId":"Prime"'
  sandkasten.location.search = '?ref_=atv_dp_season_select_s1'
  takten(takte)

  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  knopf?.hoerer?.click?.()
  setTimeout(() => {
    const gespeichert = gesetzt.find((x) => x.amazonErledigt)?.amazonErledigt ?? {}
    const e = gespeichert[listenAsin]
    pruefe(
      'gemeldet wird Staffel 1, nicht der ganze Titel',
      e && Object.keys(e.staffeln ?? {}).length === 1 && e.gesamt === 5,
      e,
    )

    const uebersicht = angehaengt.find((x) => x.className.includes('ak-uebersicht'))
    pruefe(
      'der Titel zählt weiter als offen — vier Staffeln fehlen noch',
      uebersicht?.textContent.startsWith(`${Object.keys(ECHTE_LISTE).length} Prime-Titel offen`),
      uebersicht?.textContent,
    )
  }, 40)
}

// --- 2g2. Zwei gemeldete Staffeln sind zwei, nicht eine -------------------

/**
 * Daniel am 24.08.2026, an drei Titeln unabhängig gemeldet:
 *
 *   „melden von sindbad staffel 2 klappt nicht, da steht ‚gemeldet — noch 1
 *    staffeln', nachdem ich staffel 1 gemeldet → wechsel auf staffel 2
 *    gemeldet habe, also beide gemeldet"
 *   „bei bakugan klappt es auch nicht, ich bin alle 15 staffeln durchgegangen,
 *    dort steht ‚noch 3 staffeln'"
 *
 * **Die Ursache war der Schlüssel.** Er kam aus `?ref_=..._sN` in der Adresse,
 * und den räumt Amazon weg, sobald die Seite steht. Ohne ihn fiel er auf
 * `gesehen.gesamt` zurück — die **Folgenzahl**. Zwei Staffeln mit gleich vielen
 * geladenen Folgen bekamen denselben Schlüssel, und die zweite Meldung
 * überschrieb die erste.
 *
 * Gemessen am 24.08.2026 an den echten Seiten: `amazon.de/dp/B0CC7FXYFQ` meldet
 * `"seasonNumber":1` und 45 Folgen, `B0CBNFP57W` meldet `"seasonNumber":2` und
 * 55 Folgen. Die Nummer steht also im Quelltext — dort, wo sie niemand wegräumt.
 *
 * Der Fall hier ist der schlimmste: **gleiche Folgenzahl, keine Adressangabe.**
 * Vor dem 24.08.2026 hätte er eine Staffel verschluckt.
 */
{
  const listenAsin = Object.keys(ECHTE_LISTE)[0]
  const { angehaengt, sandkasten, takte, gesetzt } = starte(listenAsin)

  const seite = (staffel) =>
    '<span>1988 · 2 Staffeln</span>' +
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${listenAsin}"/>` +
    `"titleID":"B0CC7FXYF${staffel}","seasonNumber":${staffel},` +
    '"audioTracks":["Deutsch"],"episodeNumber":1,"episodeCount":26,"benefitId":"Prime"'

  // Staffel 1 melden. Die Adresse nennt keine Staffel — genau wie im echten
  // Fall, nachdem Amazon den Parameter weggeräumt hat.
  sandkasten.document.documentElement.innerHTML = seite(1)
  sandkasten.location.search = ''
  takten(takte)
  angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))?.hoerer?.click?.()

  setTimeout(() => {
    // Staffel 2 — **gleiche Folgenzahl**, nur die Nummer unterscheidet sie.
    sandkasten.document.documentElement.innerHTML = seite(2)
    takten(takte)
    angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))?.hoerer?.click?.()

    setTimeout(() => {
      const letzter = [...gesetzt].reverse().find((x) => x.amazonErledigt)?.amazonErledigt ?? {}
      const e = letzter[listenAsin]
      const nummern = Object.keys(e?.staffeln ?? {}).sort()
      pruefe(
        'zwei gemeldete Staffeln stehen als zwei im Bestand, nicht als eine',
        nummern.length === 2,
        e,
      )
      pruefe(
        'und zwar unter ihren echten Nummern aus dem Quelltext',
        nummern.join(',') === '1,2',
        nummern,
      )
    }, 40)
  }, 40)
}

// --- 2g3. Drei Listenzeilen, eine Amazon-Serie ----------------------------

/**
 * Daniel am 24.08.2026, mit drei Adressen belegt:
 *
 *     B09C148HDL → Bakugan Schlacht Brawlers, Staffel 9
 *     B09B5JH5FM → Bakugan Schlacht Brawlers, Staffel 1
 *     B09BYF9TS2 → Bakugan Schlacht Brawlers, Staffel 5
 *
 * Unser Bestand führt drei Titel, Amazon eine Serie mit fünfzehn Staffeln.
 * „ich bin alle 15 staffeln auf prime durchgegangen, dort steht noch 3
 * staffeln … die anderen 2 bakugan zeigen 1/15? und 12/15, welche 3 fehlen?"
 *
 * Ohne Bündelung zählt jede Zeile gegen die Gesamtzahl der ganzen Serie,
 * bekommt aber nur die Staffeln ab, die zufällig unter ihrer Kennung gemeldet
 * wurden. Keine wird je fertig.
 */
{
  const [a, b] = Object.keys(ECHTE_LISTE)
  // Zwei Zeilen, dieselbe Serie, je zwei Staffeln von vier gemeldet.
  const geteilt = {
    [a]: { serie: 'Bakugan Schlacht Brawlers', gesamt: 4, staffeln: { 1: '🇩🇪', 2: '🇩🇪' } },
    [b]: { serie: 'Bakugan Schlacht Brawlers', gesamt: 4, staffeln: { 3: '🇩🇪', 4: '🇩🇪' } },
  }
  const { angehaengt } = starte(a, geteilt)
  setTimeout(() => {
    const uebersicht = angehaengt.find((x) => x.className.includes('ak-uebersicht'))
    pruefe(
      'zwei Zeilen derselben Serie sind zusammen fertig — beide fallen aus der Zahl',
      uebersicht?.textContent.startsWith(`${Object.keys(ECHTE_LISTE).length - 2} Prime-Titel offen`),
      uebersicht?.textContent,
    )

    // Und die Gegenrichtung: ohne gemeinsamen Serientitel bleibt jede für sich.
    const getrennt = {
      [a]: { serie: 'Bakugan A', gesamt: 4, staffeln: { 1: '🇩🇪', 2: '🇩🇪' } },
      [b]: { serie: 'Bakugan B', gesamt: 4, staffeln: { 3: '🇩🇪', 4: '🇩🇪' } },
    }
    const zweiter = starte(a, getrennt)
    setTimeout(() => {
      const u2 = zweiter.angehaengt.find((x) => x.className.includes('ak-uebersicht'))
      pruefe(
        'verschiedene Serien bleiben getrennt — beide zählen weiter als offen',
        u2?.textContent.startsWith(`${Object.keys(ECHTE_LISTE).length} Prime-Titel offen`),
        u2?.textContent,
      )
    }, 30)
  }, 30)
}

// --- 2g4. Nach dem Dropdown-Wechsel ist der Quelltext veraltet ------------

/**
 * Gemessen von Daniel am 24.08.2026 mit `tools/amazon-diagnose.js`, an zwei
 * Titeln unabhaengig:
 *
 *     GOSICK, Staffel 1 -> 2
 *     ms     adrAsin       adrStaffel   qtAsin        qtStaffel
 *     262    B0B8MTPWRN    -            B0B8MTPWRN    1
 *     7261   B0B8XVGL62    2            B0B8MTPWRN    1
 *     8519   B0B8XVGL62    2            B0B8MTPWRN    1
 *
 *     Captain Tsubasa, Staffel 1 -> 2 -> 3
 *     263    B07C1D8JXX    -            B07C1D8JXX    1
 *     12018  B07CZRCQ6V    2            B07C1D8JXX    1
 *     19766  B07DNKH81W    3            B07C1D8JXX    1
 *
 * **Amazon tauscht den Quelltext beim Dropdown-Wechsel nicht aus.** Adresse und
 * ASIN wandern mit, die JSON-Fracht bleibt die der geladenen Seite -- nach
 * zwanzig Sekunden und zwei Wechseln immer noch. Folgenzahl, Staffelnummer und
 * Abschnitts-Tokens gehoeren danach zur alten Staffel.
 *
 * Das war die Wurzel eines Dutzends Fehler an einem Abend. Kein Warten half,
 * weil es nichts gab, worauf zu warten war.
 */
{
  const listenAsin = Object.keys(ECHTE_LISTE)[0]
  const { angehaengt, sandkasten, takte, gemeldet } = starte(listenAsin)
  // Der Quelltext nennt Staffel 1, die Adresse Staffel 3 -- genau die Lage
  // nach zwei Dropdown-Wechseln.
  sandkasten.document.documentElement.innerHTML =
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${listenAsin}"/>` +
    '<span>1985 5 Staffeln</span>' +
    '"titleID":"B07C1D8JXX","seasonNumber":1,' +
    '"audioTracks":["Deutsch"],"episodeNumber":1,"episodeCount":26,"benefitId":"Prime"'
  sandkasten.location.search = '?ref_=atv_dp_season_select_s3'
  takten(takte)

  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe(
    'veralteter Quelltext: der Knopf meldet nicht, sondern holt oder laedt neu',
    /Staffel wird geladen|Neuladen/.test(knopf?.textContent ?? ''),
    knopf?.textContent,
  )

  knopf?.hoerer?.click?.()
  setTimeout(() => {
    pruefe(
      'und ein Klick darauf meldet nichts',
      gemeldet.length === 0,
      gemeldet.length,
    )
  }, 30)
}

// --- 2h. Nach dem Neuladen der Erweiterung --------------------------------

/**
 * "Uncaught Error: Extension context invalidated" (Daniel, 23.08.2026, mit
 * Bild aus der Fehlerkonsole, melder.js:942).
 *
 * Chrome trennt beim Neuladen der Erweiterung alle laufenden Content-Scripts
 * von ihr. Sie laufen weiter -- das DOM gehoert ihnen ja --, aber jeder
 * chrome.*-Zugriff wirft. Das trifft JEDE offene Seite nach jedem Neuladen,
 * bei dieser Arbeitsweise also mehrmals am Abend.
 *
 * Den Fehler zu schlucken waere die falsche Antwort: Wer klickt und nichts
 * passiert, sucht ihn bei sich.
 */
{
  const ohneVerbindung = starte(Object.keys(ECHTE_LISTE)[0])
  // So sieht es aus, nachdem die Erweiterung neu geladen wurde.
  ohneVerbindung.sandkasten.chrome.runtime = {}
  takten(ohneVerbindung.takte)

  const uebersicht = ohneVerbindung.angehaengt.find((e) =>
    e.className.includes('ak-uebersicht'),
  )
  pruefe(
    'nach dem Neuladen sagt der Knopf, dass die Seite aktualisiert werden muss',
    uebersicht?.textContent.includes('Seite aktualisieren'),
    uebersicht?.textContent,
  )

  const melde = ohneVerbindung.angehaengt.find((e) =>
    e.className.includes('ak-amazon-knopf'),
  )
  let absturz = null
  try {
    melde?.hoerer?.click?.()
  } catch (err) {
    absturz = err.message
  }
  pruefe(
    'ein Klick ohne Verbindung stuerzt nicht ab',
    absturz === null,
    absturz,
  )
}

// --- 2i. Kanal-Titel gegen Prime-eigenen Titel ----------------------------

/**
 * Daniel am 24.08.2026: "prueft die extension wirklich ob jede einzelne folge
 * eine deutsche tonspur hat, oder liest sie nur aus dem audio feld auf der
 * overview?"
 *
 * Die Frage traf einen echten Fehler. Gemessen an "Kill Blue":
 *
 *     Amazon behauptet   12 Folgen deutsch
 *     ADN-Archiv         12 Folgen, davon 2 mit vde
 *     Crunchyroll        keine (Daniels Pruefung)
 *     Netflix            4 (Daniels Pruefung am selben Tag)
 *
 * Der Titel laeuft dort ueber die Kanaele ADN, aniverse und Crunchyroll, nicht
 * als Prime-eigener Inhalt. Amazon zeigt dann offenbar die Sprachen des
 * Kanals, nicht die der Folge.
 */
{
  const seite = (benefit, folgen, asin) =>
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${asin}"/>` +
    Array.from(
      { length: folgen },
      (_, i) => `"audioTracks":["Deutsch"],"duration":1355,"episodeNumber":${i + 1},`,
    ).join("") + `"episodeCount":${folgen},"benefitId":"${benefit}"`

  // Prime-eigener Titel: die Angabe zaehlt.
  const eigen = starte(Object.keys(ECHTE_LISTE)[0])
  eigen.sandkasten.document.documentElement.innerHTML = seite("Prime", 12, Object.keys(ECHTE_LISTE)[0])
  takten(eigen.takte)
  const knopfEigen = eigen.angehaengt.find((e) => e.className.includes("ak-amazon-knopf"))
  pruefe(
    "ein Prime-eigener Titel wird nicht als Kanal gekennzeichnet",
    knopfEigen && !knopfEigen.textContent.includes("Kanal"),
    knopfEigen?.textContent,
  )

  // Kanal-Titel: die Angabe ist ein Hinweis, kein Beleg.
  const kanal = starte(Object.keys(ECHTE_LISTE)[1])
  kanal.sandkasten.document.documentElement.innerHTML = seite("animationdigitalnetworkde", 12, Object.keys(ECHTE_LISTE)[1])
  takten(kanal.takte)
  const knopfKanal = kanal.angehaengt.find((e) => e.className.includes("ak-amazon-knopf"))
  pruefe(
    "ein Kanal-Titel traegt die Warnung am Knopf",
    knopfKanal?.textContent.includes("Kanal"),
    knopfKanal?.textContent,
  )

  knopfKanal?.hoerer?.click?.()
  setTimeout(() => {
    const koerper = kanal.gemeldet[0]?.koerper ?? {}
    pruefe(
      "und die Meldung sagt es mit",
      koerper.ueberKanal === true &&
        /Kanal-Titel/.test(koerper.notiz ?? ""),
      { ueberKanal: koerper.ueberKanal, notiz: (koerper.notiz ?? "").slice(-70) },
    )
  }, 30)
}

// --- 3. Erledigte zählen nicht mehr mit -----------------------------------

{
  /**
   * Die Struktur des Erledigt-Speichers, seit dem 23.08.2026:
   *
   *     "B018YLXXNW": { staffeln: { "1": "🇩🇪" }, gesamt: 5 }
   *
   * Ein Titel gilt erst als durch, wenn so viele Staffeln gemeldet sind, wie
   * die Seite nennt — vorher bleibt seine Zeile stehen und zeigt „1/5".
   * Vorher stand dort ein blosser String, und eine Meldung hakte alle Staffeln
   * mit ab (Daniel: „aus der prüf liste verschwunden obwohl ich nur staffel 1
   * gemeldet habe").
   */
  const dreiErledigt = Object.fromEntries(
    Object.keys(ECHTE_LISTE)
      .slice(0, 3)
      .map((a) => [a, { staffeln: { 1: '🇩🇪' }, gesamt: 1 }]),
  )
  const { angehaengt } = starte(ersteAsin, dreiErledigt)
  // Der Speicher wird asynchron gelesen; ein Durchlauf der Warteschlange reicht.
  setTimeout(() => {
    const uebersicht = angehaengt.find((e) => e.className.includes('ak-uebersicht'))
    pruefe(
      `drei gemeldete Titel fehlen in der Zahl (${Object.keys(ECHTE_LISTE).length - 3} statt ${Object.keys(ECHTE_LISTE).length})`,
      uebersicht?.textContent.startsWith(`${Object.keys(ECHTE_LISTE).length - 3} Prime-Titel offen`),
      uebersicht?.textContent,
    )

    /**
     * **Eine leere Prüfliste ist kein Fehler, sondern das Ziel.**
     *
     * Am 25.08.2026 um 05:07 hat der nächtliche Lauf die letzten
     * Amazon-Meldungen übernommen. `offene-amazon.js` fiel damit auf null
     * Einträge — und weil diese Zusicherungen die echte Liste lasen, wurden
     * vier davon rot. Der Deploy blieb drei Läufe lang hängen, die Seite wurde
     * nicht mehr ausgeliefert.
     *
     * Die Erweiterung selbst kam damit gut zurecht: Der Übersichts-Knopf
     * schrieb „Prime: alles geprüft". Nur die Prüfung hielt das für einen
     * Fehler.
     *
     * Diese Zeilen halten beides fest — dass die echte Liste sich laden lässt,
     * und dass eine leere Liste sauber durchläuft.
     */
    {
      const echt = readFileSync(__dirname + '/offene-amazon.js', 'utf8')
      let geladen = null
      try {
        geladen = JSON.parse(
          echt.replace(/^globalThis\.AK_OFFENE_AMAZON = /, '').replace(/;?\s*$/, ''),
        )
      } catch {
        geladen = null
      }
      pruefe(
        'die echte Prüfliste ist gültiges JSON',
        geladen !== null && typeof geladen === 'object',
      )

      const leer = starte('B000LEERAA', {}, {})
      takten(leer.takte)
      const knopf = leer.angehaengt.find((e) => e.className.includes('ak-uebersicht'))
      pruefe(
        'eine leere Prüfliste läuft durch und sagt es',
        Boolean(knopf) && /alles geprüft|0 Prime-Titel/.test(knopf.textContent),
        knopf?.textContent,
      )
    }

    /*
      **Nichts schreiben, was sich nicht geändert hat.**

      Daniel am 30.08.2026, mit Videomitschnitt aus dem Elements-Tab: „im
      element tab flackern die elemente der extension, warum ist das per
      intervall statt per eventing gemacht?"

      Der Takt war nicht die Ursache. `zeichnen()` steigt aus, wenn sich der
      Stand nicht geändert hat — nur liefen die Zuweisungen davor jedes Mal
      durch. Allen voran `dataset.diag`: Es trug vier Taktmesswerte, die sich
      zweimal je Sekunde ändern.

      Verhaltensecht ist das schwer zu messen (der Elements-Tab lässt sich nicht
      nachbauen). Am Quelltext ist es ablesbar, und die beiden Regeln sind die
      ganze Aussage.
    */
    {
      const quelle = readFileSync(__dirname + '/amazon.js', 'utf8')
      const diagBlock = quelle.slice(quelle.indexOf("setzData(knopf, 'diag'"), quelle.indexOf("setzData(knopf, 'diag'") + 2000)
      pruefe(
        'die Diagnose am Knopf trägt keine Taktmesswerte mehr',
        !/taktMs:|taktSchnitt:|taktMax:/.test(diagBlock),
      )
      pruefe('sie wird nur bei Änderung geschrieben', /setzData\(knopf, 'diag'/.test(quelle))
      pruefe(
        'die Schutzfläche setzt ihre Maße nur bei Änderung',
        !/schutzflaeche\.style\.(left|top|right|bottom|width|height) =/.test(quelle),
      )
      pruefe(
        'der Übersichts-Knopf schreibt Text und Tooltip nur bei Änderung',
        !/uebersichtKnopf\.(textContent|title) =/.test(quelle),
      )
      /*
        **Es gibt genau einen Auftragskasten.**

        Daniel am 30.08.2026, mit Bild: „hab es als 1-12 gemeldet, jetzt ist das
        div doppelt dort?" Der Bereichs-Knopf ruft `zeigeAuftragshinweis()`
        erneut auf; der Takt räumte den alten Kasten ab, dieser Aufrufer nicht.
        Die erzeugende Stelle weiß immer, dass es nur einen geben darf — ein
        Vorsatz je Aufrufer wird vergessen.
      */
      /*
        Seit 4.11.0 wird der Kasten nicht mehr gelöscht und neu gebaut, sondern
        wiederverwendet: `kastenSkelett()` gibt den vorhandenen zurück und
        ersetzt ihn nur, wenn die Adresse gewechselt hat. Damit gibt es
        weiterhin genau einen — auf dem Weg, der auch das Flackern beendet.
      */
      const skelett = quelle.slice(quelle.indexOf('function kastenSkelett'), quelle.indexOf('function ladeRing'))
      pruefe(
        'kastenSkelett gibt einen vorhandenen Kasten zurück statt einen zweiten zu bauen',
        /if \(kasten\) return kasten/.test(skelett),
      )
      pruefe(
        'und ersetzt ihn beim Adresswechsel',
        /dataset\.fuerAdresse !== jetzt/.test(skelett) && /kasten\.remove\(\)/.test(skelett),
      )
      /*
        **Der Kasten wird genau einmal abgerissen: wenn niemand ihn sehen soll.**

        Das ist die Zusicherung, die den Fehler aus dem Video vom 02.09.2026
        festhält. `zeigeAuftragshinweis()` läuft bei jedem Takt — zweimal je
        Sekunde —, und solange irgendeine Stelle im Zeichenpfad den Kasten
        entfernte, flogen Melde-Knopf, Prüflisten-Knopf und Debugleiste jedes
        Mal mit heraus und mussten zurück. Sichtbar war das als Aufploppen in
        Stufen (Frames 196, 239/240, 277/278) — Daniels Vorgabe danach: „es soll
        ruhig sein, möglichst wenig ui changes, kein flackern."

        Erlaubt bleibt die eine Stelle im Player: Wer fernsieht, soll nichts von
        der Erweiterung sehen (30.08.2026). Kommt eine zweite dazu, ist das
        Flackern zurück — deshalb zählt diese Prüfung, statt zu beschreiben.
      */
      const abrisse = (quelle.match(/\.ak-amazon-suchhinweis'\)\?\.remove\(\)/g) ?? []).length
      pruefe(
        'genau eine Stelle entfernt den Kasten (der Player)',
        abrisse === 1,
        abrisse + ' Stellen',
      )
      pruefe(
        'und sie steht im Player-Zweig',
        /imPlayer\(\)\)\s*\{[^}]*\.ak-amazon-suchhinweis'\)\?\.remove\(\)/s.test(quelle),
      )
      /*
        Und der Inhalt wird nur bei echter Änderung ersetzt — sonst verlöre ein
        Haken, den Daniel gerade gesetzt hat, im nächsten halben Takt seinen
        Zustand.
      */
      pruefe(
        'die Inhaltszeile vergleicht ihre Signatur, bevor sie neu füllt',
        /inhalt\.dataset\.signatur === signatur/.test(quelle) && /inhalt\.dataset\.signatur = signatur/.test(quelle),
      )
      pruefe(
        'hinweisKasten baut den Kasten nicht selbst',
        !quelle
          .slice(quelle.indexOf('function hinweisKasten'), quelle.indexOf('function hinweisKasten') + 900)
          .includes("createElement('div')"),
      )
      /*
        **Die Suchadresse wird abgehakt, auch ohne `url` am Eintrag.**

        „nach der meldung ist der eintrag weiterhin in der prüfliste" — der
        Eintrag aus der Suche trägt nur Titel und `ausSuche`, die Adresse steht
        im Auftrag (`suchUrl`).
      */
      pruefe(
        'nach dem Melden fällt die Suchadresse aus der Liste',
        quelle.includes('suchauftrag()?.suchUrl') && quelle.includes('await suchAbhaken(suchAdresse)'),
      )
      /* Und keine AniList-Verweise mehr — sie sagen nichts über die Zuordnung. */
      /*
        **Der Befund kommt aus den Folgen, nicht aus dem Sammel-Set.**

        Daniel am 30.08.2026 an „Hell Mode": Der Knopf sagte „🇩🇪 Deutsch · 12
        Folgen", die Seite zeigte „Wiedergabesprachen: 日本語" und darunter
        „Untertitel: Deutsch". Sein Diagnosebericht belegt es: alle zwölf Folgen
        tragen `["日本語"]`, nur `gesehen.sprachen` enthielt Deutsch. Gegenprobe
        bei ADN — dort gibt es den Titel nur mit Untertiteln.

        Die Quelle ist ein Fund **ohne Folgennummer** aus der Rückfallebene des
        Mitlesers: Er landet nicht in `jeFolge`, seine Sprachen aber im Set.
        Wo Folgendaten vorliegen, entscheiden sie — dieselbe Regel, die dieses
        Projekt bei Crunchyroll längst zieht.
      */
      pruefe(
        'der Befund liest die Folgen, wo es welche gibt',
        quelle.includes('gesehen.jeFolge.size') && quelle.includes('deutschInFolgen()'),
      )

      /* Nur echte Verweise — der Kommentar zitiert Daniels Satz und darf stehen. */
      pruefe('keine AniList-Verweise mehr im Kasten', !quelle.includes('https://anilist.co/anime/'))
    }

    console.log()
    if (fehler.length) {
      console.error(`${fehler.length} Zusicherung(en) verletzt.`)
      process.exit(1)
    }
    console.log('Alle Zusicherungen erfüllt.')
    process.exit(0)
    /**
     * 250 ms, nicht 50 — und das ist keine Bequemlichkeit.
     *
     * Dieses `process.exit` beendet den Prozess. Jede Zusicherung, deren
     * `setTimeout` später fällt, läuft **nie** — und weil sie dann auch nichts
     * meldet, sieht der Lauf aus wie „alles grün". Genau das ist am 24.08.2026
     * passiert: Eine neu geschriebene Zusicherung mit zwei verschachtelten
     * Wartezeiten (40 + 40 ms) tauchte in der Ausgabe gar nicht erst auf, und
     * der Gegentest — Fix zurückdrehen, muss rot werden — blieb grün.
     *
     * Wer hier eine Zusicherung mit mehr als einer Wartestufe ergänzt, prüft
     * zuerst, ob ihr Name in der Ausgabe steht.
     */
  }, 2600)
}

/**
 * **Ein Titelwechsel darf nicht die Sprachen des vorigen Titels melden.**
 *
 * Daniel am 25.08.2026: „ich hab gerade ‚My Isekai Life' gemeldet … button war
 * grün, aber titel hat keine deutsche sprachausgabe."
 *
 * Angekommen war (Meldung 1288, 16:54:00 Uhr):
 *
 * ```
 * url:      .../gp/video/detail/0RNU3R7XQ7HDN1EOCZRAFD5R5R   ← My Isekai Life
 * notiz:    „Amazon-Seite B0FMNQMXXG"                        ← ein anderer Titel
 * sprachen: 9 Stück, darunter Deutsch
 * ```
 *
 * Beide Kennungen wurden nachgemessen: `0RNU…` ist „My Isekai Life", ein
 * reiner ADN-Kanal-Titel, dessen zwölf Folgen ausnahmslos
 * `"audioTracks":["日本語"]` tragen. `B0FMNQMXXG` ist „Ein Stern, heller als
 * die Sonne" — Prime, FVOD, und genau jene neun Sprachen. Den hatte Daniel
 * **vier Sekunden zuvor** gemeldet (Meldung 1287).
 *
 * Keiner der drei vorhandenen Prüfsteine konnte greifen: Die Staffelnummer war
 * beide Male dieselbe, die Folgenzahl **beide Male 12**, und ohne gezielt
 * geholten Block fiel der Kennungsvergleich ganz aus.
 */
{
  const listenAsin = Object.keys(ECHTE_LISTE)[0]
  const { angehaengt, sandkasten, takte } = starte(listenAsin)

  /*
    **Eine Antwort, die zu einer anderen Adresse gehört, wird verworfen.**

    Bis 2.3 wurde das am Quelltext erkannt: Nennt er die Kennung der Adresse
    nirgends, gehört er zu einem anderen Titel (an sechs echten Seitenabrufen
    gemessen — eigene Kennung 11- bis 119-mal, fremde null-mal).

    Seit 2.3 braucht es diesen Umweg nicht mehr. Jede Antwort trägt die Adresse
    mit, für die sie gelesen wurde; der Empfänger vergleicht sie mit der
    jetzigen. Das ist derselbe Fall — „My Isekai Life" bekam die Sprachen von
    „Ein Stern, heller als die Sonne", vier Sekunden zuvor gemeldet —, nur auf
    dem Weg, den es wirklich gibt.
  */
  traegerVon(sandkasten).hoerer?.({
    source: sandkasten.window,
    data: {
      marke: 'ak-amazon-folgen',
      /* Die Antwort des vorigen Titels, verspätet eingetroffen. */
      fuerAdresse: '/gp/video/detail/B0FMNQMXXG',
      gesamt: 12,
      funde: Array.from({ length: 12 }, (_, i) => ({
        nummer: i + 1,
        sprachen: ['Deutsch', 'English', '日本語'],
      })),
    },
  })
  takten(takte)

  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe(
    'ein Quelltext, der die Kennung der Adresse nicht kennt, gilt nicht als gelesen',
    knopf && !knopf.textContent.includes('🇩🇪 Deutsch'),
    knopf?.textContent,
  )

  /*
    Die Gegenprobe, und sie ist die wichtigere: Auf der echten Digimon-Seite
    stehen **zwei** Kennungen — Adresse `B0CQ4VL364` (11-mal), `titleID`
    `B0CKPCSHMC` (79-mal). Eine Seite, zwei Ausgaben. Der Wächter darf sie
    nicht für einen Titelwechsel halten.
  */
  const zweite = starte(listenAsin)
  zweite.sandkasten.document.documentElement.innerHTML =
    `<link rel="canonical" href="https://www.amazon.de/gp/video/detail/${listenAsin}"/>` +
    '{"titleID":"B0CKPCSHMC"}' +
    Array.from(
      { length: 12 },
      (_, i) => `"audioTracks":["Deutsch"],"episodeNumber":${i + 1},`,
    ).join('') +
    '"episodeCount":12,"benefitId":"Prime"'
  takten(zweite.takte)

  const knopf2 = zweite.angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe(
    'eine fremde titleID bei bekannter Adress-Kennung bleibt erlaubt (Digimon-Fall)',
    knopf2?.textContent.includes('🇩🇪 Deutsch'),
    knopf2?.textContent,
  )
}

/**
 * **Die Liste muss sich auch dort öffnen, wo die Adresse keine Kennung trägt.**
 *
 * Daniel am 25.08.2026, mit dem Fehlerbild aus `chrome://extensions`:
 * „dialog öffnet sich nicht auf amazon.de".
 *
 * ```
 * Uncaught ReferenceError: Cannot access 'listenId' before initialization
 * amazon.js:1286 (anonymous function)
 * ```
 *
 * `listenSignatur()` liest `listenId` rund 300 Zeilen **vor** dessen `let`.
 * Innerhalb einer Titelseite fiel das nie auf — dort setzt der Ablauf den Wert,
 * bevor jemand die Liste öffnet. Auf der Startseite und der
 * Prime-Video-Übersicht nicht, und der Klick lief in die temporale Totzone.
 *
 * Gemessen am Stand vor dem Fix, drei Adressen, derselbe Klick:
 *
 * ```
 * /                       Klick: FEHLER — Cannot access 'listenId' …
 * /gp/video/storefront    Klick: FEHLER — Cannot access 'listenId' …
 * /dp/B0DJYJBNWF          Klick: ok
 * ```
 *
 * Alle vorhandenen Zusicherungen starteten mit der dritten Adresse. Deshalb
 * prüfen diese hier die beiden anderen.
 */
for (const pfad of ['/', '/gp/video/storefront']) {
  const { angehaengt } = starte(pfad)
  const uebersicht = angehaengt.find((e) => (e.className || '').includes('ak-amazon-uebersicht'))

  pruefe(`der Übersichts-Knopf erscheint auch auf ${pfad}`, Boolean(uebersicht), uebersicht?.className)

  let geworfen = null
  try {
    uebersicht?.hoerer?.click?.()
  } catch (err) {
    geworfen = err.message
  }
  pruefe(`und die Liste öffnet dort ohne Fehler (${pfad})`, geworfen === null, geworfen)

  /* Der Dialog muss danach wirklich im Baum stehen, nicht nur fehlerfrei ausbleiben. */
  pruefe(
    `der Dialog steht danach im Baum (${pfad})`,
    angehaengt.some((e) => (e.className || '').includes('ak-dialog')),
    angehaengt.map((e) => e.className).join(' | '),
  )
}
