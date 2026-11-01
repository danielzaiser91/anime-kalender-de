/**
 * Prime zeigt den Grund der Pause (12.10.2026): Pille und Listenkopf nennen das Tageslimit bzw. den
 * Serverfehler, und der Endvermerk nennt fehlgeschlagene Staffeln „offen" statt „übersprungen".
 * Ganzes Skript im Sandkasten (wie `amazon-durchgang-takt.test.cjs`), samt `tageslimit.js`.
 *
 * Am 12.10.2026 stand die Pille bei gerissenem Limit auf „Titel 86/126 · 344 Seiten gemeldet", und
 * Daniel hielt den Lauf für hängend.
 */
const { lies, element, sandkasten, durchlaufen, laufen } = require('./test-kulisse-amazon.cjs')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Alle Texte unterhalb von `el`, eine Zeile je Element. */
const texte = (el) => [el.textContent, ...el.kinder.flatMap(texte)].filter(Boolean)

/** Ein laufender Durchgang: Titel 2 von 2, 344 Seiten gemeldet. */
const LAUF = {
  seit: Date.now(),
  titel: null,
  plan: [],
  planBekannt: false,
  staffelNr: {},
  laufend: [],
  fertig: ['a'],
  uebersprungen: [],
  spur: [],
  titelGesamt: 2,
  seiten: 344,
}

function dokumentBauen(alle) {
  const dokument = { title: 'Amazon.de' }
  dokument.documentElement = Object.assign(element(dokument, []), { innerHTML: '<html></html>' })
  Object.assign(dokument, {
    body: element(dokument, alle),
    head: element(dokument, alle),
    createElement: () => element(dokument, alle),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  })
  return dokument
}

/** Lädt das Skript mit einem Prime-Lauf im Tab-Speicher; `limit` pausiert vorher über `AK_TAGESLIMIT.merken`. */
async function lade({ limit, ende }) {
  const alle = []
  const speicher = { 'ak-prime-lauf': JSON.stringify({ ...LAUF, seit: Date.now() }) }
  if (ende) speicher['ak-prime-lauf-ende'] = JSON.stringify(ende)
  const dokument = dokumentBauen(alle)
  const fenster = { addEventListener() {}, location: { pathname: '/', search: '' }, name: '', document: dokument }
  fenster.top = fenster
  fenster.parent = { postMessage() {} }
  const k = sandkasten({ speicher })
  Object.assign(k, {
    document: dokument,
    window: fenster,
    location: { pathname: '/', search: '', hostname: 'www.amazon.de', origin: 'https://www.amazon.de', href: 'https://www.amazon.de/' },
    performance: { now: () => Date.now() },
  })
  /* Die Pause gilt schon beim ersten Zeichnen: `merken` läuft zwischen `tageslimit.js` und `amazon.js`. */
  const pause = limit ? `globalThis.AK_TAGESLIMIT.merken(${limit.map((x) => JSON.stringify(x)).join(',')})` : ''
  const { absturz } = laufen([lies('tageslimit.js'), pause, ...['box.js', 'melde-sperre.js', 'prime-titelseite.js', 'prime-stand.js', 'prime-region.js', 'amazon.js'].map(lies)], k)
  if (absturz) throw absturz
  await durchlaufen(1)
  return { alle, k, takt: k.takt }
}

const pille = (alle) => alle.find((e) => /^[⏸⏹] \d+\/\d+$/.test(e.textContent))
const liste = (alle) => alle.find((e) => e.className === 'ak-dialog')

async function haupt() {
  console.log('Prime: Grund der Pause in Pille und Liste\n')

  {
    const { alle } = await lade({})
    pruefe('ohne Pause: die Pille zeigt kurz „⏹ 2/2", die Zahlen stehen im Tooltip', pille(alle)?.textContent === '⏹ 2/2' && pille(alle)?.title.startsWith('Titel 2/2 · 344 Seiten gemeldet'), [pille(alle)?.textContent, pille(alle)?.title])
  }
  for (const [name, limit, erwartet] of [
    ['Tageslimit', [3600], /^Tageslimit erreicht, weiter ab \d\d:\d\d · Titel 2\/2 · 344 Seiten gemeldet\./],
    ['Serverfehler', [1800, 'server'], /^Server antwortet nicht, nächster Versuch \d\d:\d\d · Titel 2\/2 · 344 Seiten gemeldet\./],
  ]) {
    const { alle } = await lade({ limit })
    pruefe(`${name}: die Pille bleibt kurz (⏸ 2/2), der Grund steht im Tooltip`, pille(alle)?.textContent === '⏸ 2/2' && erwartet.test(pille(alle)?.title ?? ''), [pille(alle)?.textContent, pille(alle)?.title])
    pille(alle)?.hoerer.click?.()
    const kopf = liste(alle) ? texte(liste(alle)) : []
    pruefe(`${name}: der Listenkopf nennt den Grund`, kopf.some((t) => /^(Tageslimit erreicht, weiter ab|Server antwortet nicht, nächster Versuch) \d\d:\d\d$/.test(t)), kopf)
  }
  {
    const { alle } = await lade({})
    pille(alle)?.hoerer.click?.()
    const kopf = liste(alle) ? texte(liste(alle)) : []
    pruefe('ohne Pause: kein Grund im Listenkopf', !kopf.some((t) => /Tageslimit|Server antwortet/.test(t)) && kopf.length > 0, kopf)
  }

  console.log('\nDie Pause beginnt, während die Liste offen ist')
  {
    const { alle, k, takt } = await lade({})
    pille(alle)?.hoerer.click?.()
    const vorher = texte(liste(alle))
    pruefe('vorher: kein Grund im Listenkopf', !vorher.some((t) => /Tageslimit|Server antwortet/.test(t)), vorher)
    k.AK_TAGESLIMIT.merken(1800, 'server')
    takt()
    const nachher = texte(liste(alle))
    pruefe('der Grund steht nach dem nächsten Takt im Listenkopf (Signatur kennt ihn)', nachher.some((t) => /^Server antwortet nicht, nächster Versuch \d\d:\d\d$/.test(t)), nachher)
  }

  console.log('\nEndvermerk')
  {
    const { alle } = await lade({ ende: { grund: 'von Hand', uebersprungen: ['Naruto · Staffel 2'], suchen: 0, spur: [] } })
    pille(alle)?.hoerer.click?.()
    const zeilen = liste(alle) ? texte(liste(alle)) : []
    const vermerk = zeilen.find((t) => /^Durchgang beendet/.test(t))
    pruefe('Fehlgeschlagene Staffeln stehen als „offen (Fehler beim Melden)"', vermerk === 'Durchgang beendet · von Hand · offen (Fehler beim Melden): Naruto · Staffel 2', vermerk)
    pruefe('das Wort „übersprungen" kommt nicht mehr vor', !zeilen.some((t) => /übersprungen/.test(t)), zeilen)
  }

  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zur Prime-Pause halten.')
}

haupt()
