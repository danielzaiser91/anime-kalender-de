/**
 * Unbekannte Prime-Seiten (F109 = A, 07.11.2026): Der Kasten bietet „Sprache melden" an, statt zu schweigen.
 *
 * Geprüft wird die Entscheidung „Knopf weg?" mit jeder Teilbedingung allein (Tabelle gegen `prime-region.js`),
 * die Kopfzeile des Kastens aus dem echten Quelltext von `amazon.js` (Schnitt, keine Nachbildung).
 * Die Kennzeichnung der Meldung („unbekannt=1") prüft `amazon-melden-spa-wechsel.test.cjs` am echten Klick.
 * Der Gang durch `zeichnenRoh()` (Knopf sichtbar, Text, Sperre nach der Meldung) steht in `meldekasten.test.cjs`.
 *
 * Aufruf: `node extension/prime-kasten-unbekannt.test.cjs`
 */
const vm = require('node:vm')
const { lies, ausschnitt, handlerKompilieren } = require('./melde-geruest.cjs')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const k = vm.createContext({ Date, String, Number, Boolean, Object, JSON, Math, Set })
k.globalThis = k
vm.runInContext(lies('prime-region.js'), k)
const quelle = lies('amazon.js')

console.log('Unbekannte Seite: Knopf weg?')
/* Grundfall: nichts spricht für den Knopf, aber Liste geladen und Prime-Video-Merkmal da → bleibt (unbekannte Seite). */
const basis = { listeGeladen: true, inListe: false, ausSuche: false, serieBekannt: () => false, seiteGehtUnsAn: () => true }
const weg = (aendern) => k.akPrimeKnopfVersteckt({ ...basis, ...aendern })
pruefe('unbekannte Prime-Seite: Knopf bleibt', weg({}) === false)
pruefe('Seite ohne Prime-Video-Merkmal: Knopf weg', weg({ seiteGehtUnsAn: () => false }) === true)
pruefe('Prüfliste nicht geladen: Knopf weg', weg({ listeGeladen: false }) === true)
pruefe('Kontrolle: Prüfliste nicht geladen und Seite in der Liste: Knopf bleibt', weg({ listeGeladen: false, inListe: true, seiteGehtUnsAn: () => false }) === false)
pruefe('Seite in der Liste, ohne Merkmal: Knopf bleibt', weg({ inListe: true, seiteGehtUnsAn: () => false }) === false)
pruefe('Suchauftrag, ohne Merkmal: Knopf bleibt', weg({ ausSuche: true, seiteGehtUnsAn: () => false }) === false)
pruefe('Staffel einer bekannten Serie, ohne Merkmal: Knopf bleibt', weg({ serieBekannt: () => true, seiteGehtUnsAn: () => false }) === false)
/* Die Funktionen laufen nur bei Bedarf: Auf einer Seite der Liste fragt niemand den Quelltext der Seite. */
let gerufen = 0
const zaehlt = () => { gerufen++; return true }
k.akPrimeKnopfVersteckt({ ...basis, inListe: true, serieBekannt: zaehlt, seiteGehtUnsAn: zaehlt })
pruefe('Seite in der Liste: weder Serienvergleich noch Seitenmerkmal werden gefragt', gerufen === 0, gerufen)

console.log('Unbekannte Seite: Kopfzeile')
const zeile = (unbekannt, name, kennung) => k.akPrimeMeldetZeile(unbekannt, name, kennung)
pruefe('bekannt, mit Name', zeile(false, 'Goblin Slayer', 'B0A') === 'meldet: Goblin Slayer · B0A')
pruefe('unbekannt, mit Name: sagt „Nicht auf der Prüfliste" zuerst', zeile(true, "Devils' Crest", 'B0H') === "Nicht auf der Prüfliste: Devils' Crest · B0H")
pruefe('bekannt, ohne Name', zeile(false, null, 'B0A') === 'meldet: B0A')
pruefe('unbekannt, ohne Name', zeile(true, null, 'B0H') === 'Nicht auf der Prüfliste: B0H')
pruefe('ohne Name und Kennung: keine Kopfzeile', zeile(true, null, null) === '' && zeile(false, '', '') === '')

/* Der echte Aufruf in amazon.js: `eintrag.unbekannt` kommt als Wahrheitswert an der Kopfzeile an. */
const kopfText = ausschnitt(quelle, 'const wasGemeldetWird = ', '\n        })()')
function kopf(eintrag, titel) {
  return handlerKompilieren(kopfText, {
    liste: {},
    id: 'B0H',
    listenId: 'B0H',
    kennungJetzt: 'B0H',
    eintrag,
    meldenVersteckt: () => false,
    suchauftrag: () => null,
    zurReihe: () => true,
    seitenTitel: () => titel,
    globalThis: k,
  }).klick
}
pruefe('amazon.js: unbekannter Eintrag → „Nicht auf der Prüfliste: …"', kopf({ titel: null, unbekannt: true }, "Devils' Crest") === "Nicht auf der Prüfliste: Devils' Crest · B0H", kopf({ titel: null, unbekannt: true }, "Devils' Crest"))
pruefe('amazon.js: Kontrolle, bekannter Eintrag → „meldet: …"', kopf({ titel: null }, 'Petals') === 'meldet: Petals · B0H')
const versteckt = handlerKompilieren(kopfText, { liste: {}, id: 'B0H', listenId: 'B0H', kennungJetzt: 'B0H', eintrag: {}, meldenVersteckt: () => true, suchauftrag: () => null, zurReihe: () => true, seitenTitel: () => 'X', globalThis: k }).klick
pruefe('amazon.js: wo der Knopf wegbleibt, steht auch keine Kopfzeile', versteckt === '', versteckt)

/* A5: das echte `seiteGehtUnsAn()` aus amazon.js gegen Seitenlagen; nur Ort, Hydration-Block, Folgen-Reiter und Eintrag sind Attrappen. */
console.log('Unbekannte Seite: echtes seiteGehtUnsAn()')
const gehtAnText = '(function seiteGehtUnsAn() {' + ausschnitt(quelle, 'function seiteGehtUnsAn() {', '\n  }') + ')'
function gehtAn({ pfad, hydration = false, reiter = false }) {
  return handlerKompilieren(gehtAnText, {
    location: { pathname: pfad },
    document: { getElementById: (id) => (hydration && id === 'dv-web-page-hydration-data' ? {} : null) },
    seitenLage: () => ({ hatFolgenReiter: reiter }),
    eintragFuer: () => ({ unbekannt: true }),
    id: 'B0BUCH',
  }).klick()
}
pruefe('Buchseite (/dp/, kein Hydration-Block, kein Folgen-Reiter): geht uns nichts an', gehtAn({ pfad: '/dp/B0BUCH' }) === false)
pruefe('Prime-Startseite (/gp/video/storefront): Merkmal gilt, Kasten nur als Hülle (es gibt dort keine Kennung, der Knopf entsteht erst mit einer)', gehtAn({ pfad: '/gp/video/storefront', hydration: true }) === true)
pruefe('Pfad /gp/video/ ohne Hydration-Block: gilt', gehtAn({ pfad: '/gp/video/detail/B0H' }) === true)
pruefe('Titelseite unter /dp/ mit Hydration-Block: gilt', gehtAn({ pfad: '/dp/B0H', hydration: true }) === true)
pruefe('Seite mit Folgen-Reiter: gilt', gehtAn({ pfad: '/dp/B0H', reiter: true }) === true)
const kennungsWarten = quelle.includes('if (!id) {\n    id = await new Promise((fertig) => {')
pruefe('Ohne Kennung wartet amazon.js auf eine, statt zu zeichnen (Startseite bekommt keinen Meldeknopf)', kennungsWarten)

/* A3: die Diagnose behält ihren Wahrheitswert (Belegfeld der Air-Gear-Messung), nicht die Funktion selbst. */
pruefe('Diagnose: seiteGehtUnsAn wird als Wahrheitswert berichtet', quelle.includes('seiteGehtUnsAn: seiteGehtUnsAn(),'))

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
