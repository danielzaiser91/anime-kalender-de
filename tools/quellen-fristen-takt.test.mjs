// Jede Quelle, die der Stunden- oder Tageslauf bei jedem Lauf schreibt, hat einen eigenen Fristeintrag (Anlass 26.10.2026: crunchyroll auf Standardfrist).
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
assert.deepEqual(skriptDateien('node ./tools/drei.mjs', npm), ['tools/drei.mjs'])
assert.deepEqual(skriptDateien('node node_modules/x/bin.mjs tools/drei.mjs', npm), ['tools/drei.mjs'])
assert.deepEqual(skriptDateien('npm run data:kreis', npm), [])
assert.deepEqual(skriptDateien('npm run gibt-es-nicht', npm), [])
assert.deepEqual(skriptDateien('bash tools/schritt.sh --zeit 5m "x"', npm), [])
assert.deepEqual(quellenNamen("recordSource('a-b', 0)\nrecordSource( 'c', 1)\nrecordSource(name, 2)\n// recordSource(\"d\")"), ['a-b', 'c'])
assert.deepEqual(ohneFrist({ b: 1, a: 1, c: 1 }, { c: 2 }), ['a', 'b'])
assert.deepEqual(ohneFrist({ a: 1 }, { a: 4 }), [])
assert.deepEqual(ohneFrist({ a: 1 }, { a: 0 }), [], 'ein Eintrag zählt auch mit Frist 0 (dann eskaliert die Wache nie)')

// Wegwerf-Wurzel: dieselbe Quelle in zwei Skripten sammelt beide Dateien; eine fehlende Skriptdatei bricht nicht ab.
{
  const kulisse = mkdtempSync(join(tmpdir(), 'quellen-takt-'))
  mkdirSync(join(kulisse, '.github', 'workflows'), { recursive: true })
  mkdirSync(join(kulisse, 'pipeline'))
  writeFileSync(join(kulisse, 'package.json'), JSON.stringify({ scripts: { 'data:a': 'tsx pipeline/a.ts && tsx pipeline/b.ts' } }))
  writeFileSync(join(kulisse, '.github', 'workflows', 'w.yml'), yaml.replace('npm run data:zwei -- --leicht', 'npm run data:a'))
  writeFileSync(join(kulisse, 'pipeline', 'a.ts'), "recordSource('gemeinsam', 1)\nrecordSource('nur-a', 1)\n")
  writeFileSync(join(kulisse, 'pipeline', 'b.ts'), "recordSource('gemeinsam', 2)\n")
  const q = quellenDesWorkflows(kulisse, 'w.yml')
  assert.deepEqual(Object.keys(q).sort(), ['gemeinsam', 'nur-a'])
  assert.deepEqual([...q.gemeinsam].sort(), ['pipeline/a.ts', 'pipeline/b.ts'])
  rmSync(kulisse, { recursive: true, force: true })
}

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
