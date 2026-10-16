import { test, expect } from 'claude-code/testing'

import { STATUS, hatAusklapp, prioZeichenJeZeile, statusVon, textKlappt, zaehleTopPrios, zeichenJeSpalte } from './prios'
import { STAND_ALTFORMAT } from './stand-altformat'

const T = '# Stand\n\n## Top-Prios\n- **D1** {arbeit-agent} Zuordner nachgebessert — [Plan](https://x.org/a)\n- **Speed** {live} Vorprüfung\n  - Detail eins\n  Detail zwei — [Bericht](file:///C:/x/b.md)\nText\n\n## Anderes\n- **Nein** {live} nicht\n'

test('zaehleTopPrios: Titel, Status, Kurztext ohne Knopfreihe am Ende, Links; nur dieser Abschnitt', () => {
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

test('Status wird getrimmt', () => {
  expect(zaehleTopPrios('## Top-Prios\n- **A** { live } x\n')[0]!.status).toBe('live')
})

test('Linktext bleibt im Satz; nur eine Reihe nach „ — “ am Ende ist reiner Knopf', () => {
  const v = zaehleTopPrios('## Top-Prios\n- **A** {live} siehe [Plan](https://x.org/a) dort, Berichte: [B](https://x.org/b), [C](https://x.org/c)\n- **B** {live} Text — [Plan](https://x.org/a) [Bericht](https://x.org/b)\n')
  expect(v[0]!.rest).toBe('siehe Plan dort, Berichte: B, C')
  expect(v[0]!.links.length).toBe(3)
  expect(v[1]!.rest).toBe('Text')
  expect(v[1]!.links.length).toBe(2)
})

test('Detailzeile: Linktext bleibt, reine Knopfzeile wird kein leeres Detail', () => {
  const e = zaehleTopPrios('## Top-Prios\n- **A** {live} x\n  - Detail [Karte](https://x.org/k)\n  - — [Nur Knopf](https://x.org/n)\n')[0]!
  expect(e.details).toEqual(['Detail Karte'])
  expect(e.links.map(l => l.label)).toEqual(['Karte', 'Nur Knopf'])
})

test('echte stand.md im Altformat: Satz bleibt lesbar, Linktexte stehen, kein Chip, keine Leerklammern', () => {
  const v = zaehleTopPrios(STAND_ALTFORMAT)
  expect(v.map(e => e.titel)).toEqual(['D1', 'Speed (Kleinigkeit in unter 5 min live)', 'Unzuordenbare Folgen'])
  expect(v.every(e => e.status === '' && statusVon(e.status) === null)).toBe(true)
  expect(v[1]!.rest).toContain('Berichte: Engpass, Gegenentwurf')
  expect(v[2]!.rest).toContain('geklärt (Bericht)')
  for (const e of v) expect(`${e.titel} ${e.rest}`).not.toMatch(/\(\s*\)|:\s*[,.]|,\s*$/)
  expect(v.map(e => e.links.length)).toEqual([0, 2, 1])
})

test('Breite: Zeichen je Zeile aus Spalten und Oberfläche', () => {
  expect(zeichenJeSpalte('terminal')).toBe(1)
  expect(zeichenJeSpalte('desktop')).toBe(1.6)
  expect(prioZeichenJeZeile(80, 'terminal')).toBe(72)
  expect(prioZeichenJeZeile(80, 'desktop')).toBe(115)
  expect(prioZeichenJeZeile(0, 'terminal')).toBe(30)
  expect(prioZeichenJeZeile(10, 'terminal')).toBe(16)
})

test('Knopfreihe gilt nur am Zeilenende; mitten im Satz bleibt der Text samt Strich', () => {
  const e = zaehleTopPrios('## Top-Prios\n- **A** {live} vorher — [L](https://x.org/l) nachher\n')[0]!
  expect(e.rest).toBe('vorher — L nachher')
})

test('Zeile ohne fetten Titel: Knopfreihe am Ende fällt aus dem Titel', () => {
  const e = zaehleTopPrios('## Top-Prios\n- Nur Zeile — [L](https://x.org/l)\n')[0]!
  expect([e.titel, e.links.length]).toEqual(['Nur Zeile', 1])
})

test('Status-Farben: Themenschlüssel je Status (Kontrast in hell und dunkel geprüft 16.10.2026)', () => {
  expect(Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.farbe]))).toEqual({
    queue: 'inactive',
    'arbeit-agent': 'suggestion',
    'arbeit-ich': 'planMode',
    pipeline: 'merged',
    live: 'success',
    'wartet-daniel': 'warning',
    blockiert: 'error',
  })
})
