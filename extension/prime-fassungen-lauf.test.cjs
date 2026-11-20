/**
 * Prime: die Fassungen im Kasten der Titelseite — der Lauf durch `amazon.js` (24.10.2026).
 *
 * Der Briefkasten antwortet asynchron; der Test wartet die Mikrotasks ab, damit die Weiche
 * „Auswahl schon bestätigt" und die Zugangsart der eigenen Seite (Leser-Nachricht) wirken.
 * Die Zeit ist fest (3000), nie die echte Uhr.
 */
const { lies, element, sandkasten, durchlaufen, laufen } = require('./test-kulisse-amazon.cjs')
const FIXTURE = lies('prime-fassungen.fixture.json')
const SUCHE = 'https://www.amazon.de/s?k=Fischen+Impossible&i=instant-video'
const FEST = 32503680000000
const SELBST = '/gp/video/detail/B01MSMV5MA'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const quelle = ['box.js', 'titel-bindung.js', 'melde-sperre.js', 'prime-stand.js', 'prime-stand-ziele.js', 'prime-durchgang-suche.js', 'prime-region.js', 'prime-fassungen.js', 'amazon-knopf-zeichnen.js', 'amazon.js'].map(lies).join('\n')

/** Lädt amazon.js für `pfad`; `seite` kommt als Leser-Nachricht, `erwartungen` vom Briefkasten. */
async function lauf({ hydration, pfad = SELBST, seite = {}, erwartungen = {}, erwartet = undefined, jahr = undefined } = {}) {
  const angehaengt = []
  const handler = []
  let geschickt = false
  const auftrag = { titel: 'Fischen Impossible', id: 1, suchUrl: SUCHE, zeit: FEST, erwartet, jahr }
  const speicher = { 'ak-prime-suchauftrag': JSON.stringify(auftrag) }
  const fenster = {
    addEventListener(art, fn) { if (art === 'message') handler.push(fn) },
    location: { pathname: pfad, search: '' },
  }
  const antwort = { imBriefkasten: {}, adressen: [], gemeldet: [], gemeldeteSeiten: [], erwartungen }
  const k = sandkasten({
    speicher,
    chromeLokal: { get: () => ({ amazonErledigt: {}, amazonSuche: {} }), set: () => Promise.resolve() },
    fetch: (u) => {
      if (!geschickt && String(u).includes('stand=1')) {
        geschickt = true
        const daten = { marke: 'ak-amazon-folgen', fuerAdresse: pfad, gesamt: 1, seite }
        for (const h of handler) h({ source: fenster, data: daten })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(antwort) })
    },
  })
  const dokument = {
    documentElement: { innerHTML: '<html></html>', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild(e) { angehaengt.push(e); return e } },
    body: { ...element(), appendChild(e) { angehaengt.push(e); return e } },
    title: 'Amazon.de',
    createElement: () => element(),
    createTextNode: (t) => ({ textContent: t }),
    getElementById: (id) => (id === 'dv-web-page-hydration-data' ? hydration : null),
    querySelector: (sel) => (sel === '.ak-amazon-suchhinweis' ? angehaengt.find((e) => String(e.className).includes('ak-amazon-suchhinweis')) ?? null : null),
    querySelectorAll: () => [],
    addEventListener() {},
    head: element(),
  }
  Object.assign(k, {
    AK_PRIME_SUCHE: { [SUCHE]: { titel: 'Fischen Impossible', id: 1 } },
    location: { pathname: pfad, search: '', href: 'https://www.amazon.de' + pfad },
    document: dokument,
    window: fenster,
  })
  fenster.document = dokument
  const { absturz } = laufen([quelle], k)
  await durchlaufen()
  k.takt()
  await durchlaufen()
  return { absturz, angehaengt }
}

function zeilen(e, aus = []) {
  if (String(e?.className ?? '').split(/\s+/).includes('ak-such-auswahl')) aus.push(e)
  for (const k of e?.kinder ?? []) zeilen(k, aus)
  return aus
}
const zeilenText = (z) => (z.kinder ?? []).map((k) => k.textContent ?? '').join('')
/** Die Ankreuzzeilen der Fassungsauswahl (die Checkliste einer bestätigten Auswahl hat keine Ankreuzfelder). */
const auswahl = (l) => l.angehaengt.flatMap((e) => zeilen(e)).filter((z) => z.kinder[0]?.type === 'checkbox')
const texte = (l) => auswahl(l).map(zeilenText)
const alleTexte = (liste) => liste.flatMap((e) => [e.textContent, ...alleTexte(e.kinder ?? [])]).filter(Boolean)
const daten = (f) => JSON.parse(JSON.stringify(f))

async function main() {
  console.log('Zusicherungen für die Fassungen im Kasten der Titelseite\n')
  const knoten = { textContent: FIXTURE }

  const basis = await lauf({ hydration: knoten })
  pruefe('Lauf ohne Absturz', !basis.absturz, basis.absturz?.message)
  pruefe('Titelseite eines Suchauftrags ohne Auswahl: alle drei Fassungen stehen als Ankreuzzeilen (20.11.2026, gleiche Gruppe wie die Suchseite)', auswahl(basis).map((z) => z.kinder[0].dataset.kennung).sort().join() === 'B01HRLV328,B01MSMV5MA,B0GVNJRZCM', texte(basis))
  pruefe('… mit Knopf „Auswahl übernehmen“', alleTexte(basis.angehaengt).includes('Auswahl übernehmen'), alleTexte(basis.angehaengt))
  const eine = await lauf({ hydration: knoten, erwartungen: { [SUCHE]: ['B0AAAAAAAA'] } })
  pruefe('eine gewählte Karte: auch dann keine Ankreuzfelder auf der Titelseite', auswahl(eine).length === 0, texte(eine))

  // Ribbit (31.10.2026): Jahr 2020 gegen 2014 warnt, außer die Seite steht in der bestätigten Auswahl.
  const WARNUNG = /Diese Seite ist von 2020, unser Eintrag von 2014/
  const jahrOhne = await lauf({ hydration: knoten, jahr: 2014, seite: { jahr: 2020 } })
  pruefe('Jahr 6 Jahre daneben, nichts bestätigt: die Warnung steht da', alleTexte(jahrOhne.angehaengt).some((x) => WARNUNG.test(x)), alleTexte(jahrOhne.angehaengt))
  const jahrBestaetigt = await lauf({ hydration: knoten, jahr: 2014, seite: { jahr: 2020 }, erwartungen: { [SUCHE]: ['B01MSMV5MA', 'B0BBBBBBBB'] } })
  pruefe('… in der bestätigten Auswahl: keine Warnung', !alleTexte(jahrBestaetigt.angehaengt).some((x) => WARNUNG.test(x)), alleTexte(jahrBestaetigt.angehaengt))
  const jahrAndere = await lauf({ hydration: knoten, jahr: 2014, seite: { jahr: 2020 }, erwartungen: { [SUCHE]: ['B0AAAAAAAA', 'B0BBBBBBBB'] } })
  pruefe('… bestätigt ist eine andere Seite: Warnung bleibt', alleTexte(jahrAndere.angehaengt).some((x) => WARNUNG.test(x)))
  const jahrNah = await lauf({ hydration: knoten, jahr: 2016, seite: { jahr: 2020 } })
  pruefe('Abstand 4 Jahre: weiter keine Warnung', !alleTexte(jahrNah.angehaengt).some((x) => WARNUNG.test(x)))

  // A2: Block eines anderen Films nach SPA-Wechsel
  const fremd = await lauf({ hydration: knoten, pfad: '/gp/video/detail/B0ZZZZZZZZ' })
  pruefe('Block gehört zu einer anderen Adresse: keine Fassungen', !fremd.absturz && auswahl(fremd).length === 0, texte(fremd))

  // Gegenproben
  const ohneKnoten = await lauf({ hydration: null })
  pruefe('ohne Hydration-Knoten: keine Auswahl, kein Absturz', !ohneKnoten.absturz && auswahl(ohneKnoten).length === 0)
  const roh = daten(JSON.parse(FIXTURE))
  const behaelter = roh.init.preparations.body.btf.state.containers
  for (const k of Object.keys(behaelter)) behaelter[k] = behaelter[k].map((c) => ({ ...c, title: 'Ähnliche Titel' }))
  const ohneAbschnitt = await lauf({ hydration: { textContent: JSON.stringify(roh) } })
  pruefe('Seite ohne den Abschnitt: keine Auswahl', !ohneAbschnitt.absturz && auswahl(ohneAbschnitt).length === 0)

  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) rot.`)
    process.exit(1)
  }
  console.log('\nDie Fassungen im Kasten halten.')
}

main()
