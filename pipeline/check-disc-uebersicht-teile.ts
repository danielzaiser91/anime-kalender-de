/**
 * Disc-Übersicht: Volume und Staffel zählen beim Abgleich mit (18.11.2026). Vorher deckte „Vol. 1" am Kalender den Termin von „Vol. 2" mit:
 * Ron Kamonohashi S2 Vol. 2 und Shield Hero S4 Vol. 1 standen in der Übersicht, im Kalender fehlten sie, der Abgleich meldete nur „anderer Tag".
 * Die Zeilen und Namen sind wörtlich aus der Übersicht (Anime2You 1062132) und aus `releases.json`.
 */
import { discAbgleich, teileVertraeglich, teilZahlen, type DiscZeile } from './lib/disc-uebersicht.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const zeile = (titel: string, datum: string): DiscZeile => ({ datum, titel, label: 'crunchyroll', format: 'serie', medium: 'blu-ray', edition: '' })
const art = (titel: string, datum: string, termine: { name: string; datum: string }[]) => discAbgleich(zeile(titel, datum), termine)

const ron = art('Ron Kamonohashi’s Forbidden Deductions (Staffel 2) – Vol. 2', '2026-11-20', [{ name: 'Master Detective Ron Kamonohashi – Staffel 2 – Vol. 1', datum: '2026-09-18' }])
pruefe('Ron Kamonohashi: Vol. 2 wird von Vol. 1 nicht gedeckt, auch nicht als „anderer Tag"', ron.art === 'fehlt', ron)

const schild = art('The Rising of the Shield Hero (Staffel 4) – Vol. 1', '2026-11-20', [{ name: 'The Rising of the Shield Hero – Staffel 4 – Vol. 2', datum: '2027-01-15' }])
pruefe('Shield Hero: Vol. 1 wird von Vol. 2 nicht gedeckt', schild.art === 'fehlt', schild)

const rezero = art('Re:ZERO (Staffel 3) – Vol. 2', '2026-11-06', [{ name: 'Re:ZERO – Staffel 3 – Vol. 1', datum: '2026-09-04' }, { name: 'Re:ZERO – Staffel 3 – Vol. 3', datum: '2027-01-15' }])
pruefe('Re:ZERO: Vol. 2 fehlt zwischen Vol. 1 und Vol. 3', rezero.art === 'fehlt', rezero)

const staffel = art('Call of the Night (Staffel 2) – Vol. 2', '2026-11-20', [{ name: 'Call of the Night – Staffel 1 – Vol. 2', datum: '2026-11-20' }])
pruefe('Call of the Night: gleiche Vol.-Nummer, andere Staffel deckt nicht', staffel.art === 'fehlt', staffel)

const wind = art('Wind Breaker (Staffel 2) – Vol. 2', '2026-10-02', [{ name: 'Wind Breaker – Staffel 2 – Vol. 2', datum: '2026-10-02' }])
pruefe('Wind Breaker: gleiche Staffel und gleiches Volume am selben Tag sind gedeckt', wind.art === 'gedeckt', wind)

const verschoben = art('Infinite Dendrogram – Vol. 2', '2026-11-13', [{ name: 'Infinite Dendrogram – Vol. 2', datum: '2026-11-20' }])
pruefe('Infinite Dendrogram: gleiches Volume an einem anderen Tag bleibt „anderer Tag"', verschoben.art === 'anderer-tag' && verschoben.tag === '2026-11-20', verschoben)

const ohneVol = art('My Next Life as a Villainess (Staffel 2) – Vol. 1', '2026-10-16', [{ name: 'My Next Life as a Villainess – Staffel 2', datum: '2026-10-16' }])
pruefe('Ein Kalendereintrag ohne Volume (Komplettbox) bleibt verträglich', ohneVol.art === 'gedeckt', ohneVol)

const bundle = art('Angeloid – Staffel 1 + 2', '2026-11-20', [{ name: 'Angeloid – Sora no Otoshimono – Staffel 1 & 2 – Komplett-Bundle', datum: '2026-11-20' }])
pruefe('Angeloid: „Staffel 1 + 2" und „Staffel 1 & 2" sind dieselbe Angabe', bundle.art === 'gedeckt', bundle)

const z = teilZahlen('Angeloid – Sora no Otoshimono – Staffel 1 & 2 – Vol. 1/2')
pruefe('Zahlen: Staffel 1 und 2, Volume 1 und 2', [...z.staffel].join() === '1,2' && [...z.vol].join() === '1,2', { staffel: [...z.staffel], vol: [...z.vol] })
pruefe('Zahlen: „Part 2" zählt wie ein Volume, „Season 3" wie eine Staffel', [...teilZahlen('X Season 3 Part 2').vol].join() === '2' && [...teilZahlen('X Season 3 Part 2').staffel].join() === '3')
pruefe('Verträglich: ohne Zahlen auf einer Seite immer', teileVertraeglich('Gantz', 'Gantz – Vol. 4'))
pruefe('Verträglich: Volume 2 gegen Volume 3 nie', !teileVertraeglich('X – Vol. 2', 'X – Vol. 3'))

console.log(`Disc-Übersicht Volume/Staffel: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
