/**
 * Zusicherungen zur Zuordnung ADN-Serie → aniSearch (13.10.2026, `lib/adn-anisearch.ts`) und zur Frist der Titelliste. Läuft in `check:logic`
 * ohne Cache und ohne Bestand; der Katalog `data/adn-catalog.json` und die Liste `data/adn-anisearch-offen.json` liegen im Repo.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { wortIndex, type AsTitel } from './lib/anisearch-katalog-abgleich.ts'
import { kalenderLueckenZeile, kalenderOhneNetz, ordneAdnZuAnisearch, titellisteFrisch, TITELLISTE_MAX_TAGE, type AdnOffen } from './lib/adn-anisearch.ts'
import { ordneKatalogZuAnisearch, uebernimmOhneTitelliste } from './lib/adn-zuordnung-lauf.ts'
import { besterTitel, nameTraegt } from './bau/adn-show-titel.ts'
import type { AdnShow } from './lib/adn.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return
  fehler++
  console.error(`FEHLER: ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titelListe: AsTitel[] = [
  { id: 74, jahr: 1993, namen: ['JoJo no Kimyou na Bouken'] },
  { id: 207, jahr: 2000, namen: ['Jojo no Kimyou na Bouken', 'JoJo no Kimyou na Bouken (2000)'] },
  { id: 2376, jahr: 2004, namen: ['One Piece: Norowareta Seiken', 'One Piece: Der Fluch des heiligen Schwerts', 'ワンピース 呪われた聖剣'] },
  { id: 1815, jahr: 2001, namen: ['One Piece: Nejimaki-jima no Bouken'] },
  { id: 3634, jahr: 2003, namen: ['Bouken Gabotenjima'] },
  { id: 18878, jahr: 2024, namen: ['Dandadan', 'ダンダダン'] },
  { id: 10474, jahr: 2015, namen: ['Aikatsu! Music Award: Minna de Shou o Moraccha Ima Show!'] },
  { id: 3455, jahr: 2008, namen: ['To LOVE-Ru'] },
]
const titel = new Map(titelListe.map((t) => [t.id, t]))
const index = wortIndex(titelListe)
const ordne = (...serien: { showId: number; title: string; originalTitle?: string }[]) => ordneAdnZuAnisearch(serien, titel, index)

const dandadan = ordne({ showId: 1, title: 'DAN DA DAN', originalTitle: 'ダンダダン' })
pruefe('gleicher Name (Kanji) ordnet zu, auch wenn die Wörter zu kurz für passtZuSerie sind', dandadan.zuordnung.get(1) === 18878, [...dandadan.zuordnung])

const norowareta = ordne({ showId: 2, title: 'One Piece – Der Fluch des heiligen Schwerts', originalTitle: 'One Piece Movie 5 : Norowareta Seiken' })
pruefe('ohne gleichen Namen genügt ein Wortteil mit ausreichender Passung (Norowareta Seiken)', norowareta.zuordnung.get(2) === 2376, [...norowareta.zuordnung])

const spirale = ordne({ showId: 3, title: 'One Piece – Abenteuer auf der Spiralinsel', originalTitle: 'One Piece Movie 2 : Nejimaki Shima no Bouken' })
pruefe('ein geteiltes Wort („Bouken“) macht „Bouken Gabotenjima“ nicht zum Treffer', spirale.zuordnung.get(3) !== 3634, [...spirale.zuordnung])

const garfield = ordne({ showId: 4, title: 'The Garfield Show', originalTitle: 'The Garfield Show' })
pruefe('Zufallstreffer unter der Untergrenze bleibt offen, mit Grund „kein-kandidat“', !garfield.zuordnung.has(4) && garfield.offen[0]?.grund === 'kein-kandidat', garfield.offen)

const jojo = ordne({ showId: 5, title: 'Jojo’s Bizarre Adventure', originalTitle: 'JoJo no Kimyou na Bouken' })
pruefe('zwei Kandidaten gleichen Rangs: keine Zuordnung, beide stehen in der Liste', !jojo.zuordnung.has(5) && jojo.offen[0]?.grund === 'mehrdeutig' && jojo.offen[0].kandidaten.length >= 2, jojo.offen)

const zweimal = ordne({ showId: 6, title: 'To Love-Ru', originalTitle: 'To Love-Ru' }, { showId: 7, title: 'To Love-Ru Darkness', originalTitle: 'To Love-Ru Darkness' })
pruefe('ein aniSearch-Eintrag gehört höchstens einer Serie', new Set(zweimal.zuordnung.values()).size === zweimal.zuordnung.size, [...zweimal.zuordnung])
pruefe('die Serie mit dem gleichen Namen bekommt „To LOVE-Ru“, die andere nicht', zweimal.zuordnung.get(6) === 3455 && !zweimal.zuordnung.has(7), [...zweimal.zuordnung])

const alsTitel = (id: number, romaji: string): Title => ({ id, titleRomaji: romaji }) as Title
const wolf = { showId: 8, title: 'Wolf’s Rain', originalTitle: 'Wolf’s Rain', episodes: [], batch: false, url: '' } as AdnShow
pruefe('bei zwei Titeln unter einer Kennung gewinnt der mit dem besseren Namen (Wolf’s Rain, nicht die OVA)', besterTitel(wolf, [alsTitel(1023, 'Wolf’s Rain OVA'), alsTitel(202, 'Wolf’s Rain')])?.id === 202)
pruefe('gleichauf: keiner', besterTitel(wolf, [alsTitel(1, 'Wolf’s Rain'), alsTitel(2, 'Wolf’s Rain')]) === undefined)

const mitName = (id: number, romaji: string, en?: string): Title => ({ id, titleRomaji: romaji, titleEn: en }) as Title
const kurz = (title: string, originalTitle?: string) => ({ showId: 9, title, originalTitle, episodes: [], batch: false, url: '' }) as AdnShow
pruefe('gleicher Name nach Normalisierung trägt (TERRAFORMARS / Terra Formars)', nameTraegt(kurz('TERRAFORMARS', 'テラフォーマーズ'), mitName(1, 'Terra Formars')))
pruefe('gleicher Name trägt auch ohne Wort ab vier Zeichen (DAN DA DAN / Dandadan)', nameTraegt(kurz('DAN DA DAN'), mitName(2, 'Dandadan')))
pruefe('ein Werkwort allein trägt nicht („Der Film“ gegen „Girls und Panzer der Film“)', !nameTraegt(kurz('One Piece - Der Film'), mitName(3, 'Girls und Panzer der Film')))

// Frist: eine neue ADN-Serie ist spätestens nach TITELLISTE_MAX_TAGE Tagen in der Titelliste, die ein Lauf mit Token verwendet.
const tag = 24 * 3600 * 1000
const geholt = '2026-10-01T12:00:00.000Z'
const start = Date.parse(geholt)
pruefe('Titelliste gilt am letzten Tag der Frist noch', titellisteFrisch(geholt, start + TITELLISTE_MAX_TAGE * tag))
pruefe('Titelliste gilt eine Millisekunde nach der Frist nicht mehr', !titellisteFrisch(geholt, start + TITELLISTE_MAX_TAGE * tag + 1))
pruefe('ohne Zeitstempel gilt die Titelliste nicht', !titellisteFrisch(undefined, start))
pruefe('die Frist beträgt höchstens eine Woche', TITELLISTE_MAX_TAGE <= 7, TITELLISTE_MAX_TAGE)

// Titelliste fehlt: neue Serien kommen als offen in die Liste, bekannte bleiben, Zugeordnete und Erledigte fallen heraus.
const serie = (showId: number, anisearchId?: number): AdnShow => ({ showId, title: `Serie ${showId}`, originalTitle: `Original ${showId}`, anisearchId, episodes: [], batch: false, url: '' }) as AdnShow
const altOffen = (showId: number): AdnOffen => ({ showId, title: `Serie ${showId}`, grund: 'mehrdeutig', kandidaten: [] })
const katalogNeu = [serie(887), serie(7), serie(12), serie(30), serie(500)]
const katalogAlt = [serie(12), serie(30, 4711), serie(500, 4712)]
const ohneListe = uebernimmOhneTitelliste(katalogNeu, katalogAlt, [altOffen(12), altOffen(500)])
pruefe('ohne Titelliste: die neue Serie steht als offen mit Grund „titelliste-fehlt“', ohneListe.find((o) => o.showId === 887)?.grund === 'titelliste-fehlt', ohneListe)
pruefe('ohne Titelliste: der Eintrag trägt Namen der Serie und keine Kandidaten', JSON.stringify(ohneListe.find((o) => o.showId === 887)) === JSON.stringify({ showId: 887, title: 'Serie 887', originalTitle: 'Original 887', grund: 'titelliste-fehlt', kandidaten: [] }), ohneListe)
pruefe('ohne Titelliste: ein vorhandener Eintrag bleibt unverändert (Grund „mehrdeutig“)', ohneListe.find((o) => o.showId === 12)?.grund === 'mehrdeutig', ohneListe)
pruefe('ohne Titelliste: eine Serie mit Kennung aus der Vorwoche behält sie und steht nicht in der Liste', katalogNeu[3]!.anisearchId === 4711 && !ohneListe.some((o) => o.showId === 30), ohneListe)
pruefe('ohne Titelliste: ein erledigter Eintrag (Serie hat jetzt Kennung) fällt aus der Liste', !ohneListe.some((o) => o.showId === 500), ohneListe)
pruefe('ohne Titelliste: die Liste ist nach Serienkennung sortiert, ohne Doppelte', JSON.stringify(ohneListe.map((o) => o.showId)) === '[7,12,887]', ohneListe)
const zweiterLauf = uebernimmOhneTitelliste(katalogNeu, katalogAlt, ohneListe)
pruefe('ohne Titelliste: ein zweiter Lauf ändert nichts', JSON.stringify(zweiterLauf) === JSON.stringify(ohneListe), zweiterLauf)
pruefe('ohne Titelliste und ohne alte Liste: eine einzige Neue steht allein drin', uebernimmOhneTitelliste([serie(5)], [], []).length === 1)
pruefe('leerer Katalog: leere Liste', uebernimmOhneTitelliste([], [], [altOffen(1)]).length === 0)

// Der Aufrufer selbst (ordneKatalogZuAnisearch) in einem Wegwerf-Ordner: Titelliste fehlt -> Datei enthält die Neue; zweiter Lauf lässt sie unberührt.
const wurzel = mkdtempSync(join(tmpdir(), 'adn-offen-'))
const offenDatei = join(wurzel, 'offen.json')
writeFileSync(offenDatei, JSON.stringify({ anzahl: 1, serien: [altOffen(12)] }))
const liesOffen = () => (JSON.parse(readFileSync(offenDatei, 'utf8')) as { anzahl: number; serien: AdnOffen[] })
const lauf = (shows: AdnShow[], tl?: Map<number, AsTitel>) => ordneKatalogZuAnisearch(shows, katalogAlt, { titelliste: async () => tl, offenDatei })
await lauf([serie(887), serie(12), serie(30)])
const nachLauf = liesOffen()
pruefe('Aufrufer ohne Titelliste: die Datei nennt 12 und die neue 887 mit „titelliste-fehlt“, Anzahl 2', JSON.stringify(nachLauf.serien.map((o) => [o.showId, o.grund])) === '[[12,"mehrdeutig"],[887,"titelliste-fehlt"]]' && nachLauf.anzahl === 2, nachLauf)
const bytes = readFileSync(offenDatei, 'utf8')
await lauf([serie(887), serie(12), serie(30)])
pruefe('Aufrufer ohne Titelliste: ein zweiter Lauf lässt die Datei byteweise gleich', readFileSync(offenDatei, 'utf8') === bytes)
await lauf([serie(887, 1), serie(12, 2)], new Map())
pruefe('Aufrufer mit Titelliste rechnet die Liste neu (ohne „titelliste-fehlt“)', !readFileSync(offenDatei, 'utf8').includes('titelliste-fehlt'), liesOffen())
rmSync(wurzel, { recursive: true, force: true })

// Der eingecheckte Katalog und die Liste der offenen passen zusammen: nichts fällt heraus, nichts ist doppelt, keine AniList-Kennung bleibt.
const katalog = JSON.parse(readFileSync('data/adn-catalog.json', 'utf8')) as { shows: (AdnShow & { anilistId?: number })[] }
const offen = (JSON.parse(readFileSync('data/adn-anisearch-offen.json', 'utf8')) as { serien: AdnOffen[] }).serien
const offenIds = new Set(offen.map((o) => o.showId))
const ohne = katalog.shows.filter((s) => !s.anisearchId).map((s) => s.showId).sort((a, b) => a - b)
pruefe('jede Serie ohne aniSearch-Kennung steht in der Liste der offenen, und umgekehrt', JSON.stringify(ohne) === JSON.stringify([...offenIds].sort((a, b) => a - b)), { ohne, offen: [...offenIds] })
const vergebene = katalog.shows.map((s) => s.anisearchId).filter(Boolean)
pruefe('keine aniSearch-Kennung doppelt im Katalog', new Set(vergebene).size === vergebene.length)
pruefe('keine Serie trägt noch eine AniList-Kennung', katalog.shows.every((s) => s.anilistId === undefined))
pruefe('„kein-kandidat“ hat keine Kandidaten, „mehrdeutig“ zwei mit gleichem Rang', offen.every((o) => {
  if (o.grund === 'kein-kandidat') return o.kandidaten.length === 0
  if (o.grund !== 'mehrdeutig') return true
  const [a, b] = o.kandidaten
  return Boolean(a && b && a.gleich === b.gleich && a.punkte === b.punkte)
}))

// Kalenderserien ohne Platz in Katalog und Liste: Fälle (Mutanten: Katalog oder Liste weglassen, Vereinigung statt Schnitt).
const kal = [{ showId: 1, title: 'A' }, { showId: 2, title: 'B' }, { showId: 3, title: 'C' }, { showId: 4, title: 'D' }]
pruefe('Kalenderserie nur im Katalog, nur in der Liste, in beiden oder in keinem: nur die in keinem bleibt', JSON.stringify(kalenderOhneNetz(kal, [{ showId: 1 }, { showId: 3 }], [{ showId: 2 }, { showId: 3 }])) === '[{"showId":4,"title":"D"}]', kalenderOhneNetz(kal, [{ showId: 1 }], [{ showId: 2 }]))
pruefe('Kalenderserien: alles leer ergibt alle, nichts im Kalender ergibt nichts', kalenderOhneNetz(kal, [], []).length === 4 && kalenderOhneNetz([], [{ showId: 1 }], []).length === 0)
// Der eingecheckte Kalender: Lücken sind erlaubt (Katalog-Lauf hinkt), aber sichtbar. Warnung statt Fehler, weil eine neue Serie bis zum nächsten Lauf fehlen darf.
const kalenderShows = (JSON.parse(readFileSync('data/adn.json', 'utf8')) as { shows: { showId: number; title: string }[] }).shows
const luecken = kalenderOhneNetz(kalenderShows, katalog.shows, offen)
const lueckenZeile = kalenderLueckenZeile(luecken, kalenderShows.length)
if (lueckenZeile) console.log(lueckenZeile)
console.log(`check-adn-anisearch: Kalenderserien ohne Katalog und Liste: ${luecken.length}`)

if (fehler) process.exit(1)
console.log('check-adn-anisearch: ok')
