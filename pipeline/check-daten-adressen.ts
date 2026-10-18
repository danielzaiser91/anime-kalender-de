import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NACH_DEM_BAU_UMGESCHRIEBEN, dateiKennungen } from '../tools/daten-kennungen.ts'

/** Zusicherung: `tools/daten-adressen-pruefen.mjs` besteht ein stimmiges `dist/` und scheitert (Exit 1) an jedem Bruch zwischen Inhalt, meta.json, Vorladen und Bündel. */
const wurzel = mkdtempSync(join(tmpdir(), 'adressen-'))
const daten = join(wurzel, 'daten')
const salzDatei = join(wurzel, 'kennungen.json')
mkdirSync(join(daten, 'voices'), { recursive: true })
for (const name of ['events.json', 'releases.json', 'titles-core.json', 'woche.json', 'meta.json', 'patchnotes.json']) writeFileSync(join(daten, name), JSON.stringify(name))
writeFileSync(join(daten, 'voices', '1.json'), '{}')
writeFileSync(salzDatei, '{"titel":[]}')

const echt = dateiKennungen(daten, '{"titel":[]}', NACH_DEM_BAU_UMGESCHRIEBEN)
const vorlade = (v: Record<string, string>) =>
  `<script>var A = {"meta":"/data/meta.json?v=${v.meta}","titles-core":"/data/titles-core.json?v=${v.core}","releases":"/data/releases.json?v=${v.releases}","events":"/data/events.json?v=${v.events}"}</script>`

interface Stand {
  dateien: Record<string, string>
  html: string
  buendel: string
}
const gut = (): Stand => ({
  dateien: { ...echt },
  html: vorlade({ meta: 'v1', core: echt['titles-core.json']!, releases: echt['releases.json']!, events: echt['events.json']! }),
  buendel: JSON.stringify({ ...echt, 'meta.json': 'v1', 'patchnotes.json': 'v1' }),
})

function lauf(stand: Stand, salz = salzDatei): { status: number | null; text: string } {
  const dist = mkdtempSync(join(tmpdir(), 'adressen-dist-'))
  mkdirSync(join(dist, 'data'))
  mkdirSync(join(dist, 'assets'))
  writeFileSync(join(dist, 'data', 'meta.json'), JSON.stringify({ dateien: stand.dateien }))
  writeFileSync(join(dist, 'version.json'), JSON.stringify({ v: 'v1' }))
  writeFileSync(join(dist, 'index.html'), stand.html)
  writeFileSync(join(dist, 'assets', 'index-x.js'), stand.buendel)
  const r = spawnSync(process.execPath, ['tools/daten-adressen-pruefen.mjs', '--dist', dist, '--daten', daten, '--salz', salz], { encoding: 'utf8' })
  return { status: r.status, text: r.stdout + r.stderr }
}

const fehler: string[] = []
const erwarte = (name: string, stand: Stand, status: number, teil: string, salz?: string) => {
  const r = lauf(stand, salz)
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
erwarte('Kennung passt nicht zum Inhalt (Mitte der Liste)', veraltet, 1, `dateien["woche.json"] = 00000000, aus dem Inhalt von ${daten} folgt ${echt['woche.json']}`)

const zusatz = gut()
zusatz.dateien = { ...echt, 'zusatz.json': 'eeeeeeee' }
erwarte('Kennung ohne Datei im Bestand', zusatz, 1, 'dateien["zusatz.json"] = eeeeeeee, aus dem Inhalt von')

erwarte('Salz geändert: alle Kennungen veraltet', gut(), 1, 'aus dem Inhalt von', (() => {
  const andere = join(wurzel, 'andere-kennungen.json')
  writeFileSync(andere, '{"titel":[[1,2,3]]}')
  return andere
})())

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

const unvollstaendig = gut()
unvollstaendig.html = unvollstaendig.html.replace(/,"events":"[^"]*"/, '')
erwarte('Vorladen ohne events.json', unvollstaendig, 1, 'Vorladen: events.json fehlt')

const ohneVersion = gut()
ohneVersion.buendel = JSON.stringify(echt)
erwarte('Bündel ohne Code-Version für meta.json (Vorladen und loadJson wichen ab)', ohneVersion, 1, 'Bündel kennt meta.json nicht mit der Code-Version v1')

const ohneBuendel = gut()
ohneBuendel.buendel = JSON.stringify({ ...echt, 'releases.json': '99999999', 'meta.json': 'v1', 'patchnotes.json': 'v1' })
erwarte('Bündel kennt eine Kennung nicht', ohneBuendel, 1, `Bündel kennt releases.json:${echt['releases.json']} nicht`)

if (fehler.length) {
  console.error('✖ Daten-Adressen-Wächter:', fehler.join('\n  '))
  process.exit(1)
}
console.log('  ✓ Daten-Adressen-Wächter: besteht ein stimmiges dist/, scheitert mit Exit 1 an 14 Brüchen')
