import { test, expect } from 'claude-code/testing'

import { anbieterName, folgenText, heuteBerlin, kalenderHeute, kalenderZeilenText, termineAusDatei, wocheDeckt } from './kalender'
import type { KalenderTermin } from './kalender'
import { EVENTS_DATEI, WOCHE_DATEI, ladeKalender } from './kalender-laden'
import { PANE, STAND, kalenderWelt, starte, zeilen } from './testhilfe'

// Termine vom 19.11.2026 wörtlich aus public/data/woche.json (Auszug der Felder, die der Bereich liest; Disc und Prime-Angebot unverändert dabei).
const T = (date: string, t: Partial<KalenderTermin> & { name: string; platform: string }): KalenderTermin => ({ date, releaseType: 'weekly', ...t })
const TAG = '2026-11-19'
const ECHT: KalenderTermin[] = [
  T(TAG, { name: 'Super Wings', platform: 'tv', sender: 'Super RTL', time: '10:00', episode: 63 }),
  T(TAG, { name: 'Super Wings', platform: 'tv', sender: 'Super RTL', time: '09:50', episode: 62 }),
  T(TAG, { name: 'Super Wings', platform: 'tv', sender: 'TOGGO plus', time: '10:50', episode: 62 }),
  T(TAG, { name: 'Super Wings', platform: 'tv', sender: 'TOGGO plus', time: '11:00', episode: 63 }),
  T(TAG, { name: 'Dragon Ball', platform: 'tv', sender: 'ProSieben MAXX', time: '17:05', episode: 78 }),
  T(TAG, { name: 'Dragon Ball', platform: 'tv', sender: 'ProSieben MAXX', time: '17:30', episode: 79 }),
  T(TAG, { name: 'YAIBA: Samurai Legend', platform: 'joyn', time: '18:50', episode: 9, episodeCount: 24 }),
  T(TAG, { name: 'ONE PIECE', platform: 'tv', sender: 'ProSieben MAXX', time: '18:50', episode: 788, estimated: true }),
  T(TAG, { name: 'The Iceblade Sorcerer Shall Rule the World II', platform: 'crunchyroll', time: '19:05', episode: 4, estimated: true }),
  T(TAG, { name: 'The Ramparts of Ice: Staffel 2', platform: 'netflix', episode: 8, episodeCount: 12 }),
  T(TAG, { name: 'Naruto Shippuden: The Movie', platform: 'disc', releaseType: 'disc' }),
  T(TAG, { name: 'Wolf Girl & Black Prince', platform: 'primevideo', releaseType: 'batch', episodeCount: 12, imAngebot: true }),
  T('2026-11-20', { name: 'Morgen', platform: 'netflix', time: '08:00', episode: 1 }),
]

test('kalenderHeute: eine Zeile je Titel und Anbieter, Zeit zuerst, ohne Uhrzeit danach; Disc, Im-Angebot und andere Tage fehlen', () => {
  expect(kalenderHeute(ECHT, TAG).map(kalenderZeilenText)).toEqual([
    '09:50 Super Wings · Super RTL · F62–63',
    '10:50 Super Wings · TOGGO plus · F62–63',
    '17:05 Dragon Ball · ProSieben MAXX · F78–79',
    '≈18:50 ONE PIECE · ProSieben MAXX · F788',
    '18:50 YAIBA: Samurai Legend · Joyn · F9',
    '≈19:05 The Iceblade Sorcerer Shall Rule the World II · Crunchyroll · F4',
    'The Ramparts of Ice: Staffel 2 · Netflix · F8',
  ])
  expect(kalenderHeute(ECHT, '2026-11-21')).toEqual([])
})

test('kalenderHeute: gleicher Titel bei zwei Sendern bleibt getrennt; timeEstimated zählt wie estimated; Batch ohne Nummer nennt die Zahl', () => {
  const z = kalenderHeute(
    [T(TAG, { name: 'A', platform: 'tv', sender: 'X', time: '08:00', timeEstimated: true, episode: 1 }), T(TAG, { name: 'A', platform: 'tv', sender: 'Y', time: '07:00', episode: 1 }), T(TAG, { name: 'B', platform: 'netflix', releaseType: 'batch', episodeCount: 12 })],
    TAG
  )
  expect(z.map(kalenderZeilenText)).toEqual(['07:00 A · Y · F1', '≈08:00 A · X · F1', 'B · Netflix · alle 12 Folgen'])
})

test('folgenText und anbieterName', () => {
  expect(folgenText([63, 62, 62])).toBe('F62–63')
  expect(folgenText([1, 3])).toBe('F1, F3')
  expect(folgenText([1, 3, 5, 7])).toBe('4 Folgen')
  expect(folgenText([], 12)).toBe('alle 12 Folgen')
  expect(folgenText([])).toBe('')
  expect(anbieterName('tv', 'Super RTL')).toBe('Super RTL')
  expect(anbieterName('primevideo')).toBe('Prime Video')
  expect(anbieterName('neu')).toBe('neu')
})

test('heuteBerlin: Berliner Tag, nicht der UTC-Tag; Winter- und Sommerzeit', () => {
  expect(heuteBerlin(Date.parse('2026-11-19T22:59:00Z'))).toBe('2026-11-19')
  expect(heuteBerlin(Date.parse('2026-11-19T23:00:00Z'))).toBe('2026-11-20')
  expect(heuteBerlin(Date.parse('2026-07-19T21:59:00Z'))).toBe('2026-07-19')
  expect(heuteBerlin(Date.parse('2026-07-19T22:00:00Z'))).toBe('2026-07-20')
})

test('wocheDeckt und termineAusDatei: Wochen-Objekt gegen flache Liste', () => {
  expect(wocheDeckt({ von: '2026-11-16', bis: '2026-11-22' }, '2026-11-22')).toBe(true)
  expect(wocheDeckt({ von: '2026-11-16', bis: '2026-11-22' }, '2026-11-23')).toBe(false)
  expect(wocheDeckt({}, '2026-11-19')).toBe(false)
  expect(termineAusDatei('{"von":"a","bis":"b","events":[]}')).toEqual({ von: 'a', bis: 'b', events: [] })
  expect(termineAusDatei('[{"date":"x"}]')).toEqual({ events: [{ date: 'x' }] })
})

// Attrappe der Dateien: je Pfad Inhalt und mtime; zählt Lesungen.
function dateien(inhalt: Record<string, { text: string; mtime: number }>) {
  const gelesen: string[] = []
  return {
    gelesen,
    stat: async (p: string) => {
      const d = inhalt[p]
      if (!d) throw new Error('fehlt')
      return { mtimeMs: d.mtime, size: d.text.length }
    },
    read: async (p: string) => {
      gelesen.push(p)
      return inhalt[p]!.text
    },
  }
}
const WOCHE = (events: KalenderTermin[]) => JSON.stringify({ von: '2026-11-16', bis: '2026-11-22', events })
const MITTAG = Date.parse('2026-11-19T11:00:00Z')

test('ladeKalender: liest nur bei geänderter Datei neu; Tageswechsel zeigt den neuen Tag ohne Lesung', async () => {
  const d = dateien({ [WOCHE_DATEI]: { text: WOCHE(ECHT), mtime: 1 } })
  const cache = {}
  expect((await ladeKalender(d, MITTAG, cache)).zeilen).toHaveLength(7)
  await ladeKalender(d, MITTAG, cache)
  expect(d.gelesen).toEqual([WOCHE_DATEI])
  const morgen = await ladeKalender(d, Date.parse('2026-11-19T23:30:00Z'), cache)
  expect(morgen).toMatchObject({ datum: '2026-11-20' })
  expect(morgen.zeilen.map(kalenderZeilenText)).toEqual(['08:00 Morgen · Netflix · F1'])
  expect(d.gelesen).toEqual([WOCHE_DATEI])
  const neu = { [WOCHE_DATEI]: { text: WOCHE([T(TAG, { name: 'Neu', platform: 'netflix', episode: 1 })]), mtime: 2 } }
  const d2 = dateien(neu)
  expect((await ladeKalender(d2, MITTAG, cache)).zeilen.map(kalenderZeilenText)).toEqual(['Neu · Netflix · F1'])
})

test('ladeKalender: heute außerhalb der Woche → events.json; Lesefehler lässt den letzten Stand stehen', async () => {
  const d = dateien({ [WOCHE_DATEI]: { text: WOCHE([]), mtime: 1 }, [EVENTS_DATEI]: { text: JSON.stringify(ECHT), mtime: 1 } })
  const cache = {}
  const s = await ladeKalender(d, Date.parse('2026-11-19T11:00:00Z') + 4 * 86_400_000, cache)
  expect(s).toEqual({ datum: '2026-11-23', zeilen: [] })
  expect(d.gelesen).toEqual([WOCHE_DATEI, EVENTS_DATEI])
  const events = await ladeKalender(d, MITTAG + 4 * 86_400_000, cache)
  expect(events.zeilen).toEqual([])
  expect(await ladeKalender(dateien({ [WOCHE_DATEI]: { text: '', mtime: 1 } }), MITTAG, {})).toEqual({ datum: '2026-11-19', zeilen: [] })
  const kaputt = dateien({})
  const behalten = { [WOCHE_DATEI]: { stempel: '1:1', daten: termineAusDatei(WOCHE(ECHT)) } }
  expect((await ladeKalender(kaputt, MITTAG, behalten)).zeilen).toHaveLength(7)
})

// Die Test-Uhr startet bei 0: erst auf den Mittag des 19.11.2026 vorstellen, dann starten.
async function paneMitKalender($: any, on: any, woche: string, start = MITTAG) {
  const uhr = starte(on, null, [], true, STAND)
  kalenderWelt.woche = woche
  await uhr.advance(start)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  return { uhr, p: await $.ui.mount({ ...PANE, surface: 'terminal' }) }
}

test('Pane: „Kalender heute“ mit Anzahl, Zeilen, Einklappen; „Gerade in Arbeit“ gibt es nicht', async ($, on) => {
  const { p } = await paneMitKalender($, on, WOCHE(ECHT))
  const z = zeilen(await p.drawn())
  expect(z).toContain('▾ Kalender heute 7')
  expect(z).toContain('  09:50 Super Wings · Super RTL · F62–63')
  expect(z).toContain('  ≈18:50 ONE PIECE · ProSieben MAXX · F788')
  expect(z.join('\n')).not.toContain('Gerade in Arbeit')
  expect(z.join('\n')).not.toContain('Naruto')
  await p.press({ key: 'bereich:kalender' })
  const zu = zeilen(await p.drawn())
  expect(zu).toContain('▸ Kalender heute 7')
  expect(zu).not.toContain('  09:50 Super Wings · Super RTL · F62–63')
  await p.unmount()
})

test('Pane: lange Liste ist gekürzt und klappt über „weitere“ aus; ohne Termine kein Bereich', async ($, on) => {
  const viele = Array.from({ length: 9 }, (_, i) => T(TAG, { name: `Titel ${i}`, platform: 'netflix', time: `0${i}:00`, episode: 1 }))
  const { p } = await paneMitKalender($, on, WOCHE(viele))
  let z = zeilen(await p.drawn())
  expect(z).toContain('▾ Kalender heute 9')
  expect(z).toContain('  00:00 Titel 0 · Netflix · F1')
  expect(z).not.toContain('  08:00 Titel 8 · Netflix · F1')
  await p.press({ key: 'mehr:kalender' })
  z = zeilen(await p.drawn())
  expect(z).toContain('  08:00 Titel 8 · Netflix · F1')
  await p.unmount()
})

test('Pane: ohne Termine heute kein Bereich', async ($, on) => {
  const { p } = await paneMitKalender($, on, WOCHE([]))
  expect(zeilen(await p.drawn()).join('\n')).not.toContain('Kalender heute')
  await p.unmount()
})

test('Pane: Änderung der Datei und Tageswechsel erscheinen im Takt, ohne Neustart', async ($, on) => {
  // 22:58 UTC ist in Berlin noch der 19., ab 23:00 UTC der 20.
  const { uhr, p } = await paneMitKalender($, on, WOCHE(ECHT), Date.parse('2026-11-19T22:58:00Z'))
  expect(zeilen(await p.drawn())).toContain('▾ Kalender heute 7')
  kalenderWelt.woche = WOCHE([...ECHT, T(TAG, { name: 'Nachträglich', platform: 'netflix', time: '23:00', episode: 1 })])
  kalenderWelt.mtime = 2
  await uhr.advance(30_000)
  expect(zeilen(await p.drawn())).toContain('▾ Kalender heute 8')
  await uhr.advance(90_000)
  const z = zeilen(await p.drawn())
  expect(z).toContain('▾ Kalender heute 1')
  expect(z).toContain('  08:00 Morgen · Netflix · F1')
  await p.unmount()
})
