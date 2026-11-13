/**
 * Zusicherungen zu `imTagesfenster()` aus `worker/src/push-fenster.ts`: behalten werden Termine vom Berliner Tag vor `von` bis zum
 * Berliner Tag nach `bis`, beide Ränder eingeschlossen, Reihenfolge der Eingabe; die Tage sind Berliner Tage (Winter-, Sommerzeit,
 * Jahreswechsel). Läuft in `check:logic`.
 */
import { imTagesfenster } from '../worker/src/push-fenster.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const termine = (...tage: string[]) => tage.map((date, i) => ({ id: i, date }))
const fenster = (tage: string[], von: string, bis: string) => imTagesfenster(termine(...tage), new Date(von), new Date(bis)).map((t) => t.date)

const NOV = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
pruefe('leer', imTagesfenster([], new Date('2026-11-12T12:00:00Z'), new Date('2026-11-12T13:00:00Z')), [])
pruefe('ein Zeitpunkt: Vortag bis Folgetag', fenster(NOV, '2026-11-12T12:00:00Z', '2026-11-12T12:00:00Z'), ['2026-11-11', '2026-11-12', '2026-11-13'])
pruefe('Spanne über zwei Tage', fenster(NOV, '2026-11-11T08:00:00Z', '2026-11-12T08:00:00Z'), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
pruefe('Reihenfolge der Eingabe', fenster(['2026-11-13', '2026-11-01', '2026-11-11'], '2026-11-12T12:00:00Z', '2026-11-12T12:00:00Z'), ['2026-11-13', '2026-11-11'])

// Winterzeit: 23:30 UTC am 12.11. ist in Berlin der 13.11. — das Fenster reicht vom 12. bis zum 14.
pruefe('Winterzeit: Berliner Tag nach Mitternacht', fenster(NOV, '2026-11-12T23:30:00Z', '2026-11-12T23:30:00Z'), ['2026-11-12', '2026-11-13', '2026-11-14'])
pruefe('Winterzeit: kurz davor', fenster(NOV, '2026-11-12T22:59:59Z', '2026-11-12T22:59:59Z'), ['2026-11-11', '2026-11-12', '2026-11-13'])
// Sommerzeit: 22:30 UTC am 15.07. ist in Berlin der 16.07.
const JUL = ['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18']
pruefe('Sommerzeit: Berliner Tag nach Mitternacht', fenster(JUL, '2026-07-15T22:30:00Z', '2026-07-15T22:30:00Z'), ['2026-07-15', '2026-07-16', '2026-07-17'])
// Jahreswechsel.
pruefe('Jahreswechsel', fenster(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'], '2026-12-31T23:30:00Z', '2026-12-31T23:30:00Z'), ['2026-12-31', '2027-01-01', '2027-01-02'])
// Ende der Sommerzeit (25.10.2026, 25-Stunden-Tag): 24 h zurück bleibt der Berliner Vortag.
pruefe('Ende der Sommerzeit', fenster(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'], '2026-10-26T00:30:00Z', '2026-10-26T00:30:00Z'), ['2026-10-25', '2026-10-26', '2026-10-27'])

// Verglichen wird als Text: ein leeres Datum liegt vor jedem Tag.
pruefe('leeres Datum fällt weg', fenster(['', '2026-11-12'], '2026-11-12T12:00:00Z', '2026-11-12T12:00:00Z'), ['2026-11-12'])

if (fehler) {
  console.error(`check-push-fenster: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-push-fenster: ok')
