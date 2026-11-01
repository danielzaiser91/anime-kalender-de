/**
 * Prime-Wechsel A→B: Name, Kennung und Melde-Knopf gehören zur selben Seite (Daniel, 01.11.2026, v4.32.39).
 *
 * Anlass: Wechsel in der Anwendung von „Goblin Slayer" (B0D98PQ1FW) auf „Blade of the Immortal"
 * (B07YTGVXC6). Der Leser lieferte für die neue Adresse noch Kennung und Titel der alten Seite;
 * `seitenTitel()` nannte „Goblin Slayer", `serieBekannt()` hielt den Kasten offen, die Kopfzeile lautete
 * „meldet: Goblin Slayer · B07YTGVXC6". Der echte Quelltext von `amazon.js` läuft hier gegen eine Kulisse:
 * `seitenTitel()`, die Kopfzeilen-Rechnung und der Klick-Handler (Rückweisung vor dem Senden).
 *
 * Aufruf: `node extension/amazon-prime-wechsel.test.cjs`
 */
const vm = require('node:vm')
const { lies, knopfNeu, ausschnitt, handlerKompilieren } = require('./melde-geruest.cjs')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const quelle = lies('amazon.js')
const ALT = 'B0D98PQ1FW'
const NEU = 'B07YTGVXC6'

function globaleLaden() {
  const k = vm.createContext({ Date, String, Number, Boolean, Object, JSON, Math, Set })
  k.globalThis = k
  vm.runInContext(lies('prime-stand.js'), k)
  vm.runInContext(lies('prime-region.js'), k)
  return k
}

/* --- 1. Die reine Regel: Tabelle aus Frühere Seite × Kopfzeile × Titel × Bestätigung --- */
console.log('Prime-Wechsel: Widerspruchsregel')
const regel = globaleLaden().akPrimeMeldungWiderspruch
const w = (o) => regel(
  { querySelector: () => (o.kopfKennung ? { dataset: { kennung: o.kopfKennung } } : null) },
  o.quelltextFrueher,
  o.adressKennung,
  o.seitenKennung,
  o.titel,
  o.verlassen,
)
const basis = { quelltextFrueher: false, kopfKennung: NEU, adressKennung: NEU, seitenKennung: NEU, titel: 'Blade of the Immortal', verlassen: { kennung: ALT, titel: 'Goblin Slayer' } }
pruefe('stimmig: keine Rückweisung', w(basis) === null, w(basis))
pruefe('Quelltext der verlassenen Seite: Rückweisung', w({ ...basis, quelltextFrueher: true }) === 'Seite noch nicht umgestellt')
pruefe('Kopfzeile nennt andere Kennung: Rückweisung', w({ ...basis, kopfKennung: ALT }) === 'Kopfzeile nennt andere Kennung')
pruefe('alter Titel, Leser noch nicht auf neuer Kennung: Rückweisung', w({ ...basis, titel: 'Goblin Slayer', seitenKennung: ALT }) === 'Titel gehört zur verlassenen Seite')
pruefe('derselbe Titel, aber Leser bestätigt neue Kennung (Staffelwechsel): erlaubt', w({ ...basis, titel: 'Goblin Slayer', seitenKennung: NEU }) === null)
pruefe('Seitenstart ohne verlassene Seite: erlaubt', w({ ...basis, titel: 'Goblin Slayer', seitenKennung: null, verlassen: { kennung: null, titel: 'Goblin Slayer' } }) === null)
pruefe('neuer Titel, Leser noch unbestätigt: erlaubt (die Überschrift ist schon die der neuen Seite)', w({ ...basis, seitenKennung: ALT }) === null)
pruefe('Titel ohne Wert: kein Titelvorwurf', w({ ...basis, titel: null, seitenKennung: ALT }) === null)

/* --- 2. seitenTitel() läuft echt: Der Titel des Lesers zählt nur, wenn seine Kennung nicht die einer verlassenen Seite ist --- */
console.log('Prime-Wechsel: seitenTitel()')
const fruehText = '(function quelltextVonFruehererSeite() {' + ausschnitt(quelle, 'function quelltextVonFruehererSeite() {', '\n  }') + ')'
const seitenTitelText = '(function seitenTitel() {' + ausschnitt(quelle, 'function seitenTitel() {', '\n  }') + ')'
function titelLesen({ lesersicht, adresse, frueher }) {
  const fruehFn = handlerKompilieren(fruehText, {
    asinAusSeite: () => lesersicht.kennung,
    asinAusAdresse: () => adresse,
    fruehereAdressKennungen: new Set(frueher),
  }).klick
  const dokument = {
    querySelector: (wahl) => (/og:title/.test(wahl) ? { getAttribute: () => 'Goblin Slayer' } : wahl === 'h1' ? { textContent: 'Blade of the Immortal' } : null),
  }
  const { klick } = handlerKompilieren(seitenTitelText, {
    gemeldeterSerientitel: lesersicht.titel,
    quelltextVonFruehererSeite: fruehFn,
    saeubern: (t) => t,
    document: dokument,
  })
  return klick()
}
pruefe('Kontrolle: Leser nennt die Adress-Kennung, sein Titel gilt', titelLesen({ lesersicht: { kennung: NEU, titel: 'Blade of the Immortal' }, adresse: NEU, frueher: [ALT] }) === 'Blade of the Immortal')
pruefe('Leser nennt die verlassene Kennung: sein Titel „Goblin Slayer" gilt nicht, die Überschrift schon', titelLesen({ lesersicht: { kennung: ALT, titel: 'Goblin Slayer' }, adresse: NEU, frueher: [ALT] }) === 'Blade of the Immortal')
pruefe('Kontrolle: Sammelseite (Leser-Kennung nie in der Adresse) behält den Titel des Lesers', titelLesen({ lesersicht: { kennung: 'SAMMEL', titel: 'Goblin Slayer' }, adresse: NEU, frueher: [ALT] }) === 'Goblin Slayer')

/* Der Wechsel selbst: Die Adresswache merkt sich Kennung und Titel der verlassenen Seite, bevor sie sie als „früher" vermerkt. */
const fortText = '(function adressKennungFortschreiben() {' + ausschnitt(quelle, 'function adressKennungFortschreiben() {', '\n  }') + ')'
function wechselVon() {
  const z = { adresse: ALT, leser: { kennung: ALT, titel: 'Goblin Slayer' } }
  const frueher = new Set()
  const lauf = handlerKompilieren(fortText, {
    asinAusAdresse: () => z.adresse,
    letzteAdressKennung: ALT,
    titelVerlassen: null,
    fruehereAdressKennungen: frueher,
    seitenTitel: () => titelLesen({ lesersicht: z.leser, adresse: z.adresse, frueher: [...frueher] }),
  })
  z.adresse = NEU
  lauf.klick()
  return lauf.werte.get('titelVerlassen')
}
const verlassen = wechselVon()
pruefe('Adresswache: verlassene Seite mit Kennung und ihrem Titel gemerkt', verlassen?.kennung === ALT && verlassen?.titel === 'Goblin Slayer', verlassen)

/* --- 3. Die Kopfzeile „meldet: Name · Kennung" nimmt den Namen nur von der Kennung der Seite --- */
console.log('Prime-Wechsel: Kopfzeile')
const kopfText = ausschnitt(quelle, 'const wasGemeldetWird = ', '\n        })()')
function kopfLesen({ liste, auftrag, titel }) {
  const { klick } = handlerKompilieren(kopfText, {
    liste,
    id: ALT,
    listenId: NEU,
    kennungJetzt: NEU,
    eintrag: { titel: null, ausSuche: false },
    serieBekannt: () => true,
    suchauftrag: () => auftrag,
    zurReihe: (a, b) => String(a) === String(b),
    seitenTitel: () => titel,
  })
  return klick
}
pruefe('Eintrag der alten Seite (id hinkt) liefert keinen Namen', kopfLesen({ liste: { [ALT]: { titel: 'Goblin Slayer' } }, auftrag: null, titel: null }) === `meldet: ${NEU}`, kopfLesen({ liste: { [ALT]: { titel: 'Goblin Slayer' } }, auftrag: null, titel: null }))
pruefe('Auftrag einer anderen Zielseite liefert keinen Namen', kopfLesen({ liste: {}, auftrag: { titel: 'Goblin Slayer', zielAsin: ALT }, titel: null }) === `meldet: ${NEU}`)
pruefe('Kontrolle: Auftrag ohne Zielseite liefert weiter den Namen', kopfLesen({ liste: {}, auftrag: { titel: 'Blade of the Immortal' }, titel: null }) === `meldet: Blade of the Immortal · ${NEU}`)
pruefe('Kontrolle: Auftrag mit passender Zielseite liefert den Namen', kopfLesen({ liste: {}, auftrag: { titel: 'Blade of the Immortal', zielAsin: NEU }, titel: null }) === `meldet: Blade of the Immortal · ${NEU}`)
pruefe('Kontrolle: Eintrag der neuen Kennung liefert den Namen', kopfLesen({ liste: { [NEU]: { titel: 'Blade of the Immortal' } }, auftrag: null, titel: null }) === `meldet: Blade of the Immortal · ${NEU}`)

/* --- 4. Der Klick-Handler weist vor dem Senden zurück --- */
console.log('Prime-Wechsel: Klick')
const handler = ausschnitt(quelle, "knopf.addEventListener('click', meldeSperre.mitSperre(", '\n  }))\n').replace(/\)\)\n$/, '')
async function klicken({ frueher, kopf, adresse, seitenKennung, titel, verlassen }) {
  const k = globaleLaden()
  const knopf = knopfNeu()
  const gruende = []
  let gesendet = 0
  const echt = {
    knopf,
    meldeSperre: { mitSperre: (f) => f, vermerken: () => {} },
    verbindungLebt: () => true,
    standGeladen: true,
    erledigt: {},
    listenId: NEU,
    liste: { [NEU]: { url: 'https://www.amazon.de/gp/video/detail/' + NEU } },
    location: { pathname: '/gp/video/detail/' + NEU },
    staffelSchluessel: () => 's1',
    staffelZahl: () => 1,
    seitenTitel: () => titel,
    deutschInFolgen: () => true,
    geladeneFolgen: () => 12,
    sprachenAusFolgen: () => ['Deutsch'],
    seitenLage: () => ({ folgenLautSeite: 12 }),
    gesehen: { gesamt: 12, jeFolge: null },
    eintrag: { url: 'https://www.amazon.de/gp/video/detail/' + NEU, titel: null },
    quelltextVonFruehererSeite: () => frueher,
    asinAusAdresse: () => adresse,
    asinAusSeite: () => seitenKennung,
    titelVerlassen: verlassen,
    document: { querySelector: () => (kopf ? { dataset: { kennung: kopf } } : null) },
    abweisen: (g) => gruende.push(g),
    WORKER: 'https://worker.test/pruefung',
    chrome: { storage: { sync: { get: async () => ({ token: 'tok' }) } } },
    setTimeout: () => 0,
    fetch: async () => { gesendet += 1; return { ok: true, status: 200, clone() { return this }, json: async () => ({}) } },
    speicherLesen: async () => ({}),
    speicherSchreiben: async () => {},
    briefkastenAdressen: new Set(),
    frischGemeldet: new Set(),
    uebersichtZeichnen: () => {},
    vorfallMelden: async () => {},
    globalThis: k,
  }
  const { klick } = handlerKompilieren(handler, echt)
  await klick(null)
  return { gruende, gesendet }
}
const stimmig = { frueher: false, kopf: NEU, adresse: NEU, seitenKennung: NEU, titel: 'Blade of the Immortal', verlassen: { kennung: ALT, titel: 'Goblin Slayer' } }
async function haupt() {
  const gut = await klicken(stimmig)
  pruefe('Kontrolle: stimmige Seite wird gesendet', gut.gesendet === 1 && gut.gruende.length === 0, gut)
  const a = await klicken({ ...stimmig, frueher: true, titel: 'Goblin Slayer' })
  pruefe('Quelltext der verlassenen Seite: nichts gesendet, Grund genannt', a.gesendet === 0 && a.gruende[0] === 'Seite noch nicht umgestellt', a)
  const b = await klicken({ ...stimmig, kopf: ALT })
  pruefe('Kopfzeile mit alter Kennung: nichts gesendet', b.gesendet === 0 && b.gruende[0] === 'Kopfzeile nennt andere Kennung', b)
  const c = await klicken({ ...stimmig, titel: 'Goblin Slayer', seitenKennung: ALT })
  pruefe('alter Name, neue ASIN, Leser unbestätigt: nichts gesendet', c.gesendet === 0 && c.gruende[0] === 'Titel gehört zur verlassenen Seite', c)
  const d = await klicken({ ...stimmig, titel: 'Goblin Slayer' })
  pruefe('Kontrolle: gleicher Titel, Leser bestätigt neue Kennung (Staffelwechsel): gesendet', d.gesendet === 1, d)
  if (fehler.length) {
    console.error(`\n${fehler.length} Fehler`)
    process.exit(1)
  }
  console.log('\nPrime-Wechsel: alles bestanden')
}
haupt()
