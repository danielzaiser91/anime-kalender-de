// Test für software-updates.mjs: Aufruf: node .claude/hooks/software-updates-test.mjs
// Ohne Netz und ohne Prozessaufruf: fetch und q.lokal() sind ersetzt, der Zustand liegt in einem Wegwerf-Home.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'software-updates-'))
process.env.HOME = home
process.env.USERPROFILE = home
const stateDir = join(home, '.claude', 'hooks', 'state')
const stateDatei = join(stateDir, 'software-updates.json')
const ZUKUNFT = 32503680000000

let fetchAufrufe = 0
globalThis.fetch = async (url) => {
  fetchAufrufe++
  return { ok: true, json: async () => ({ tag_name: String(url).includes('cli/cli') ? 'v9.9.9' : 'v2.56.1' }) }
}

const { meldung, QUELLEN } = await import('./software-updates.mjs')
let lokalAufrufe = 0
let lokaleVersion = '2.56.0'
for (const q of QUELLEN) q.lokal = () => { lokalAufrufe++; return q.name === 'Git' ? lokaleVersion : '9.9.9' }

const setze = (st) => {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(stateDatei, JSON.stringify(st))
  fetchAufrufe = 0
  lokalAufrufe = 0
}

try {
  setze({ zeit: ZUKUNFT, faellig: ['Git 2.56.0 → 2.56.1'], lokal: { Git: '2.56.0', gh: '9.9.9' } })
  assert.match(await meldung(), /Git 2\.56\.0 → 2\.56\.1/, 'fällig, lokal gleich: Meldung bleibt')
  assert.equal(fetchAufrufe, 0, 'fällig, lokal gleich: kein Neuprüfen')

  lokaleVersion = '2.56.1'
  const neu = await meldung()
  assert.equal(neu, '', 'fällig, lokal neu: Meldung weg')
  assert.equal(fetchAufrufe, QUELLEN.length, 'fällig, lokal neu: neu geprüft')
  assert.equal(JSON.parse(readFileSync(stateDatei, 'utf8')).lokal.Git, '2.56.1', 'neue lokale Version gespeichert')

  setze({ zeit: ZUKUNFT, faellig: [], lokal: { Git: '2.56.0' } })
  assert.equal(await meldung(), '')
  assert.equal(lokalAufrufe, 0, 'leeres faellig: kein lokal()-Aufruf')
  assert.equal(fetchAufrufe, 0)

  setze({ zeit: ZUKUNFT, faellig: ['Git 2.56.1 → 2.57.0'] })
  await meldung()
  assert.equal(fetchAufrufe, QUELLEN.length, 'alter Zustand ohne lokal: einmal neu prüfen')
  assert.ok(JSON.parse(readFileSync(stateDatei, 'utf8')).lokal, 'danach mit lokal gespeichert')

  setze({ zeit: ZUKUNFT, faellig: ['gh 9.9.8 → 9.9.9'], lokal: { Git: '1.0.0', gh: '9.9.9' } })
  await meldung()
  assert.equal(fetchAufrufe, 0, 'nur fällige Werkzeuge zählen (Git abweichend, aber nicht fällig)')
  console.log('software-updates-test: ok (gleich, neu, leer, alter Zustand, nur fällige)')
} finally {
  rmSync(home, { recursive: true, force: true })
}
