import { test, expect } from 'claude-code/testing'

import { STATUS, hatAusklapp, statusVon, textKlappt, zaehleTopPrios } from './prios'

const T = '# Stand\n\n## Top-Prios\n- **D1** {arbeit-agent} Zuordner nachgebessert [Plan](https://x.org/a)\n- **Speed** {live} Vorprüfung\n  - Detail eins\n  Detail zwei [Bericht](file:///C:/x/b.md)\nText\n\n## Anderes\n- **Nein** {live} nicht\n'

test('zaehleTopPrios: Titel, Status, Kurztext ohne Linktext, Links; nur dieser Abschnitt', () => {
  const v = zaehleTopPrios(T)
  expect(v.map(e => [e.titel, e.status, e.rest])).toEqual([['D1', 'arbeit-agent', 'Zuordner nachgebessert'], ['Speed', 'live', 'Vorprüfung']])
  expect(v[0]!.links.map(l => l.href)).toEqual(['https://x.org/a'])
})

test('zaehleTopPrios: eingerückte Zeilen sind Details, ihre Links kommen in die Knopfzeile', () => {
  const s = zaehleTopPrios(T)[1]!
  expect(s.details).toEqual(['Detail eins', 'Detail zwei'])
  expect(s.links.map(l => l.label)).toEqual(['Bericht'])
})

test('zaehleTopPrios: ohne Abschnitt leer', () => {
  expect(zaehleTopPrios('# Stand\n## In Arbeit\n- **x** {live} y\n')).toEqual([])
  expect(zaehleTopPrios('')).toEqual([])
})

test('Status: alle sieben bekannt; unbekanntes Wort sichtbar rot; fehlender Status (Altzeile) ohne Chip', () => {
  expect(Object.keys(STATUS)).toEqual(['queue', 'arbeit-agent', 'arbeit-ich', 'pipeline', 'live', 'wartet-daniel', 'blockiert'])
  expect(statusVon('live')).toEqual({ label: 'LIVE', farbe: 'success' })
  expect(statusVon('fertig')).toEqual({ label: '?fertig', farbe: 'error' })
  const [ohne, zeile] = zaehleTopPrios('## Top-Prios\n- **Ohne** Text\n- Nur Zeile ohne Fett\n')
  expect(ohne!.status).toBe('')
  expect(statusVon(ohne!.status)).toBeNull()
  expect(zeile!.titel).toBe('Nur Zeile ohne Fett')
})

test('Länge: höchstens vier Zeilen; länger klappt der Kurztext weg, Details klappen immer', () => {
  const kurz = zaehleTopPrios('## Top-Prios\n- **A** {queue} ' + 'x'.repeat(100) + '\n')[0]!
  expect(textKlappt(kurz, 40)).toBe(false)
  expect(textKlappt(kurz, 20)).toBe(true)
  expect(hatAusklapp(kurz, 40)).toBe(false)
  const mit = zaehleTopPrios('## Top-Prios\n- **A** {queue} kurz\n  Detail\n')[0]!
  expect(hatAusklapp(mit, 40)).toBe(true)
})

test('Länge: genau vier Zeilen passen, fünf klappen', () => {
  const mit = (n: number) => zaehleTopPrios('## Top-Prios\n- **A** {queue} ' + 'x'.repeat(n) + '\n')[0]!
  expect(textKlappt(mit(30), 10)).toBe(false)
  expect(textKlappt(mit(31), 10)).toBe(true)
})

test('Zeile ohne Status-Klammer behält Titel und Kurztext', () => {
  const e = zaehleTopPrios('## Top-Prios\n- **Ohne** — Text dazu\n')[0]!
  expect([e.titel, e.rest, e.status]).toEqual(['Ohne', 'Text dazu', ''])
})
