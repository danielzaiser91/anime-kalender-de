/**
 * Test für `tools/bau-vergleich-protokoll.mjs` mit Auszügen echter Protokolle der Ablage (13.10.2026): rote Patch-Notes-Prüfung,
 * Absturz mit Stack, 25 Widersprüche (nur die letzten 10 Zeilen), Lauf ohne Fehlerausgabe.
 */
import assert from 'node:assert/strict'
import { basisRotMeldung, fehlerZeilen } from './bau-vergleich-protokoll.mjs'

const WARNUNG = '[pipeline] ⚠  "adn-1143": 30 Folgen gegen 26 laut AniList ("Wolf\'s Rain")'

const PATCHNOTES = [
  'exit 1',
  '[pipeline] Cover nach Regel TMDB → AniList → aniSearch: 2221 TMDB, 597 AniList',
  '',
  '--- stderr',
  WARNUNG,
  '[pipeline] ⚠  "cr-GR3K50PZR" hat keinen Titel — nicht im Kalender, Zuordnung fehlt',
  '  ✖ undefined: 3 Highlights, erlaubt sind 2',
  '',
  '1 Widerspruch/Widersprüche in data/patchnotes — abgebrochen.',
].join('\n')

const ABSTURZ = [
  'exit 1',
  'baue …',
  '',
  '--- stderr',
  WARNUNG,
  'C:\\Temp\\baum\\pipeline\\lib\\beleg-anbieter.ts:30',
  "  const roh = [e.titel, e.slug.replace(/-\\d+$/, '')]",
  '                              ^',
  '',
  "TypeError: Cannot read properties of undefined (reading 'replace')",
  '    at namenVon (C:\\Temp\\baum\\pipeline\\lib\\beleg-anbieter.ts:30:56)',
  '    at main (C:\\Temp\\baum\\pipeline\\build.ts:92:27)',
  '',
  'Node.js v24.11.1',
].join('\n')

const VIELE = [
  'exit 1',
  '',
  '--- stderr',
  ...Array.from({ length: 25 }, (_, i) => `  ✖ Titel ${i + 1}: Prime-Verweis ohne Beleg`),
  '',
  '25 Widerspruch/Widersprüche im ausgelieferten Ergebnis — Bau abgebrochen.',
].join('\n')

assert.deepEqual(fehlerZeilen(PATCHNOTES), [
  '  ✖ undefined: 3 Highlights, erlaubt sind 2',
  '1 Widerspruch/Widersprüche in data/patchnotes — abgebrochen.',
])

const absturz = fehlerZeilen(ABSTURZ)
assert.ok(absturz.some((z) => z.startsWith('TypeError: Cannot read properties')), 'Fehlerart und Meldung stehen drin')
assert.ok(!absturz.some((z) => /^\s+at /.test(z)), 'Stack-Zeilen fehlen')
assert.ok(!absturz.some((z) => z.includes('⚠')), 'Warnungen fehlen')

const viele = fehlerZeilen(VIELE)
assert.equal(viele.length, 10)
assert.equal(viele.at(-1), '25 Widerspruch/Widersprüche im ausgelieferten Ergebnis — Bau abgebrochen.')
assert.ok(viele[0].includes('Titel 17:'), 'es zählen die letzten Zeilen')

assert.deepEqual(fehlerZeilen('exit 1\nerste\nzweite\n\n--- stderr\n'), ['erste', 'zweite'], 'ohne Fehlerausgabe: Standardausgabe')
assert.equal(fehlerZeilen(`exit 1\n\n--- stderr\n  ✖ ${'x'.repeat(500)}`)[0].length, 200, 'lange Zeilen werden gekürzt')

const meldung = basisRotMeldung(PATCHNOTES, 'd36214376cab', '/tmp/bau-vergleich/x')
assert.ok(meldung.startsWith('Der Bau der Basis d36214376cab scheitert selbst (exit 1) — Protokoll: /tmp/bau-vergleich/x/_protokoll.txt'))
assert.ok(meldung.includes('  |   ✖ undefined: 3 Highlights, erlaubt sind 2'))

console.log('bau-vergleich-protokoll.test: ok')
