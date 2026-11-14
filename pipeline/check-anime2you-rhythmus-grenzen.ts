/**
 * Direkte Grenzfälle zu `pipeline/lib/anime2you-rhythmus.ts` (der Artikelfall steht in `check-anime2you-rhythmus.ts`):
 * `leseRhythmus` nimmt nur [von, bis] mit ganzen Zahlen 1–20 (von ≤ bis) und einen Tag JJJJ-MM-TT; `pruefeRhythmus` verlangt
 * Takt-Wort, die Spanne im Satz bzw. Nebensatz des Takt-Worts (Zahlwort oder Ziffer, Einzelzahl als von = bis), das Enddatum
 * im Zitat und kein Ende vor dem Artikel. Tage und „13-teilig“ zählen nicht als Folgenzahl. Läuft in `check:logic`.
 */
import { leseRhythmus, pruefeRhythmus } from './lib/anime2you-rhythmus.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const FORM = 'rhythmus: proWoche muss [von, bis] mit ganzen Zahlen von 1 bis 20 sein'
const TAG = 'rhythmus: bis muss ein Tag (JJJJ-MM-TT) sein'
const BIS = '2026-10-30'

// leseRhythmus
pruefe('gültig', leseRhythmus({ proWoche: [3, 4], bis: BIS }), { proWoche: [3, 4], bis: BIS })
pruefe('Grenzen 1 und 20, fremde Felder fallen weg', leseRhythmus({ proWoche: [1, 20], bis: BIS, x: 1 }), { proWoche: [1, 20], bis: BIS })
pruefe('von > bis', leseRhythmus({ proWoche: [4, 3], bis: BIS }), FORM)
pruefe('0 zu klein', leseRhythmus({ proWoche: [0, 3], bis: BIS }), FORM)
pruefe('21 zu groß', leseRhythmus({ proWoche: [1, 21], bis: BIS }), FORM)
pruefe('Bruch', leseRhythmus({ proWoche: [1.5, 2], bis: BIS }), FORM)
pruefe('drei Werte', leseRhythmus({ proWoche: [1, 2, 3], bis: BIS }), FORM)
pruefe('Zeichenkette', leseRhythmus({ proWoche: '3', bis: BIS }), FORM)
pruefe('Zahlen als Text', leseRhythmus({ proWoche: ['3', '4'], bis: BIS }), FORM)
pruefe('fehlendes proWoche', leseRhythmus({ bis: BIS }), FORM)
pruefe('deutsches Datum', leseRhythmus({ proWoche: [3, 4], bis: '30.10.2026' }), TAG)
pruefe('fehlendes bis', leseRhythmus({ proWoche: [3, 4] }), TAG)

// pruefeRhythmus
const r = (von: number, bis: number, ende = BIS) => ({ proWoche: [von, bis] as [number, number], bis: ende })
const Z = 'Ab dem 2. Oktober erscheinen bis 30.10. wöchentlich drei bis vier weitere Folgen.'
pruefe('Zahlwort-Spanne', pruefeRhythmus(r(3, 4), Z, '2026-10-01'), undefined)
pruefe('Ende am Artikeltag ist erlaubt', pruefeRhythmus(r(3, 4), Z, BIS), undefined)
pruefe('Ende vor dem Artikel', pruefeRhythmus(r(3, 4), Z, '2026-10-31'), 'Enddatum liegt vor dem Artikeldatum')
pruefe('Einzelzahl trifft keine Spanne', pruefeRhythmus(r(3, 3), Z, '2026-10-01'), 'rhythmus: 3–3 Folgen je Woche stehen nicht im Satz mit dem Takt-Wort')
pruefe('anderes Enddatum', pruefeRhythmus(r(3, 4, '2026-10-31'), Z, '2026-10-01'), 'Enddatum 2026-10-31 steht nicht im Zitat')
pruefe('ohne Takt-Wort', pruefeRhythmus(r(3, 4), 'Bis 30.10. erscheinen drei bis vier Folgen.', '2026-10-01'), 'rhythmus, aber das Zitat nennt keinen wöchentlichen Takt')
pruefe('Ziffern mit Halbgeviertstrich', pruefeRhythmus(r(3, 4), 'Bis zum 30. Oktober 2026 kommen wöchentlich 3–4 Folgen.', '2026-10-01'), undefined)
pruefe('Tag ist keine Folgenzahl', pruefeRhythmus(r(30, 30), 'Bis zum 30. Oktober 2026 kommen wöchentlich Folgen.', '2026-10-01'), 'rhythmus: 30–30 Folgen je Woche stehen nicht im Satz mit dem Takt-Wort')

const TEILIG = 'Die 13-teilige Serie läuft bis 30.10., jeden Freitag zwei Folgen.'
pruefe('„jeden Freitag“ ist Takt, Zahlwort als Einzelzahl', pruefeRhythmus(r(2, 2), TEILIG, '2026-10-01'), undefined)
pruefe('„13-teilig“ ist keine Folgenzahl', pruefeRhythmus(r(13, 13), TEILIG, '2026-10-01'), 'rhythmus: 13–13 Folgen je Woche stehen nicht im Satz mit dem Takt-Wort')
const TEILIG_EIN_SATZ = 'Die 13-teilige Serie kommt jeden Freitag mit zwei Folgen bis 30.10.'
pruefe('„13-teilig“ im selben Teilsatz ist keine Folgenzahl', pruefeRhythmus(r(13, 13), TEILIG_EIN_SATZ, '2026-10-01'), 'rhythmus: 13–13 Folgen je Woche stehen nicht im Satz mit dem Takt-Wort')

// Satzgrenze: die Zahl muss im Satz mit dem Takt-Wort stehen, das Datum darf überall im Zitat stehen.
pruefe('Ende im Nachbarsatz', pruefeRhythmus(r(1, 1), 'Ab sofort pro Woche eine Folge. Ende ist am 30.10.', '2026-10-01'), undefined)
pruefe('Zahl nur im Nachbarsatz', pruefeRhythmus(r(3, 3), 'Es gibt drei Folgen. Sie laufen wöchentlich bis 30.10.', '2026-10-01'), 'rhythmus: 3–3 Folgen je Woche stehen nicht im Satz mit dem Takt-Wort')

// Nebensatz: nennt der Teil mit dem Takt-Wort eine Zahl, zählt nur er; sonst der ganze Satz.
const NEBEN = 'Bis 30.10. kommen 12 Folgen insgesamt, wöchentlich zwei.'
pruefe('Nebensatz mit Zahl: dessen Zahl gilt', pruefeRhythmus(r(2, 2), NEBEN, '2026-10-01'), undefined)
pruefe('Nebensatz mit Zahl: Zahl davor zählt nicht', pruefeRhythmus(r(12, 12), NEBEN, '2026-10-01'), 'rhythmus: 12–12 Folgen je Woche stehen nicht im Satz mit dem Takt-Wort')
pruefe('Nebensatz ohne Zahl: ganzer Satz', pruefeRhythmus(r(3, 3), 'Bis 30.10. gibt es drei Folgen, und zwar wöchentlich.', '2026-10-01'), undefined)

if (fehler) {
  console.error(`check-anime2you-rhythmus-grenzen: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-anime2you-rhythmus-grenzen: alle Zusicherungen grün')
