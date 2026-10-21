// Prüft die Wache-Entscheidung: nur eine ungelistete Adresse mit alter Meldung ist ein Befund.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { liegengeblieben, uebernahmeStau } from './briefkasten-wache-logik.mjs'

const JETZT = Date.parse('2026-10-11T12:00:00Z')
const meldung = (url, gemeldet_am) => ({ url, gemeldet_am })
const meldungen = [
  meldung('https://x/jung', '2026-10-11T08:00:00Z'),
  meldung('https://x/alt', '2026-10-10T08:00:00Z'),
  meldung('https://x/gemischt', '2026-10-11T09:00:00Z'),
  meldung('https://x/gemischt', '2026-10-01T09:00:00Z'),
]
const befund = (fehlend, liste = meldungen) => liegengeblieben(fehlend, liste, JETZT, 24)

assert.deepEqual(befund(['https://x/jung']), [], 'junge Meldung ist ein Nachzügler')
assert.deepEqual(befund(['https://x/alt']), ['https://x/alt'], 'Meldung über 24 h ist liegengeblieben')
assert.deepEqual(befund(['https://x/gemischt']), ['https://x/gemischt'], 'die älteste Meldung der Adresse entscheidet')
assert.deepEqual(befund(['https://x/fehlt']), [], 'Adresse ohne bekanntes Alter ist kein Befund')
assert.deepEqual(befund(['https://x/alt'], []), [], 'leere Antwort ist kein Befund')
assert.deepEqual(befund([]), [], 'nichts ungelistet')

// Übernahme-Stau: alter Stempel und zuzuordnende Meldungen über 24 h; gelistete, junge und Meldungen genau an der Grenze zählen nicht.
const GRENZE = new Date(JETZT - 24 * 36e5).toISOString()
const stauListe = [
  meldung('https://x/gelistet', '2026-10-01T09:00:00Z'),
  meldung('https://x/alt', '2026-10-10T08:00:00Z'),
  meldung('https://x/jung', '2026-10-11T08:00:00Z'),
  meldung('https://x/rand', GRENZE),
  meldung('https://x/gemischt', '2026-10-01T09:00:00Z'),
]
const fehlend = ['https://x/alt', 'https://x/jung', 'https://x/rand', 'https://x/gemischt']
const stau = (zuletzt, liste = stauListe) => uebernahmeStau(zuletzt, fehlend, liste, JETZT, 24)
assert.deepEqual(stau('2026-10-08T11:30:00Z'), { stunden: 72, wartend: 2 }, 'Stau: 72,5 Stunden, zwei Wartende')
assert.equal(stau(GRENZE), null, 'Stempel genau an der Grenze ist frisch')
assert.equal(stau('2026-10-11T00:00:00Z'), null, 'frischer Stempel')
assert.equal(stau(null), null, 'ohne Stempel kein Befund')
assert.equal(stau('2026-10-08T11:30:00Z', stauListe.slice(0, 1)), null, 'nur Gelistetes wartet: Leerlauf, kein Stau')
assert.equal(stau('2026-10-08T11:30:00Z', stauListe.slice(2, 4)), null, 'nur Junges und Grenzfall: Nachzügler')

// Die ganze Wache mit untergeschobenem Briefkasten: Ergebniszeile immer, Stau-Zeile nur beim Stau, Exit-Code als Prozess.
const WACHE = fileURLToPath(new URL('./briefkasten-wache.mjs', import.meta.url))
const ADRESSE = 'https://www.amazon.de/gp/video/detail/B0TEST0001'
function attrappe(protokoll, alter) {
  const zaehlen = { imBriefkasten: { primevideo: 3 }, adressen: ['https://x/gelistet', ADRESSE, ADRESSE] }
  const neu = new Date(Date.now() - alter * 36e5).toISOString()
  const liste = { pruefungen: [meldung('https://x/gelistet', '2026-10-01T00:00:00Z'), meldung(ADRESSE, neu), meldung(ADRESSE, new Date().toISOString())] }
  const basis = 'https://newsletter.animekalender.workers.dev/pruefung?'
  return [
    'import {appendFileSync} from "node:fs";',
    `globalThis.fetch=async(u)=>{u=String(u);appendFileSync(${JSON.stringify(protokoll)},u+String.fromCharCode(10));`,
    `if(u===${JSON.stringify(basis + 'zaehlen=1&token=geheim')})return new Response(${JSON.stringify(JSON.stringify(zaehlen))});`,
    `if(u===${JSON.stringify(basis + 'token=geheim')})return new Response(${JSON.stringify(JSON.stringify(liste))});`,
    'return new Response("",{status:404})}',
  ].join('')
}
function wache({ zuletzt, gelistet = '', alter = 48, zurueck }) {
  const ort = mkdtempSync(join(tmpdir(), 'briefkasten-wache-'))
  const protokoll = join(ort, 'abrufe.txt')
  mkdirSync(join(ort, 'daniel-zum-abarbeiten/listen'), { recursive: true })
  mkdirSync(join(ort, 'data'))
  writeFileSync(join(ort, 'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md'), `| [a](https://x/gelistet) |\n${gelistet}`)
  if (zuletzt !== undefined) writeFileSync(join(ort, 'data/meldungen-uebernahme.json'), JSON.stringify({ zuletzt, meldungen: 1 }))
  if (zurueck) writeFileSync(join(ort, 'data/meldungen-zurueckgestellt.json'), JSON.stringify(zurueck))
  const vorlauf = `data:text/javascript,${encodeURIComponent(attrappe(protokoll, alter))}`
  const lauf = spawnSync(process.execPath, ['--import', vorlauf, WACHE], {
    cwd: ort,
    encoding: 'utf8',
    env: { ...process.env, LAUF_TOKEN: 'geheim' },
    windowsHide: true,
  })
  const abrufe = readFileSync(protokoll, 'utf8').trim().split('\n')
  rmSync(ort, { recursive: true, force: true })
  return { ...lauf, abrufe }
}
const vorStunden = (h) => new Date(Date.now() - h * 36e5).toISOString()
const STAU_ZEILE = /^⚠ {2}Übernahme-Stau: seit 7[23] Stunden keine Meldung übernommen, 1 zuzuordnende warten länger als 24 Stunden\.$/m

const staut = wache({ zuletzt: vorStunden(72.2) })
assert.equal(staut.status, 1, staut.stderr)
assert.equal(staut.abrufe.length, 2, 'beide Abfragen laufen')
assert.match(staut.stdout, STAU_ZEILE)
assert.match(staut.stdout, /^⚠ {2}1 von 2 Adressen sind weder zugeordnet noch gelistet:$/m)

const frisch = wache({ zuletzt: vorStunden(2) })
assert.equal(frisch.status, 1, 'die alte Adresse bleibt ein Befund')
assert.match(frisch.stdout, /^Übernahme: zuletzt \d{4}-\d\d-\d\dT[\d:.]+Z \(data\/meldungen-uebernahme\.json\)$/m)
assert.doesNotMatch(frisch.stdout, /Übernahme-Stau/)

const leerlauf = wache({ zuletzt: vorStunden(72.2), gelistet: `| [b](${ADRESSE}) |\n` })
assert.equal(leerlauf.status, 0, leerlauf.stdout + leerlauf.stderr)
assert.match(leerlauf.stdout, /^Alle Adressen sind gelistet\.$/m)
assert.doesNotMatch(leerlauf.stdout, /Übernahme-Stau/)

const jung = wache({ zuletzt: vorStunden(72.2), alter: 2 })
assert.equal(jung.status, 0, jung.stdout + jung.stderr)
assert.doesNotMatch(jung.stdout, /Übernahme-Stau/)

const ohne = wache({})
assert.equal(ohne.status, 1)
assert.match(ohne.stdout, /^Übernahme: zuletzt unbekannt \(data\/meldungen-uebernahme\.json\)$/m)
assert.doesNotMatch(ohne.stdout, /Übernahme-Stau/)
assert.match(ohne.stdout, /^Zurückgestellt \(data\/meldungen-zurueckgestellt\.json\): 0 Adressen im Briefkasten$/m, 'ohne Datei: keine')

/* Beim Eingrenzen zurückgestellt (48 h alte Meldung): bekannt, kein Befund, auch beim alten Stempel kein Stau; dazu eine schon abgearbeitete. */
const ZURUECK = [
  { url: 'https://x/erledigt', ids: [1], grund: 'pipeline/check-x.ts', seit: '2026-10-17T01:00:00.000Z' },
  { url: ADRESSE, ids: [2, 3], grund: 'pipeline/check-x.ts', seit: '2026-10-18T01:00:00.000Z' },
]
for (const zuletzt of [vorStunden(2), vorStunden(72.2)]) {
  const zurueck = wache({ zuletzt, zurueck: ZURUECK })
  assert.equal(zurueck.status, 0, zurueck.stdout + zurueck.stderr)
  assert.match(zurueck.stdout, /^Zurückgestellt \(data\/meldungen-zurueckgestellt\.json\): 1 Adressen im Briefkasten$/m)
  assert.match(zurueck.stdout, /^ {3}zurückgestellt seit 2026-10-18T01:00:00\.000Z: https:\/\/www\.amazon\.de\/gp\/video\/detail\/B0TEST0001 — pipeline\/check-x\.ts$/m)
  assert.match(zurueck.stdout, /^Alle Adressen sind gelistet\.$/m)
  assert.doesNotMatch(zurueck.stdout, /Übernahme-Stau|erledigt/)
}
const ungeprueft = wache({ zuletzt: vorStunden(2), zurueck: [{ ...ZURUECK[1], grund: null }] })
assert.equal(ungeprueft.status, 0, ungeprueft.stdout)
assert.match(ungeprueft.stdout, /B0TEST0001 — ungeprüft \(Versuchsgrenze\)$/m)
const leer = wache({ zuletzt: vorStunden(2), zurueck: [] })
assert.equal(leer.status, 1, 'leere Datei: die alte Adresse bleibt ein Befund')
console.log('briefkasten-wache.test: 6 Fälle Liegengeblieben, 6 Fälle Stau, 9 Wache-Läufe grün.')
