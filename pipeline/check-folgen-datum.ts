/**
 * Erscheinungsdatum gemeldeter Folgen: ISO oder null, nie abgeschnitten. Die Formen stammen
 * wörtlich aus einer echten Prime-Seitenantwort (`getdetailwidgets`, „16. Sept. 2001“) und
 * dem ADN-Bestand („2026-06-22T14:00:00Z“); „10. Mai 2023“ ist der Anlass (Vorrat 64).
 */
import { ordneZu } from '../shared/folgen-zuordnung.ts'
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
  ['Monat September ausgeschrieben (neun Buchstaben)', '11. September 2024', '2024-09-11'],
  ['Monat Oktober','12. Okt. 2024', '2024-10-12'],
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

/*
  Digimon Tamers, Prime B0CKPCSHMC: Prime führt das Datum der Vorwoche (25 „16. Sept. 2001“, TMDB: 24).
  Titel und Daten wörtlich aus der Roh-Antwort und `data/tmdb-folgen.json` (874); der Titel gilt.
*/
const tamers = [
  { s: 1, e: 24, titel: 'Der Tag der Abreise', datum: '2001-09-16', minuten: 25 },
  { s: 1, e: 25, titel: 'Auf in eine fremde Welt', datum: '2001-09-23', minuten: 25 },
  { s: 1, e: 26, titel: 'Das Tal der Stürme', datum: '2001-09-30', minuten: 25 },
  { s: 1, e: 44, titel: 'Das Mädchen in Schwarz', datum: '2002-02-03', minuten: 25 },
  { s: 1, e: 45, titel: 'Der D-Reaper', datum: '2002-02-17', minuten: 25 },
]
const primeRoh = [
  { nummer: 25, titel: 'Auf in eine fremde Welt', erschienen: '16. Sept. 2001' },
  { nummer: 26, titel: 'Das Tal der Stürme', erschienen: '23. Sept. 2001' },
  { nummer: 44, titel: 'Das Mädchen in Schwarz', erschienen: '27. Jan. 2002' },
  { nummer: 45, titel: 'D-Reaper', erschienen: '3. Feb. 2002' },
].map((r) => anbieterFolgeAus({ ...r, dauer_sek: 1320 }))
const z = ordneZu(primeRoh, tamers)
pruefe('Tamers: Titel schlägt das verschobene Datum', z[0]!.unsere === 25 && z[1]!.unsere === 26, JSON.stringify(z))
pruefe('Tamers: Titeltreffer nennt den Titel als Grund', z[0]!.grund === 'titel' && z[2]!.grund === 'titel', JSON.stringify(z))
pruefe('Tamers: Datum auf eine per Titel vergebene Folge bleibt offen', z[3]!.unsere === null && z[3]!.grund === 'offen', JSON.stringify(z))
const nurDatum = ordneZu([{ nummer: null, titel: 'Ganz anderer Titel', datum: '2001-09-16', minuten: null }], tamers)
pruefe('Datum ohne Titeltreffer und ohne Widerspruch ordnet zu', nurDatum[0]!.unsere === 24 && nurDatum[0]!.grund === 'datum', JSON.stringify(nurDatum))
const einig = ordneZu([{ nummer: null, titel: 'Das Tal der Stürme', datum: '2001-09-30', minuten: null }], tamers)
pruefe('Titel und Datum auf dieselbe Folge: Grund Datum', einig[0]!.unsere === 26 && einig[0]!.grund === 'datum', JSON.stringify(einig))
/* Widerspruch auf der Seite (Titel „Tal der Stürme“ = 26, Datum der Vorwoche = 25): Das Datum der Seite taugt nicht, auch der stumme Titel bleibt offen. */
const verschoben = ordneZu(
  [
    { nummer: null, titel: 'Das Tal der Stürme', datum: '2001-09-23', minuten: null },
    { nummer: null, titel: 'Ganz anderer Titel', datum: '2001-09-16', minuten: null },
  ],
  tamers,
)
pruefe('Seite mit Widerspruch: Titel gilt', verschoben[0]!.unsere === 26 && verschoben[0]!.grund === 'titel', JSON.stringify(verschoben))
pruefe('Seite mit Widerspruch: stummer Titel bleibt trotz Datumstreffer offen', verschoben[1]!.unsere === null && verschoben[1]!.grund === 'offen', JSON.stringify(verschoben))
const einigeSeite = ordneZu(
  [
    { nummer: null, titel: 'Das Tal der Stürme', datum: '2001-09-30', minuten: null },
    { nummer: null, titel: 'Ganz anderer Titel', datum: '2001-09-16', minuten: null },
  ],
  tamers,
)
pruefe('Seite ohne Widerspruch: Datumstreffer des stummen Titels gilt', einigeSeite[1]!.unsere === 24 && einigeSeite[1]!.grund === 'datum', JSON.stringify(einigeSeite))
const ohneDatum = ordneZu(
  [
    { nummer: null, titel: 'Das Tal der Stürme', datum: null, minuten: null },
    { nummer: null, titel: 'Ganz anderer Titel', datum: '2001-09-16', minuten: null },
  ],
  tamers,
)
pruefe('Titeltreffer ohne Datum ist kein Widerspruch: Datumstreffer gilt', ohneDatum[1]!.unsere === 24 && ohneDatum[1]!.grund === 'datum', JSON.stringify(ohneDatum))
const doppelt = ordneZu(
  [
    { nummer: null, titel: 'Das Tal der Stürme', datum: null, minuten: null },
    { nummer: null, titel: 'Ganz anderer Titel', datum: '2001-09-30', minuten: null },
  ],
  tamers,
)
pruefe('Ohne Widerspruch: Datumstreffer auf eine per Titel vergebene Folge bleibt offen', doppelt[1]!.unsere === null && doppelt[0]!.unsere === 26, JSON.stringify(doppelt))
/* ADN Show 1125 (Demon Slave S1): Folge 6 trägt den Titel von Folge 7; Titel und Daten wörtlich aus data/adn-raw/1125 und data/anisearch-folgen.json (16798). */
const demon = [
  { s: 1, e: 5, titel: 'Schwestern, Yachiho, Necken', datum: '2024-02-01', minuten: null },
  { s: 1, e: 6, titel: 'Angriff, Sahara, Funkeln', datum: '2024-02-08', minuten: null },
  { s: 1, e: 7, titel: 'Gemeinsamer Kampf, Tenka, Fliegen', datum: '2024-02-15', minuten: null },
  { s: 1, e: 8, titel: 'Versprechen, Nei, Reminiszenz', datum: '2024-02-22', minuten: null },
]
const adn = ordneZu(
  [
    { nummer: 5, titel: 'Schwestern, Yachiho, Necken', datum: '2024-02-01', minuten: null },
    { nummer: 6, titel: 'Gemeinsamer Kampf, Tenka, Fliegen', datum: '2024-02-08', minuten: null },
    { nummer: 7, titel: 'Gemeinsamer Kampf, Tenka, Fliegen', datum: '2024-02-15', minuten: null },
    { nummer: 8, titel: 'Versprechen, Nei, Reminiszenz', datum: '2024-02-22', minuten: null },
  ],
  demon,
)
pruefe('Doppelter Titel auf der Seite belegt keine Folge: das Datum entscheidet (ADN 1125)', adn.map((x) => x.unsere).join() === '5,6,7,8', JSON.stringify(adn))
const einmalig = ordneZu([{ nummer: 7, titel: 'Gemeinsamer Kampf, Tenka, Fliegen', datum: null, minuten: null }], demon)
pruefe('Derselbe Titel einmal auf der Seite ordnet per Titel zu', einmalig[0]!.unsere === 7 && einmalig[0]!.grund === 'titel', JSON.stringify(einmalig))
const mehrdeutig = [
  { s: 1, e: 1, titel: 'Erste Folge hier', datum: '2000-01-01', minuten: null },
  { s: 1, e: 2, titel: 'Zweite Folge hier', datum: '2000-01-01', minuten: null },
  { s: 1, e: 3, titel: 'Gleicher Titel', datum: '2000-02-01', minuten: null },
  { s: 1, e: 4, titel: 'Gleicher Titel', datum: '2000-03-01', minuten: null },
]
const zwei = ordneZu(
  [
    { nummer: null, titel: 'Fremder Name', datum: '2000-01-01', minuten: null },
    { nummer: null, titel: 'Gleicher Titel', datum: null, minuten: null },
  ],
  mehrdeutig,
)
pruefe('zwei Folgen am selben Tag: Datum ordnet nicht zu', zwei[0]!.unsere === null, JSON.stringify(zwei))
pruefe('zwei Folgen mit demselben Titel: Titel ordnet nicht zu', zwei[1]!.unsere === null, JSON.stringify(zwei))

if (fehler) process.exit(1)
console.log(`check-folgen-datum: ok (${faelle.length + 2 + 14} Fälle)`)
