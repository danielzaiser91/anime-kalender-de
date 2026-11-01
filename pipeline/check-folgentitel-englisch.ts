/**
 * Zusicherungen zu `bau/folgentitel-englisch.ts`: Eine Serie, deren Titel aus Crunchyroll/TMDB nur der englische Titel aus Kitsu/TMDB sind
 * (Burn the Witch, 116673), zeigt keine Titel; einzelne Gleichheiten (Gantz „Kurono Alien", Black Torch) und Titel aus aniSearch bleiben.
 * Die Texte stammen wörtlich aus `data/kitsu-folgen.json` und `data/tmdb-folgen.json` (Stand 01.11.2026).
 * Aufruf: `npm run check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { englischeTitel, ohneEnglischeTitel, unuebersetzteNummern } from './bau/folgentitel-englisch.ts'
import { ohneUnuebersetzte } from './bau/folgen-dateien.ts'
import type { TitelQuellen } from './bau/folgentitel-stufen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kitsu116673 = { f: [[1, 'Witches Blow a New Pipe', 21], [2, 'Ghillie Suit / She Makes Me Special', 21], [3, "If a lion could speak, we couldn't understand", 21]] as [number, string, number][] }
const tmdb116673 = { folgen: [{ en: 'Witches Blow a New Pipe' }, { en: 'Ghillie Suit / She Makes Me Special' }, { en: "If a Lion Could Speak, We Couldn't Understand" }] }
/* So steht die Liste nach Crunchyroll: dieselben Titel, mit typografischem Apostroph in Folge 3. */
const crListe = [
  { nr: 1, de: 'Witches Blow a New Pipe' },
  { nr: 2, de: 'Ghillie Suit / She Makes Me Special' },
  { nr: 3, de: 'If a lion could speak, we couldn’t understand' },
]
const en116673 = englischeTitel(kitsu116673, tmdb116673, [])

console.log('\nUnübersetzte Serien (Folgentitel nur englisch)')
pruefe('116673: drei von drei gleich dem englischen Titel → alle drei Nummern fallen weg', [...unuebersetzteNummern(crListe.map((x) => [x.nr, x.de] as const), new Set(), en116673)].join() === '1,2,3')
pruefe('116673: die Liste hat danach keine Titel, die Nummern bleiben', JSON.stringify(ohneEnglischeTitel(crListe, new Set(), en116673)) === JSON.stringify([{ nr: 1 }, { nr: 2 }, { nr: 3 }].map((x) => ({ ...x, de: undefined }))))

/* Gantz (384): 1 von 13 gleich, Kurono Alien ist ein Eigenname; Black Torch (187538): 8 von 12 gleich (Songtitel). */
const gantz = Array.from({ length: 13 }, (_, i) => ({ nr: i + 1, de: i === 9 ? 'Kurono Alien' : `Deutsch ${i + 1}` }))
pruefe('Gantz: ein Eigenname unter 13 Titeln bleibt stehen', ohneEnglischeTitel(gantz, new Set(), ['Kurono Alien']) === gantz)
const torch = Array.from({ length: 12 }, (_, i) => ({ nr: i + 1, de: [2, 3, 5, 6, 8, 9, 11, 12].includes(i + 1) ? `Song ${i + 1}` : `Deutsch ${i + 1}` }))
const torchEn = [2, 3, 5, 6, 8, 9, 11, 12].map((n) => `Song ${n}`)
pruefe('Black Torch: 8 von 12 (67 %) bleiben stehen', unuebersetzteNummern(torch.map((x) => [x.nr, x.de] as const), new Set(), torchEn).size === 0)

const zeilen = (gleich: number, gesamt: number) => Array.from({ length: gesamt }, (_, i) => [i + 1, i < gleich ? `Gleich ${i}` : `Anders ${i}`] as const)
const enGleich = (n: number) => Array.from({ length: n }, (_, i) => `Gleich ${i}`)
pruefe('Grenze Anzahl: zwei von zwei bleiben, drei von drei fallen', unuebersetzteNummern(zeilen(2, 2), new Set(), enGleich(2)).size === 0 && unuebersetzteNummern(zeilen(3, 3), new Set(), enGleich(3)).size === 3)
pruefe('Grenze Anteil: 9 von 10 fallen, 8 von 10 bleiben', unuebersetzteNummern(zeilen(9, 10), new Set(), enGleich(9)).size === 9 && unuebersetzteNummern(zeilen(8, 10), new Set(), enGleich(8)).size === 0)

console.log('\nTitel aus aniSearch zählen nicht')
const asFolgen = Array.from({ length: 12 }, (_, i) => ({ nr: i + 1, de: `Same ${i}`, en: `Same ${i}` }))
const asListe = asFolgen.map((x) => [x.nr, x.de] as const)
pruefe('Cowboy-Bebop-Fall: aniSearch führt den englischen Titel als deutschen → bleibt', unuebersetzteNummern(asListe, new Set(asFolgen.map((x) => x.nr)), asFolgen.map((x) => x.en)).size === 0)
pruefe('dieselben Zeilen ohne aniSearch-de fielen weg (Kontrolle)', unuebersetzteNummern(asListe, new Set(), asFolgen.map((x) => x.en)).size === 12)

console.log('\nVerdrahtung im Bau')
const t = { id: 116673 } as unknown as Title
const nurKitsu = englischeTitel(kitsu116673, undefined, [])
const nurTmdb = englischeTitel(undefined, tmdb116673, [])
const nurAs = englischeTitel(undefined, undefined, crListe.map((x) => ({ en: x.de })))
const gleichMit = (en: (string | null | undefined)[]) => unuebersetzteNummern(crListe.map((x) => [x.nr, x.de] as const), new Set(), en).size
pruefe('jede Quelle allein genügt: nur Kitsu 3, nur TMDB 3 (beide Schreibweisen des Apostroph), nur aniSearch 3', gleichMit(nurKitsu) === 3 && gleichMit(nurTmdb) === 3 && gleichMit(nurAs) === 3)
const quellenNurTmdb = { kitsu: {}, tmdbFolgen: { 116673: tmdb116673 } } as unknown as TitelQuellen
const quellenNurKitsu = { kitsu: { 116673: { k: 43146, ...kitsu116673 } }, tmdbFolgen: {} } as unknown as TitelQuellen
pruefe('Bau: TMDB allein und Kitsu allein reichen je (Eintrag wird mit der Titelkennung gesucht)', ohneUnuebersetzte(t, crListe, [], quellenNurTmdb)?.every((x) => x.de === undefined) === true && ohneUnuebersetzte(t, crListe, [], quellenNurKitsu)?.every((x) => x.de === undefined) === true)
const quellen = { kitsu: { 116673: { k: 43146, ...kitsu116673 } }, tmdbFolgen: { 116673: tmdb116673 } } as unknown as TitelQuellen
const bau = ohneUnuebersetzte(t, crListe, [{ nr: 1 }, { nr: 2 }, { nr: 3 }], quellen)
pruefe('ohneUnuebersetzte entfernt die Titel von 116673 aus der Bauliste', bau?.length === 3 && bau.every((x) => x.de === undefined), bau)
const anderer = ohneUnuebersetzte({ id: 900001 } as unknown as Title, crListe, [], quellen)
pruefe('ein Titel ohne Kitsu/TMDB-Eintrag behält seine Titel', anderer?.every((x, i) => x.de === crListe[i].de) === true)
pruefe('ohne Liste bleibt es ohne Liste', ohneUnuebersetzte(t, undefined, [], quellen) === undefined)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\ncheck-folgentitel-englisch: ok (13 Zusicherungen)')
