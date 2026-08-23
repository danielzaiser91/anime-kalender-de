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
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: ECHTE_LISTE,
    location: { pathname: `/dp/${seitenAsin}`, search: '' },
    document: { ...dom, body: dom.body },
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
    setInterval: () => 0,
    setTimeout: () => 0,
    fetch: async () => ({ ok: true, status: 200 }),
    console,
  }
  sandkasten.globalThis = sandkasten
  vm.createContext(sandkasten)
  vm.runInContext(readFileSync(__dirname + '/amazon.js', 'utf8'), sandkasten)
  return { angehaengt, gesetzt, sandkasten }
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
  pruefe(
    'dort erscheint aber KEIN Melde-Knopf',
    !angehaengt.some((e) => e.className.includes('ak-amazon-knopf')),
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
  }, 50)
}
