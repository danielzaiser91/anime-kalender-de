/**
 * Part-/Cour-/Box-Hinweis ohne Staffel-Wort (25.10.2026): Disc-Termine hingen am Basistitel
 * (Dr. Stone „Part 2", Dragon Ball Z „Filmbox 2"). Jetzt: über den Namen zuordnen oder verwerfen und zählen.
 */
import { releasesAus } from './lib/meldungen.ts'
import { teilHinweis } from './lib/teil-hinweis.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Eingabe = Parameters<typeof releasesAus>
const titel = [
  { id: 900001, franchiseId: 900001, titleEn: 'Teststein', format: 'TV' },
  { id: 900002, franchiseId: 900001, titleEn: 'Teststein: Science Future Part 2', format: 'TV' },
  { id: 900003, franchiseId: 900001, titleEn: 'Teststein: Staffel 2', format: 'TV' },
  { id: 900004, franchiseId: 900004, titleEn: 'Dracheball', format: 'TV' },
  { id: 900005, franchiseId: 900005, titleEn: 'Zwilling Part 2 A', format: 'TV' },
  { id: 900006, franchiseId: 900005, titleEn: 'Zwilling Part 2 B', format: 'TV' },
] as unknown as Eingabe[1]

const disc = (titleId: number, artikel: string) =>
  ({
    articleTitle: artikel,
    articleUrl: `https://www.anime2you.de/news/${titleId}/${artikel.length}/`,
    category: 'disc',
    platforms: ['disc'],
    titleId,
    dub: 'ja',
    dates: [{ iso: '2027-01-29', context: 'erscheint am 29.01.2027' }],
  }) as unknown as Eingabe[0][number]

const lauf = (titleId: number, artikel: string) => {
  const verworfen: string[] = []
  const r = releasesAus([disc(titleId, artikel)], titel, [], '2026-10-25', verworfen)
  return { r, verworfen }
}

const part2 = lauf(900001, 'Teststein Part 2: Blu-ray-Termin')
pruefe('Part 2 mit genau einem Namenstreffer: richtiger Teil', part2.r[0]?.titleId === 900002 && part2.verworfen.length === 0, part2.r.map((x) => x.titleId))

const ohneName = lauf(900004, 'Dracheball Part 2: Blu-ray-Termin')
pruefe('Part 2 ohne Namenstreffer: verworfen und gezählt', ohneName.r.length === 0 && ohneName.verworfen.length === 1, ohneName)

const mehrdeutig = lauf(900005, 'Zwilling Part 2: Blu-ray-Termin')
pruefe('Part 2 mit zwei Namenstreffern: verworfen', mehrdeutig.r.length === 0 && mehrdeutig.verworfen.length === 1, mehrdeutig)

const filmbox = lauf(900004, 'Termin der zweiten Blu-ray-Filmbox zu »Dracheball«')
pruefe('Filmbox 2: verworfen und gezählt', filmbox.r.length === 0 && filmbox.verworfen.length === 1, filmbox)

const filmbox2 = lauf(900004, 'Dracheball Filmbox 2')
pruefe('Filmbox 2 ohne Bindestrich: verworfen', filmbox2.r.length === 0 && filmbox2.verworfen.length === 1, filmbox2)

const box4 = lauf(900004, 'Termin der vierten Blu-ray-Box von »Dracheball«')
pruefe('Gegenfall: vierte Box einer Serie bleibt am Serientitel (auto-813-disc live)', box4.r[0]?.titleId === 900004 && box4.verworfen.length === 0, box4)

const staffel2 = lauf(900001, 'Zweite »Teststein«-Staffel: Blu-ray-Termin')
pruefe('Gegenfall: Staffel 2 bleibt am Staffel-2-Titel', staffel2.r[0]?.titleId === 900003 && staffel2.verworfen.length === 0, staffel2)

const einfach = lauf(900004, 'Dracheball: Blu-ray-Termin')
pruefe('Gegenfall: ohne Hinweis bleibt die Meldung am Basistitel', einfach.r[0]?.titleId === 900004 && einfach.verworfen.length === 0, einfach)

const boxOhneZahl = lauf(900004, 'Design der Blu-ray-Box zu »Dracheball«')
pruefe('Gegenfall: Box ohne Zahl bleibt am Basistitel', boxOhneZahl.r[0]?.titleId === 900004, boxOhneZahl)

const filmboxOhneZahl = lauf(900004, 'Design der neuen Dracheball Filmbox enthüllt')
pruefe('Gegenfall: Filmbox ohne Zahl bleibt am Basistitel', filmboxOhneZahl.r[0]?.titleId === 900004, filmboxOhneZahl)

const staffel5 = lauf(900001, 'Fünfte »Teststein«-Staffel: Blu-ray-Termin')
pruefe('Staffel ohne Treffer wird verworfen, aber nicht als Hinweis gezählt', staffel5.r.length === 0 && staffel5.verworfen.length === 0, staffel5)

pruefe('Hinweis: Cour 3', JSON.stringify(teilHinweis('X Cour 3')) === '{"art":"part","nummer":3}')
pruefe('Hinweis: Filmbox 2', teilHinweis('X Filmbox 2')?.art === 'box')
pruefe('Hinweis: Steelbook allein ist keiner', teilHinweis('Erste X-Staffel im Steelbook') === undefined)

console.log(`Disc-Teil-Hinweis: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
