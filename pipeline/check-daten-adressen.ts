import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NACH_DEM_BAU_UMGESCHRIEBEN, dateiKennungen } from '../tools/daten-kennungen.ts'
import { bewerteAnfragen } from '../tools/daten-adressen-bewerten.ts'

/** Zusicherung: `tools/daten-adressen-pruefen.mjs` besteht ein stimmiges `dist/` und scheitert (Exit 1) an jedem Bruch zwischen Inhalt, meta.json, Vorladen und Bündel. */
const wurzel = mkdtempSync(join(tmpdir(), 'adressen-'))
const daten = join(wurzel, 'daten')
mkdirSync(join(daten, 'voices'), { recursive: true })
for (const name of ['events.json', 'releases.json', 'titles-core.json', 'woche.json', 'meta.json', 'patchnotes.json']) writeFileSync(join(daten, name), JSON.stringify(name))
writeFileSync(join(daten, 'voices', '1.json'), '{}')

const echt = dateiKennungen(daten, NACH_DEM_BAU_UMGESCHRIEBEN)
const vorlade = (v: Record<string, string>) =>
  `<script>var A = {"meta":"/data/meta.json?v=${v.meta}","titles-core":"/data/titles-core.json?v=${v.core}","releases":"/data/releases.json?v=${v.releases}","events":"/data/events.json?v=${v.events}"}</script>`

interface Stand {
  dateien: Record<string, string>
  html: string
  buendel: string
  /** Ändert `dist/data` nach dem Kopieren (ein Schreiber nach dem Bau). */
  nachBau?: (distDaten: string) => void
}
const gut = (): Stand => ({
  dateien: { ...echt },
  html: vorlade({ meta: 'v1', core: echt['titles-core.json']!, releases: echt['releases.json']!, events: echt['events.json']! }),
  buendel: JSON.stringify({ ...echt, 'meta.json': 'v1', 'patchnotes.json': 'v1' }),
})

function lauf(stand: Stand): { status: number | null; text: string } {
  const dist = mkdtempSync(join(tmpdir(), 'adressen-dist-'))
  cpSync(daten, join(dist, 'data'), { recursive: true })
  mkdirSync(join(dist, 'assets'))
  writeFileSync(join(dist, 'data', 'meta.json'), JSON.stringify({ dateien: stand.dateien }))
  writeFileSync(join(dist, 'version.json'), JSON.stringify({ v: 'v1' }))
  writeFileSync(join(dist, 'index.html'), stand.html)
  writeFileSync(join(dist, 'assets', 'index-x.js'), stand.buendel)
  stand.nachBau?.(join(dist, 'data'))
  const r = spawnSync(process.execPath, ['tools/daten-adressen-pruefen.mjs', '--dist', dist], { encoding: 'utf8' })
  return { status: r.status, text: r.stdout + r.stderr }
}

const fehler: string[] = []
let faelle = 0
const erwarte = (name: string, stand: Stand, status: number, teil: string) => {
  faelle++
  const r = lauf(stand)
  if (r.status !== status || !r.text.includes(teil)) fehler.push(`${name}: Exit ${r.status}, ${r.text.trim()}`)
}

erwarte('stimmiges dist', gut(), 0, `✓ Daten-Adressen: ${Object.keys(echt).length} Kennungen`)

const ohneDateien = gut()
ohneDateien.dateien = {}
erwarte('meta.json ohne dateien', ohneDateien, 1, 'kein `dateien`')

const schlechterHash = gut()
schlechterHash.dateien = { ...echt, 'events.json': 'xyz' }
erwarte('Kennung kein 8-stelliger Hash', schlechterHash, 1, 'kein 8-stelliger Hash')

const patch = gut()
patch.dateien = { ...echt, 'patchnotes.json': 'eeeeeeee' }
erwarte('patchnotes.json mit Inhalts-Hash', patch, 1, 'darf keinen Inhalts-Hash tragen')

const metaHash = gut()
metaHash.dateien = { ...echt, 'meta.json': 'eeeeeeee' }
erwarte('meta.json mit Inhalts-Hash', metaHash, 1, 'darf keinen Inhalts-Hash tragen')

const veraltet = gut()
veraltet.dateien = { ...echt, 'woche.json': '00000000' }
erwarte('Kennung passt nicht zum Inhalt (Mitte der Liste)', veraltet, 1, `dateien["woche.json"] = 00000000, aus dem Inhalt von `)

const zusatz = gut()
zusatz.dateien = { ...echt, 'zusatz.json': 'eeeeeeee' }
erwarte('Kennung ohne Datei im Bestand', zusatz, 1, 'dateien["zusatz.json"] = eeeeeeee, aus dem Inhalt von')

const nachtraeglich = gut()
nachtraeglich.nachBau = (d) => appendFileSync(join(d, 'titles-core.json'), ' ')
erwarte('dist/data nach dem Bau verändert (Schreiber nach der Kennung)', nachtraeglich, 1, 'dateien["titles-core.json"]')

const ordnerNachtraeglich = gut()
ordnerNachtraeglich.nachBau = (d) => writeFileSync(join(d, 'voices', '2.json'), '{}')
erwarte('neue Datei in dist/data/voices nach dem Bau', ordnerNachtraeglich, 1, 'dateien["voices/"]')

const fehlt = gut()
delete fehlt.dateien['voices/']
erwarte('Ordnerkennung fehlt', fehlt, 1, 'dateien["voices/"] = undefined')

const falschVorgeladen = gut()
falschVorgeladen.html = vorlade({ meta: 'v1', core: echt['titles-core.json']!, releases: 'deadbeef', events: echt['events.json']! })
erwarte('Vorladen mit falscher Kennung (Mitte der Liste)', falschVorgeladen, 1, `Vorladen releases.json: ?v=deadbeef, erwartet ${echt['releases.json']}`)

const metaFalsch = gut()
metaFalsch.html = vorlade({ meta: 'v0', core: echt['titles-core.json']!, releases: echt['releases.json']!, events: echt['events.json']! })
erwarte('meta.json im Vorladen nimmt die Code-Version', metaFalsch, 1, 'Vorladen meta.json: ?v=v0, erwartet v1')

const keinVorladen = gut()
keinVorladen.html = '<html></html>'
erwarte('kein Vorladen', keinVorladen, 1, 'lädt keine Startdaten vor')

/* Jede der vier Startdateien einzeln: eine Auswahl, die eine davon verliert, bliebe sonst unbemerkt. */
for (const [schluessel, datei] of [['meta', 'meta.json'], ['titles-core', 'titles-core.json'], ['releases', 'releases.json'], ['events', 'events.json']] as const) {
  const unvollstaendig = gut()
  unvollstaendig.html = unvollstaendig.html.replace(new RegExp(`"${schluessel}":"[^"]*",?`), '').replace(',}', '}')
  erwarte(`Vorladen ohne ${datei}`, unvollstaendig, 1, `Vorladen: ${datei} fehlt`)
}

const ohnePatchnotes = gut()
ohnePatchnotes.buendel = JSON.stringify({ ...echt, 'meta.json': 'v1' })
erwarte('Bündel ohne Code-Version nur für patchnotes.json', ohnePatchnotes, 1, 'Bündel kennt patchnotes.json nicht mit der Code-Version v1')

const ohneVersion = gut()
ohneVersion.buendel = JSON.stringify(echt)
erwarte('Bündel ohne Code-Version für meta.json (Vorladen und loadJson wichen ab)', ohneVersion, 1, 'Bündel kennt meta.json nicht mit der Code-Version v1')

const ohneBuendel = gut()
ohneBuendel.buendel = JSON.stringify({ ...echt, 'releases.json': '99999999', 'meta.json': 'v1', 'patchnotes.json': 'v1' })
erwarte('Bündel kennt eine Kennung nicht', ohneBuendel, 1, `Bündel kennt releases.json:${echt['releases.json']} nicht`)

/* Regeln der Laufzeitprobe (`tools/daten-adressen-browser.mjs`) ohne Browser: sie bekommen die Anfragen als Liste. */
const tabelle = { 'events.json': 'aaaaaaaa', 'woche.json': 'bbbbbbbb', 'voices/': 'cccccccc' }
const a = (datei: string, v: string) => `http://ak.test/data/${datei}?v=${v}`
const guteAnfragen = [a('meta.json', 'v1'), a('events.json', 'aaaaaaaa'), a('woche.json', 'bbbbbbbb'), a('voices/7.json', 'cccccccc')]
const bewerte = (anfragen: string[], vorgeladen: string[]) => bewerteAnfragen(anfragen, vorgeladen, tabelle, 'v1').join('; ')
const erwarteBewertung = (name: string, text: string, teil: string) => {
  faelle++
  if (teil === '' ? text !== '' : !text.includes(teil)) fehler.push(`${name}: ${text || 'kein Verstoß'}`)
}
erwarteBewertung('Anfragen stimmig', bewerte(guteAnfragen, [a('events.json', 'aaaaaaaa'), a('meta.json', 'v1')]), '')
erwarteBewertung('Anfrage mit der Build-Kennung statt der Datei-Kennung', bewerte([...guteAnfragen.slice(0, 1), a('events.json', 'v1'), ...guteAnfragen.slice(2)], []), 'events.json: ?v=v1, erwartet aaaaaaaa')
erwarteBewertung('Datei im Ordner mit falscher Kennung', bewerte([...guteAnfragen.slice(0, 3), a('voices/7.json', 'aaaaaaaa')], []), 'voices/7.json: ?v=aaaaaaaa, erwartet cccccccc')
erwarteBewertung('meta.json mit alter Code-Version', bewerte([a('meta.json', 'v0'), ...guteAnfragen.slice(1)], []), 'meta.json: ?v=v0, erwartet v1')
erwarteBewertung('Datei ohne Regel', bewerte([...guteAnfragen, a('news.json', 'v1')], []), 'news.json: keine Kennung')
erwarteBewertung('Anfrage ohne ?v', bewerte([...guteAnfragen, 'http://ak.test/data/events.json'], []), 'events.json: ?v=null')
erwarteBewertung('vorgeladene Adresse nie geholt', bewerte(guteAnfragen, [a('events.json', 'aaaaaaaa'), a('woche.json', 'zzzzzzzz')]), 'vorgeladen')
erwarteBewertung('vorgeladene Adresse doppelt geholt', bewerte([...guteAnfragen, a('events.json', 'aaaaaaaa')], [a('events.json', 'aaaaaaaa')]), '2 Abrufe statt 1')
erwarteBewertung('keine Abrufe', bewerte([], [a('events.json', 'aaaaaaaa')]), 'kein Datenabruf')
erwarteBewertung('kein Vorlade-Link meldet', bewerte(guteAnfragen, []), 'kein Vorlade-Link')

if (fehler.length) {
  console.error('✖ Daten-Adressen-Wächter:', fehler.join('\n  '))
  process.exit(1)
}
console.log('  ✓ Daten-Adressen-Wächter: besteht ein stimmiges dist/, scheitert mit Exit 1 an ' + (faelle - 1) + ' Brüchen (inkl. Laufzeitregeln)')
