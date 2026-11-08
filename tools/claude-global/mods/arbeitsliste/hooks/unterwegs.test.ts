import { test, expect } from 'claude-code/testing'

import { PANE, STAND, zeilen, starte } from './testhilfe'
import { alterMin, dauerMin, dauerText, haengt, kurzDauer, labelText, langsam, seitText, zaehleUnterwegs } from './unterwegs'

// Feste Uhr: 08.11.2026 15:00 Ortszeit.
const JETZT = new Date(2026, 10, 8, 15, 0).getTime()
const KOPF = '## Titel unterwegs (Zeilen `- [Status TT.MM. HH:MM] Titel SxEy — …`)'
// Wörtlich aus daniel-zum-abarbeiten/stand.md (08.11.2026): Info-Zeit fehlt, Start ist „im Bestand“.
const BLACK_CLOVER = '- [Live 08.11. 14:38] Black Clover S2E1 — de Synchro seit 07.11.2026 (Crunchyroll) · im Bestand 07.11. 20:29 · live gemessen 08.11. 14:38 (Info-Zeit vor diesem Bereich, nicht erfasst)'
const ein = (...zeilen: string[]) => [KOPF, ...zeilen, '', '## Daniel-Todo', '- 🔴 fremd [Live 08.11. 14:00] x', ''].join('\n')
const erster = (zeile: string, jetzt = JETZT) => zaehleUnterwegs(ein(zeile), jetzt)[0]!

test('Black Clover wörtlich: Live, Titel, Anbieter-Text, Dauer Bestand → live 18 h 9 min und damit rot', () => {
  const e = erster(BLACK_CLOVER, new Date(2026, 10, 8, 14, 40).getTime())
  expect(e.status).toBe('Live')
  expect(e.titel).toBe('Black Clover S2E1')
  expect(e.meta).toBe('de Synchro seit 07.11.2026 (Crunchyroll)')
  expect(labelText(e)).toBe('Live 08.11. 14:38')
  expect(dauerMin(e)).toBe(18 * 60 + 9)
  expect(dauerText(e)).toBe('Bestand → live 18 h 9 min')
  expect(langsam(e)).toBe(true)
  expect(haengt(e, JETZT)).toBe(false)
  expect(seitText(e, JETZT)).toBe('')
})

test('Zeilenform des Auftrags mit Info-Zeit: Dauer Info → live, genau 5 min grün, 6 min rot', () => {
  const zeile = (live: string) => `- [Live 08.11. 14:50] Titel S1E2 — de Synchro seit 08.11.2026 (Netflix) · Info 08.11. 14:00 · live ${live}`
  const fuenf = erster(zeile('08.11. 14:05'))
  expect(fuenf.startArt).toBe('Info')
  expect(dauerText(fuenf)).toBe('Info → live 5 min')
  expect(langsam(fuenf)).toBe(false)
  expect(langsam(erster(zeile('08.11. 14:06')))).toBe(true)
  expect(dauerMin(erster(zeile('08.11. 13:59')))).toBeNull()
  expect(dauerMin(erster('- [Pipeline 08.11. 14:50] Titel — x · Info 08.11. 14:00'))).toBeNull()
  // Info schlägt „im Bestand“ als Start
  expect(erster('- [Live 08.11. 14:50] T — x · im Bestand 08.11. 14:30 · Info 08.11. 14:00 · live 08.11. 14:02').start).toBe(new Date(2026, 10, 8, 14, 0).getTime())
})

// Schwellen: genau die Schwelle ist grün, eine Minute mehr rot (Zeiten wörtlich bei Jetzt 15:00).
const SCHWELLEN: [string, string, string][] = [
  ['Info', '14:45', '14:44'],
  ['Queue', '14:45', '14:44'],
  ['In Arbeit', '14:00', '13:59'],
  ['Pipeline', '14:30', '14:29'],
]
for (const [status, genau, drueber] of SCHWELLEN) {
  test(`Schwelle ${status}: genau grün, eine Minute mehr rot`, () => {
    expect(haengt(erster(`- [${status} 08.11. ${genau}] T — x`), JETZT)).toBe(false)
    expect(haengt(erster(`- [${status} 08.11. ${drueber}] T — x`), JETZT)).toBe(true)
  })
}

test('Statuserkennung: Live hängt nie, unbekanntes Wort ist rot, Groß-/Kleinschreibung zählt', () => {
  expect(haengt(erster('- [Live 07.11. 10:00] T — x'), JETZT)).toBe(false)
  expect(haengt(erster('- [Fertig 08.11. 14:59] T — x'), JETZT)).toBe(true)
  expect(haengt(erster('- [pipeline 08.11. 14:59] T — x'), JETZT)).toBe(true)
  expect(erster('- [In Arbeit 08.11. 14:59] T — x').status).toBe('In Arbeit')
})

test('Alter: „seit 2 h 10 min“, Minuten abgerundet, nie negativ; kurzDauer an den Grenzen', () => {
  const e = erster('- [Queue 08.11. 12:50] T — x')
  expect(alterMin(e, JETZT)).toBe(130)
  expect(seitText(e, JETZT)).toBe('seit 2 h 10 min')
  expect(seitText(erster('- [Info 08.11. 14:59] T — x'), JETZT + 59_000)).toBe('seit 1 min')
  expect(alterMin(erster('- [Info 08.11. 14:59] T — x'), JETZT - 5 * 60_000)).toBe(0)
  expect([0, 59, 60, 61, 1439, 1440, 1500].map(kurzDauer)).toEqual(['0 min', '59 min', '1 h 0 min', '1 h 1 min', '23 h 59 min', '1 d 0 h', '1 d 1 h'])
})

test('Zeitstempel ohne Jahr: jüngstes Jahr nicht nach jetzt; ungültiges Datum fällt weg', () => {
  const e = erster('- [Info 31.12. 23:00] T — x · Info 31.12. 22:00')
  expect(new Date(e.seit).getFullYear()).toBe(2025)
  expect(new Date(e.start!).getFullYear()).toBe(2025)
  expect(new Date(erster('- [Info 08.11. 15:00] T — x').seit).getFullYear()).toBe(2026)
  expect(zaehleUnterwegs(ein('- [Info 31.02. 10:00] T — x', '- [Info 08.11. 25:00] T — x'), JETZT)).toEqual([])
})

test('Abschnittsgrenzen: nur Zeilen unter der Überschrift bis zum nächsten „## “; Unlesbares und Nachbarn fallen weg', () => {
  const text = ['## Neu und live testbar', '- [Live 08.11. 14:00] davor — x', ein('- [Info 08.11. 14:50] Eins — a', 'Fließtext', '- ohne Kopf', '- [Info 08.11. 14:51] Zwei — b'), '## Später', '- [Info 08.11. 14:55] danach — x'].join('\n')
  expect(zaehleUnterwegs(text, JETZT).map(e => e.titel)).toEqual(['Eins', 'Zwei'])
  expect(zaehleUnterwegs('', JETZT)).toEqual([])
  expect(zaehleUnterwegs(ein('- [Info 08.11. 14:50] Crlf — a').replace(/\n/g, '\r\n'), JETZT).map(e => e.titel)).toEqual(['Crlf'])
})

test('Live-Zeilen: genau 2 Tage bleiben, eine Minute mehr fällt weg; andere Status bleiben immer', () => {
  const live = '- [Live 06.11. 15:00] Alt — x'
  expect(zaehleUnterwegs(ein(live), JETZT)).toHaveLength(1)
  expect(zaehleUnterwegs(ein(live), JETZT + 60_000)).toHaveLength(0)
  expect(zaehleUnterwegs(ein('- [Pipeline 06.11. 15:00] Alt — x'), JETZT + 60_000)).toHaveLength(1)
})

test('Lebenslauf einer erfundenen Meldung: Info → Pipeline → Live, jeder Wechsel setzt den Zeitstempel neu', () => {
  const zeile = (status: string, stempel: string, rest = '') => `- [${status} ${stempel}] Testtitel S1E1 — de Synchro seit 08.11.2026 (Testanbieter) · Info 08.11. 14:00${rest}`
  const um = (std: number, min: number) => new Date(2026, 10, 8, std, min).getTime()
  const a = zaehleUnterwegs(ein(zeile('Info', '08.11. 14:00')), um(14, 10))[0]!
  expect([a.status, haengt(a, um(14, 10)), haengt(a, um(14, 16))]).toEqual(['Info', false, true])
  const b = zaehleUnterwegs(ein(zeile('Pipeline', '08.11. 14:20')), um(14, 40))[0]!
  expect([b.status, seitText(b, um(14, 40)), haengt(b, um(14, 40))]).toEqual(['Pipeline', 'seit 20 min', false])
  expect(haengt(b, um(14, 51))).toBe(true)
  const c = zaehleUnterwegs(ein(zeile('Live', '08.11. 14:50', ' · live 08.11. 14:50')), um(14, 55))[0]!
  expect([c.status, haengt(c, um(23, 0)), dauerText(c), langsam(c)]).toEqual(['Live', false, 'Info → live 50 min', true])
})

// Pane: Wegwerf-Stempel „01.01. 00:00“ liegt immer weit zurück (Live fällt weg, Pipeline hängt), ohne die echte Uhr zu lesen.
const MIT_ABSCHNITT = `# Stand\n\n## Daniel-Todo\n### Jetzt\n- 🔴 **Dringend** Text\n\n${KOPF}\n- [Pipeline 01.01. 00:00] Pane-Titel S1E1 — de Synchro seit 01.01.2026 (Anbieter) · Info 01.01. 00:00 · live 01.01. 00:10\n- [Queue 01.01. 00:00] Schnell S1E1 — x · Info 01.01. 00:00 · live 01.01. 00:03\n- [Live 01.01. 00:00] Alter Live — x\n- [Fertig 01.01. 00:00] Fremdstatus — x\n\n## In Arbeit (Stand 08.11.2026 12:00)\n- **Nur eins**\n`

test('Pane: Bereich direkt unter „Jetzt“, Label mit Zeitstempel, hängend rot, altes Live fehlt, unbekannter Status mit „?“', async ($, on) => {
  starte(on, null, [], true, MIT_ABSCHNITT)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const p = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const gezeichnet = await p.drawn()
  const z = zeilen(gezeichnet)
  const kopf = z.indexOf('Titel unterwegs')
  expect(kopf).toBeGreaterThan(z.findIndex(s => s.includes('Jetzt')))
  expect(z[kopf - 1]).toContain('Dringend')
  expect(z[kopf + 1]).toMatch(/^ Pipeline 01\.01\. 00:00  Pane-Titel S1E1 · de Synchro seit 01\.01\.2026 \(Anbieter\) · seit \d{3} d \d+ h · Info → live 10 min$/)
  expect(z[kopf + 2]).toMatch(/^ Queue 01\.01\. 00:00  Schnell S1E1 · x · seit \d{3} d \d+ h · Info → live 3 min$/)
  expect(z[kopf + 3]).toContain(' ?Fertig 01.01. 00:00 ')
  expect(z.join('\n')).not.toContain('Alter Live')
  // Farben einzeln: Alter hängend rot, Dauer 10 min rot, Dauer 3 min nicht
  expect(farbeVon(gezeichnet, ' · seit ')).toEqual(['error', 'error', 'error'])
  expect(farbeVon(gezeichnet, ' · Info → live 10 min')).toEqual(['error'])
  expect(farbeVon(gezeichnet, ' · Info → live 3 min')).toEqual([undefined])
  await p.unmount()
})

// Farbe (Prop `color`) aller Text-Knoten, deren Text mit `anfang` beginnt.
function farbeVon(knoten: unknown, anfang: string, aus: (string | undefined)[] = []): (string | undefined)[] {
  if (!knoten || typeof knoten !== 'object') return aus
  const k = knoten as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  const kinder = k.children ?? (k.props?.children as unknown[] | undefined) ?? []
  const liste = Array.isArray(kinder) ? kinder : [kinder]
  if (k.type === 'Text' && typeof liste[0] === 'string' && liste[0].startsWith(anfang)) aus.push(k.props?.color as string | undefined)
  for (const c of liste) farbeVon(c, anfang, aus)
  return aus
}

test('Pane: ohne Abschnitt keine Überschrift und kein Fehler', async ($, on) => {
  starte(on, null, [], true, STAND)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const p = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(zeilen(await p.drawn())).not.toContain('Titel unterwegs')
  await p.unmount()
})
