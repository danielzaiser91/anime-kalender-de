/**
 * Eine Teilmeldung schließt den Titel nicht ab (Miraculous, 31.10.2026).
 *
 * Daniel: Auf B06HHFR44 (Amazon „Staffel 1", 8 Folgen, 26 erwartet) stand nach „Nicht bei Prime — melden"
 * „gemeldet ✓", und Miraculous verschwand aus der Prüfliste. Hier läuft der echte Klick-Handler: der Auftrag
 * wird nur dann abgehakt, wenn die gemeldeten Folgen der Serie die erwartete Zahl decken.
 *
 * Aufruf: `node extension/amazon-teilmeldung.test.cjs`
 */
const vm = require('node:vm')
const { lies, knopfNeu, ausschnitt, speicherNeu, uhrNeu, handlerKompilieren } = require('./melde-geruest.cjs')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const FEST = Date.parse('2026-10-31T18:00:00Z')
const ID = 'B06HHFR44A'
const TITEL = `https://www.amazon.de/gp/video/detail/${ID}`
const handler = ausschnitt(lies('amazon.js'), "knopf.addEventListener('click', meldeSperre.mitSperre(", '\n  }))\n').replace(/\)\)\n$/, '')
const kern = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '')

/** Ein Klick auf „melden"; liefert, ob abgehakt und der Auftrag vergessen wurde. */
async function melden({ folgenDa, erwartet, start = {}, deutsch = false, ausSuche = true }) {
  const k = vm.createContext({ Date: uhrNeu(FEST).Date, String, Number, Boolean, Object, JSON, Math, Set })
  k.globalThis = k
  vm.runInContext(lies('prime-stand.js'), k)
  vm.runInContext(lies('prime-such-bruecke.js'), k)
  vm.runInContext(lies('prime-region.js'), k)
  const speicher = speicherNeu()
  const aufgerufen = { abgehakt: 0, vergessen: 0 }
  const echt = {
    knopf: knopfNeu(),
    meldeSperre: { mitSperre: (f) => f, vermerken: () => {} },
    verbindungLebt: () => true,
    standGeladen: true,
    erledigt: start,
    listenId: ID,
    liste: { [ID]: { url: TITEL } },
    location: { pathname: `/gp/video/detail/${ID}` },
    staffelSchluessel: () => '1',
    staffelZahl: () => 1,
    seitenTitel: () => 'Miraculous',
    deutschInFolgen: () => deutsch,
    geladeneFolgen: () => folgenDa,
    sprachenAusFolgen: () => (deutsch ? ['Deutsch'] : []),
    seitenLage: () => ({ folgenLautSeite: folgenDa }),
    gesehen: { gesamt: folgenDa, jeFolge: null },
    eintrag: { url: TITEL, titel: 'Miraculous', ausSuche },
    suchauftrag: () => ({ titel: 'Miraculous', folgen: erwartet, suchUrl: TITEL }),
    titelKern: kern,
    erwartungNochOffen: () => false,
    suchAbhaken: async () => { aufgerufen.abgehakt++ },
    suchauftragVergessen: () => { aufgerufen.vergessen++ },
    WORKER: 'https://worker.test/pruefung',
    chrome: { storage: { sync: { get: async () => ({ token: 'tok' }) } } },
    setTimeout: () => 0,
    fetch: async () => ({ ok: true, status: 200, clone() { return this }, json: async () => ({}) }),
    speicherLesen: speicher.lesen,
    speicherSchreiben: speicher.schreiben,
    briefkastenAdressen: new Set(),
    frischGemeldet: new Set(),
    uebersichtZeichnen: () => {},
    vorfallMelden: async () => {},
    globalThis: k,
  }
  const { klick } = handlerKompilieren(handler, echt, uhrNeu(FEST).Date)
  await klick(null)
  return aufgerufen
}

async function main() {
  console.log('Teilmeldung: Auftrag bleibt offen, bis die Folgen gedeckt sind\n')
  pruefe('Handler im Quelltext gefunden', handler.startsWith('async (befundBeimKlick) => {') && handler.length > 1000)

  const teil = await melden({ folgenDa: 8, erwartet: 26 })
  pruefe('8 von 26 Folgen („Nicht bei Prime"): Suche nicht abgehakt', teil.abgehakt === 0, teil)
  pruefe('8 von 26 Folgen: Auftrag bleibt bestehen', teil.vergessen === 0, teil)

  const voll = await melden({ folgenDa: 26, erwartet: 26 })
  pruefe('26 von 26 Folgen: abgehakt', voll.abgehakt === 1, voll)
  pruefe('26 von 26 Folgen: Auftrag vergessen', voll.vergessen === 1, voll)

  const knapp = await melden({ folgenDa: 25, erwartet: 26 })
  pruefe('25 von 26 Folgen (genau eine fehlt): offen', knapp.abgehakt === 0, knapp)

  const ohne = await melden({ folgenDa: 8, erwartet: undefined })
  pruefe('ohne erwartete Zahl: wie bisher abgehakt', ohne.abgehakt === 1, ohne)

  const zweite = await melden({
    folgenDa: 18,
    erwartet: 26,
    start: { B0ANDERE00: { staffeln: { 1: '✕' }, folgen: { 1: 8 }, gesamt: 2, serie: 'Miraculous' } },
  })
  pruefe('8 früher + 18 jetzt = 26: abgehakt', zweite.abgehakt === 1, zweite)

  const fremd = await melden({
    folgenDa: 18,
    erwartet: 26,
    start: { B0FREMD000: { staffeln: { 1: '✕' }, folgen: { 1: 8 }, gesamt: 1, serie: 'Andere Serie' } },
  })
  pruefe('8 Folgen einer anderen Serie zählen nicht: offen', fremd.abgehakt === 0, fremd)

  const keineSuche = await melden({ folgenDa: 8, erwartet: 26, ausSuche: false })
  pruefe('ohne Such-Herkunft wird nichts abgehakt (unverändert)', keineSuche.abgehakt === 0 && keineSuche.vergessen === 0, keineSuche)

  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt`)
    process.exit(1)
  }
  console.log('\nalle Zusicherungen erfüllt')
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
