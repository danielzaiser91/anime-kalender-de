/**
 * Zusicherungen: Eine lange Staffel (Dragon Quest: The Adventure of Dai, 99 Folgen,
 * fünf Abschnitte „1–24 … 97–99") wird ganz gelesen oder meldet ehrlich „offen".
 *
 * Anlass 24.10.2026: Die Diagnose zeigte fünf Abschnitte, `offen: 0` und 75 von 99
 * Folgen. Ein Abschnitt galt als geholt, ohne etwas beizutragen. Geprüft wird hier der
 * Leser (`amazon-leser.js`) mit einer Attrappe für `fetch`, die je Abschnitt
 * antwortet: gut, Fehler (einmal / immer), Nummernkollision, Folgen ohne Nummer.
 *
 * Die Abschnittsantworten sind erfunden (Form wie in der echten Antwort von
 * `amazon-nachladen.test.cjs`); sie belegen die Regel, nicht Amazons Verhalten bei Dai.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TOKENS = ['tokenAbschnitt1-aaaaaaaaaaaa', 'tokenAbschnitt2-bbbbbbbbbbbb', 'tokenAbschnitt3-cccccccccccc', 'tokenAbschnitt4-dddddddddddd', 'tokenAbschnitt5-eeeeeeeeeeee']
const BEREICHE = [
  [1, 24],
  [25, 48],
  [49, 72],
  [73, 96],
  [97, 99],
]

const folge = (nummer, asin) => ({ titleID: asin, detail: { episodeNumber: nummer, title: `Folge ${nummer}`, audioTracks: ['日本語'] } })

const bereich = (von, bis, asin = (n) => `B0FOLGE${String(n).padStart(3, '0')}`) =>
  Array.from({ length: bis - von + 1 }, (_, i) => folge(von + i, asin(von + i)))

const antwortMit = (episodes) => JSON.stringify({ widgets: { episodeList: { episodeCount: 99, episodes, actions: { episodePages: [] } } } })

const block = JSON.stringify({
  init: {
    preparations: {
      body: {
        atf: { state: { pageTitleId: 'B0CGQ64WRN', detail: { headerDetail: { B0CGQ64WRN: { entityType: 'TV Show', titleType: 'season', title: 'Dai', seasonNumber: 1 } } } } },
        btf: { state: { detail: { detail: {} } } },
      },
    },
  },
})

const seiten = TOKENS.map((t) => `{"isSelected":false,"text":{"string":"Folgen"},"token":"${t}"}`).join(',')
const quelltext = `<html><body><script type="text/template">{"titleID":"B0CGQ64WRN","episodePages":[${seiten}]}</script></body></html>`

/** `abschnitt4` bestimmt, was der vierte Abschnitt liefert: (versuch) => { status, text }. */
function starte(abschnitt4) {
  const nachrichten = []
  let versuche4 = 0
  const fenster = {
    addEventListener() {},
    postMessage: (n) => nachrichten.push(n),
    fetch: async (adresse) => {
      const token = TOKENS.find((t) => decodeURIComponent(String(adresse)).includes(t))
      const index = TOKENS.indexOf(token)
      let antwort = { status: 200, text: antwortMit(bereich(...BEREICHE[index])) }
      if (index === 3) antwort = abschnitt4(++versuche4)
      return { ok: antwort.status === 200, status: antwort.status, text: async () => antwort.text }
    },
  }
  const sandkasten = {
    window: fenster,
    location: { pathname: '/gp/video/detail/B0CGQ64WRN/', search: '', href: 'https://www.amazon.de/gp/video/detail/B0CGQ64WRN/' },
    document: {
      documentElement: { innerHTML: quelltext },
      getElementById: (id) => (id === 'dv-web-page-hydration-data' ? { textContent: block, firstChild: { length: block.length } } : null),
    },
    setTimeout,
    setInterval,
    clearInterval,
    console,
  }
  sandkasten.globalThis = sandkasten
  vm.createContext(sandkasten)
  vm.runInContext(readFileSync(__dirname + '/amazon-leser.js', 'utf8'), sandkasten)
  return {
    nachrichten,
    versuche4: () => versuche4,
    letzter: () => nachrichten.filter((n) => n.marke === 'ak-amazon-folgen').at(-1) ?? {},
  }
}

console.log('Zusicherungen für lange Staffeln mit mehreren Abschnitten\n')

const gut = starte(() => ({ status: 200, text: antwortMit(bereich(73, 96)) }))
const einmalFehler = starte((v) => (v === 1 ? { status: 503, text: '' } : { status: 200, text: antwortMit(bereich(73, 96)) }))
const immerFehler = starte(() => ({ status: 503, text: '' }))
const kollision = starte(() => ({ status: 200, text: antwortMit(bereich(1, 24, (n) => `B0ANDERE${String(n).padStart(3, '0')}`)) }))
const ohneNummer = starte(() => ({ status: 200, text: antwortMit(bereich(73, 96).map((f) => ({ titleID: f.titleID, detail: { title: f.detail.title } }))) }))

setTimeout(() => {
  const g = gut.letzter()
  pruefe('alle fünf Abschnitte: 99 Folgen gelesen', g.funde?.length === 99, g.funde?.length)
  pruefe('alle Abschnitte geholt: offen 0', g.abschnitte?.offen === 0, g.abschnitte)
  pruefe('Abschnittslog: fünf Einträge mit Status 200', g.abschnitte?.log?.length === 5 && g.abschnitte?.log.every((e) => e.status === 200), g.abschnitte?.log)
  pruefe('Abschnittslog nennt Bereich 73–96 und 24 Folgen für den vierten', g.abschnitte?.log?.[3]?.von === 73 && g.abschnitte?.log?.[3]?.bis === 96 && g.abschnitte?.log?.[3]?.gelesen === 24, g.abschnitte?.log?.[3])

  const e = einmalFehler.letzter()
  pruefe('ein einmaliger Fehler im vierten Abschnitt wird nachgeholt: 99 Folgen', e.funde?.length === 99, e.funde?.length)
  pruefe('danach offen 0', e.abschnitte?.offen === 0, e.abschnitte)
  pruefe('der vierte Abschnitt wurde genau zweimal abgerufen', einmalFehler.versuche4() === 2, einmalFehler.versuche4())

  const i = immerFehler.letzter()
  pruefe('dauerhafter Fehler: nur 75 Folgen', i.funde?.length === 75, i.funde?.length)
  pruefe('dauerhafter Fehler: der Abschnitt bleibt offen (offen 1)', i.abschnitte?.offen === 1, i.abschnitte)
  pruefe('dauerhafter Fehler: höchstens drei Versuche', immerFehler.versuche4() === 3, immerFehler.versuche4())

  const k = kollision.letzter()
  pruefe('Nummernkollision: 75 Folgen, die ersten 24 bleiben unverändert', k.funde?.length === 75 && k.funde.find((f) => f.nummer === 1)?.kennung === 'B0FOLGE001', k.funde?.length)
  pruefe('Nummernkollision: der Abschnitt zählt als offen (offen 1)', k.abschnitte?.offen === 1, k.abschnitte)
  pruefe('Nummernkollision: der Log nennt 24 Kollisionen', k.abschnitte?.log?.[3]?.kollisionen === 24, k.abschnitte?.log?.[3])

  const o = ohneNummer.letzter()
  pruefe('Folgen ohne Nummer: 75 Folgen, Abschnitt offen', o.funde?.length === 75 && o.abschnitte?.offen === 1, [o.funde?.length, o.abschnitte])
  pruefe('Folgen ohne Nummer: der Log nennt 24 ohne Nummer', o.abschnitte?.log?.[3]?.ohneNummer === 24, o.abschnitte?.log?.[3])

  console.log()
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen erfüllt.')
  process.exit(0)
}, 9000)
