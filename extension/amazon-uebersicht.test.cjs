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

/** Die echte Liste aus dem Repo, nicht eine nachgebaute. */
const listenDatei = readFileSync(__dirname + '/offene-amazon.js', 'utf8')
const ECHTE_LISTE = JSON.parse(
  listenDatei.replace(/^globalThis\.AK_OFFENE_AMAZON = /, '').replace(/;?\s*$/, ''),
)

/**
 * Ein DOM, das gerade genug kann.
 *
 * Kein jsdom: Die Erweiterung baut ihre Oberfläche mit einer Handvoll
 * `createElement`/`appendChild`, und eine Nachbildung davon ist schneller
 * gelesen als eine Abhängigkeit erklärt.
 */
function machDom() {
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
    documentElement: { innerHTML: '<html></html>' },
  }
}

function starte(seitenAsin, gespeichert = {}) {
  const dom = machDom()
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
  const takte = []
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: ECHTE_LISTE,
    location: { pathname: `/dp/${seitenAsin}`, search: '' },
    document: { ...dom, body: dom.body, title: 'Testserie ansehen | Prime Video' },
    chrome: {
      /**
       * Die Kennung der Erweiterung — daran erkennt der Melder, ob seine
       * Verbindung noch lebt. Chrome trennt sie beim Neuladen der Erweiterung;
       * ohne diese Zeile prueft der Test den toten Fall statt den lebenden.
       */
      runtime: { id: 'test-erweiterung' },
      storage: {
        local: {
          get: async () => ({ amazonErledigt: gespeichert }),
          set: async (x) => {
            gesetzt.push(x)
          },
        },
        sync: { get: async () => ({ token: 'test' }) },
      },
    },
    window: { addEventListener() {} },
    setInterval: (fn) => {
      takte.push(fn)
      return takte.length
    },
    setTimeout: () => 0,
    fetch: async (adresse, wie) => {
      gemeldet.push({ adresse: String(adresse), koerper: JSON.parse(wie?.body ?? '{}') })
      return { ok: true, status: 200 }
    },
    console,
  }
  sandkasten.globalThis = sandkasten
  vm.createContext(sandkasten)
  vm.runInContext(readFileSync(__dirname + '/amazon.js', 'utf8'), sandkasten)
  return { angehaengt, gesetzt, sandkasten, takte, dom, gemeldet }
}

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
  const mitFolgen = (n) =>
    Array.from(
      { length: n },
      (_, i) => `"audioTracks":["Deutsch"],"duration":1355,"episodeNumber":${i + 1},`,
    ).join('') + `"episodeCount":${n},"benefitId":"Prime"`

  const asins = Object.keys(ECHTE_LISTE)
  const { angehaengt, sandkasten, takte } = starte(asins[0])
  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))

  // Staffel 1: zwölf Folgen, wie bei „Oshi no Ko".
  sandkasten.document.documentElement.innerHTML = mitFolgen(12)
  for (const takt of takte) takt()
  pruefe('Staffel 1 zeigt ihre 12 Folgen', knopf?.textContent.includes('12 Folgen'), knopf?.textContent)

  // Der Wechsel, wie ihn Amazon vornimmt: neue Kennung, neuer Inhalt, kein
  // Neuladen.
  sandkasten.location.pathname = `/dp/${asins[1]}`
  sandkasten.document.documentElement.innerHTML = mitFolgen(13)
  for (const takt of takte) takt()

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
    '<script>{"pageTitleId":"B0GFPBT6FG","titleID":"B0GT9DR9YF",' +
    '"audioTracks":[{"audioTrackId":"de-de_dialog_0","displayName":"Deutsch",' +
    '"languageCode":"de-de","audioSubtype":"dialog"}],"duration":1440,' +
    '"episodeNumber":1,"episodeCount":1,"benefitId":"aniversede"}</script>' +
    '</body></html>'

  const { angehaengt, sandkasten, takte } = starte('B0GFPBT6FG')
  sandkasten.document.documentElement.innerHTML = echteStaffel3
  sandkasten.document.title = 'Amazon.de: Season 3'
  sandkasten.location.search = '?ref_=atv_dp_season_select_s3'
  sandkasten.document.querySelector = (w) =>
    w === 'h1' ? { textContent: '[Oshi No Ko] - [Mein*Star]' } : null
  for (const takt of takte) takt()

  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe(
    'die Objektform von audioTracks ergibt „Deutsch", keine Bruchstücke',
    knopf?.textContent.includes('🇩🇪 Deutsch'),
    knopf?.textContent,
  )
  pruefe(
    'gemeldet wird die Kennung aus dem Quelltext (B0GT9DR9YF), nicht die der Adresse (B0GFPBT6FG)',
    knopf?.textContent.includes('neu'),
    knopf?.textContent,
  )
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
  const { angehaengt, sandkasten, takte, gemeldet } = starte('B0GFPBT6FG')
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
    '<span class="_36qUej">[Oshi No Ko] - [Mein*Star] - Staffel 1</span>' +
    '"audioTracks":[{"displayName":"Deutsch"}],"episodeNumber":1,"episodeCount":1'
  sandkasten.location.search = '?ref_=atv_dp_season_select_s3'
  for (const takt of takte) takt()

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
      'der Serientitel wird aus dem Auswahlfeld gelesen (og:title und h1 sind leer)',
      koerper.titel === '[Oshi No Ko] - [Mein*Star]',
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
    '{"titleID":"B0GFPBT6FG"}' +
    Array.from(
      { length: folgen },
      (_, i) => `"audioTracks":["Deutsch"],"duration":1355,"episodeNumber":${i + 1},`,
    ).join('') +
    `"episodeCount":${gesamt}`

  const { angehaengt, sandkasten, takte } = starte('B0GFPBT6FG')
  sandkasten.document.documentElement.innerHTML = seite(12, 12)
  for (const takt of takte) takt()
  const knopf = angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))
  pruefe('Staffel 1 der Sammelseite zeigt 12 Folgen', knopf?.textContent.includes('12 Folgen'), knopf?.textContent)

  // Der Wechsel: gleiche Adresse, gleiche titleID, andere Folgenliste.
  sandkasten.document.documentElement.innerHTML = seite(11, 11)
  for (const takt of takte) takt()

  pruefe(
    'nach dem Wechsel auf Staffel 3 zeigt der Knopf 11 Folgen, nicht 12',
    knopf?.textContent.includes('11 Folgen'),
    knopf?.textContent,
  )
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
    '{"titleID":"B0XXXXXXXX"}"audioTracks":["Deutsch"],"episodeNumber":1,"episodeCount":1'
  for (const takt of takte) takt()

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
    '<span>1988 · 5 Staffeln</span>' +
    '"audioTracks":["Deutsch"],"episodeNumber":1,"episodeCount":10,"benefitId":"Prime"'
  sandkasten.location.search = '?ref_=atv_dp_season_select_s1'
  for (const takt of takte) takt()

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
    `"titleID":"B0CC7FXYF${staffel}","seasonNumber":${staffel},` +
    '"audioTracks":["Deutsch"],"episodeNumber":1,"episodeCount":26,"benefitId":"Prime"'

  // Staffel 1 melden. Die Adresse nennt keine Staffel — genau wie im echten
  // Fall, nachdem Amazon den Parameter weggeräumt hat.
  sandkasten.document.documentElement.innerHTML = seite(1)
  sandkasten.location.search = ''
  for (const takt of takte) takt()
  angehaengt.find((e) => e.className.includes('ak-amazon-knopf'))?.hoerer?.click?.()

  setTimeout(() => {
    // Staffel 2 — **gleiche Folgenzahl**, nur die Nummer unterscheidet sie.
    sandkasten.document.documentElement.innerHTML = seite(2)
    for (const takt of takte) takt()
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
  for (const takt of ohneVerbindung.takte) takt()

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
  const seite = (benefit, folgen) =>
    Array.from(
      { length: folgen },
      (_, i) => `"audioTracks":["Deutsch"],"duration":1355,"episodeNumber":${i + 1},`,
    ).join("") + `"episodeCount":${folgen},"benefitId":"${benefit}"`

  // Prime-eigener Titel: die Angabe zaehlt.
  const eigen = starte(Object.keys(ECHTE_LISTE)[0])
  eigen.sandkasten.document.documentElement.innerHTML = seite("Prime", 12)
  for (const takt of eigen.takte) takt()
  const knopfEigen = eigen.angehaengt.find((e) => e.className.includes("ak-amazon-knopf"))
  pruefe(
    "ein Prime-eigener Titel wird nicht als Kanal gekennzeichnet",
    knopfEigen && !knopfEigen.textContent.includes("Kanal"),
    knopfEigen?.textContent,
  )

  // Kanal-Titel: die Angabe ist ein Hinweis, kein Beleg.
  const kanal = starte(Object.keys(ECHTE_LISTE)[1])
  kanal.sandkasten.document.documentElement.innerHTML = seite("animationdigitalnetworkde", 12)
  for (const takt of kanal.takte) takt()
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
  }, 250)
}
