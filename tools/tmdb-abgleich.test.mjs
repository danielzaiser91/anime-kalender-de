/**
 * Prüft `tools/tmdb-abgleich.mjs` an erfundenen Handzuordnungen: passende spätere Staffel ohne Befund, falscher Start,
 * falsche Folgenzahl, veralteter Name, Film nach Jahr, `ohne`-Zeilen zählen nicht, fehlende TMDB-Daten sind „nicht prüfbar“.
 * Aufruf: node tools/tmdb-abgleich.test.mjs
 */
import assert from 'node:assert/strict'
import { abgleich, nameStimmt, staffelnAus, waehleStaffel } from './tmdb-abgleich.mjs'

const folgen = (s, n, start) => Array.from({ length: n }, (_, i) => ({ s, e: i + 1, datum: i ? null : start }))
const titelZeile = (id, romaji, en, franchiseId = id) => ({ id, titleRomaji: romaji, titleEn: en, titleNative: null, franchiseId })

function daten(hand, aenderung = {}) {
  return {
    hand,
    tmdbTitel: { 900001: { tmdbId: 7001, kind: 'tv', nameDe: 'Testreihe' }, 900020: { tmdbId: 7002, kind: 'movie', nameDe: 'Testfilm', jahr: 2020 }, ...aenderung.tmdbTitel },
    tmdbFolgen: {
      900001: { tmdbId: 7001, geholtAm: '2026-10-01', folgen: [...folgen(0, 2, '2019-05-01'), ...folgen(1, 12, '2019-01-05'), ...folgen(2, 10, '2021-04-03')] },
    },
    titel: new Map([
      [900001, titelZeile(900001, 'Testreihe', 'Test Series')],
      [900002, titelZeile(900002, 'Testreihe 2nd Season', 'Test Series Season 2', 900001)],
      [900020, titelZeile(900020, 'Testfilm Gekijouban', 'Testfilm: The Movie')],
    ]),
    franchiseEintrag: new Map([
      [900002, { id: 900002, jpStart: aenderung.start ?? '2021-04-03', episodes: aenderung.folgen ?? 10 }],
      [900020, { id: 900020, jpStart: '2020-08-01', episodes: 1 }],
      [900030, { id: 900030, jpStart: '2015-01-01', episodes: 24 }],
    ]),
  }
}
const zweite = { anilistId: 900002, tmdbId: 7001, kind: 'tv', titel: 'Testreihe Staffel 2' }

assert.ok(nameStimmt('Test Series', ['Test Series Season 2']), 'Serienname steckt im Staffelnamen')
assert.ok(nameStimmt('Test: Series!', ['test series']), 'Satzzeichen und Groß-/Kleinschreibung zählen nicht')
assert.ok(!nameStimmt('Test Series Beerus', ['Test Series']), 'längerer fremder Name passt nicht')
assert.ok(!nameStimmt('', ['x']), 'leerer Name passt nie')

const st = staffelnAus(daten([]).tmdbFolgen[900001].folgen)
assert.deepEqual(st.map((s) => [s.s, s.folgen, s.start]), [[1, 12, '2019-01-05'], [2, 10, '2021-04-03']], 'Staffel 0 fällt weg')
assert.equal(waehleStaffel(st, '2021-03-30').s, 2, 'nächster Starttag')
assert.equal(waehleStaffel(st, '2019-02-01').s, 1)
assert.equal(waehleStaffel(st, undefined), undefined, 'ohne AniList-Start keine Wahl')

let r = abgleich(daten([zweite]))
assert.equal(r.zuordnungen, 1)
assert.deepEqual(r.abweichungen, [], 'Staffel 2 unter der Kennung der ersten: alles passt')
assert.deepEqual(r.geprueft, { Name: 1, Startdatum: 1, Folgenzahl: 1 })

r = abgleich(daten([zweite], { start: '2021-04-10' }))
assert.deepEqual(r.abweichungen.map((a) => [a.feld, a.tmdb, a.anilist, a.staffel]), [['Startdatum', '2021-04-03', '2021-04-10', 'Staffel 2']], 'eine Woche daneben ist eine Abweichung')

r = abgleich(daten([zweite], { folgen: 12 }))
assert.deepEqual(r.abweichungen.map((a) => [a.feld, a.tmdb, a.anilist]), [['Folgenzahl', 10, 12]])

r = abgleich(daten([zweite], { tmdbTitel: { 900002: { tmdbId: 7001, nameDe: 'Testreihe Beerus' } } }))
assert.deepEqual(r.abweichungen.map((a) => [a.feld, a.tmdb]), [['Name', 'Testreihe Beerus']], 'der eigene, veraltete Name geht vor')

const film = { anilistId: 900020, tmdbId: 7002, kind: 'movie', titel: 'Testfilm' }
assert.deepEqual(abgleich(daten([film])).abweichungen, [], 'Film: Jahr und eine Folge passen')
r = abgleich(daten([film], { tmdbTitel: { 900020: { tmdbId: 7002, kind: 'movie', nameDe: 'Testfilm', jahr: 2019 } } }))
assert.deepEqual(r.abweichungen.map((a) => [a.feld, a.tmdb, a.anilist]), [['Startdatum', '2019', '2020-08-01']])

r = abgleich(daten([{ anilistId: 900040, ohne: true, kind: 'movie', titel: 'Ohne' }, zweite]))
assert.equal(r.zuordnungen, 1, '`ohne`-Zeilen tragen keine Kennung und zählen nicht')

r = abgleich(daten([{ anilistId: 900030, tmdbId: 7999, kind: 'tv', titel: 'Unbekannt' }]))
assert.deepEqual(r.nichtPruefbar, [{ anilistId: 900030, titel: 'Unbekannt', felder: ['Name', 'Startdatum', 'Folgenzahl'] }])
assert.deepEqual(r.abweichungen, [], 'fehlende Daten sind keine Abweichung')

console.log('tmdb-abgleich: alle Fälle grün')
