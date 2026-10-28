/**
 * Erscheinungsdatum gemeldeter Folgen: ISO oder null, nie abgeschnitten. Die Formen stammen
 * wörtlich aus einer echten Prime-Seitenantwort (`getdetailwidgets`, „16. Sept. 2001“) und
 * dem ADN-Bestand („2026-06-22T14:00:00Z“); „10. Mai 2023“ ist der Anlass (Vorrat 64).
 */
import { anbieterFolgeAus, folgenDatum } from './lib/folgen-datum.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, detail = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${detail}`)
}

const faelle: [string, string | null | undefined, string | null][] = [
  ['ISO-Zeitpunkt (ADN)', '2026-06-22T14:00:00Z', '2026-06-22'],
  ['ISO-Tag', '2023-05-10', '2023-05-10'],
  ['Klartext mit vollem Monat (Anlass)', '10. Mai 2023', '2023-05-10'],
  ['Klartext Oktober, ein Tag einstellig', '7. Oktober 2001', '2001-10-07'],
  ['Klartext abgekürzt mit Punkt', '16. Sept. 2001', '2001-09-16'],
  ['Klartext abgekürzt Okt.', '7. Okt. 2001', '2001-10-07'],
  ['Klartext März mit Umlaut', '1. März 2024', '2024-03-01'],
  ['Klartext Dezember', '30. Dez. 2001', '2001-12-30'],
  ['Punktform', '10.05.2023', '2023-05-10'],
  ['Jahr unter 1000 bleibt vierstellig', '10.05.0999', '0999-05-10'],
  ['Monat Januar', '3. Jan. 2024', '2024-01-03'],
  ['Monat Februar', '4. Feb. 2024', '2024-02-04'],
  ['Monat März abgekürzt Mrz', '5. Mrz 2024', '2024-03-05'],
  ['Monat März abgekürzt Mar', '5. Mar 2024', '2024-03-05'],
  ['Monat April', '6. Apr. 2024', '2024-04-06'],
  ['Monat Mai', '7. Mai 2024', '2024-05-07'],
  ['Monat Juni', '8. Juni 2024', '2024-06-08'],
  ['Monat Juli', '9. Juli 2024', '2024-07-09'],
  ['Monat August', '10. Aug. 2024', '2024-08-10'],
  ['Monat September', '11. Sep. 2024', '2024-09-11'],
  ['Monat Oktober', '12. Okt. 2024', '2024-10-12'],
  ['Monat November', '13. Nov. 2024', '2024-11-13'],
  ['Monat Dezember', '14. Dezember 2024', '2024-12-14'],
  ['unbekannte Form', 'Frühling 2023', null],
  ['unbekannter Monat', '10. Foo 2023', null],
  ['nur Jahr', '2023', null],
  ['unmöglicher Tag', '31. Feb. 2023', null],
  ['unmöglicher ISO-Tag', '2023-02-30', null],
  ['leer', '', null],
  ['null', null, null],
]
for (const [name, eingabe, soll] of faelle) {
  pruefe(name, folgenDatum(eingabe) === soll, `${eingabe} → ${folgenDatum(eingabe)}`)
}

const f = anbieterFolgeAus({ nummer: 3, titel: 'Folge 3', erschienen: '10. Mai 2023', dauer_sek: 1470 })
pruefe('Folge: Datum als ISO an den Zuordner', f.datum === '2023-05-10' && f.nummer === 3 && f.minuten === 25, JSON.stringify(f))
pruefe('Folge ohne Datum und Dauer', anbieterFolgeAus({ nummer: null, titel: null, erschienen: null, dauer_sek: null }).datum === null)

if (fehler) process.exit(1)
console.log(`check-folgen-datum: ok (${faelle.length + 2} Fälle)`)
