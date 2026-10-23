/**
 * Blau, Indigo, Violett und Türkis gibt es in `web/src` nicht mehr (docs/wissen/design-regeln.md, Abschnitt 5 „Info“; 14.10.2026):
 * erklärende Marken ohne Handlungsbedarf tragen `ak-info*`, Katalog und TV haben ihre eigenen Tokens. Die Meldungsarten haben
 * Chip und Punkt aus einer Datei (`news-farben.ts`) und beide zeigen je Art dieselbe Kennfarbe.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fundstellen } from './design-klassen.mjs'
import { NEWS_FARBE, NEWS_PUNKT } from '../web/src/components/news-farben.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const quelle = join(wurzel, 'web', 'src')
const lies = (pfad) => readFileSync(join(quelle, pfad), 'utf8')
const PALETTE = ['blue-', 'indigo-', 'violet-', 'teal-']

const funde = (ordner) => PALETTE.flatMap((name) => fundstellen(ordner)[name].map((f) => `${f} ${name}`))

// Gegenprobe: das Zählen sieht alle vier Farben.
const probe = mkdtempSync(join(tmpdir(), 'design-info-'))
try {
  mkdirSync(join(probe, 'a'), { recursive: true })
  writeFileSync(join(probe, 'a', 'x.tsx'), '<b className="bg-blue-500 text-indigo-300 border-violet-400 bg-teal-500">x</b>\n')
  assert.equal(funde(probe).length, 4)
  writeFileSync(join(probe, 'a', 'x.tsx'), '<b className="bg-ak-info text-ak-info-text border-ak-katalog bg-ak-tv">x</b>\n')
  assert.equal(funde(probe).length, 0)
} finally {
  rmSync(probe, { recursive: true })
}
assert.deepEqual(funde(quelle), [], 'blue-, indigo-, violet-, teal- in web/src: stattdessen ak-info*, ak-katalog, ak-tv')

// Jede Meldungsart: Chip und Punkt tragen dieselbe Kennfarbe, und es ist die beschlossene.
const SOLL = {
  neu: 'gut',
  folgen: 'gut',
  nachgereicht: 'gut',
  angekuendigt: 'info',
  offiziell: 'info',
  kino: 'akzent',
  rhythmus: 'akzent',
  takt: 'leise',
  disc: 'favorit',
  verspaetet: 'leise',
  nachgetragen: 'leise',
}
const chip = (klasse) => klasse.match(/text-ak-([a-z]+)/)?.[1]
const punkt = (klasse) => klasse.match(/^bg-ak-([a-z]+)/)?.[1]
assert.deepEqual(Object.keys(NEWS_FARBE).sort(), Object.keys(SOLL).sort(), 'jede Art hat einen Chip')
assert.deepEqual(Object.keys(NEWS_PUNKT).sort(), Object.keys(SOLL).sort(), 'jede Art hat einen Punkt')
for (const [art, token] of Object.entries(SOLL)) {
  assert.equal(chip(NEWS_FARBE[art]), token, `Chip ${art}`)
  assert.equal(punkt(NEWS_PUNKT[art]), token, `Punkt ${art}`)
}

// Die Aufrufer reichen die Tabellen durch.
const neuigkeiten = lies('components/detail/neuigkeiten.tsx')
assert.match(neuigkeiten, /\$\{NEWS_PUNKT\[z\.m\.art\]\}/, 'Panel: Punkt aus NEWS_PUNKT')
assert.match(neuigkeiten, /\$\{NEWS_FARBE\[z\.m\.art\]\}/, 'Panel: Chip aus NEWS_FARBE')
assert.match(neuigkeiten, /akzent="info"/, 'Neuigkeiten-Karte ist Info')
assert.match(lies('components/detail/reihen-karte.tsx'), /akzent="info"/, 'Reihen-Karte ist Info')
assert.match(lies('components/FilterDetails.tsx'), /"border-y border-ak-info bg-ak-info-grund /, 'Schnellfilter-Band ist Info')
const nachtrag = lies('components/news-nachtrag.tsx')
assert.match(nachtrag, /quelle: 'border-ak-info\/50 bg-ak-info-grund text-ak-info-text'/)
assert.match(nachtrag, /zusage: 'border-ak-info\/50 bg-ak-info-grund text-ak-info-text'/)
assert.match(lies('components/detail/reihen-marke.tsx'), /border-ak-info\/50 bg-ak-info-grund [^"]*text-ak-info-text/, 'Geplant-Marke ist Info')
assert.match(lies('components/SaisonKarte.tsx'), /angekuendigt: 'border-ak-info text-ak-info-text'/, 'Stufe angekündigt ist Info')

console.log('design-info: ok')
