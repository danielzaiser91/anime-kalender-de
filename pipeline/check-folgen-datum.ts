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
