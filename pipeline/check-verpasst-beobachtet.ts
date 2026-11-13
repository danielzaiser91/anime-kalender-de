/**
 * Zusicherungen zu `beobachtetAusRelease()` aus `lib/verpasst-beobachtet.ts`: Folgentage aus `schedule.observed` werden Beobachtungen
 * (Folge als Zahl, Reihenfolge der Eingabe), Tage nach dem heutigen Berliner Tag fallen weg, heute bleibt. Die Tagesgrenze ist die
 * Berliner, nicht die UTC-Grenze (Sommer- und Winterzeit). Läuft in `check:logic`.
 */
import { beobachtetAusRelease } from './lib/verpasst-beobachtet.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const observed = { 22: '2026-11-11', 23: '2026-11-12', 24: '2026-11-13', 25: '2026-11-14' }
const tage = (jetzt: string, o: Record<string, string> | undefined = observed) => beobachtetAusRelease(o, new Date(jetzt)).map((b) => `${b.episode}@${b.date}`)

pruefe('ohne observed', beobachtetAusRelease(undefined, new Date('2026-11-12T12:00:00Z')), [])
pruefe('leeres observed', beobachtetAusRelease({}, new Date('2026-11-12T12:00:00Z')), [])
pruefe('Form: Folge als Zahl', beobachtetAusRelease({ 7: '2026-11-01' }, new Date('2026-11-12T12:00:00Z')), [{ date: '2026-11-01', episode: 7 }])
pruefe('heute bleibt, morgen nicht', tage('2026-11-12T12:00:00Z'), ['22@2026-11-11', '23@2026-11-12'])

// Winterzeit (UTC+1): 23:30 UTC am 12.11. ist in Berlin schon der 13.11.
pruefe('Winterzeit: kurz vor Berliner Mitternacht', tage('2026-11-12T22:59:59Z'), ['22@2026-11-11', '23@2026-11-12'])
pruefe('Winterzeit: Berliner Mitternacht', tage('2026-11-12T23:00:00Z'), ['22@2026-11-11', '23@2026-11-12', '24@2026-11-13'])
// Sommerzeit (UTC+2): 22:00 UTC am 15.07. ist in Berlin der 16.07.
const sommer = { 1: '2026-07-15', 2: '2026-07-16' }
pruefe('Sommerzeit: 21:59 UTC', tage('2026-07-15T21:59:59Z', sommer), ['1@2026-07-15'])
pruefe('Sommerzeit: 22:00 UTC', tage('2026-07-15T22:00:00Z', sommer), ['1@2026-07-15', '2@2026-07-16'])
// Jahresgrenze in Berlin vor der UTC-Jahresgrenze.
pruefe('Silvester: Berliner Neujahr', tage('2026-12-31T23:00:00Z', { 1: '2026-12-31', 2: '2027-01-01' }), ['1@2026-12-31', '2@2027-01-01'])
pruefe('Silvester: kurz davor', tage('2026-12-31T22:59:59Z', { 1: '2026-12-31', 2: '2027-01-01' }), ['1@2026-12-31'])

// Alles in der Zukunft: nichts; Nummernfolge der Eingabe (Objektschlüssel als Zahl aufsteigend) bleibt.
pruefe('alles in der Zukunft', tage('2026-11-01T12:00:00Z'), [])
pruefe('Reihenfolge', tage('2026-11-20T12:00:00Z', { 10: '2026-11-03', 2: '2026-11-10', 5: '2026-11-01' }), ['2@2026-11-10', '5@2026-11-01', '10@2026-11-03'])

if (fehler) {
  console.error(`check-verpasst-beobachtet: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-verpasst-beobachtet: ok')
