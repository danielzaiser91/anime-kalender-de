/**
 * Disney+: zurückgestellte Titel zählen nicht als offen (Daniel, 31.10.2026).
 *
 * Der Durchgang meldete „2 Titel / 6 zurückgestellt“, die Pille am Kasten sagte zugleich „6 offen“.
 * Geprüft werden die Zähl- und Textfunktionen aus `disney-durchgang.js` und die echte `zeigeUebersicht`
 * aus `disney.js` (aus dem Quelltext geschnitten, Kulisse mit festem Speicher und fester Uhr).
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (n) => readFileSync(`${__dirname}/${n}`, 'utf8')
const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const JETZT = Date.parse('2026-10-31T10:00:00Z')
const TAG = 24 * 60 * 60 * 1000
const kontext = { JSON, Math, Date, Intl, globalThis: {} }
kontext.globalThis = kontext
vm.runInNewContext(lies('disney-durchgang.js'), kontext)

const titel = (n) => ({ url: `https://www.disneyplus.com/browse/entity-${n}`, titel: `Titel ${n}`, offen: 1, staffeln: [{ offen: true, folgen: 12 }] })
const alle = Array.from({ length: 8 }, (_, i) => titel(i + 1))
/* Sechs Titel sind heute zurückgestellt (also bis 7.11.), die Titel 7 und 8 nicht. */
const gedaechtnis = Object.fromEntries(alle.slice(0, 6).map((e) => [e.url, JETZT]))
const dauer = { getItem: () => JSON.stringify(gedaechtnis) }
const bisFuer = (url) => kontext.akDisneyZurueckBis(dauer, url, JETZT)
const keinerErledigt = () => false

console.log('Disney+: zurückgestellt ist nicht offen\n')
pruefe('Rückstellung endet nach 7 Tagen (heute + 7 = 7.11.)', bisFuer(alle[0].url) === JETZT + 7 * TAG, bisFuer(alle[0].url))
pruefe('nicht zurückgestellt: null', bisFuer(alle[7].url) === null)
pruefe('abgelaufene Rückstellung (8 Tage alt) zählt nicht', kontext.akDisneyZurueckBis({ getItem: () => JSON.stringify({ a: JETZT - 8 * TAG }) }, 'a', JETZT) === null)

const z = kontext.akDisneyZaehlung(alle, keinerErledigt, bisFuer)
pruefe('Zählung: 2 offen, 6 zurückgestellt', z.offen === 2 && z.zurueck === 6, z)
pruefe('Zählung: früheste Rückkehr = 7.11. (Daniels Fall: nicht „6 offen“)', kontext.akDisneyBisText(z.bis) === 'bis 7.11.', kontext.akDisneyBisText(z.bis))
const einzeln = kontext.akDisneyZaehlung(alle, keinerErledigt, (url) => (url === alle[0].url ? JETZT + TAG : null))
pruefe('Zählung mit genau 1 zurückgestellten: 7 offen, 1 zurückgestellt', einzeln.offen === 7 && einzeln.zurueck === 1, einzeln)
const gemeldet = kontext.akDisneyZaehlung(alle, (e) => e === alle[0], bisFuer)
pruefe('ein gemeldeter, zurückgestellter Titel zählt weder offen noch zurückgestellt', gemeldet.zurueck === 5 && gemeldet.offen === 2, gemeldet)
const nurRuhend = kontext.akDisneyZaehlung(alle.slice(0, 6), keinerErledigt, bisFuer)
pruefe('nur Zurückgestellte: 0 offen', nurRuhend.offen === 0 && nurRuhend.zurueck === 6, nurRuhend)

pruefe('Pille: 2 offen und 6 zurückgestellt', kontext.akDisneyPilleText(2, z) === 'Anime-Kalender: 2 offen · 6 zurückgestellt bis 7.11.', kontext.akDisneyPilleText(2, z))
pruefe('Pille: nur Zurückgestellte sagt nicht „alles gemeldet“', kontext.akDisneyPilleText(0, nurRuhend) === 'Anime-Kalender: 6 zurückgestellt bis 7.11.', kontext.akDisneyPilleText(0, nurRuhend))
pruefe('Pille: ohne alles „alles gemeldet“', kontext.akDisneyPilleText(0, { offen: 0, zurueck: 0, bis: null }) === 'Anime-Kalender: alles gemeldet ✓')
pruefe('Kopf der Liste: Zurückgestellte stehen mit Datum da', kontext.akDisneyKopfText(nurRuhend) === '6 zurückgestellt bis 7.11.' && kontext.akDisneyKopfText(z) === '2 Titel zu prüfen')
pruefe('Zeile: zurückgestellt mit Datum, ohne Grundbehauptung (Gebiet und Startseite sind verschiedene Gründe)', kontext.akDisneyZeilenText(alle[0], z.bis) === 'zurückgestellt bis 7.11.', kontext.akDisneyZeilenText(alle[0], z.bis))
pruefe('Zeile: sonst Staffeln und ca. Folgen', kontext.akDisneyZeilenText(alle[7], null) === '1 Staffel, ca. 12 Folgen', kontext.akDisneyZeilenText(alle[7], null))

/* Die echte Funktion der Seite: sie ruft Zählung und Text mit den richtigen Eingaben. */
const quelle = lies('disney.js')
const von = quelle.indexOf('  function zeigeUebersicht() {')
const bis = quelle.indexOf('\n  }\n', von)
const knopf = { textContent: '', className: '', isConnected: true }
const seite = vm.createContext({
  globalThis: kontext,
  Date: class extends Date {
    static now() {
      return JETZT
    }
  },
  localStorage: dauer,
  offeneEintraege: () => alle,
  istErledigt: keinerErledigt,
  akZaehler: (_, zahl) => zahl,
  disneyKasten: () => ({ querySelector: () => null }),
  disneyDebugZeile: () => {},
  uebersichtKnopf: knopf,
  document: { createElement: () => knopf },
  dialogOeffnen: () => {},
})
/* Die echte Zeile aus disney.js wird mit ausgeführt, nicht in der Kulisse nachgebaut. */
const zurueckBisZeile = quelle.split('\n').find((zeile) => zeile.startsWith('  const zurueckBis = '))
pruefe('Seite: disney.js hat die Zeile zurueckBis', Boolean(zurueckBisZeile))
vm.runInContext(`${zurueckBisZeile}\n${quelle.slice(von, bis + 5)}\nzeigeUebersicht()`, seite)
pruefe('Seite: die Pille zeigt 2 offen und 6 zurückgestellt', knopf.textContent === 'Anime-Kalender: 2 offen · 6 zurückgestellt bis 7.11.', knopf.textContent)

/* Die Kopfzeile von dialogOeffnen: der Anfang der echten Funktion bis zum Durchgangsknopf, Kulisse ohne Rest der Seite. */
{
  const dVon = quelle.indexOf('  function dialogOeffnen() {')
  const ende = 'durchgangKnopf(kopf, zaehlung.offen)'
  const dBis = quelle.indexOf(ende, dVon) + ende.length
  const element = () => ({ style: {}, appendChild() {}, getBoundingClientRect: () => ({ top: 500 }) })
  const gemacht = []
  const dialogSeite = vm.createContext({
    globalThis: kontext,
    Date: seite.Date,
    Math,
    window: { innerHeight: 800 },
    localStorage: dauer,
    offeneEintraege: () => alle,
    istErledigt: keinerErledigt,
    disneyKasten: element,
    document: { createElement: () => (gemacht.push(element()), gemacht.at(-1)) },
    durchgangKnopf: (_, offen) => (dialogSeite.knopfOffen = offen),
  })
  vm.runInContext(
    `let dialog = null\nlet zeigeErledigte = false\n${zurueckBisZeile}\n${quelle.slice(dVon, dBis)}\n return titelzeile.textContent }\n` +
      'globalThis.kopfzeile = dialogOeffnen()',
    dialogSeite,
  )
  pruefe('Dialog: Kopfzeile „2 Titel zu prüfen“', kontext.kopfzeile === '2 Titel zu prüfen', kontext.kopfzeile)
  pruefe('Dialog: der Durchgangsknopf bekommt die offenen (2), nicht alle (8)', dialogSeite.knopfOffen === 2, dialogSeite.knopfOffen)
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('\nZurückgestellte Disney+-Titel zählen nicht als offen.')
