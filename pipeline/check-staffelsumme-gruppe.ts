/**
 * Zusicherungen zu `lib/staffelsumme-gruppe.ts`: Nummer über die Staffelsumme, Anbieter-Staffeln aus den Meldungen (jüngste lesbare
 * Angabe) und die Fälle, in denen `summeFuerGruppe` gar nicht erst rechnet. Der volle Weg liest Datendateien und bleibt
 * `check-episodentitel.ts` überlassen. Läuft in `check:logic`.
 */
import type { AnbieterStaffel } from './lib/folgenbereiche.ts'
import { leseAnbieterStaffeln, nummerUeberSumme, summeFuerGruppe } from './lib/staffelsumme-gruppe.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const st = (seq: number, folgen: number, erste = 1): AnbieterStaffel => ({ seq, name: `Staffel ${seq}`, folgen, erste })
// Anbieter beginnt bei Staffel 3; Staffel 4 zählt je Staffel neu, Staffel 5 durchgezählt ab 25.
const anbieter = [st(5, 10, 25), st(3, 12), st(4, 12)]

pruefe('erste Staffel des Anbieters', nummerUeberSumme(0, anbieter, 3, 1), 1)
pruefe('Versatz kommt dazu', nummerUeberSumme(26, anbieter, 3, 12), 38)
pruefe('Staffeln davor nach seq, nicht nach Listenplatz', nummerUeberSumme(0, anbieter, 4, 1), 13)
pruefe('durchgezählte Staffel: Stelle ab ihrer ersten Nummer', nummerUeberSumme(0, anbieter, 5, 25), 25)
pruefe('durchgezählte Staffel, letzte Folge', nummerUeberSumme(0, anbieter, 5, 34), 34)
pruefe('unbekannte Staffel', nummerUeberSumme(0, anbieter, 9, 1), null)
pruefe('Staffel null', nummerUeberSumme(0, anbieter, null, 1), null)

const json = (l: unknown) => JSON.stringify(l)
pruefe('keine Meldung mit Angabe', leseAnbieterStaffeln([{}, { staffeln: null }, { staffeln: '' }]), undefined)
pruefe('leere Gruppe', leseAnbieterStaffeln([]), undefined)
pruefe('jüngste (letzte) Angabe gilt', leseAnbieterStaffeln([{ staffeln: json([st(1, 5)]) }, { staffeln: null }, { staffeln: json([st(2, 7)]) }, {}]), [st(2, 7)])
pruefe('unlesbare jüngste Angabe: undefined, nicht die ältere', leseAnbieterStaffeln([{ staffeln: json([st(1, 5)]) }, { staffeln: '{kaputt' }]), undefined)
pruefe('leere Liste: undefined', leseAnbieterStaffeln([{ staffeln: '[]' }]), undefined)
pruefe('kein Array: undefined', leseAnbieterStaffeln([{ staffeln: '{"seq":1}' }]), undefined)
{
  const gruppe = [{ staffeln: json([st(1, 5)]) }, { staffeln: json([st(2, 7)]) }]
  leseAnbieterStaffeln(gruppe)
  pruefe('Gruppe bleibt in ihrer Reihenfolge', gruppe.map((g) => JSON.parse(g.staffeln)[0].seq), [1, 2])
}

const eine = [{ id: 1, titel: 'T', folgen: 24 }]
pruefe('ohne Anbieter-Staffeln: nichts', summeFuerGruppe([], undefined, eine), null)
pruefe('leere Anbieter-Staffeln: nichts', summeFuerGruppe([], [], eine), null)
pruefe('mehrere Titel an der Adresse: nichts', summeFuerGruppe([], [st(3, 12)], [...eine, { id: 2, titel: 'U', folgen: 12 }]), null)
pruefe('kein Titel: nichts', summeFuerGruppe([], [st(3, 12)], []), null)
pruefe('Liste beginnt bei Staffel 1: nichts', summeFuerGruppe([], [st(2, 12), st(1, 12)], eine), null)

if (fehler) process.exit(1)
console.log('check-staffelsumme-gruppe: ok')
