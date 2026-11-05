/** Test der Regel „TV-Termin bei Joyn-Sender ohne Joyn-Weg“ (`lib/joyn-sender-luecke.ts`); Fall 1 ist Yaiba vom 05.11.2026. */
import assert from 'node:assert/strict'
import { JOYN_SENDER, joynLueckeZeile, joynLuecken } from './lib/joyn-sender-luecke.ts'
import type { Release, StreamLink } from '../shared/types.ts'

const tv = (titleId: number, sender: string, start: string, name = `T${titleId}`) =>
  ({ slug: `s${titleId}`, titleId, name, platform: 'tv', sender, schedule: { firstEpisodeDate: start } }) as unknown as Release
const titel = (id: number, ...plattformen: string[]) => ({ id, streams: plattformen.map((p) => ({ platform: p, url: '' }) as StreamLink) })
const HEUTE = '2026-11-05'

// Yaiba: ProSieben MAXX, gestartet, nur Akibapass -> Lücke
const yaiba = joynLuecken([tv(177476, 'ProSieben MAXX', '2026-11-05', 'YAIBA: Samurai Legend')], [titel(177476, 'crunchyroll')], HEUTE)
assert.deepEqual(yaiba, [{ titleId: 177476, name: 'YAIBA: Samurai Legend', sender: 'ProSieben MAXX' }])

// mit Joyn-Weg: keine Lücke; Joyn an einem anderen Titel zählt nicht
assert.equal(joynLuecken([tv(1, 'ProSieben MAXX', '2026-10-01')], [titel(1, 'joyn')], HEUTE).length, 0)
assert.equal(joynLuecken([tv(1, 'ProSieben MAXX', '2026-10-01')], [titel(1), titel(2, 'joyn')], HEUTE).length, 1)

// Start morgen: noch keine Lücke; heute: schon (Grenze)
assert.equal(joynLuecken([tv(1, 'ProSieben MAXX', '2026-11-06')], [titel(1)], HEUTE).length, 0)
assert.equal(joynLuecken([tv(1, 'ProSieben MAXX', '2026-11-05')], [titel(1)], HEUTE).length, 1)

// Sender ohne Joyn-Mediathek und Nicht-TV bleiben außen
assert.equal(joynLuecken([tv(1, 'TOGGO plus', '2026-10-01'), tv(2, 'Disney Channel', '2026-10-01')], [titel(1), titel(2)], HEUTE).length, 0)
assert.equal(joynLuecken([{ ...tv(1, 'ProSieben MAXX', '2026-10-01'), platform: 'netflix' } as Release], [titel(1)], HEUTE).length, 0)

// jeder Joyn-Sender der Liste löst aus (Liste fest eingetragen, nicht aus dem Modul gelesen)
for (const s of ['ProSieben', 'ProSieben MAXX', 'ProSieben FUN', 'SAT.1', 'kabel eins', 'sixx'])
  assert.equal(joynLuecken([tv(5, s, '2026-10-01')], [titel(5)], HEUTE).length, 1, s)
assert.equal(JOYN_SENDER.length, 6)

// zwei Termine eines Titels zählen einmal; Reihenfolge nach Kennung
const zwei = joynLuecken([tv(9, 'sixx', '2026-10-01'), tv(3, 'ProSieben FUN', '2026-10-02'), tv(3, 'ProSieben FUN', '2026-10-03')], [titel(3), titel(9)], HEUTE)
assert.deepEqual(zwei.map((l) => l.titleId), [3, 9])

// Warnzeile: leer ohne Lücke, sonst mit Marke und Titel
assert.equal(joynLueckeZeile([]), '')
assert.match(joynLueckeZeile(yaiba), /^⚠ WARNUNG Joyn-Lücke: 1 Titel .*YAIBA: Samurai Legend \(177476, ProSieben MAXX\)/)

console.log('check-joyn-sender-luecke: OK — Yaiba, Joyn-Weg, Startgrenze, Sender, Dubletten, Warnzeile')
