/**
 * Prime-Titelseite: melden → neue Seite → `fertig()` liest „erledigt“ (Prüfer 1734, 21.10.2026).
 *
 * Bisher prüfte nur ein Muster auf den Quelltext, dass der Vermerk `zeit` gesetzt wird; der Mutant
 * `bisher.zeit = undefined` überlebte. Hier läuft der echte Klick-Handler aus `amazon.js` gegen ein
 * Gerüst mit überlebendem Speicher (`melde-geruest.cjs`), danach die echte `fertig()` einer frischen Seite
 * (leeres `frischGemeldet`, der Stand führt die Adresse noch). Die Uhr ist fest, kein Abruf geht ins Netz.
 *
 * Aufruf: `node extension/amazon-melden-vermerk.test.cjs`
 */
const vm = require('node:vm')
const { lies, knopfNeu, ausschnitt, speicherNeu, uhrNeu, handlerKompilieren } = require('./melde-geruest.cjs')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const FEST = Date.parse('2026-10-21T01:10:00Z')
const MIN = 60 * 1000
const LISTEN_ID = 'B0GXC6GGH6'
const TITEL = 'https://www.amazon.de/gp/video/detail/B0GXC6GGH6'
const quelle = lies('amazon.js')

const handler = ausschnitt(quelle, "knopf.addEventListener('click', meldeSperre.mitSperre(", '\n  }))\n').replace(/\)\)\n$/, '')

/** Die Hilfsdateien, die `amazon.js` im Manifest vor sich lädt, in einem Seiten-Kontext. */
function globaleLaden(k) {
  k.globalThis = k
  vm.runInContext(lies('prime-stand.js'), k)
  vm.runInContext(lies('prime-such-bruecke.js'), k)
  vm.runInContext(lies('prime-region.js'), k)
}

/** Erste Seite: der Klick auf „melden“, Antwort des Workers ist ok. Der Speicher bleibt in `speicher`. */
async function meldenAufSeite(speicher, uhr, staffel = 's1') {
  const k = vm.createContext({ Date: uhr.Date, String, Number, Boolean, Object, JSON, Math, Set })
  globaleLaden(k)
  const knopf = knopfNeu()
  const ablage = new Set()
  const echt = {
    knopf,
    meldeSperre: { mitSperre: (f) => f, vermerken: () => {} },
    verbindungLebt: () => true,
    standGeladen: true,
    erledigt: {},
    listenId: LISTEN_ID,
    liste: { [LISTEN_ID]: { url: TITEL } },
    location: { pathname: '/gp/video/detail/B0GXC6GGH6' },
    staffelSchluessel: () => staffel,
    staffelZahl: () => 1,
    seitenTitel: () => 'Mission Mars',
    deutschInFolgen: () => true,
    geladeneFolgen: () => 12,
    sprachenAusFolgen: () => ['Deutsch'],
    seitenLage: () => ({ folgenLautSeite: 12 }),
    gesehen: { gesamt: 12, jeFolge: null },
    eintrag: { url: TITEL, titel: 'Mission Mars' },
    WORKER: 'https://worker.test/pruefung',
    chrome: { storage: { sync: { get: async () => ({ token: 'tok' }) } } },
    setTimeout: () => 0,
    fetch: async () => ({ ok: true, status: 200, clone() { return this }, json: async () => ({}) }),
    speicherLesen: speicher.lesen,
    speicherSchreiben: speicher.schreiben,
    briefkastenAdressen: ablage,
    frischGemeldet: ablage,
    uebersichtZeichnen: () => {},
    vorfallMelden: async () => {},
    globalThis: k,
  }
  const { klick } = handlerKompilieren(handler, echt, uhr.Date)
  await klick(null)
  return knopf
}

/** Neue Seite: leerer Arbeitsspeicher, `erledigt` aus dem Speicher, der Stand führt die Adresse noch. */
function neueSeite(speicher, uhr) {
  const k = vm.createContext({
    Date: uhr.Date,
    Set,
    standZiele: new Set([TITEL]),
    frischGemeldet: new Set(),
    liste: { [LISTEN_ID]: { url: TITEL } },
    erledigt: speicher.inhalt.amazonErledigt ?? {},
    erwartungZu: () => null,
    briefkastenSeiten: null,
    briefkastenAdressen: null,
    briefkastenSuchen: null,
    vermerkVerwerfen: () => {},
  })
  globaleLaden(k)
  const treffer = new RegExp('\\n  function fertig\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}').exec(quelle)
  vm.runInContext(treffer[0], k)
  return () => vm.runInContext(`fertig('${LISTEN_ID}')`, k)
}

/** Unter derselben Kennung liegt schon Staffel 1 (andere Zeit, andere Folgen): Staffel 2 ergänzt, überschreibt nichts. */
async function zweiteStaffel() {
  const speicher = speicherNeu()
  const alt = { staffeln: { s1: '🇩🇪' }, folgen: { s1: 10 }, gesamt: 2, serie: 'Mission Mars', zeit: '2026-10-20T00:00:00.000Z' }
  speicher.inhalt.amazonErledigt = { [LISTEN_ID]: alt, ANDERE: { staffeln: { s1: '✕' }, gesamt: 1 } }
  const uhr = uhrNeu(FEST)
  await meldenAufSeite(speicher, uhr, 's2')
  const neu = speicher.inhalt.amazonErledigt?.[LISTEN_ID]
  pruefe('zweite Staffel: Staffel 1 bleibt erhalten', neu?.staffeln?.s1 === '🇩🇪', neu?.staffeln)
  pruefe('zweite Staffel: Staffel 2 kommt dazu', neu?.staffeln?.s2 === '🇩🇪', neu?.staffeln)
  pruefe('zweite Staffel: Folgenzahl von Staffel 1 bleibt', neu?.folgen?.s1 === 10, neu?.folgen)
  pruefe('zweite Staffel: Gesamtzahl schrumpft nicht', neu?.gesamt === 2, neu?.gesamt)
  pruefe('zweite Staffel: Vermerk trägt die neue Zeit', neu?.zeit === '2026-10-21T01:10:00.000Z', neu?.zeit)
  pruefe('zweite Staffel: fremde Kennung bleibt unberührt', speicher.inhalt.amazonErledigt?.ANDERE?.staffeln?.s1 === '✕')
}

async function main() {
  console.log('Prime-Titelseite: melden, neue Seite, fertig() liest „erledigt“\n')
  pruefe('Handler im Quelltext gefunden', handler.startsWith('async (befundBeimKlick) => {') && handler.length > 1000, handler.length)

  const speicher = speicherNeu()
  const uhr = uhrNeu(FEST)
  const knopf = await meldenAufSeite(speicher, uhr)
  const vermerk = speicher.inhalt.amazonErledigt?.[LISTEN_ID]
  pruefe('Meldung gelang (Knopf trägt keinen Fehler)', !/Fehler|Nicht erreichbar/.test(knopf.textContent), knopf.textContent)
  pruefe('Vermerk unter der Listenkennung gespeichert', Boolean(vermerk), Object.keys(speicher.inhalt.amazonErledigt ?? {}))
  pruefe('Vermerk trägt die ISO-Zeit der Meldung', vermerk?.zeit === '2026-10-21T01:10:00.000Z', vermerk?.zeit)

  uhr.t = FEST + 5 * MIN
  pruefe('neue Seite 5 Minuten später: fertig() = erledigt', neueSeite(speicher, uhr)() === true)
  uhr.t = FEST + 9 * MIN
  pruefe('neue Seite 9 Minuten später: noch erledigt', neueSeite(speicher, uhr)() === true)
  uhr.t = FEST + 11 * MIN
  pruefe('neue Seite 11 Minuten später: Frist um, der Stand entscheidet (offen)', neueSeite(speicher, uhr)() === false)
  uhr.t = FEST + 5 * MIN
  pruefe('ohne Vermerk (leerer Speicher) ist dieselbe Seite offen', neueSeite(speicherNeu(), uhr)() === false)

  await zweiteStaffel()

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
