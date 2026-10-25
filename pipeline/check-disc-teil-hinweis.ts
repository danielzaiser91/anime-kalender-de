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

const staffelUndPart = lauf(900001, 'Fünfte »Teststein«-Staffel Part 2: Blu-ray-Termin')
pruefe('Staffel-Pfad verwirft Staffel + Part: nicht als Hinweis gezählt', staffelUndPart.r.length === 0 && staffelUndPart.verworfen.length === 0, staffelUndPart)

// Die drei echten Anlass-Überschriften (data/proposals/anime2you.json, 25.10.2026), wörtlich.
const dbz = lauf(900004, 'Termin der zweiten Blu-ray-Filmbox zu »Dragon Ball Z« + Design')
pruefe('Echt: DBZ-Filmbox (Staffel-Pfad hätte sie am Basistitel gelassen): verworfen', dbz.r.length === 0 && dbz.verworfen.length === 1, dbz)

const stone = lauf(900001, 'Blu-ray-Termin des zweiten Parts von »Teststein: Science Future«')
pruefe('Echt: „zweiten Parts" geht an den Part-2-Titel, nicht an den Basistitel', stone.r[0]?.titleId === 900002 && stone.verworfen.length === 0, stone.r.map((x) => x.titleId))

const anki = lauf(900004, 'Disc-Termin des zweiten Parts von »Tougen Anki« + Design')
pruefe('Echt: „zweiten Parts" ohne Namenstreffer: verworfen', anki.r.length === 0 && anki.verworfen.length === 1, anki)

const dbzDesign = lauf(900004, 'Design der neuen Blu-ray-Filmbox zu »Dragon Ball Z« enthüllt')
pruefe('Echt: Filmbox ohne Zahl bleibt am Basistitel', dbzDesign.r[0]?.titleId === 900004 && dbzDesign.verworfen.length === 0, dbzDesign)

// Namensliste: Treffer nur über titleDe bzw. titleRomaji; zwei Kandidaten, richtiger an zweiter Stelle.
const titel2 = [
  { id: 900011, franchiseId: 900011, titleEn: 'Mitte', format: 'TV' },
  { id: 900012, franchiseId: 900011, titleDe: 'Mitte Part 2', titleEn: 'Mitte Zwei', format: 'TV' },
  { id: 900021, franchiseId: 900021, titleEn: 'Rand', format: 'TV' },
  { id: 900022, franchiseId: 900021, titleEn: 'Rand Teil', titleRomaji: 'Rand Cour 3', format: 'TV' },
] as unknown as Eingabe[1]
const deTreffer = releasesAus([disc(900011, 'Mitte Part 2: Blu-ray')], titel2, [], '2026-10-25', [])
pruefe('Treffer nur über titleDe', deTreffer[0]?.titleId === 900012, deTreffer.map((x) => x.titleId))
const romajiTreffer = releasesAus([disc(900021, 'Rand Cour 3: Blu-ray')], titel2, [], '2026-10-25', [])
pruefe('Treffer nur über titleRomaji', romajiTreffer[0]?.titleId === 900022, romajiTreffer.map((x) => x.titleId))
const zweiKandidaten = [
  { id: 900031, franchiseId: 900031, titleEn: 'Paar', format: 'TV' },
  { id: 900032, franchiseId: 900031, titleEn: 'Paar Staffel 1', format: 'TV' },
  { id: 900033, franchiseId: 900031, titleEn: 'Paar Part 2', format: 'TV' },
] as unknown as Eingabe[1]
const zweiter = releasesAus([disc(900031, 'Paar Part 2: Blu-ray')], zweiKandidaten, [], '2026-10-25', [])
pruefe('Treffer an dritter Stelle der Reihe, nicht am ersten', zweiter[0]?.titleId === 900033, zweiter.map((x) => x.titleId))

// Basis mit Reihenkennung ungleich eigener Kennung; „Part 20" darf nicht als „Part 2" zählen.
const titel3 = [
  { id: 900040, franchiseId: 900040, titleEn: 'Fern', format: 'TV' },
  { id: 900041, franchiseId: 900040, titleEn: 'Fern Part 20', format: 'TV' },
  { id: 900042, franchiseId: 900040, titleEn: 'Fern Part 2', format: 'TV' },
] as unknown as Eingabe[1]
const ausBasis = releasesAus([disc(900040, 'Fern Part 2: Blu-ray')], titel3, [], '2026-10-25', [])
pruefe('Part 2 trifft nicht Part 20', ausBasis[0]?.titleId === 900042, ausBasis.map((x) => x.titleId))
const ausFolge = releasesAus([disc(900041, 'Fern Part 2: Blu-ray')], titel3, [], '2026-10-25', [])
pruefe('Reihe wird über die Reihenkennung der Basis gesucht, nicht über deren Kennung', ausFolge[0]?.titleId === 900042, ausFolge.map((x) => x.titleId))

pruefe('Hinweis: zweiten Parts', JSON.stringify(teilHinweis('des zweiten Parts von X')) === '{"art":"part","nummer":2}')
pruefe('Hinweis: dritter Cour', JSON.stringify(teilHinweis('dritter Cour')) === '{"art":"part","nummer":3}')
pruefe('Hinweis: 2. Part', JSON.stringify(teilHinweis('X 2. Part')) === '{"art":"part","nummer":2}')
pruefe('Hinweis: Cour 3', JSON.stringify(teilHinweis('X Cour 3')) === '{"art":"part","nummer":3}')
pruefe('Hinweis: Filmbox 2', teilHinweis('X Filmbox 2')?.art === 'box')
pruefe('Hinweis: Steelbook allein ist keiner', teilHinweis('Erste X-Staffel im Steelbook') === undefined)

console.log(`Disc-Teil-Hinweis: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
