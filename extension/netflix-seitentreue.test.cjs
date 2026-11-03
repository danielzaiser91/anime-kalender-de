/**
 * **Netflix: nach einem Titelwechsel geht keine Meldung der vorigen Seite unter der neuen Adresse raus.**
 *
 * Anlass (13.10.2026): Die 13 Folgen von Barbie Staffel 2 (Titel 81184735, gti 81184787 … 81184798) kamen
 * 40 s nach der ersten Meldung ein zweites Mal an — unter The Loud House (81186971). Hier läuft der echte
 * `randMelden`/`durchlaufMelden` aus `melder.js` (herausgeschnitten) mit der echten Prüfung aus
 * `netflix-seitentreue.js`; Attrappen nur für Speicher, Netz und Nachbar-Funktionen.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
const helfer = readFileSync(resolve(__dirname, 'netflix-seitentreue.js'), 'utf8')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Netflix: Meldung nur unter der Adresse ihrer Folgen')

const schneide = (name) => {
  const i = quelle.search(new RegExp(`\\n(?:async )?function ${name}\\(`))
  if (i < 0) return ''
  return quelle.slice(i + 1, quelle.indexOf('\n}\n', i + 1) + 3)
}

const BARBIE = '81184735'
const LOUD = '81186971'
const GTI_BARBIE_S2 = [81184787, 81184789, 81184792, 81184790, 81184793, 81184791, 81184795, 81184794, 81184796, 81184799, 81184788, 81184797, 81184798]
const GTI_LOUD_S3 = [81947014, 81947026, 81947035]
const folge = (videoId, i, seasonId) => ({ videoId, nummer: i + 1, seasonId, titel: `E${i + 1}`, felder: {} })
const barbieS2 = GTI_BARBIE_S2.map((g, i) => folge(g, i, 81184773))
const loudS3 = GTI_LOUD_S3.map((g, i) => folge(g, i, 81944948))

/** Läuft `randMelden` (und `durchlaufMelden`) mit dem Stand eines Durchlaufs; liefert gesendete URLs und Rückgabe. */
async function lauf({ durchlauf, hier, aufruf }) {
  const gesendet = []
  const kontext = {
    console: { warn() {}, log() {}, info() {} },
    chrome: { storage: { sync: { get: async () => ({ token: 't' }) } } },
    fetch: async (_url, opt) => {
      const stapel = JSON.parse(opt.body).stapel ?? [JSON.parse(opt.body)]
      for (const m of stapel) gesendet.push(m.url)
      return { ok: true, json: async () => ({ ergebnisse: stapel.map(() => ({ ok: true })) }) }
    },
    WORKER: 'x',
    MELDE_STAPEL: 10,
    DURCHLAUF: durchlauf,
    stand: { reihe: hier, staffeln: null },
    letztesMenue: [],
    frischGemeldetNetflix: new Set(),
    titelDerAdresse: () => hier,
    gemeinteReihe: () => hier,
    staffelFuerFolge: () => 2,
    staffelGeprueft: (_r, _n, s) => s,
    meldeZiel: () => ({ staffel: 2, titelId: null, ausKennung: false, folgen: 13 }),
    akNetflixRohStaffel: () => ({}),
    akNetflixMenue: () => [],
    akNetflixRandNotiz: () => 'n',
    beobachtung: () => ({}),
    ohneKennungen: () => null,
    meldungenMerken() {},
    merkeErledigt: async () => {},
    durchlaufStandSchreiben: async () => {},
    Date,
  }
  kontext.globalThis = kontext
  vm.createContext(kontext)
  vm.runInContext(helfer, kontext)
  vm.runInContext(['randMelden', 'durchlaufMelden'].map(schneide).join('\n\n'), kontext)
  kontext.befund = { echte: [{ code: 'de', name: 'Deutsch' }], folge: durchlauf.folgen[0], deutsch: true }
  kontext.folgenArg = aufruf.folgen
  const ergebnis = await vm.runInContext(
    aufruf.einzeln ? 'durchlaufMelden(folgenArg[0], befund.echte, true)' : 'randMelden(folgenArg, befund, 13, [1, 13])',
    kontext,
  )
  return { gesendet, ergebnis }
}

const stand = (listeFuer, liste) => ({ listeFuer, alleFolgen: liste, folgen: liste, gemeldet: new Set(), staffelLabel: null })

async function main() {
  pruefe('Funktionen auffindbar', schneide('randMelden').length > 100 && schneide('durchlaufMelden').length > 100)

  const gleich = await lauf({ durchlauf: stand(BARBIE, barbieS2), hier: BARBIE, aufruf: { folgen: barbieS2 } })
  pruefe('Barbie auf Barbies Seite: 13 Meldungen, alle unter Barbie', gleich.ergebnis === 13 && gleich.gesendet.length === 13 && gleich.gesendet.every((u) => u.endsWith(`/${BARBIE}`)), gleich)

  /* Der Anlass: Seite ist schon The Loud House, Durchlauf hält noch Barbies Liste. */
  const wechsel = await lauf({ durchlauf: stand(BARBIE, barbieS2), hier: LOUD, aufruf: { folgen: barbieS2 } })
  pruefe('Wechsel zu Loud House: Barbies Folgen gehen nicht raus', wechsel.ergebnis === 0 && wechsel.gesendet.length === 0, wechsel)

  const wechselEinzeln = await lauf({ durchlauf: stand(BARBIE, barbieS2), hier: LOUD, aufruf: { folgen: barbieS2, einzeln: true } })
  pruefe('Wechsel: auch die Einzelmeldung bleibt zurück', wechselEinzeln.ergebnis === false && wechselEinzeln.gesendet.length === 0, wechselEinzeln)

  /* Liste ist schon die der neuen Seite, die Stichprobe aber noch die alte. */
  const altStichprobe = await lauf({ durchlauf: stand(LOUD, loudS3), hier: LOUD, aufruf: { folgen: barbieS2 } })
  pruefe('Liste von Loud House, Stichprobe von Barbie: nichts geht raus', altStichprobe.ergebnis === 0 && altStichprobe.gesendet.length === 0, altStichprobe)

  /* Gegenfälle: das Richtige geht weiter raus. */
  const loud = await lauf({ durchlauf: stand(LOUD, loudS3), hier: LOUD, aufruf: { folgen: loudS3 } })
  pruefe('Loud House Staffel 3 auf seiner Seite: 3 Meldungen unter Loud House', loud.ergebnis === 3 && loud.gesendet.every((u) => u.endsWith(`/${LOUD}`)), loud)
  const einzeln = await lauf({ durchlauf: stand(LOUD, loudS3), hier: LOUD, aufruf: { folgen: loudS3, einzeln: true } })
  pruefe('Einzelmeldung auf der eigenen Seite geht raus', einzeln.ergebnis === true && einzeln.gesendet.length === 1, einzeln)
  const imPlayer = await lauf({ durchlauf: stand(BARBIE, barbieS2), hier: null, aufruf: { folgen: barbieS2 } })
  pruefe('im Player (keine Titeladresse) gilt die Liste', imPlayer.ergebnis === 13, imPlayer)
  const ohneListe = await lauf({ durchlauf: stand(undefined, []), hier: LOUD, aufruf: { folgen: loudS3 } })
  pruefe('ohne gelesene Liste (Film) bleibt es beim bisherigen Weg', ohneListe.ergebnis === 3, ohneListe)

  /* Verdrahtung: beide Melder rufen die Prüfung, und das Manifest lädt sie vor melder.js. */
  pruefe('randMelden ruft die Prüfung', /akNetflixSeitentreu\(DURCHLAUF, titelDerAdresse\(\), folgen\)/.test(schneide('randMelden')))
  pruefe('durchlaufMelden ruft die Prüfung', /akNetflixSeitentreu\(DURCHLAUF, titelDerAdresse\(\), \[folge\]\)/.test(schneide('durchlaufMelden')))
  const dateien = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8')).content_scripts.flatMap((c) => c.js ?? [])
  const i = dateien.indexOf('netflix-seitentreue.js')
  pruefe('Manifest lädt netflix-seitentreue.js vor melder.js', i >= 0 && i < dateien.indexOf('melder.js'), dateien.slice(0, 3))

  if (fehler.length) {
    console.log(`\n${fehler.length} Fehler`)
    process.exit(1)
  }
  console.log('\nnetflix-seitentreue: alle Fälle grün')
}

main()
