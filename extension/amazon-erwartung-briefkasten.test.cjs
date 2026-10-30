/**
 * Prime: eine bestätigte Erwartung (zwei Ausgaben) macht die Suche erst fertig, wenn der Briefkasten
 * beide Seiten als gemeldet führt (`istGemeldet`, Zweig `erwartungZu(...) + briefkastenSeiten`).
 *
 * Der Briefkasten antwortet asynchron: Vor dem Durchlauf der Mikrotasks ist nichts bekannt, erst danach
 * entscheidet er. Gelesen wird über `window.AK.bericht().erwartungsLage` (dieselbe Funktion, die der Kasten fragt).
 * Aufruf: `node extension/amazon-erwartung-briefkasten.test.cjs`
 */
const { lies, element, sandkasten, durchlaufen, laufen } = require('./test-kulisse-amazon.cjs')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const SUCHE = 'https://www.amazon.de/s?k=Fischen+Impossible&i=instant-video'
const PFAD = '/gp/video/detail/B01MSMV5MA'
const QUELLEN = ['box.js', 'melde-sperre.js', 'prime-stand-ziele.js', 'prime-region.js', 'amazon.js'].map(lies)

/** Lädt amazon.js; `antwort` ist, was der Briefkasten auf jeden Abruf zurückgibt. Liefert `lage()` vor/nach dem Durchlauf. */
function lade(antwort) {
  const fenster = { addEventListener() {}, location: { pathname: PFAD, search: '' } }
  const k = sandkasten({
    chromeLokal: { get: () => ({ amazonErledigt: {}, amazonSuche: {} }), set: () => Promise.resolve() },
    /* Die Suchliste (prime-suche.json) bleibt die gepackte; nur der Briefkasten bekommt die Antwort. */
    fetch: (u) => Promise.resolve({ ok: true, json: () => Promise.resolve(String(u).includes('prime-suche.json') ? {} : antwort) }),
  })
  const dokument = {
    documentElement: { innerHTML: '<html></html>', classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    body: element(),
    head: element(),
    title: 'Amazon.de',
    createElement: () => element(),
    createTextNode: (t) => ({ textContent: t }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  }
  Object.assign(k, {
    AK_PRIME_SUCHE: { [SUCHE]: { titel: 'Fischen Impossible', id: 1 } },
    location: { pathname: PFAD, search: '', href: 'https://www.amazon.de' + PFAD },
    document: dokument,
    window: fenster,
  })
  fenster.document = dokument
  const { absturz } = laufen(QUELLEN, k)
  return { absturz, lage: () => fenster.AK.bericht().erwartungsLage }
}

const antwort = (gemeldeteSeiten, erwartungen, gemeldeteSuchen = []) => ({
  imBriefkasten: {},
  adressen: [],
  gemeldet: [],
  gemeldeteSuchen,
  gemeldeteSeiten,
  erwartungen,
})
const zeile = (lage) => lage.zeilen?.find((z) => z.suche === SUCHE.slice(-60))

async function haupt() {
  console.log('Prime: Erwartung gegen gemeldete Seiten des Briefkastens\n')

  const zwei = lade(antwort(['A'], { [SUCHE]: ['A', 'B'] }))
  pruefe('Kulisse läuft ohne Absturz', zwei.absturz === null, String(zwei.absturz))
  const vorher = zwei.lage()
  pruefe('vor dem Durchlauf: Briefkasten nicht da, Suche offen', vorher.briefkastenDa === false && zeile(vorher)?.istGemeldet === false, vorher)
  await durchlaufen()
  const nachher = zwei.lage()
  pruefe('nach dem Durchlauf: Briefkasten da, Erwartung (2 Ausgaben) bekannt', nachher.briefkastenDa === true && nachher.erwartungenBekannt === 1, nachher)
  pruefe('eine von zwei Ausgaben gemeldet: Suche bleibt offen', zeile(nachher)?.istGemeldet === false, zeile(nachher))
  pruefe('… die Zeile nennt A gemeldet und B offen', JSON.stringify(zeile(nachher)?.jeKennung) === JSON.stringify(['A:gemeldet', 'B:offen']), zeile(nachher)?.jeKennung)

  const beide = lade(antwort(['A', 'B'], { [SUCHE]: ['A', 'B'] }))
  await durchlaufen()
  pruefe('beide Ausgaben gemeldet: Suche fertig', zeile(beide.lage())?.istGemeldet === true, zeile(beide.lage()))

  const eine = lade(antwort(['A'], { [SUCHE]: ['A'] }))
  await durchlaufen()
  pruefe('eine erwartete Ausgabe, gemeldet: Suche fertig', zeile(eine.lage())?.istGemeldet === true, zeile(eine.lage()))

  const fremd = lade(antwort(['X'], { [SUCHE]: ['A', 'B'] }))
  await durchlaufen()
  pruefe('nur eine fremde Seite gemeldet: Suche offen', zeile(fremd.lage())?.istGemeldet === false, zeile(fremd.lage()))

  const gegen = lade(antwort(['A'], {}, [SUCHE]))
  await durchlaufen()
  pruefe('ohne Erwartung, Suche im Briefkasten geführt: fertig (Gegenprobe)', zeile(gegen.lage())?.istGemeldet === true, zeile(gegen.lage()))

  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('\nAlle Zusicherungen halten.')
}
haupt()
