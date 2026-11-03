/**
 * Netflix-Durchgang: leitet Netflix einen angesprungenen Titel auf /browse um, meldet der Durchgang ihn
 * selbst als „nicht bei Netflix" und geht weiter (03.11.2026: 5 Centimeters per Second, A Silent Voice,
 * Afro Samurai). Der Schritt läuft über die echten Stücke aus `melder.js` (`browseUmgebung`,
 * `selbstStartenSchritt`, herausgeschnitten); Attrappen nur für Seite, Netz und Nachbarfunktionen.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const lesen = (datei) => readFileSync(resolve(__dirname, datei), 'utf8')
const melder = lesen('melder.js')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const schneide = (name) => {
  const i = melder.search(new RegExp(`\\n(?:async )?function ${name}\\(`))
  if (i < 0) return ''
  return melder.slice(i + 1, melder.indexOf('\n}\n', i + 1) + 3)
}

const JETZT = 1_000_000_000_000
const offene = () => ({ 81659233: { titel: 'Afro Samurai', staffeln: [{ nr: 1, offen: true }] }, 70000001: { titel: 'Zweiter', staffeln: [{ nr: 1, offen: true }] } })

/** Baut die Welt der Seite; `x` überschreibt Pfad, Durchgang, Sprung und Antwort der Meldung. */
function welt(x = {}) {
  const protokoll = { gemeldet: [], spur: [], weiter: 0 }
  const kontext = {
    globalThis: null,
    location: { pathname: x.pfad ?? '/browse' },
    Date: { now: () => x.jetzt ?? JETZT + 10_000 },
    selbstAn: x.selbstAn ?? true,
    DURCHLAUF: { laeuft: false },
    offeneTitel: offene(),
    zuletztGeoeffnet: 'zuletzt' in x ? x.zuletzt : { id: '81659233', zeit: JETZT },
    selbstUebersprungen: new Map(),
    totMelden: async (id, titel) => {
      protokoll.gemeldet.push([id, titel])
      return x.antwort ?? { ok: true, text: 'als tot gemeldet' }
    },
    spur: (was, dazu) => protokoll.spur.push([was, dazu]),
    selbstWeiter: () => protokoll.weiter++,
    gemeinteReihe: () => null,
    console,
  }
  kontext.globalThis = kontext
  vm.createContext(kontext)
  vm.runInContext(lesen('netflix-browse-durchgang.js'), kontext)
  vm.runInContext(`${schneide('browseUmgebung')}\n${schneide('selbstStartenSchritt')}`, kontext)
  return { kontext, protokoll }
}

async function lauf(x) {
  const w = welt(x)
  await vm.runInContext('selbstStartenSchritt()', w.kontext)
  return w
}

async function main() {
  console.log('Netflix-Durchgang: Umleitung auf /browse')

  const ein = await lauf()
  pruefe('Durchgang + /browse: genau eine Meldung mit Kennung und Titel', JSON.stringify(ein.protokoll.gemeldet) === JSON.stringify([['81659233', 'Afro Samurai']]), ein.protokoll.gemeldet)
  pruefe('… und genau ein Weitergehen', ein.protokoll.weiter === 1, ein.protokoll.weiter)
  pruefe('… Grund vermerkt (Endzählung erkennt ihn)', ein.kontext.selbstUebersprungen.get('81659233') === 'nicht bei Netflix gemeldet', [...ein.kontext.selbstUebersprungen])
  pruefe('… Sprung als verbraucht markiert', ein.kontext.zuletztGeoeffnet.verbraucht === true, ein.kontext.zuletztGeoeffnet)
  pruefe('… Spur-Eintrag mit Kennung', ein.protokoll.spur.length === 1 && ein.protokoll.spur[0][1].id === '81659233', ein.protokoll.spur)

  /* Zweiter Takt, während die erste Meldung noch läuft: der Sprung ist schon verbraucht. */
  const doppelt = welt()
  const ersterTakt = vm.runInContext('selbstStartenSchritt()', doppelt.kontext)
  await vm.runInContext('selbstStartenSchritt()', doppelt.kontext)
  await ersterTakt
  pruefe('zweiter Takt vor der Antwort: weiterhin genau eine Meldung', doppelt.protokoll.gemeldet.length === 1 && doppelt.protokoll.weiter === 1, doppelt.protokoll)

  const ohne = await lauf({ selbstAn: false })
  pruefe('ohne Durchgang: keine Selbstmeldung, kein Weitergehen (Handknopf bleibt)', ohne.protokoll.gemeldet.length === 0 && ohne.protokoll.weiter === 0, ohne.protokoll)

  const fehl = await lauf({ antwort: { ok: false, text: 'Fehler 500' } })
  pruefe('Meldung schlägt fehl: zurückgestellt mit Grund, weiter', fehl.kontext.selbstUebersprungen.get('81659233') === 'Meldung nicht möglich: Fehler 500' && fehl.protokoll.weiter === 1, [...fehl.kontext.selbstUebersprungen])
  pruefe('… und nicht als „nicht bei Netflix gemeldet" geführt', fehl.kontext.selbstUebersprungen.get('81659233') !== 'nicht bei Netflix gemeldet')

  const verbraucht = await lauf({ zuletzt: { id: '81659233', zeit: JETZT, verbraucht: true } })
  pruefe('verbrauchter Sprung: nichts', verbraucht.protokoll.gemeldet.length === 0 && verbraucht.protokoll.weiter === 0, verbraucht.protokoll)
  const alt = await lauf({ jetzt: JETZT + 60_000 })
  pruefe('Sprung genau eine Minute alt: nichts', alt.protokoll.gemeldet.length === 0 && alt.protokoll.weiter === 0, alt.protokoll)
  const frisch = await lauf({ jetzt: JETZT + 59_999 })
  pruefe('Sprung 59,999 s alt: noch gemeldet', frisch.protokoll.gemeldet.length === 1, frisch.protokoll)
  const zuFrueh = await lauf({ jetzt: JETZT + 5_999 })
  pruefe('Seite noch nicht gesetzt (unter 6 s): noch nichts', zuFrueh.protokoll.gemeldet.length === 0 && zuFrueh.protokoll.weiter === 0, zuFrueh.protokoll)
  const gesetzt = await lauf({ jetzt: JETZT + 6_000 })
  pruefe('nach 6 s: gemeldet', gesetzt.protokoll.gemeldet.length === 1, gesetzt.protokoll)
  const ohneSprung = await lauf({ zuletzt: null })
  pruefe('kein Sprung des Durchgangs: nichts', ohneSprung.protokoll.gemeldet.length === 0, ohneSprung.protokoll)
  const fremd = await lauf({ zuletzt: { id: '99999999', zeit: JETZT } })
  pruefe('Sprung auf einen Titel außerhalb der Prüfliste: nichts', fremd.protokoll.gemeldet.length === 0, fremd.protokoll)
  const titelSeite = await lauf({ pfad: '/title/81659233' })
  pruefe('Titelseite (kein /browse): keine Selbstmeldung', titelSeite.protokoll.gemeldet.length === 0, titelSeite.protokoll)
  const sprache = await lauf({ pfad: '/de-de/browse' })
  pruefe('/de-de/browse zählt wie /browse', sprache.protokoll.gemeldet.length === 1, sprache.protokoll)

  /* Endzählung: der Kasten nennt diese Titel einzeln. */
  const ende = vm.createContext({ globalThis: {} })
  ende.globalThis = ende
  vm.runInContext(lesen('netflix-browse-durchgang.js'), ende)
  vm.runInContext(lesen('netflix-uebernahme.js'), ende)
  const zurueck = new Map([['1', 'nicht bei Netflix gemeldet'], ['2', 'nicht bei Netflix gemeldet'], ['3', 'Meldung nicht möglich: x']])
  const text = ende.akNetflixEnde('kein offener Auftrag mehr', zurueck, new Set(), 5, {}, new Set()).text
  pruefe('Endzählung: „2 als nicht bei Netflix gemeldet“, nicht der misslungene', /, 2 als nicht bei Netflix gemeldet$/.test(text), text)
  const keine = ende.akNetflixEnde('x', new Map([['3', 'Meldung nicht möglich: x']]), new Set(), 5, {}, new Set()).text
  pruefe('Endzählung ohne solche Titel: Text unverändert', !/nicht bei Netflix/.test(keine), keine)

  if (fehler.length) {
    console.log(`\n${fehler.length} Fall/Fälle fehlgeschlagen`)
    process.exit(1)
  }
  console.log('\nNetflix-Durchgang /browse: alle Fälle grün')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
