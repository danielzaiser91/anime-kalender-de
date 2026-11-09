// Wache „Synchro-Wartezeit“: Fälle mit dem Black-Clover-Katalog vom 07.11.2026 (Folge 171, verfuegbarAb 16:00Z); kein Netz.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { holeSynchroJson, staffelnummern, synchroWartende, synchroWartezeitZeilen } from './synchro-wartezeit.mjs'

const URL_BC = 'https://www.crunchyroll.com/de/series/GRE50KV36/black-clover'
const FOLGE_171 = '2026-11-07T16:00:00Z'
const MS = Date.parse(FOLGE_171)
const MINUTE = 60_000

const katalog = (blocks) => ({ serien: [{ katalog: 'de', seriesId: 'GRE50KV36', url: URL_BC, staffeln: blocks }] })
const block = (name, ...zeiten) => ({
  name,
  deutscheFolgen: zeiten.map((verfuegbarAb, i) => ({ nummer: 171 + i, laufend: 1 + i, guid: `G${i}`, verfuegbarAb })),
})
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
const wartende = (k, r, ms, g) => synchroWartende(k, r, ms, g).wartende

// Grenze: 89 min nein, 90 und 91 ja (Alarm „ab 90 min“).
assert.deepEqual(wartende(BC, [omu()], nach(89)), [])
assert.deepEqual(namen(wartende(BC, [omu()], nach(90))), ['195604:90'])
assert.deepEqual(namen(wartende(BC, [omu()], nach(91))), ['195604:91'])
// Minuten werden abgerundet: 89 min 30 s sind noch kein Alarm, 90 min 30 s zeigen 90.
assert.deepEqual(wartende(BC, [omu()], nach(89) + 30_000), [])
assert.deepEqual(namen(wartende(BC, [omu()], nach(90) + 30_000)), ['195604:90'])
// Folge liegt in der Zukunft (noch nicht erschienen): nie ein Alarm.
assert.deepEqual(wartende(BC, [omu()], nach(-30)), [])

// Deutscher Termin vorhanden: Hand-Eintrag, abgeleiteter Termin und `-synchro`-Begleiter (ohne `sprache`) beenden die Wartezeit.
for (const slug of ['black-clover-s2-synchro', 'black-clover-s2-crunchyroll-hand']) {
  const deutsch = { ...omu(), slug, sprache: undefined }
  assert.deepEqual(wartende(BC, [omu(), deutsch], nach(600)), [], slug)
}
// Ein deutscher Termin eines anderen Titels, eine andere Plattform oder `offen` zählt nicht als Gegenstück.
for (const fremd of [{ titleId: 1 }, { platform: 'netflix' }, { sprache: 'offen' }]) {
  const andere = { ...omu(), slug: 'x', sprache: undefined, ...fremd }
  assert.equal(wartende(BC, [omu(), andere], nach(600)).length, 1, JSON.stringify(fremd))
}

// Staffel: deutsche Folgen nur einer anderen Staffel lösen keinen Alarm aus, sondern zählen als „Staffel unklar“ (Zeile unten).
const nurPart4 = synchroWartende(katalog([block('Season 1 Part 4', FOLGE_171)]), [omu()], nach(600))
assert.deepEqual(nurPart4, { wartende: [], unklar: ['Black Clover – Staffel 2'] })
assert.deepEqual(wartende(katalog([block('Staffel 3', FOLGE_171)]), [omu()], nach(600)), [])
// Eigene Serie: Name ohne jede Zählung gehört zu „Staffel 1“, solange kein anderer Titel die Serie teilt.
const rayearth = omu({ name: 'Rayearth', titleId: 7 })
assert.equal(wartende(katalog([block('Staffel 1', FOLGE_171)]), [rayearth], nach(600)).length, 1)
assert.deepEqual(wartende(katalog([block('Staffel 2', FOLGE_171)]), [rayearth], nach(600)), [])
assert.deepEqual(wartende(katalog([block('Season 1 Part 4', FOLGE_171)]), [rayearth], nach(600)), [])
// Andere Serie im Katalog oder englischer Katalog zählt nicht.
const anders = { serien: [{ katalog: 'de', seriesId: 'ANDERE', staffeln: [block('Staffel 2', FOLGE_171)] }, { katalog: 'en', seriesId: 'GRE50KV36', staffeln: [block('Staffel 2', FOLGE_171)] }] }
assert.deepEqual(synchroWartende(anders, [omu()], nach(600)), { wartende: [], unklar: [] })

// Wörtliche Namen von Crunchyroll-Terminen (public/data/releases.json, 08.11.2026), deren Zählung der Bau aus der Reihe bestimmt:
// gegen einen Block „Season 1“ mit Folgen nach dem OmU-Start darf die Wache nie alarmieren (der Begleiter legte dort nichts an).
const GETEILT = { ...omu(), titleId: 99, name: 'My Hero Academia', sprache: undefined }
for (const name of [
  'Classroom of the Elite Staffel 4: Second Year, First Semester',
  'The Iceblade Sorcerer Shall Rule the World II',
  'My Hero Academia I am a hero too',
  'The Quintessential Quintuplets Specials',
  "Kaiju No. 8 Narumi's Week at Work",
]) {
  const r = synchroWartende(katalog([block('Season 1', FOLGE_171)]), [omu({ name }), GETEILT], nach(600))
  assert.deepEqual(r, { wartende: [], unklar: [name] }, name)
}
// Dieselben Namen allein an der Serie (kein Geschwister-Titel): die Zählung im Namen allein macht die Staffel unklar.
for (const name of ['Classroom of the Elite Staffel 4: Second Year, First Semester', 'The Iceblade Sorcerer Shall Rule the World II', 'The Quintessential Quintuplets Specials', "Kaiju No. 8 Narumi's Week at Work"]) {
  const r = synchroWartende(katalog([block('Season 1', FOLGE_171)]), [omu({ name })], nach(600))
  assert.deepEqual(r, { wartende: [], unklar: [name] }, `allein: ${name}`)
}
// Wortgrenze: „Vivid“ und „Partizan“ enthalten iv/vi/part, sind aber keine Zählung — der Name gehört zu Staffel 1 und alarmiert.
assert.equal(wartende(katalog([block('Staffel 1', FOLGE_171)]), [omu({ name: 'Vivid Partizan' })], nach(600)).length, 1)
// …und am Wortende („Counterpart“ endet auf part): auch dort keine Zählung.
assert.equal(wartende(katalog([block('Staffel 1', FOLGE_171)]), [omu({ name: 'Counterpart Story' })], nach(600)).length, 1)
// Mehrdeutig: zwei Blöcke derselben Staffelnummer (Staffel 2 und Season 2) lassen keine Wahl — unklar, kein Alarm.
assert.deepEqual(synchroWartende(katalog([block('Staffel 2', FOLGE_171), block('Season 2', FOLGE_171)]), [omu()], nach(600)), { wartende: [], unklar: ['Black Clover – Staffel 2'] })
// Ein undatierter Block gleicher Nummer zählt nicht mit: der datierte bleibt der eine.
const undatiert = { name: 'Season 2', deutscheFolgen: [{ guid: 'u' }] }
assert.equal(wartende(katalog([block('Staffel 2', FOLGE_171), undatiert]), [omu()], nach(600)).length, 1)
// Folgen nur vor dem OmU-Start in irgendeinem Block: nichts zu melden, auch nicht „unklar“.
assert.deepEqual(synchroWartende(katalog([block('Season 1 Part 4', '2026-02-01T16:00:00Z')]), [omu()], nach(600)), { wartende: [], unklar: [] })
// Block ohne Zahl im Namen („Platinum End“): unklar, nicht „kein Alarm“.
assert.deepEqual(synchroWartende(katalog([block('Platinum End', FOLGE_171)]), [omu({ name: 'Platinum End' })], nach(600)), { wartende: [], unklar: ['Platinum End'] })
// Staffelnummern: ausdrücklich, Name ohne Zählung allein an der Serie, geteilte Serie, Zahl im Namen.
assert.deepEqual(staffelnummern(omu(), []), [2])
assert.deepEqual(staffelnummern(omu({ name: 'Rayearth' }), []), [1])
assert.equal(staffelnummern(omu({ name: 'Rayearth' }), [{ titleId: 5, platformUrl: URL_BC }]), null)
assert.deepEqual(staffelnummern(omu({ name: 'Rayearth' }), [{ titleId: 5, platformUrl: 'https://www.crunchyroll.com/de/series/ANDERE/x' }]), [1])
assert.equal(staffelnummern(omu({ name: 'Kaiju No. 8' }), []), null)

// Start-Rand = Berliner Tag wie beim Begleiter (Winter: Mitternacht Berlin = 23:00Z, Sommer: 22:00Z).
const winter = omu({ schedule: { firstEpisodeDate: '2026-01-15' } })
const sommer = omu({ schedule: { firstEpisodeDate: '2026-07-15' } })
const bei = (zeit) => synchroWartende(katalog([block('Staffel 2', zeit)]), [winter], Date.parse('2026-02-01T00:00:00Z'))
assert.equal(bei('2026-01-14T22:30:00Z').wartende.length, 0, 'Winter 23:30 Berlin am Vortag zählt nicht')
assert.equal(bei('2026-01-14T22:30:00Z').unklar.length, 0)
assert.equal(bei('2026-01-14T23:00:00Z').wartende.length, 1, 'Winter 00:00 Berlin am Starttag zählt')
const imSommer = (zeit) => synchroWartende(katalog([block('Staffel 2', zeit)]), [sommer], Date.parse('2026-08-01T00:00:00Z')).wartende.length
assert.equal(imSommer('2026-07-14T21:59:59Z'), 0)
assert.equal(imSommer('2026-07-14T22:00:00Z'), 1)
// Folgen vor dem OmU-Start zählen nicht; die früheste Folge ab dem Start bestimmt die Wartezeit.
assert.deepEqual(wartende(katalog([block('Staffel 2', '2026-10-02T10:00:00Z')]), [omu()], nach(600)), [])
const zwei = katalog([block('Staffel 2', '2026-11-14T16:00:00Z', FOLGE_171)])
assert.deepEqual(namen(wartende(zwei, [omu()], nach(100))), ['195604:100'])
// Release ohne Serienkennung im Link trifft keine Katalogserie ohne Kennung.
const ohneKennung = { serien: [{ katalog: 'de', staffeln: [block('Staffel 2', FOLGE_171)] }] }
assert.deepEqual(synchroWartende(ohneKennung, [omu({ platformUrl: 'https://www.crunchyroll.com/de/news' })], nach(600)), { wartende: [], unklar: [] })
// Folge ohne Datum zählt nicht; Release mit `sprache: 'offen'` oder ohne Kennzeichnung wird nicht beobachtet.
assert.deepEqual(wartende(katalog([{ name: 'Staffel 2', deutscheFolgen: [{ guid: 'x' }] }]), [omu()], nach(600)), [])
assert.deepEqual(wartende(BC, [omu({ sprache: 'offen' })], nach(600)), [])
assert.deepEqual(wartende(BC, [omu({ sprache: undefined })], nach(600)), [])
assert.deepEqual(wartende(BC, [omu({ platform: 'netflix' })], nach(600)), [])

// Zeilen.
const holer = (k, r) => async (name) => {
  if (name === 'katalog') return k
  if (name === 'releases') return r
  throw new Error('?')
}
const ALARM_BC = 'ALARM Synchro-Wartezeit: Black Clover – Staffel 2 (Titel 195604) — deutsche Folge seit 120 min im Katalog, kein deutscher Termin im Datensatz (Grenze 90 min). '
const zeilen120 = await synchroWartezeitZeilen(holer(BC, [omu()]), nach(120))
assert.equal(zeilen120.length, 1)
assert.ok(zeilen120[0].startsWith(ALARM_BC), zeilen120[0])
// A5: ohne Synchro-Beleg am Weg legt der Begleiter nichts an — die Zeile sagt, wer das auflöst.
assert.match(zeilen120[0], /Synchro-Beleg am Weg.*Handbeleg oder Hand-Eintrag$/)
assert.deepEqual(await synchroWartezeitZeilen(holer(BC, [omu()]), nach(89)), ['Synchro-Wartezeit: kein Alarm (Grenze 90 min)'])
assert.deepEqual(await synchroWartezeitZeilen(holer(katalog([block('Season 1 Part 4', FOLGE_171)]), [omu()]), nach(600)), [
  'Synchro-Wartezeit: 1 OmU-Termin(e) nicht prüfbar (Staffel unklar): Black Clover – Staffel 2',
])
const mitBeidem = await synchroWartezeitZeilen(holer(BC, [omu(), omu({ titleId: 8, name: 'Platinum End', slug: 'p', platformUrl: 'https://www.crunchyroll.com/de/series/PLAT/x' })]), nach(600))
assert.equal(mitBeidem.length, 1, 'Platinum End hat im Katalog keine Folgen — nur der Alarm bleibt')
const fehl = async () => {
  throw new Error('HTTP 500\nZweite Zeile')
}
assert.deepEqual(await synchroWartezeitZeilen(fehl, nach(120)), ['SYNCHRO? Wartezeit nicht lesbar: HTTP 500'])

// Abruf: Fehlstatus wirft; der Ordner (Test) ersetzt das Netz.
await assert.rejects(holeSynchroJson('katalog', async () => ({ ok: false, status: 503 }), ''), /katalog: HTTP 503/)
assert.deepEqual(await holeSynchroJson('releases', async () => ({ ok: true, json: async () => [1] }), ''), [1])
// A1: die Frist hängt am Abruf. Die Attrappe antwortet nie, sondern reagiert nur auf das Abbruchsignal.
const haengt = (_url, optionen) =>
  new Promise((_ok, fehler) => optionen.signal.addEventListener('abort', () => fehler(optionen.signal.reason)))
const wachhalter = setInterval(() => {}, 50) // AbortSignal.timeout hält die Ereignisschleife nicht offen; ein echter Abruf tut es über den Socket
// Greift die übergebene Frist nicht, bleibt der Abruf bis zur Standardfrist (30 s) hängen: nach 2 s gilt das als verfehlt.
const binnen2s = (p) => Promise.race([p, new Promise((_ok, fehler) => setTimeout(() => fehler(new Error('Frist greift nicht')), 2000))])
await assert.rejects(binnen2s(holeSynchroJson('katalog', haengt, '', 20)), { name: 'TimeoutError' })
const beiFrist = await binnen2s(synchroWartezeitZeilen((name) => holeSynchroJson(name, haengt, '', 20), nach(120)))
clearInterval(wachhalter)
assert.match(beiFrist[0], /^SYNCHRO\? Wartezeit nicht lesbar: .*timeout/)
// Die Standardfrist ist 30 s (Abruf der Wache darf nie länger hängen als ein Bruchteil des 3-Minuten-Jobs).
const fristen = []
const echt = AbortSignal.timeout
AbortSignal.timeout = (ms) => {
  fristen.push(ms)
  return echt.call(AbortSignal, ms)
}
try {
  await holeSynchroJson('releases', async () => ({ ok: true, json: async () => [] }), '')
} finally {
  AbortSignal.timeout = echt
}
assert.deepEqual(fristen, [30_000])

// Verdrahtung: der echte Aufrufer (laeufe-aufraeumen) druckt die Zeile und nimmt „WACHE ruhig“ zurück.
const wegwerf = mkdtempSync(join(tmpdir(), 'synchro-wartezeit-'))
try {
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const stub = (laeufe, fetchTeil) =>
    `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=()=>${JSON.stringify(JSON.stringify(laeufe))};syncBuiltinESMExports();${fetchTeil}`
  const SOFORT_500 = 'globalThis.fetch=async()=>new Response("{}",{status:500})'
  const gesundheit = join(wegwerf, 'g.json')
  writeFileSync(gesundheit, '{}')
  const fahre = (releases, laeufe = [], fetchTeil = SOFORT_500) => {
    const dir = join(wegwerf, 'quelle')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'katalog.json'), JSON.stringify(BC))
    writeFileSync(join(dir, 'releases.json'), JSON.stringify(releases))
    const env = { ...process.env, LAUF_TOKEN: '', AK_SYNCHRO_QUELLE: dir }
    return spawnSync(process.execPath, ['--import', stub(laeufe, fetchTeil), aufraeumen, '--trocken', '--gesundheit', gesundheit], { encoding: 'utf8', timeout: 120_000, env })
  }
  const alarm = fahre([omu()])
  assert.equal(alarm.status, 0, alarm.stderr)
  assert.match(alarm.stdout, /^ALARM Synchro-Wartezeit: Black Clover – Staffel 2 \(Titel 195604\)/m)
  assert.doesNotMatch(alarm.stdout, /WACHE ruhig/)
  const ruhig = fahre([omu(), { ...omu(), slug: 'black-clover-s2-synchro', sprache: undefined }])
  assert.match(ruhig.stdout, /^Synchro-Wartezeit: kein Alarm/m)
  assert.doesNotMatch(ruhig.stdout, /ALARM Synchro/)

  // A1 Reihenfolge: Die Synchro-Zeile steht weiter nach den ALARMen des Bestandsbaus (Server antwortet 500).
  const rot = [
    { status: 'completed', conclusion: 'success', createdAt: '2026-10-18T01:00:00Z', databaseId: 1 },
    { status: 'completed', conclusion: 'failure', createdAt: '2026-10-18T02:00:00Z', databaseId: 2 },
  ]
  const ohneQuelle = (laeufe, fetchTeil) =>
    spawnSync(process.execPath, ['--import', stub(laeufe, fetchTeil), aufraeumen, '--trocken', '--gesundheit', gesundheit], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, LAUF_TOKEN: '', AK_SYNCHRO_QUELLE: '' },
    })
  const nachAlarm = ohneQuelle(rot, SOFORT_500)
  assert.equal(nachAlarm.status, 0, nachAlarm.stderr)
  const bestand = nachAlarm.stdout.indexOf('ALARM Bestandsbau')
  const synchro = nachAlarm.stdout.indexOf('SYNCHRO? Wartezeit nicht lesbar')
  assert.ok(bestand >= 0 && synchro > bestand, `Bestandsbau-ALARM (${bestand}) vor der Synchro-Zeile (${synchro})`)
  assert.match(nachAlarm.stdout, /^WACHE nicht geprüft: Synchro-Wartezeit \(/m)

  // A2 blockierte Ereignisschleife (09.11.2026, „nicht lesbar: timeout“ bei 0,4 s Abruf): die Antwort kommt erst über setImmediate,
  // die synchronen gh-Aufrufe (execFileSync-Attrappe) stehen 400 ms still, die Frist ist auf 100 ms gekürzt. Wer den Abruf
  // nicht vor dem ersten synchronen Aufruf abschließt, sieht die Frist vor der Antwort ablaufen.
  const blockiert = (frist) =>
    `const e=AbortSignal.timeout;AbortSignal.timeout=()=>e.call(AbortSignal,${frist});` +
    `globalThis.fetch=async(u,o)=>{await new Promise((r)=>setImmediate(r));if(o&&o.signal&&o.signal.aborted)throw o.signal.reason;` +
    `const m=/crunchyroll-dub/.test(String(u))?"katalog":/releases[.]json/.test(String(u))?"releases":"";` +
    `if(!m)return new Response("{}",{status:500});const fs=await import("node:fs");return new Response(fs.readFileSync(${JSON.stringify(join(wegwerf, 'quelle'))}+"/"+m+".json","utf8"))};` +
    `const alt=cp.execFileSync;cp.execFileSync=(...a)=>{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,400);return alt(...a)};syncBuiltinESMExports();`
  fahre([omu()]) // legt katalog.json und releases.json an
  const geladen = ohneQuelle([], blockiert(100))
  assert.equal(geladen.status, 0, geladen.stderr)
  assert.match(geladen.stdout, /^ALARM Synchro-Wartezeit: Black Clover – Staffel 2/m)
  assert.doesNotMatch(geladen.stdout, /SYNCHRO[?] Wartezeit nicht lesbar/)
  console.log('A2: Abruf bei blockierter Ereignisschleife gelesen — ALARM Synchro-Wartezeit vorhanden')
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('synchro-wartezeit: ok (Grenze 89/90/91, Gegenstück, Staffel, 5 Namen des Prüfers, Winterrand, Zeilen, Frist 30 s + Abbruch, Reihenfolge nach den ALARMen, blockierte Schleife, laeufe-aufraeumen als Prozess)')
