/**
 * Prüft `tools/offen-erschienen.mjs` mit fester Eingabe: Eine Staffel ist erst offen, wenn mehr Folgen
 * erschienen sind als belegt (Tokyo Revengers, 11.10.2026: 2 von 13 erschienen, beide belegt).
 * Aufruf: node tools/offen-erschienen.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brauchtUrteil, wartet } from './offen-erschienen.mjs'

const wurzel = mkdtempSync(join(tmpdir(), 'offen-erschienen-'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
mkdirSync(join(wurzel, 'data'), { recursive: true })

const woechentlich = (titleId, platform, firstEpisodeDate, episodeCount) => ({
  titleId,
  platform,
  releaseType: 'weekly',
  schedule: { firstEpisodeDate, time: '19:00', episodeCount },
})
writeFileSync(
  join(wurzel, 'public/data/releases.json'),
  JSON.stringify([
    woechentlich(1, 'disneyplus', '2026-10-02', 13),
    woechentlich(2, 'disneyplus', '2026-10-02', 13),
    woechentlich(3, 'disneyplus', '2026-10-02', 13),
    woechentlich(4, 'disneyplus', '2026-11-20', 12),
    woechentlich(5, 'disneyplus', '2026-07-01', 12),
  ]),
)
writeFileSync(
  join(wurzel, 'data/dub-confirmed.yaml'),
  [
    '- anilistId: 1',
    '  platform: disneyplus',
    '  dub: true',
    '  dubRanges:',
    '    - { from: 1, to: 2, dub: true }',
    '- anilistId: 2',
    '  platform: disneyplus',
    '  dub: true',
    '  dubRanges:',
    '    - { from: 1, to: 1, dub: true }',
    '- anilistId: 3',
    '  platform: disneyplus',
    '  available: false',
    '',
  ].join('\n'),
)

const jetzt = new Date('2026-10-11T12:00:00Z')
const pruefe = (id, plattform = 'disneyplus', weg) => wartet(wurzel, { id }, plattform, weg, jetzt)

assert.equal(pruefe(1), true, 'laufend: 2 erschienen, 2 belegt — nichts zu prüfen')
assert.equal(pruefe(2), false, 'laufend: 2 erschienen, 1 belegt — offen')
assert.equal(pruefe(2, 'disneyplus', { dubRanges: [{ from: 2, to: 2, dub: true }] }), true, 'Bereiche am Weg zählen mit')
assert.equal(pruefe(3), false, 'ein Beleg ohne Folgenbereiche belegt keine Folge')
assert.equal(pruefe(4), true, 'noch keine Folge erschienen — nichts zu prüfen')
assert.equal(pruefe(5), false, 'fertig erschienen, unbelegt — offen')
assert.equal(pruefe(99), false, 'ohne Termindaten bleibt es wie bisher')
assert.equal(pruefe(1, 'netflix'), false, 'Termine eines anderen Anbieters zählen nicht')

assert.equal(brauchtUrteil({ dub: undefined, wartet: true }), false)
assert.equal(brauchtUrteil({ dub: undefined, wartet: false }), true)
assert.equal(brauchtUrteil({ dub: true, wartet: false }), false, 'mit Urteil nie offen')
console.log('offen-erschienen.test: grün')
