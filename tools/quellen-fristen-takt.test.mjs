// Jede Quelle, die der Stunden- oder Tageslauf bei jedem Lauf schreibt, hat einen eigenen Fristeintrag (Anlass 26.10.2026: crunchyroll auf Standardfrist).
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRISTEN } from './quellen-fristen.mjs'
import { importZiele, laufBefehle, ohneFrist, quellenDesWorkflows, quellenNamen, skriptDateien } from './quellen-takt.mjs'

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
assert.deepEqual(quellenNamen("recordSource('a-b', 0)\nrecordSource( 'c', 1)\nrecordSource(name, 2)\n// recordSource(\"d\")\nrecordSource(`e`, 3)\nrecordSource(\n  'f',\n  1,\n)"), ['a-b', 'c', '?', 'e', 'f'])
const ziele = (text) => importZiele(text, 'pipeline/lib/x.ts')
assert.deepEqual(ziele("import a from './adn-news.ts'\nimport { b } from '../bau/y.ts'\nimport ts from 'typescript'\nimport t from 'node:fs'"), ['pipeline/lib/adn-news.ts', 'pipeline/bau/y.ts'])
assert.deepEqual(ziele("export { c } from './c.ts'\nconst m = await import('./d.mjs')\nimport('./e.ts')\nimport(name)"), ['pipeline/lib/c.ts', 'pipeline/lib/d.mjs', 'pipeline/lib/e.ts'])
assert.deepEqual(ziele("import x from './kein-skript.json'\n// import y from './kommentar.ts'"), [])
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
  mkdirSync(join(kulisse, 'pipeline', 'lib'))
  writeFileSync(join(kulisse, 'pipeline', 'a.ts'), "import { hilf } from './lib/hilf.ts'\nrecordSource('gemeinsam', 1)\nrecordSource('nur-a', 1)\n")
  writeFileSync(join(kulisse, 'pipeline', 'b.ts'), "recordSource('gemeinsam', 2)\nrecordSource(name, 3)\n")
  writeFileSync(join(kulisse, 'pipeline', 'lib', 'hilf.ts'), "import { tief } from './tief.ts'\nimport { zurueck } from '../a.ts'\nrecordSource('im-hilfsmodul', 1)\n")
  writeFileSync(join(kulisse, 'pipeline', 'lib', 'tief.ts'), "recordSource('zwei-stufen-tief', 1)\n")
  writeFileSync(join(kulisse, 'pipeline', 'lib', 'unbenutzt.ts'), "recordSource('nirgends-eingebunden', 1)\n")
  const q = quellenDesWorkflows(kulisse, 'w.yml')
  assert.deepEqual(Object.keys(q).sort(), ['?', 'gemeinsam', 'im-hilfsmodul', 'nur-a', 'zwei-stufen-tief'])
  assert.deepEqual([...q.gemeinsam].sort(), ['pipeline/a.ts', 'pipeline/b.ts'])
  assert.deepEqual([...q['zwei-stufen-tief']], ['pipeline/lib/tief.ts'])
  assert.deepEqual(ohneFrist(q, { gemeinsam: 1, 'nur-a': 1, 'im-hilfsmodul': 1, 'zwei-stufen-tief': 1 }), ['?'], 'ein unlesbarer Name ist rot, nicht still')
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

// Frist je Quelle des Stunden- und Tageslaufs, fest eingetragen (Stand 26.10.2026): Stündliche und tägliche Quellen höchstens 4 Tage
// (Standard, Alarm bei 8), die mit belegtem Takt genau ihr Wert. Wochenquellen, die der Tageslauf nur anstößt, stehen in WOCHE und
// brauchen die Wochenfrist. Eine neue Quelle im Lauf ist hier rot, bis jemand sie eingeordnet hat.
const TAEGLICH = {
  crunchyroll: 1,
  'crunchyroll-woche': 1,
  adn: 3,
  anime2you: 3,
  'anisearch-dubs': 3,
  'anisearch-zuordnung': 3,
  'crunchyroll-neu': 3,
  messbelege: 3,
  toggo: 3,
  'tv-de': 3,
  'tv-programm': 3,
  'adn-news': 4,
  anisearch: 4,
  'beleg-lesungen': 4,
  'cartoon-reihen': 4,
  cartoons: 4,
  trailer: 4,
  'wikipedia-folgen': 4,
}
const WOCHE = ['adn-catalog', 'anisearch-eintraege', 'crunchyroll-dub', 'justwatch-audio', 'motn-changes']
for (const name of new Set([...Object.keys(stunde), ...Object.keys(tag)])) {
  if (WOCHE.includes(name)) assert.ok(FRISTEN[name] >= 9, `${name}: Wochenquelle mit Frist ${FRISTEN[name]} < 9`)
  else {
    assert.ok(name in TAEGLICH, `${name}: nicht eingeordnet (TAEGLICH oder WOCHE in diesem Test)`)
    assert.equal(FRISTEN[name], TAEGLICH[name], `${name}: Frist ${FRISTEN[name]}, erwartet ${TAEGLICH[name]}`)
    assert.ok(FRISTEN[name] <= 4, `${name}: Frist ${FRISTEN[name]} für eine tägliche Quelle zu lang`)
  }
}
for (const name of Object.keys(TAEGLICH)) assert.ok(name in stunde || name in tag, `${name}: steht in TAEGLICH, läuft aber in keinem der beiden Workflows`)

// Hilfsmodul: adn-news schreibt `pipeline/lib/adn-news.ts`, aufgerufen wird `fetch-adn.ts` (Anlass: das alte Regex-Lesen sah nur die Skriptdatei selbst).
assert.ok('adn-news' in tag && [...tag['adn-news']].includes('pipeline/lib/adn-news.ts'), 'adn-news über das Hilfsmodul gefunden')

console.log('quellen-fristen-takt: alle Fälle grün (Stundenlauf', Object.keys(stunde).length, 'Quellen, Tageslauf', Object.keys(tag).length, ')')
