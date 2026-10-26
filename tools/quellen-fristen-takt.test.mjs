// Jede Quelle, die der Stunden- oder Tageslauf bei jedem Lauf schreibt, hat einen eigenen Fristeintrag (Anlass 26.10.2026: crunchyroll auf Standardfrist).
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRISTEN } from './quellen-fristen.mjs'
import { laufBefehle, ohneFrist, quellenDesWorkflows, quellenNamen, skriptDateien } from './quellen-takt.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

// Bausteine: Befehle aus dem Workflow-Dokument (nicht aus Kommentaren), Skripte über npm-Skripte, wörtliche Namen.
const yaml = `
name: x
on: { workflow_dispatch: {} }
jobs:
  a:
    steps:
      - name: Kalender
        run: bash tools/schritt.sh --zeit 10m "K" -- npx tsx pipeline/scrape-eins.ts --weeks 3
      - uses: actions/checkout@v4
      - name: Über npm
        run: bash tools/schritt.sh --zeit 5m "N" -- npm run data:zwei -- --leicht
  b:
    steps:
      - run: node tools/drei.mjs
      # - run: npx tsx pipeline/auskommentiert.ts
`
assert.deepEqual(laufBefehle(yaml).length, 3)
assert.ok(!laufBefehle(yaml).some((b) => b.includes('auskommentiert')))
const npm = { 'data:zwei': 'tsx pipeline/fetch-zwei.ts && npm run data:tief', 'data:tief': 'tsx pipeline/fetch-tief.ts', 'data:kreis': 'npm run data:kreis' }
assert.deepEqual(skriptDateien('npx tsx pipeline/scrape-eins.ts --weeks 3', npm), ['pipeline/scrape-eins.ts'])
assert.deepEqual(skriptDateien('npm run data:zwei -- --leicht', npm), ['pipeline/fetch-tief.ts', 'pipeline/fetch-zwei.ts'])
assert.deepEqual(skriptDateien('node tools/drei.mjs', npm), ['tools/drei.mjs'])
assert.deepEqual(skriptDateien('npm run data:kreis', npm), [])
assert.deepEqual(skriptDateien('npm run gibt-es-nicht', npm), [])
assert.deepEqual(skriptDateien('bash tools/schritt.sh --zeit 5m "x"', npm), [])
assert.deepEqual(quellenNamen("recordSource('a-b', 0)\nrecordSource( 'c', 1)\nrecordSource(name, 2)\n// recordSource(\"d\")"), ['a-b', 'c'])
assert.deepEqual(ohneFrist({ b: 1, a: 1, c: 1 }, { c: 2 }), ['a', 'b'])
assert.deepEqual(ohneFrist({ a: 1 }, { a: 4 }), [])

// Echte Workflows: der Scanner sieht die bekannten Quellen (sonst wäre er blind), und alle haben eine Frist.
const stunde = quellenDesWorkflows(wurzel, 'refresh-hourly.yml')
const tag = quellenDesWorkflows(wurzel, 'refresh-data.yml')
for (const name of ['crunchyroll', 'tv-de', 'messbelege', 'anime2you']) assert.ok(name in stunde, `Stundenlauf: ${name} nicht gefunden`)
for (const name of ['crunchyroll', 'adn', 'toggo', 'anisearch', 'cartoon-reihen']) assert.ok(name in tag, `Tageslauf: ${name} nicht gefunden`)
assert.deepEqual(ohneFrist(stunde, FRISTEN), [], 'Stundenlauf: Quellen ohne Fristeintrag')
assert.deepEqual(ohneFrist(tag, FRISTEN), [], 'Tageslauf: Quellen ohne Fristeintrag')

// Der Anlassfall: ohne den Eintrag meldet der Wächter genau crunchyroll.
const { crunchyroll: _weg, ...ohneCrunchyroll } = FRISTEN
assert.deepEqual(ohneFrist(stunde, ohneCrunchyroll), ['crunchyroll'])

// Der Kalender läuft stündlich: ein Tag Frist (Alarm nach zwei). Alles im Stundenlauf höchstens vier (Standard).
// Im Tageslauf stehen auch Wochenquellen (crunchyroll-dub holt nur, was älter als 28 Tage ist), dort gibt es keine Obergrenze.
assert.equal(FRISTEN.crunchyroll, 1)
for (const name of Object.keys(stunde)) assert.ok(FRISTEN[name] <= 4, `${name}: Frist ${FRISTEN[name]} für eine Quelle im Stundenlauf zu lang`)

console.log('quellen-fristen-takt: alle Fälle grün (Stundenlauf', Object.keys(stunde).length, 'Quellen, Tageslauf', Object.keys(tag).length, ')')
