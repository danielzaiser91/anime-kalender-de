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
  // Der Takt wird nicht der Uhr überlassen: Der Test ruft ihn selbst auf,
  // sonst müsste er warten und wäre von der Maschine abhängig.
  const takte = []
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: ECHTE_LISTE,
    location: { pathname: `/dp/${seitenAsin}`, search: '' },
    document: { ...dom, body: dom.body, title: 'Testserie ansehen | Prime Video' },
    chrome: {
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
    fetch: async () => ({ ok: true, status: 200 }),
    console,
  }
  sandkasten.globalThis = sandkasten
  vm.createContext(sandkasten)
  vm.runInContext(readFileSync(__dirname + '/amazon.js', 'utf8'), sandkasten)
  return { angehaengt, gesetzt, sandkasten, takte, dom }
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
    '"episodeNumber":1,"episodeCount":11,"benefitId":"aniversede"}</script>' +
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

// --- 3. Erledigte zählen nicht mehr mit -----------------------------------

{
  const dreiErledigt = Object.fromEntries(
    Object.keys(ECHTE_LISTE)
      .slice(0, 3)
      .map((a) => [a, '🇩🇪']),
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
  }, 50)
}
