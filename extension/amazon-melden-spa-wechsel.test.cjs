/**
 * Seite A → Seite B → zurück zu A (SPA-Navigation ohne Neuladen): Melden wirkt und meldet A (Daniel, 07.11.2026, v4.32.73).
 *
 * Anlass: „Devils' Crest" (B0HKLZZ54Y) steht nicht in der Prüfliste, „Petals of Reincarnation" (B0GVN98MKW) schon.
 * Nach dem Weg über Petals hielt `listenSchluessel(bisher)` den Eintrag von Petals fest: Der Kasten nannte
 * Petals, die Meldung trug Titel „Petals" zur Adresse von Devils' Crest, und ein Klick wurde ohne Anzeige abgewiesen.
 * Der echte Quelltext von `amazon.js` läuft hier gegen eine Kulisse: `listenSchluessel()` mit den Helfern aus
 * `prime-region.js`, die Verdrahtung des Grundes am Knopf, der Klick-Handler.
 *
 * Aufruf: `node extension/amazon-melden-spa-wechsel.test.cjs`
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
const A = 'B0HKLZZ54Y'
const B = 'B0GVN98MKW'
const TITEL_A = "Devils' Crest"
const TITEL_B = 'Petals of Reincarnation'
const liste = { [B]: { titel: TITEL_B, url: `https://www.amazon.de/gp/video/detail/${B}` } }
const kernText = '(' + ausschnitt(quelle, 'const titelKern = ', ".replace(/[^a-z0-9]/g, '')") + ')'
const timer = []

function globaleLaden() {
  const k = vm.createContext({ Date, String, Number, Boolean, Object, JSON, Math, Set, setTimeout: (fn, ms) => timer.push({ fn, ms }) })
  k.globalThis = k
  vm.runInContext(lies('prime-stand.js'), k)
  vm.runInContext(lies('prime-region.js'), k)
  return k
}

/** Der echte `listenSchluessel()` aus amazon.js mit den echten Helfern aus prime-region.js; Adresse und Titel kommen von außen. */
function seiteBauen(zustand, eigeneListe = liste, erledigt = {}) {
  return handlerKompilieren(
    '(function listenSchluessel(bisher) {' + ausschnitt(quelle, 'function listenSchluessel(bisher) {', '\n  }') + ')',
    {
      titelKern: handlerKompilieren(kernText, {}).klick,
      liste: eigeneListe,
      erledigt,
      seitenTitel: () => zustand.titel,
      asinAusAdresse: () => zustand.adresse,
      gtiSprung: () => null,
      id: zustand.id,
      gesehen: null,
      globalThis: globaleLaden(),
    },
  ).klick
}

/** Ein Seitenwechsel wie in `beiStaffelwechsel()`: Adresse und Titel setzen, dann der Listenschlüssel mit dem bisherigen. */
function besuch(zustand, listenSchluessel, adresse, titel, bisher) {
  zustand.adresse = adresse
  zustand.titel = titel
  return listenSchluessel(bisher)
}

console.log('SPA-Wechsel: Listenschlüssel')
const z = { adresse: A, id: A, titel: TITEL_A }
/* `id` ist in der Kulisse fest; der Schlüssel kommt hier über die Adresse (`asinAusAdresse`), wie auf der echten Seite. */
const schluessel = (adresse, titel, bisher) => {
  z.id = adresse
  return besuch(z, seiteBauen(z), adresse, titel, bisher)
}
let listenId = schluessel(A, TITEL_A, undefined)
pruefe('erster Aufruf von A (nicht in der Liste): Schlüssel ist A', listenId === A, listenId)
listenId = schluessel(B, TITEL_B, listenId)
pruefe('Wechsel nach B (in der Liste): Schlüssel ist B', listenId === B, listenId)
listenId = schluessel(A, TITEL_A, listenId)
pruefe('zurück zu A: Schlüssel ist wieder A, nicht der Eintrag von B', listenId === A, listenId)
listenId = schluessel(A, TITEL_B, B)
pruefe('Kontrolle: Titel hinkt noch (zeigt B) — der Eintrag von B bleibt bis zur Titelaktualisierung', listenId === B, listenId)
listenId = schluessel(A, TITEL_A, listenId)
pruefe('… und heilt, sobald der Titel der neuen Seite da ist', listenId === A, listenId)

const mitSerie = { B0STAFFEL1: { titel: 'Dr. Stone – Staffel 1' } }
const staffel = { adresse: 'B0STAFFEL2', id: 'B0STAFFEL2', titel: 'Dr. Stone' }
pruefe('Kontrolle: Staffelwechsel derselben Serie behält den Eintrag der Serie', seiteBauen(staffel, mitSerie)('B0STAFFEL1') === 'B0STAFFEL1')
const ohneTitel = { adresse: 'B0STAFFEL2', id: 'B0STAFFEL2', titel: '' }
pruefe('Kontrolle: ohne Seitentitel lässt sich nichts widerlegen, der bisherige Eintrag bleibt', seiteBauen(ohneTitel, mitSerie)('B0STAFFEL1') === 'B0STAFFEL1')

/* Woher der Name der Serie kommt: jede Quelle und jede Richtung des „enthält" hat einen Fall, in dem nur sie den Ausschlag gibt. */
const staffelNeu = { adresse: 'B0NEU', id: 'B0NEU', titel: 'Dr. Stone' }
const namensfall = (listeneintrag, erledigtEintrag, seite = staffelNeu) =>
  seiteBauen(seite, { B0ALT: listeneintrag }, erledigtEintrag ? { B0ALT: erledigtEintrag } : {})('B0ALT') === 'B0ALT'
pruefe('Name nur im Erledigten (Liste trägt einen anderen): derselbe Eintrag', namensfall({ titel: 'Steinzeit' }, { serie: 'Dr. Stone' }))
pruefe('Name nur im Serienfeld der Liste', namensfall({ titel: 'Steinzeit', serie: 'Dr. Stone' }))
pruefe('Name nur in den Einträgen der Liste', namensfall({ titel: 'Steinzeit', eintraege: [{ name: 'Dr. Stone' }] }))
pruefe('Eintrag heißt länger als die Seite („Dr. Stone: Ryusui")', namensfall({ titel: 'Dr. Stone: Ryusui' }))
pruefe('Seite heißt länger als der Eintrag („Dr. Stone: New World")', namensfall({ titel: 'Dr. Stone' }, null, { ...staffelNeu, titel: 'Dr. Stone: New World' }))
pruefe('Kontrolle: ein fremder Name hält den Eintrag nicht', !namensfall({ titel: 'Steinzeit', eintraege: [{ name: 'Petals of Reincarnation' }] }, { serie: 'Anderes' }))
pruefe('Kontrolle: ein zu kurzer Name (unter vier Zeichen) zählt nicht', !namensfall({ titel: 'Dr' }, null, { ...staffelNeu, titel: 'Dr. Stone' }))

console.log('SPA-Wechsel: Anzeigeregeln')
const serieBekannt = (seitenTitel, mitListe) =>
  handlerKompilieren('(function serieBekannt() {' + ausschnitt(quelle, 'function serieBekannt() {', '\n  }') + ')', {
    titelKern: handlerKompilieren(kernText, {}).klick,
    seitenTitel: () => seitenTitel,
    erledigt: {},
    liste: mitListe,
    globalThis: globaleLaden(),
  }).klick()
pruefe('serieBekannt: Seite „Dr. Stone", Liste führt „Dr. Stone – Staffel 3": bekannt', serieBekannt('Dr. Stone', { X: { titel: 'Dr. Stone – Staffel 3' } }) === true)
pruefe('serieBekannt: Seite „Devils\' Crest" steht nicht in der Liste: unbekannt', serieBekannt(TITEL_A, liste) === false)
const imKastenAusdruck = ausschnitt(quelle, 'imKasten: ', '\n').replace(/^imKasten: /, '').replace(/,\s*$/, '')
const imKasten = (knopf) => handlerKompilieren(imKastenAusdruck, { knopf }).klick
pruefe('Diagnose: Knopf in der Meldezeile des Kastens zählt als „im Kasten"', imKasten({ closest: (w) => (w === '.ak-amazon-suchhinweis' ? {} : null), parentElement: { className: 'ak-z-melden' } }) === true)
pruefe('Diagnose: Knopf außerhalb des Kastens zählt nicht', imKasten({ closest: () => null, parentElement: { className: 'x' } }) === false)

console.log('SPA-Wechsel: Grund am Knopf')
const grundZeile = ausschnitt(quelle, 'const abweisenMitGrund = ', '\n').replace('const abweisenMitGrund = ', '')
function grundZeigen(knopf, gruende) {
  return handlerKompilieren(grundZeile, { knopf, abweisen: (g) => gruende.push(g), globalThis: globaleLaden() }).klick
}
{
  const knopf = knopfNeu()
  knopf.textContent = '🇩🇪 Deutsch · 2 Folgen · melden'
  const gruende = []
  timer.length = 0
  grundZeigen(knopf, gruende)('Titel gehört zur verlassenen Seite')
  pruefe('der Grund steht am Knopf und wird gemeldet', knopf.textContent === '⚠ Titel gehört zur verlassenen Seite' && knopf.title === 'Titel gehört zur verlassenen Seite' && gruende.length === 1, knopf)
  pruefe('… und verschwindet nach vier Sekunden (Frist 4000 ms)', timer.length === 1 && timer[0].ms === 4000, timer.map((t) => t.ms))
  timer[0].fn()
  pruefe('… der alte Text kommt zurück', knopf.textContent === '🇩🇪 Deutsch · 2 Folgen · melden' && knopf.title === '', knopf)
  timer.length = 0
  grundZeigen(knopf, gruende)('Staffelwechsel läuft')
  knopf.textContent = 'sende …'
  timer[0].fn()
  pruefe('Kontrolle: hat inzwischen etwas anderes den Knopf beschriftet, bleibt das stehen', knopf.textContent === 'sende …', knopf)
}

console.log('SPA-Wechsel: Klick')
const handler = ausschnitt(quelle, "knopf.addEventListener('click', meldeSperre.mitSperre(", '\n  }))\n').replace(/\)\)\n$/, '')

async function klicken({ eintragTitel, listenKey, seitenTitelWert, verlassen, seitenKennung = A, geladen = 2, wechselt = false }) {
  const knopf = knopfNeu()
  if (wechselt) knopf.dataset.wechselt = 'true'
  const gruende = []
  const gesendet = []
  const abweisen = (g) => gruende.push(g)
  const echt = {
    knopf,
    meldeSperre: { mitSperre: (f) => f, vermerken: () => {} },
    verbindungLebt: () => true,
    standGeladen: true,
    erledigt: {},
    listenId: listenKey,
    liste,
    location: { pathname: `/dp/${A}` },
    staffelSchluessel: () => 's1',
    staffelZahl: () => 1,
    seitenTitel: () => seitenTitelWert,
    deutschInFolgen: () => true,
    geladeneFolgen: () => geladen,
    sprachenAusFolgen: () => ['Deutsch'],
    seitenLage: () => ({ folgenLautSeite: 2 }),
    gesehen: { gesamt: 2, jeFolge: null },
    eintrag: { url: `https://www.amazon.de/dp/${A}`, titel: eintragTitel },
    quelltextVonFruehererSeite: () => false,
    asinAusAdresse: () => A,
    asinAusSeite: () => seitenKennung,
    titelVerlassen: verlassen,
    document: { querySelector: () => null },
    abweisen,
    abweisenMitGrund: grundZeigen(knopf, gruende),
    WORKER: 'https://worker.test/pruefung',
    chrome: { storage: { sync: { get: async () => ({ token: 'tok' }) } } },
    setTimeout: () => 0,
    fetch: async (url, opt) => { gesendet.push(String(opt?.body ?? url)); return { ok: true, status: 200, clone() { return this }, json: async () => ({}) } },
    speicherLesen: async () => ({}),
    speicherSchreiben: async () => {},
    briefkastenAdressen: new Set(),
    frischGemeldet: new Set(),
    uebersichtZeichnen: () => {},
    vorfallMelden: async () => {},
    globalThis: globaleLaden(),
  }
  const { klick } = handlerKompilieren(handler, echt)
  await klick(null)
  return { gruende, gesendet, knopfText: knopf.textContent, knopfTitel: knopf.title }
}

async function haupt() {
  const verlassen = { kennung: B, titel: TITEL_B }
  const gut = await klicken({ eintragTitel: TITEL_A, listenKey: listenId, seitenTitelWert: TITEL_A, verlassen })
  pruefe('A nach B → A: Klick sendet', gut.gesendet.length === 1 && gut.gruende.length === 0, gut)
  pruefe('… und meldet A, nicht B', gut.gesendet[0]?.includes(A) === true && !gut.gesendet[0]?.includes(B), gut.gesendet)
  const alt = await klicken({ eintragTitel: TITEL_B, listenKey: B, seitenTitelWert: TITEL_B, verlassen, seitenKennung: B })
  pruefe('Kontrolle: mit dem alten Eintrag von B wird abgewiesen', alt.gesendet.length === 0 && alt.gruende[0] === 'Titel gehört zur verlassenen Seite', alt)
  pruefe('… und der Grund steht am Knopf (kein stiller Klick)', alt.knopfText.includes('Titel gehört zur verlassenen Seite') && alt.knopfTitel === 'Titel gehört zur verlassenen Seite', alt)
  const mitten = await klicken({ eintragTitel: TITEL_A, listenKey: A, seitenTitelWert: TITEL_A, verlassen, wechselt: true })
  pruefe('mitten im Staffelwechsel: nichts gesendet, Grund am Knopf', mitten.gesendet.length === 0 && mitten.knopfText === '⚠ Staffelwechsel läuft', mitten)
  const leer = await klicken({ eintragTitel: TITEL_A, listenKey: A, seitenTitelWert: TITEL_A, verlassen, geladen: 0 })
  pruefe('keine Folge gelesen: nichts gesendet, Grund am Knopf', leer.gesendet.length === 0 && leer.knopfText === '⚠ keine Folge gelesen', leer)
  if (fehler.length) {
    console.error(`\n${fehler.length} Fehler`)
    process.exit(1)
  }
  console.log('\nSPA-Wechsel: alles bestanden')
}
haupt()
