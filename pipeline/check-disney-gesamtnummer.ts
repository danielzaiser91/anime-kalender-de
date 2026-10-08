/**
 * Disney+ zählt je Staffel neu, unser Bestand durch: Zusicherungen zur Gesamtnummer.
 *
 * Fälle aus dem Bestand: Naruto Shippuden (53/59/54, Handbeleg Daniel 08.10.2026, AniList 500 Folgen),
 * Yozakura Family (27 + 12, Bestand führt nur Staffel 2 mit 12) und Naruto (AniList 220).
 */
import { entfernteJeAdresse, mitEntfernten, staffelnMitAdresse } from './lib/entfernte-verweise.ts'
import { ordneNachStaffelliste } from './lib/folgenbereiche.ts'
import { schluesselAdresse } from './lib/zuordnung.ts'
import { gesamtnummerDisney, ordneMeldungZuPlattform, type DisneyStaffel } from './lib/disney-gesamtnummer.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('\nDisney+: Gesamtnummer aus Staffel und Folge')

/** Die Staffelliste, wie die Erweiterung ab 4.24.15 sie schickt. */
const staffeln = (groessen: number[]): DisneyStaffel[] =>
  groessen.map((gesamt, i) => ({
    seq: i + 1,
    name: `Staffel ${i + 1}`,
    folgen: gesamt,
    erste: 1,
    gesamt,
    davor: groessen.slice(0, i).reduce((n, x) => n + x, 0),
  }))

const SHIPPUDEN = [{ id: 1735, titel: 'Naruto Shippuden', folgen: 500 }]
const sh = staffeln([53, 59, 54])
const nr = (staffel: number, folge: number, unsere = SHIPPUDEN, anbieter = sh) =>
  ordneMeldungZuPlattform('disneyplus', { folge, staffel }, unsere, anbieter)?.folgeInStaffel ?? null

pruefe('Shippuden: Staffel 1 bleibt, wie sie ist', nr(1, 53) === 53)
pruefe('Shippuden: Staffel 2 Folge 1 ist Folge 54', nr(2, 1) === 54, nr(2, 1))
pruefe('Shippuden: Staffel 2 Folge 59 ist Folge 112', nr(2, 59) === 112)
pruefe('Shippuden: Staffel 3 Folge 1 ist Folge 113', nr(3, 1) === 113)
pruefe('Shippuden: Staffel 3 Folge 54 ist Folge 166', nr(3, 54) === 166)
pruefe('Shippuden: Folge hinter dem Ende der Staffel wird nicht zugeordnet', nr(2, 60) === null)

/* Die Staffeln stammen aus einer Meldung nur zu Staffel 2: der Versatz kommt von der Seite, nicht aus den gemeldeten Folgen. */
pruefe('Teilmeldung nur zu Staffel 3 rechnet mit dem Versatz der Seite', nr(3, 10, SHIPPUDEN, [sh[2]!]) === 122)

/* Vor 4.24.15 fehlte die Größe: dann gilt der bisherige Weg (Zählung je Staffel), nichts Neues wird geraten. */
const alt: DisneyStaffel[] = sh.map(({ seq, name, folgen, erste }) => ({ seq, name, folgen, erste }))
pruefe('Meldung ohne Staffelgröße: bisheriger Weg', gesamtnummerDisney({ folge: 1, staffel: 2 }, SHIPPUDEN, alt) === undefined)

/* Kennt die Seite eine Vorstaffel nicht sicher (davor: null), bleibt die Meldung unzugeordnet. */
const unklar: DisneyStaffel[] = sh.map((s) => (s.seq === 2 ? { ...s, davor: null } : s))
pruefe('Versatz unklar: unzugeordnet', nr(2, 1, SHIPPUDEN, unklar) === null)
pruefe('Versatz unklar: Staffel 1 bleibt trotzdem', nr(1, 5, SHIPPUDEN, unklar) === 5)

/* Passt die Summe nicht in den Eintrag, meint die Adresse mehr als ihn. */
pruefe('Summe größer als der Eintrag: unzugeordnet', nr(3, 1, [{ id: 7, titel: 'Klein', folgen: 100 }]) === null)
pruefe('Eintrag ohne bekannte Folgenzahl: unzugeordnet', nr(2, 1, [{ id: 7, titel: 'Offen', folgen: 0 }]) === null)

/* Yozakura: der Bestand führt nur Staffel 2 (12 Folgen); sie bleibt, was sie war. */
const yoz = staffeln([27, 12])
const YOZAKURA = [{ id: 182578, titel: 'Mission: Yozakura Family', folgen: 12 }]
pruefe('Yozakura: Staffel 2 Folge 5 bleibt Folge 5', nr(2, 5, YOZAKURA, yoz) === 5, nr(2, 5, YOZAKURA, yoz))

/* Mehrere Einträge an einer Adresse laufen weiter über die Staffelliste (Haikyu!!, Tokyo Revengers). */
pruefe(
  'zwei Einträge: nicht betroffen',
  gesamtnummerDisney({ folge: 1, staffel: 2 }, [...SHIPPUDEN, { id: 8, titel: 'B', folgen: 20 }], sh) === undefined,
)

/* Andere Anbieter bleiben unberührt. */
pruefe(
  'Netflix: nicht betroffen',
  ordneMeldungZuPlattform('netflix', { folge: 1, staffel: 2 }, SHIPPUDEN, sh)?.folgeInStaffel === 1,
)

console.log('\nBleach TYBW: Staffel ohne deutschen Ton gehört zur Adresse')
const BLEACH = 'https://www.disneyplus.com/de-de/series/bleach-thousand-year-blood-war/4Afet1Q421gy'
const drei = [{ id: 116674, titel: 'S1', folgen: 13 }, { id: 159322, titel: 'S2', folgen: 13 }, { id: 169755, titel: 'S3', folgen: 14 }]
const vier = [...drei, { id: 185874, titel: 'S4', folgen: 10 }]
const seite = staffeln([13, 13, 14, 8])
pruefe('ohne die entfernte Staffel: Zuordnung verweigert', Boolean(ordneNachStaffelliste(seite, drei).problem))
const entfernt = entfernteJeAdresse([
  { titleId: 185874, url: BLEACH, grund: 'belegtes Nein: dort gibt es keine deutsche Tonspur' },
  { titleId: 1, url: BLEACH, grund: 'deutscher Katalog führt unter dieser Kennung keine einzige Staffel' },
])
pruefe('nur das belegte Nein zählt', entfernt.get(schluesselAdresse(BLEACH))?.join() === '185874', [...entfernt])
pruefe('benannte 3 Titel + entfernte Staffel 4', mitEntfernten([116674, 159322, 169755], [185874]).join() === '116674,159322,169755,185874')
pruefe('ein einzelner benannter Titel bleibt allein', mitEntfernten([159322], [185874]).join() === '159322')
const kengan = [{ id: 100891, titel: 'I', folgen: 12 }, { id: 111048, titel: 'II', folgen: 12 }, { id: 146638, titel: 'S2', folgen: 12 }, { id: 169692, titel: 'S2.2', folgen: 16 }]
const netflixKengan = staffeln([12, 12, 28])
pruefe('Kengan Ashura: nur die zwei offenen benannt, ganze Adresse gilt', staffelnMitAdresse(netflixKengan, kengan.slice(2), kengan).length === 4)
pruefe('ohne Problem bleibt es bei den benannten', staffelnMitAdresse(staffeln([12, 12, 12, 16]), kengan, kengan.slice(0, 2)).length === 4)
const z = ordneNachStaffelliste(seite, vier)
pruefe('mit ihr: vier Paare, kein Problem', !z.problem && z.paare.length === 4, z)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
