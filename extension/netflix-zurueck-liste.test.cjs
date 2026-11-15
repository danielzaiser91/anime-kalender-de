/**
 * Netflix-Prüfliste: was die Merkliste der Ansicht der Zurückgestellten liefert (Daniel 15.11.2026: „0 auf prüfung,
 * 160 zurückgestellt, aber man sieht es visuell nicht“). Geprüft: `zurueckInfo` (aktiv, abgelaufen, fertig, unbekannt)
 * samt letzter Messung `am` — beim Zurückstellen gespeichert, bei alten Einträgen ohne Wert. Kopf und Tabelle selbst
 * prüft `netflix-liste-ansicht.test.cjs`.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
for (const datei of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js']) {
  vm.runInContext(readFileSync(resolve(__dirname, datei), 'utf8'), kontext)
}

console.log('Netflix: zurückgestellte Titel in der Prüfliste')

/* 15.11.2026, 12:00 Berlin (Winterzeit, UTC+1). */
const JETZT = Date.UTC(2026, 10, 15, 11, 0)
const TAG = 24 * 3600 * 1000

const speicherNeu = (start) => {
  const daten = { ...start }
  return { daten, get: async (k) => (k in daten ? { [k]: daten[k] } : {}), set: async (o) => void Object.assign(daten, o) }
}
async function pruefeInfo() {
  const bis = Date.UTC(2026, 10, 20)
  const gemessen = Date.UTC(2026, 10, 14, 17, 0)
  const speicher = speicherNeu({
    netflixZurueckgestellt: {
      1: { grund: 'Erinnern 20. November', bis },
      2: { grund: 'alt', bis: JETZT - 1 },
      3: { grund: 'fertig-Fall', bis },
      5: { grund: 'mit Messung', bis, am: gemessen },
      9: { grund: 'nicht gelistet', bis },
    },
  })
  const titel = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }
  const karte = kontext.akNetflixZurueckNeu(titel, (k) => k === '3', { speicher, jetzt: () => JETZT, datum: () => null })
  await karte.geladen()
  pruefe('zurueckInfo: aktiver Eintrag liefert Grund und Ablauf', JSON.stringify(karte.zurueckInfo('1')) === JSON.stringify({ grund: 'Erinnern 20. November', bis }), karte.zurueckInfo('1'))
  pruefe('zurueckInfo: alter Eintrag ohne Messung — `am` fehlt, nichts wird erfunden', karte.zurueckInfo('1')?.am === undefined, karte.zurueckInfo('1'))
  pruefe('zurueckInfo: gespeicherte Messung kommt mit', karte.zurueckInfo('5')?.am === gemessen, karte.zurueckInfo('5'))
  pruefe('zurueckInfo: Zahl als Kennung zählt wie Text', karte.zurueckInfo(1)?.bis === bis)
  pruefe('zurueckInfo: abgelaufen → null', karte.zurueckInfo('2') === null)
  pruefe('zurueckInfo: nach Worker-Stand fertig → null', karte.zurueckInfo('3') === null)
  pruefe('zurueckInfo: nicht in der Liste → null', karte.zurueckInfo('9') === null)
  pruefe('zurueckInfo: unbekannt → null', karte.zurueckInfo('77') === null)
  pruefe('Zahl und Info stimmen überein (2 zurückgestellt)', karte.zurueckZahl() === 2, karte.zurueckZahl())

  karte.set('4', 'keine Folgenliste in 20 s')
  await karte.geladen()
  const neu = speicher.daten.netflixZurueckgestellt['4']
  pruefe('Zurückstellen speichert die Messung: `am` = jetzt, neben Grund und Ablauf', JSON.stringify(neu) === JSON.stringify({ grund: 'keine Folgenliste in 20 s', bis: JETZT + TAG, am: JETZT }), neu)
  pruefe('… und `zurueckInfo` nennt sie', karte.zurueckInfo('4')?.am === JETZT && karte.zurueckInfo('4')?.bis === JETZT + TAG, karte.zurueckInfo('4'))
  pruefe('… der alte Eintrag daneben bleibt ohne `am`', !('am' in speicher.daten.netflixZurueckgestellt['1']), speicher.daten.netflixZurueckgestellt['1'])
}

pruefeInfo().then(() => {
  console.log(fehler.length ? `\n${fehler.length} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
  process.exit(fehler.length ? 1 : 0)
})
