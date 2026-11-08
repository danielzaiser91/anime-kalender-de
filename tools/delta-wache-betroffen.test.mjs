/**
 * Ein roter Wache-Befund nennt die betroffenen Titel (Anlass 06.11.2026: 14 Netflix-Synchro-Streams zu Unrecht entfernt, der Befund
 * zeigte nur "netflix: 13 Synchro-Belege weniger"). Die Funktionen einzeln, dazu `tools/delta-pruefen.mjs` als eigener Prozess
 * mit fester Uhr: rote Zeile mit Namen, Kürzung auf 20 + "… und N weitere", Gegenfall (nicht rot: keine Namen), Zeile ohne Feld.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { betroffenAusgabe, betroffeneZeilen, kuerzeZeilen } from '../pipeline/lib/bestand-betroffen.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const JETZT = '2026-11-06T08:00:00.000Z'
const NF = (id) => `https://www.netflix.com/title/${id}`
const titel = (id, name, ...streams) => ({ id, titleDe: name, streams })
const s = (platform, url, dub) => ({ platform, url, dub })

// --- betroffeneZeilen ---------------------------------------------------------------------------------------------------
const vorher = [
  titel(20, 'Naruto Shippuden', s('netflix', NF(1), true), s('primevideo', 'https://www.amazon.de/dp/B000000001', true)),
  titel(21, 'Made in Abyss', s('netflix', NF(2), true)),
  titel(22, 'Bleibt', s('netflix', NF(3), true)),
  titel(23, 'Ohne Ja', s('netflix', NF(4), false)),
  titel(24, 'Ganz weg', s('netflix', NF(5), true)),
  titel(25, 'Gekippt', s('crunchyroll', 'https://www.crunchyroll.com/series/X', true), s('adn', 'https://animationdigitalnetwork.de/video/x', true)),
]
const jetzt = [
  titel(20, 'Naruto Shippuden', s('primevideo', 'https://www.amazon.de/dp/B000000001', true)),
  titel(21, 'Made in Abyss'),
  titel(22, 'Bleibt', s('netflix', NF(3), true)),
  titel(23, 'Ohne Ja'),
  titel(25, 'Gekippt', s('crunchyroll', 'https://www.crunchyroll.com/series/X', false), s('adn', 'https://animationdigitalnetwork.de/video/x')),
]
const befund = (url) => (url === NF(1) ? 'link-check: 404 am 2026-10-26' : undefined)
assert.deepEqual(betroffeneZeilen(vorher, jetzt, befund), [
  'Naruto Shippuden (20) · netflix · Synchro-Beleg weg (link-check: 404 am 2026-10-26)',
  'Made in Abyss (21) · netflix · Synchro-Beleg weg',
  'Ganz weg (24) · Titel entfernt',
  'Gekippt (25) · crunchyroll · Synchro-Urteil jetzt Nein',
  'Gekippt (25) · adn · Synchro-Urteil jetzt offen',
])
assert.deepEqual(betroffeneZeilen(vorher, vorher), [], 'nichts verloren: keine Zeile')
assert.deepEqual(betroffeneZeilen(jetzt, vorher), [], 'Zuwachs ist kein Verlust')
// Weg ohne Ja (dub false) zählt nicht; gleiche Seite unter anderer Sprachschreibweise bleibt erhalten (sperrKern).
assert.deepEqual(betroffeneZeilen([titel(1, 'A', s('netflix', 'https://www.netflix.com/de/title/9', true))], [titel(1, 'A', s('netflix', 'https://www.netflix.com/title/9', true))]), [])

// --- kuerzeZeilen -------------------------------------------------------------------------------------------------------
const viele = Array.from({ length: 34 }, (_, i) => `Titel ${i}`)
const gekuerzt = kuerzeZeilen(viele)
assert.equal(gekuerzt.length, 21)
assert.equal(gekuerzt[19], 'Titel 19')
assert.equal(gekuerzt[20], '… und 14 weitere')
assert.equal(kuerzeZeilen(viele.slice(0, 20)).length, 20, 'genau 20: keine Kürzung')
assert.equal(kuerzeZeilen(viele.slice(0, 21))[20], '… und 1 weitere', 'genau eine mehr')

// --- betroffenAusgabe ---------------------------------------------------------------------------------------------------
assert.deepEqual(betroffenAusgabe({ betroffen: ['A (1) · netflix · Synchro-Beleg weg'] }, true), ['               • A (1) · netflix · Synchro-Beleg weg'])
assert.deepEqual(betroffenAusgabe({ betroffen: ['A'] }, false), [], 'nicht rot: nichts')
assert.deepEqual(betroffenAusgabe({}, true), [], 'Zeile ohne Feld (vor dem 06.11.2026)')
assert.deepEqual(betroffenAusgabe({ betroffen: 'kaputt' }, true), [])

// --- Wache als Prozess ----------------------------------------------------------------------------------------------------
const kz = { titel: 10, titelMitVerweis: 9, verweise: 20, mitUrteil: 15, ohneUrteil: 5, titelMitSynchro: 8, entferntProtokolliert: 0, releases: 1, termine: 1, jeAnbieter: { netflix: 14 } }
const zeile = (ueber) => JSON.stringify({ zeitpunkt: '2026-11-06T05:00:00.000Z', lauf: 'Test', ...kz, delta: { titel: 0, verweise: -14, mitUrteil: -14, ohneUrteil: 0, titelMitSynchro: 0, releases: 0, termine: 0 }, ...ueber })

function wache(zeilen) {
  const ordner = mkdtempSync(join(tmpdir(), 'wache-betroffen-'))
  try {
    mkdirSync(join(ordner, 'data'))
    writeFileSync(join(ordner, 'data', 'bestand-historie.jsonl'), zeilen.join('\n') + '\n')
    const r = spawnSync(process.execPath, [join(wurzel, 'tools/delta-pruefen.mjs'), '--tage', '1', '--jetzt', JETZT], { cwd: ordner, encoding: 'utf8', windowsHide: true, timeout: 60000 })
    assert.ok(r.status !== null, `Prozess lief nicht bis zum Ende: ${r.stderr}`)
    return r
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

const namen = Array.from({ length: 23 }, (_, i) => `Titel ${i} (${i}) · netflix · Synchro-Beleg weg (link-check: 404 am 2026-10-26)`)
const rot = wache([zeile({}), zeile({ auffaellig: ['netflix: 14 Synchro-Belege weniger'], betroffen: kuerzeZeilen(namen) })])
assert.equal(rot.status, 1, rot.stdout)
assert.match(rot.stdout, /⚠ {2}netflix: 14 Synchro-Belege weniger/)
assert.match(rot.stdout, /• Titel 0 \(0\) · netflix · Synchro-Beleg weg \(link-check: 404 am 2026-10-26\)/)
assert.match(rot.stdout, /• Titel 19 \(19\)/)
assert.doesNotMatch(rot.stdout, /Titel 20 \(20\)/, 'ab Zeile 21 gekürzt')
assert.match(rot.stdout, /• … und 3 weitere/)
assert.equal(rot.stdout.split('\n').filter((z) => z.includes('•')).length, 21)

// Gegenfall: Feld da, aber kein roter Befund (nur erklärt) -> keine Namen, Exit 0.
const still = wache([zeile({}), zeile({ erklaert: ['netflix: 1 Weg durch Linkprüfung entfernt'], betroffen: ['Naruto Shippuden (20) · netflix · Synchro-Beleg weg'] })])
assert.equal(still.status, 0, still.stdout)
assert.doesNotMatch(still.stdout, /Naruto Shippuden/)
// Alte Zeile ohne Feld: rot wie bisher, ohne Absturz.
const alt = wache([zeile({}), zeile({ auffaellig: ['netflix: 14 Synchro-Belege weniger'] })])
assert.equal(alt.status, 1)
assert.doesNotMatch(alt.stdout, /•/)

// --- Schreiber `pipeline/bestand-historie.ts` als Prozess gegen ein Wegwerf-Repo mit echtem git ------------------------------
const git = (repo, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', timeout: 30000, windowsHide: true })
function schreiber(vorherTitel, jetztTitel, historie) {
  const ordner = mkdtempSync(join(tmpdir(), 'wache-betroffen-schreiber-'))
  try {
    mkdirSync(join(ordner, 'data'))
    mkdirSync(join(ordner, 'public/data'), { recursive: true })
    for (const d of ['releases', 'events']) writeFileSync(join(ordner, `public/data/${d}.json`), '[]')
    writeFileSync(join(ordner, 'public/data/titles.json'), JSON.stringify(vorherTitel))
    git(ordner, 'init', '-q')
    git(ordner, 'add', 'public/data/titles.json')
    git(ordner, 'commit', '-q', '-m', 'stand')
    writeFileSync(join(ordner, 'public/data/titles.json'), JSON.stringify(jetztTitel))
    writeFileSync(join(ordner, 'data/link-check.json'), JSON.stringify({ [NF(1)]: { status: 200, geprueftAm: '2026-10-26' } }))
    const datei = join(ordner, 'data/bestand-historie.jsonl')
    writeFileSync(datei, historie.map((x) => JSON.stringify(x)).join('\n') + '\n')
    const r = spawnSync(process.execPath, [join(wurzel, 'pipeline/bestand-historie.ts')], { env: { ...process.env, AK_ROOT: ordner, GITHUB_RUN_ID: '' }, encoding: 'utf8', windowsHide: true, timeout: 60000 })
    assert.equal(r.status, 0, r.stderr)
    return readFileSync(datei, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x)).at(-1)
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const stand = { zeitpunkt: '2026-11-05T05:00:00.000Z', titel: 2, titelMitVerweis: 2, verweise: 2, mitUrteil: 2, ohneUrteil: 0, titelMitSynchro: 2, entferntProtokolliert: 0, releases: 0, termine: 0, jeAnbieter: { netflix: 2 } }
const zwei = [titel(20, 'Naruto Shippuden', s('netflix', NF(1), true)), titel(21, 'Made in Abyss', s('netflix', NF(2), true))]
const verlust = schreiber(zwei, [zwei[1], titel(20, 'Naruto Shippuden')], [stand])
assert.ok(verlust.auffaellig?.length, 'Kulisse ist rot')
assert.deepEqual(verlust.betroffen, ['Naruto Shippuden (20) · netflix · Synchro-Beleg weg (link-check: 200 am 2026-10-26)'])
const ruhig = schreiber(zwei, zwei, [{ ...stand }])
assert.equal(ruhig.auffaellig, undefined)
assert.equal(ruhig.betroffen, undefined, 'ohne Befund kein Feld')

console.log('delta-wache-betroffen: 4 Funktionsgruppen, 5 Prozessfälle grün')
