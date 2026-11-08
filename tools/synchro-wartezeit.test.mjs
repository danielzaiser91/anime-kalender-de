// Wache „Synchro-Wartezeit“: Fälle mit dem Black-Clover-Katalog vom 07.11.2026 (Folge 171, verfuegbarAb 16:00Z); kein Netz.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { holeSynchroJson, synchroWartende, synchroWartezeitZeilen } from './synchro-wartezeit.mjs'

const URL_BC = 'https://www.crunchyroll.com/de/series/GRE50KV36/black-clover'
const FOLGE_171 = '2026-11-07T16:00:00Z'
const MS = Date.parse(FOLGE_171)
const MINUTE = 60_000

const katalog = (blocks) => ({ serien: [{ katalog: 'de', seriesId: 'GRE50KV36', url: URL_BC, staffeln: blocks }] })
const block = (name, ...zeiten) => ({ name, deutscheFolgen: zeiten.map((verfuegbarAb, i) => ({ nummer: 171 + i, laufend: 1 + i, guid: `G${i}`, verfuegbarAb })) })
const omu = (extra = {}) => ({
  slug: 'black-clover-s2-crunchyroll',
  titleId: 195604,
  name: 'Black Clover – Staffel 2',
  platform: 'crunchyroll',
  platformUrl: URL_BC,
  sprache: 'omu',
  schedule: { firstEpisodeDate: '2026-10-03' },
  ...extra,
})
const BC = katalog([block('Season 1 Part 4', '2026-02-01T16:00:00Z'), block('Staffel 2', FOLGE_171)])
const nach = (minuten) => MS + minuten * MINUTE
const namen = (w) => w.map((x) => `${x.titleId}:${x.minuten}`)

// Grenze: 89 min nein, 90 und 91 ja (Alarm „ab 90 min“).
assert.deepEqual(synchroWartende(BC, [omu()], nach(89)), [])
assert.deepEqual(namen(synchroWartende(BC, [omu()], nach(90))), ['195604:90'])
assert.deepEqual(namen(synchroWartende(BC, [omu()], nach(91))), ['195604:91'])
// Minuten werden abgerundet: 89 min 30 s sind noch kein Alarm, 90 min 30 s zeigen 90.
assert.deepEqual(synchroWartende(BC, [omu()], nach(89) + 30_000), [])
assert.deepEqual(namen(synchroWartende(BC, [omu()], nach(90) + 30_000)), ['195604:90'])
// Folge liegt in der Zukunft (noch nicht erschienen): nie ein Alarm.
assert.deepEqual(synchroWartende(BC, [omu()], nach(-30)), [])

// Deutscher Termin vorhanden: Hand-Eintrag, abgeleiteter Termin und `-synchro`-Begleiter (ohne `sprache`) beenden die Wartezeit.
for (const slug of ['black-clover-s2-synchro', 'black-clover-s2-crunchyroll-hand']) {
  const deutsch = { ...omu(), slug, sprache: undefined }
  assert.deepEqual(synchroWartende(BC, [omu(), deutsch], nach(600)), [], slug)
}
// Ein deutscher Termin eines anderen Titels, eine andere Plattform oder `offen` zählt nicht als Gegenstück.
for (const fremd of [{ titleId: 1 }, { platform: 'netflix' }, { sprache: 'offen' }]) {
  const andere = { ...omu(), slug: 'x', sprache: undefined, ...fremd }
  assert.equal(synchroWartende(BC, [omu(), andere], nach(600)).length, 1, JSON.stringify(fremd))
}

// Staffel: deutsche Folgen nur einer anderen Staffel (Season 1 Part 4 hat keine Zahl am Ende; Staffel 3 gehört nicht zu S2) lösen nichts aus.
assert.deepEqual(synchroWartende(katalog([block('Season 1 Part 4', FOLGE_171)]), [omu()], nach(600)), [])
assert.deepEqual(synchroWartende(katalog([block('Staffel 3', FOLGE_171)]), [omu()], nach(600)), [])
// Eigene Serie: Name ohne Zahl gehört zu „Staffel 1“.
const rayearth = omu({ name: 'Rayearth', titleId: 7 })
assert.equal(synchroWartende(katalog([block('Staffel 1', FOLGE_171)]), [rayearth], nach(600)).length, 1)
assert.deepEqual(synchroWartende(katalog([block('Staffel 2', FOLGE_171)]), [rayearth], nach(600)), [])
// Andere Serie im Katalog oder englischer Katalog zählt nicht.
const anders = { serien: [{ katalog: 'de', seriesId: 'ANDERE', staffeln: [block('Staffel 2', FOLGE_171)] }, { katalog: 'en', seriesId: 'GRE50KV36', staffeln: [block('Staffel 2', FOLGE_171)] }] }
assert.deepEqual(synchroWartende(anders, [omu()], nach(600)), [])

// Folgen vor dem OmU-Start (Berlin-Tag 03.10.) zählen nicht; die früheste Folge ab dem Start bestimmt die Wartezeit.
assert.deepEqual(synchroWartende(katalog([block('Staffel 2', '2026-10-02T10:00:00Z')]), [omu()], nach(600)), [])
const zwei = katalog([block('Staffel 2', '2026-11-14T16:00:00Z', FOLGE_171)])
assert.deepEqual(namen(synchroWartende(zwei, [omu()], nach(100))), ['195604:100'])
// Rand des Starts (2 h vor 00:00 UTC des OmU-Tages deckt den Berliner Tag ab): genau am Rand ja, eine Sekunde davor nein.
assert.equal(synchroWartende(katalog([block('Staffel 2', '2026-10-02T22:00:00Z')]), [omu()], nach(600)).length, 1)
assert.equal(synchroWartende(katalog([block('Staffel 2', '2026-10-02T21:59:59Z')]), [omu()], nach(600)).length, 0)
// Zählung ohne Zahl am Namen (Season 1 Part 4) gehört nie zu einer Staffel, auch nicht zu Staffel 1.
assert.deepEqual(synchroWartende(katalog([block('Season 1 Part 4', FOLGE_171)]), [rayearth], nach(600)), [])
// Release ohne Serienkennung im Link trifft keine Katalogserie ohne Kennung.
const ohneKennung = { serien: [{ katalog: 'de', staffeln: [block('Staffel 2', FOLGE_171)] }] }
assert.deepEqual(synchroWartende(ohneKennung, [omu({ platformUrl: 'https://www.crunchyroll.com/de/news' })], nach(600)), [])
// Folge ohne Datum zählt nicht; Release mit `sprache: 'offen'` oder ohne Kennzeichnung wird nicht beobachtet.
assert.deepEqual(synchroWartende(katalog([{ name: 'Staffel 2', deutscheFolgen: [{ guid: 'x' }] }]), [omu()], nach(600)), [])
assert.deepEqual(synchroWartende(BC, [omu({ sprache: 'offen' })], nach(600)), [])
assert.deepEqual(synchroWartende(BC, [omu({ sprache: undefined })], nach(600)), [])
assert.deepEqual(synchroWartende(BC, [omu({ platform: 'netflix' })], nach(600)), [])

// Zeilen.
const holer = (k, r) => async (name) => {
  if (name === 'katalog') return k
  if (name === 'releases') return r
  throw new Error('?')
}
assert.deepEqual(await synchroWartezeitZeilen(holer(BC, [omu()]), nach(120)), [
  'ALARM Synchro-Wartezeit: Black Clover – Staffel 2 (Titel 195604) — deutsche Folge seit 120 min im Katalog, kein deutscher Termin im Datensatz (Grenze 90 min)',
])
assert.deepEqual(await synchroWartezeitZeilen(holer(BC, [omu()]), nach(89)), ['Synchro-Wartezeit: kein Alarm (Grenze 90 min)'])
const fehl = async () => {
  throw new Error('HTTP 500\nZweite Zeile')
}
assert.deepEqual(await synchroWartezeitZeilen(fehl, nach(120)), ['SYNCHRO? Wartezeit nicht lesbar: HTTP 500'])

// Abruf: Fehlstatus wirft; der Ordner (Test) ersetzt das Netz.
await assert.rejects(holeSynchroJson('katalog', async () => ({ ok: false, status: 503 }), ''), /katalog: HTTP 503/)
assert.deepEqual(await holeSynchroJson('releases', async () => ({ ok: true, json: async () => [1] }), ''), [1])

// Verdrahtung: der echte Aufrufer (laeufe-aufraeumen) druckt die Zeile und nimmt „WACHE ruhig“ zurück. Datum der Folge 2026 liegt weit vor „jetzt“.
const wegwerf = mkdtempSync(join(tmpdir(), 'synchro-wartezeit-'))
try {
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const stub = 'data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=()=>"[]";syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})'
  const gesundheit = join(wegwerf, 'g.json')
  writeFileSync(gesundheit, '{}')
  const fahre = (releases) => {
    writeFileSync(join(wegwerf, 'katalog.json'), JSON.stringify(BC))
    writeFileSync(join(wegwerf, 'releases.json'), JSON.stringify(releases))
    return spawnSync(process.execPath, ['--import', stub, aufraeumen, '--trocken', '--gesundheit', gesundheit], { encoding: 'utf8', timeout: 120_000, env: { ...process.env, LAUF_TOKEN: '', AK_SYNCHRO_QUELLE: wegwerf } })
  }
  const alarm = fahre([omu()])
  assert.equal(alarm.status, 0, alarm.stderr)
  assert.match(alarm.stdout, /^ALARM Synchro-Wartezeit: Black Clover – Staffel 2 \(Titel 195604\)/m)
  assert.doesNotMatch(alarm.stdout, /WACHE ruhig/)
  const ruhig = fahre([omu(), { ...omu(), slug: 'black-clover-s2-synchro', sprache: undefined }])
  assert.match(ruhig.stdout, /^Synchro-Wartezeit: kein Alarm/m)
  assert.doesNotMatch(ruhig.stdout, /ALARM Synchro/)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('synchro-wartezeit: ok (Grenze 89/90/91, Gegenstück, Staffel, Katalog, Zeilen, Abruf, laeufe-aufraeumen als Prozess)')
