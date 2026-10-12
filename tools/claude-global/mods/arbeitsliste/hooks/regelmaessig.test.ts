import { test, expect } from 'claude-code/testing'

import { berlinVersatz, detailZeile, formatWann, inKurz, naechsterLauf, sortiereRegeln, zaehleRegelmaessig } from './regelmaessig'

const utc = (iso: string) => Date.parse(iso + 'Z')
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString().slice(0, 16))

test('naechsterLauf: täglich, Tageswechsel', () => {
  expect(iso(naechsterLauf('0 4 * * *', utc('2026-10-10T03:59:00')))).toBe('2026-10-10T04:00')
  expect(iso(naechsterLauf('0 4 * * *', utc('2026-10-10T04:00:00')))).toBe('2026-10-11T04:00')
  expect(iso(naechsterLauf('30 23 * * *', utc('2026-10-31T23:30:00')))).toBe('2026-11-01T23:30')
})

test('naechsterLauf: Wochentag (montags), Monatstag (2.)', () => {
  // 10.10.2026 ist ein Samstag
  expect(iso(naechsterLauf('0 5 * * 1', utc('2026-10-10T12:00:00')))).toBe('2026-10-12T05:00')
  expect(iso(naechsterLauf('0 4 2 * *', utc('2026-10-10T12:00:00')))).toBe('2026-11-02T04:00')
  expect(iso(naechsterLauf('0 4 2 * *', utc('2026-12-31T12:00:00')))).toBe('2027-01-02T04:00')
})

test('naechsterLauf: Stundenliste und stündlich', () => {
  expect(iso(naechsterLauf('0 2,8,14,20 * * *', utc('2026-10-10T09:15:00')))).toBe('2026-10-10T14:00')
  expect(iso(naechsterLauf('0 2,8,14,20 * * *', utc('2026-10-10T20:00:00')))).toBe('2026-10-11T02:00')
  expect(iso(naechsterLauf('0 * * * *', utc('2026-10-10T09:15:00')))).toBe('2026-10-10T10:00')
})

test('naechsterLauf: ungültiger Cron gibt null', () => {
  expect(naechsterLauf('0 4 * *', 0)).toBeNull()
  expect(naechsterLauf('0 25 * * *', 0)).toBeNull()
  expect(naechsterLauf('a b c d e', 0)).toBeNull()
})

test('Berlin: Sommerzeit endet am 25.10.2026 um 01:00 UTC, beginnt am 29.03.2026', () => {
  expect(berlinVersatz(utc('2026-10-25T00:59:00'))).toBe(2)
  expect(berlinVersatz(utc('2026-10-25T01:00:00'))).toBe(1)
  expect(berlinVersatz(utc('2026-03-29T00:59:00'))).toBe(1)
  expect(berlinVersatz(utc('2026-03-29T01:00:00'))).toBe(2)
})

// jetzt (UTC), Lauf (UTC), inKurz, formatWann
const FAELLE: [string, string, string, string][] = [
  ['2026-10-10T14:23', '2026-10-10T15:00', 'in 37 min', 'heute 17:00'],
  ['2026-10-10T14:23', '2026-10-10T20:00', 'in 5 h', 'heute 22:00'],
  ['2026-10-10T14:23', '2026-10-11T04:00', 'in 13 h', 'morgen 06:00'],
  ['2026-10-10T14:23', '2026-10-12T05:00', 'in 1 d', 'Mo 12.10. 07:00'],
  ['2026-10-10T14:23', '2026-11-02T04:00', 'in 22 d', 'Mo 02.11. 05:00'],
  ['2026-10-10T14:23', '2026-10-10T14:23', 'jetzt', 'heute 16:23'],
  ['2026-10-10T22:30', '2026-10-11T04:00', 'in 5 h', 'heute 06:00'],
  ['2026-10-24T18:00', '2026-10-25T04:00', 'in 10 h', 'morgen 05:00'],
  ['2026-10-24T23:30', '2026-10-25T04:00', 'in 4 h', 'heute 05:00'],
  ['2026-10-25T00:30', '2026-10-25T01:30', 'in 1 h', 'heute 02:30'],
  ['2027-03-28T00:30', '2027-03-28T01:30', 'in 1 h', 'heute 03:30'],
]

test('inKurz und formatWann: Tageswechsel, Winter-/Sommerzeit, doppelte Stunde am 25.10.2026', () => {
  for (const [jetzt, lauf, kurz, wann] of FAELLE) {
    expect([inKurz(utc(lauf), utc(jetzt)), formatWann(utc(lauf), utc(jetzt))]).toEqual([kurz, wann])
  }
})

test('sortiereRegeln: nach nächstem Lauf, ohne Cron hinten, Gleichstand in Dateireihenfolge', () => {
  const r = (titel: string, cron?: string) => ({ titel, rest: '', groesse: 'normal' as const, links: [], rhythmus: 'x', ...(cron ? { cron } : {}) })
  const regeln = [r('ohne'), r('spät', '0 20 * * *'), r('früh', '0 15 * * *'), r('auch früh', '0 15 * * *'), r('kaputt', '0 25 * * *')]
  const s = sortiereRegeln(regeln, utc('2026-10-10T14:23'))
  expect(s.map(x => x.r.titel)).toEqual(['früh', 'auch früh', 'spät', 'ohne', 'kaputt'])
  expect(s.map(x => x.datei)).toEqual([2, 3, 1, 0, 4])
})

test('zaehleRegelmaessig: Titel, Rhythmus, Cron; ohne cron nur Klartext; andere Abschnitte zählen nicht', () => {
  const text = `## Als Nächstes (Todo)
- x

## Regelmäßig

- ⟳ **Anime2You lesen** — Tageslauf \`refresh-data.yml\` · Rhythmus: täglich, Cloudflare-Wecker, Beginn ±Minuten · cron: 0 4 * * *
- ⟳ **Bestandsbau** — nach jedem Sammel-Lauf · Rhythmus: nach jedem Lauf

## Anderes
- y
`
  const r = zaehleRegelmaessig(text)
  expect(r.map(x => x.titel)).toEqual(['Anime2You lesen', 'Bestandsbau'])
  expect(r[0]).toMatchObject({ rhythmus: 'täglich', cron: '0 4 * * *', rest: 'Tageslauf refresh-data.yml' })
  expect(r[1]!.cron).toBeUndefined()
  expect(r[1]!.rhythmus).toBe('nach jedem Lauf')
  expect(detailZeile(r[1]!, null, 0)).toBe('nach jedem Lauf')
  const jetzt = utc('2026-10-10T08:15:00')
  expect(detailZeile(r[0]!, naechsterLauf(r[0]!.cron!, jetzt), jetzt)).toBe('täglich · morgen 06:00')
})
