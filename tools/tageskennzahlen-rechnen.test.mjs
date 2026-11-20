import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  durchsatz, istBot, istRevert, median, medianDauerMin, rotStundenJeTag, stauAmTagesende, storyPoints,
  tagBerlin, tageZwischen, tagesBeginnMs, tagPlus,
} from './tageskennzahlen-rechnen.mjs'

const d = (pfad, zeilen) => ({ pfad, zeilen })

test('Story Points: Grenzen 30/150/400, Daten und Tests zählen nicht, Stufe 2 gibt +1', () => {
  assert.equal(storyPoints([d('web/src/a.ts', 30)], 1), 1)
  assert.equal(storyPoints([d('web/src/a.ts', 31)], 1), 2)
  assert.equal(storyPoints([d('web/src/a.ts', 150)], 0), 2)
  assert.equal(storyPoints([d('web/src/a.ts', 151)], 0), 3)
  assert.equal(storyPoints([d('web/src/a.ts', 400)], 0), 3)
  assert.equal(storyPoints([d('web/src/a.ts', 401)], 0), 5)
  assert.equal(storyPoints([d('web/src/a.ts', 20), d('data/x.yaml', 900), d('public/data/t.json', 9000), d('tools/a.test.mjs', 500)], 1), 1)
  assert.equal(storyPoints([d('tools/a.mjs', 31)], 2), 3)
  assert.equal(storyPoints([d('tools/a.mjs', 500)], 2), 6)
  assert.equal(storyPoints([], undefined), 1)
})

test('Tagesgrenze Berlin: Winter, Sommer, Sommerzeit-Ende 25.10.2026 (25-Stunden-Tag)', () => {
  assert.equal(tagBerlin('2026-11-14T22:59:59Z'), '2026-11-14')
  assert.equal(tagBerlin('2026-11-14T23:00:00Z'), '2026-11-15')
  assert.equal(tagBerlin('2026-10-01T21:59:59Z'), '2026-10-01')
  assert.equal(tagBerlin('2026-10-01T22:00:00Z'), '2026-10-02')
  assert.equal(new Date(tagesBeginnMs('2026-10-01')).toISOString(), '2026-09-30T22:00:00.000Z')
  assert.equal(new Date(tagesBeginnMs('2026-10-25')).toISOString(), '2026-10-24T22:00:00.000Z')
  assert.equal(new Date(tagesBeginnMs('2026-10-26')).toISOString(), '2026-10-25T23:00:00.000Z')
  assert.equal((tagesBeginnMs('2026-10-26') - tagesBeginnMs('2026-10-25')) / 3_600_000, 25)
  assert.equal((tagesBeginnMs('2026-10-25') - tagesBeginnMs('2026-10-24')) / 3_600_000, 24)
  assert.equal(tagBerlin('2026-10-25T22:30:00Z'), '2026-10-25')
  assert.equal(tagBerlin('2026-10-25T23:30:00Z'), '2026-10-26')
})

test('Tagesrechnung: tagPlus über Monatsgrenze, tageZwischen einschließlich', () => {
  assert.equal(tagPlus('2026-10-31', 1), '2026-11-01')
  assert.equal(tagPlus('2026-10-01', -1), '2026-09-30')
  assert.deepEqual(tageZwischen('2026-10-24', '2026-10-26'), ['2026-10-24', '2026-10-25', '2026-10-26'])
})

test('Bot-Abgrenzung: [bot]-Autor mit chore(data|wache|extension); Hand sonst', () => {
  assert.equal(istBot({ author: 'anime-kalender-daten[bot]', title: 'chore(data): Sendezeiten gesammelt' }), true)
  assert.equal(istBot({ author: 'claude[bot]', title: 'chore(wache): durchgesehen' }), true)
  assert.equal(istBot({ author: 'claude[bot]', title: 'fix(bau): Riegel' }), false)
  assert.equal(istBot({ author: 'derNamenloseDaniel', title: 'chore(data): TMDB-Fund' }), false)
})

test('Revert-Erkennung', () => {
  assert.equal(istRevert('Revert "feat: x"'), true)
  assert.equal(istRevert('chore(data): Sammler-Stand zurückgenommen (a, b)'), true)
  assert.equal(istRevert('feat: Revertierung der Liste'), false)
})

test('median', () => {
  assert.equal(median([]), undefined)
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 2, 3]), 2.5)
})

test('Durchsatz: Hand/Bot, Punkte nur Hand, Median offen→Merge', () => {
  const prs = [
    { bot: false, createdAt: '2026-11-14T10:00:00Z', mergedAt: '2026-11-14T11:00:00Z', punkte: 2 },
    { bot: false, createdAt: '2026-11-14T10:00:00Z', mergedAt: '2026-11-14T13:00:00Z', punkte: 3 },
    { bot: true, createdAt: '2026-11-14T10:00:00Z', mergedAt: '2026-11-14T10:30:00Z', punkte: 1 },
  ]
  assert.deepEqual(durchsatz(prs), { merges: 3, mergesHand: 2, mergesBot: 1, storyPoints: 5, medianOffenBisMergeHandH: 2, medianOffenBisMergeBotH: 0.5 })
  assert.equal(durchsatz([]).medianOffenBisMergeHandH, undefined)
})

test('Stau am Tagesende: offen, über 24 h, ältester', () => {
  const ende = Date.parse('2026-11-14T23:00:00Z')
  const prs = [
    { createdAt: '2026-11-14T22:00:00Z', endeAt: null },
    { createdAt: '2026-11-13T22:00:00Z', endeAt: '2026-11-15T01:00:00Z' },
    { createdAt: '2026-11-10T23:00:00Z', endeAt: '2026-11-14T12:00:00Z' },
    { createdAt: '2026-11-15T00:00:00Z', endeAt: null },
  ]
  assert.deepEqual(stauAmTagesende(prs, ende), { offen: 2, ueber24h: 1, aeltestesH: 25 })
  assert.deepEqual(stauAmTagesende([], ende), { offen: 0, ueber24h: 0, aeltestesH: 0 })
})

test('Rotstunden: über Mitternacht und Sommerzeit-Ende verteilt, Abbruch ändert nichts, offen bis jetzt', () => {
  const laeufe = [
    { createdAt: '2026-10-24T20:00:00Z', conclusion: 'success' },
    { createdAt: '2026-10-24T21:00:00Z', conclusion: 'failure' }, // 23:00 Berlin
    { createdAt: '2026-10-25T05:00:00Z', conclusion: 'cancelled' },
    { createdAt: '2026-10-25T23:30:00Z', conclusion: 'success' }, // 00:30 Berlin am 26.
  ]
  const r = rotStundenJeTag(laeufe, Date.parse('2026-10-27T00:00:00Z'))
  assert.equal(r['2026-10-24'], 1) // 21:00–22:00 UTC
  assert.equal(r['2026-10-25'], 25) // ganzer 25-Stunden-Tag
  assert.equal(r['2026-10-26'], 0.5)
  const offen = rotStundenJeTag([{ createdAt: '2026-11-14T10:00:00Z', conclusion: 'timed_out' }], Date.parse('2026-11-14T12:00:00Z'))
  assert.deepEqual(offen, { '2026-11-14': 2 })
  assert.deepEqual(rotStundenJeTag([{ createdAt: '2026-11-14T10:00:00Z', conclusion: 'success' }], Date.parse('2026-11-15T00:00:00Z')), {})
})

test('Laufdauer: Median nur erfolgreicher Läufe in Minuten', () => {
  const l = (start, ende, conclusion) => ({ start, ende, conclusion })
  assert.equal(medianDauerMin([l('2026-11-14T10:00:00Z', '2026-11-14T10:10:00Z', 'success'), l('2026-11-14T10:00:00Z', '2026-11-14T10:30:00Z', 'success'), l('2026-11-14T10:00:00Z', '2026-11-14T12:00:00Z', 'failure')]), 20)
  assert.equal(medianDauerMin([]), undefined)
})

test('tageskennzahlen.mjs lehnt ungültige oder verkehrte Tage vor jedem Abruf ab', () => {
  for (const argumente of [['--von=2026-10-02', '--bis=2026-10-01'], ['--von=gestern'], ['--bis=2026-13']]) {
    const r = spawnSync('node', [fileURLToPath(new URL('./tageskennzahlen.mjs', import.meta.url)), ...argumente], { encoding: 'utf8', timeout: 20_000 })
    assert.equal(r.status, 1, argumente.join(' '))
    assert.match(r.stderr, /FEHLER: --von=/)
  }
})
