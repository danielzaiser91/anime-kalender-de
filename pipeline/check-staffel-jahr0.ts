/**
 * Zusicherung: Jahr 0 (aniSearch: Jahr unbekannt, meist eine noch nicht terminierte Fortsetzung) zählt in der Staffelzählung wie „noch offen"
 * und steht hinten, nicht vor der ersten Staffel (11.10.2026: Bookworm, Jujutsu Kaisen Kouhen, Ninja Kamui — 7 von 899 Reihen verschoben).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-staffel-jahr0.ts`
 */
import { ausstrahlungsZeit, staffelStaende } from '../shared/titles.ts'
import { staffelNummern } from './lib/staffel-nummern.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nJahr 0 in der Staffelzählung:')
{
  pruefe('Jahr 0 und fehlendes Jahr sortieren hinter jedem echten Jahr, ein Starttag gilt vor dem Jahr', ausstrahlungsZeit({ jpYear: 0 }) === '9999' && ausstrahlungsZeit({}) === '9999' && ausstrahlungsZeit({ jpYear: 2020 }) === '2020' && ausstrahlungsZeit({ jpStart: '2019-10-03', jpYear: 0 }) === '2019-10-03')
  const reihe = [
    { id: 10022017, name: 'Reihe Fortsetzung', format: 'TV', jpYear: 0 },
    { id: 1, name: 'Reihe', format: 'TV', jpYear: 2019, jpStart: '2019-10-03' },
    { id: 2, name: 'Reihe 2nd Season', format: 'TV', jpYear: 2020, jpStart: '2020-04-05' },
  ]
  const staende = staffelStaende(reihe, 'Reihe')
  pruefe('Zeile mit Jahr 0 ist die letzte Staffel, nicht die erste', staende.get(1)?.staffel === 1 && staende.get(2)?.staffel === 2 && staende.get(10022017)?.staffel === 3, [...staende])
  const nummern = staffelNummern(reihe)
  pruefe('Meldungs-Staffelnummer: die Jahr-0-Zeile verdrängt Staffel 1 nicht', nummern.get(1) === 1 && nummern.get(2) === 2, [...nummern])
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
