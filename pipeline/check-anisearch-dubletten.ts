/**
 * Zusicherung: Dasselbe Werk steht nicht als AniList-Katalogtitel **und** als aniSearch-Zeile in der Ausgabe (Daniel, 09.10.2026: „Laid-Off
 * Cheat-Granting Mage" zweimal; 2.400 Zeilen betroffen). Regel und Grenzen: `bau/anisearch-dubletten.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-dubletten.ts`
 */
import { readFileSync } from 'node:fs'
import { todayIso } from '../shared/time.ts'
import { anisearchZeilenDoppelt, findeAnisearchDubletten, gleichesWerk, type KatalogKandidat } from './bau/anisearch-dubletten.ts'
import { undatierteKennungen } from './lib/katalog-plan.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T
const BASIS = 10_000_000

/** Bis dahin darf der ausgelieferte Datensatz noch den Stand vor dem Fix tragen (der nächste Datenlauf baut ihn neu); danach wird die Prüfung rot. */
const UEBERGANG_BIS = '2026-10-16'

console.log('\naniSearch-Zeile und AniList-Katalogtitel (ein Werk, eine Zeile):')
{
  const eintraege = {
    '21236': { mal: 63431, ty: 'TV-Serie', y: 2026, f: 12, dub: '-' }, // Laid-Off Cheat-Granting Mage (AniList 207329, Folgen dort offen)
    '1022': { mal: 567, ty: 'TV-Serie', y: 1999, f: 13, dub: '-' }, // The Big O
    '900': { mal: 567, ty: 'TV-Spezial', y: 1999, f: 1, dub: '-' }, // Special unter der MAL der Serie
    '901': { mal: 700, ty: 'TV-Serie', y: 2020, f: 12, dub: 'p' }, // mit geplantem Deutsch: Handdatei, nicht der Bau
    '902': { mal: 800, ty: 'Film', y: 2001, f: 1, dub: '-' },
    '903': { mal: 800, ty: 'Film', y: 2001, f: 1, dub: '-' }, // zweite Zeile desselben Werks: mehrdeutig
  }
  const katalog: KatalogKandidat[] = [
    { id: 207329, mal: 63431, format: 'TV', jahr: 2026, folgen: null },
    { id: 567, mal: 567, format: 'TV', jahr: 1999, folgen: 13 },
    { id: 701, mal: 700, format: 'TV', jahr: 2020, folgen: 12 },
    { id: 801, mal: 800, format: 'MOVIE', jahr: 2001, folgen: 1 },
  ]
  const zeile = (as: number) => BASIS + as
  const u = findeAnisearchDubletten([zeile(21236), zeile(1022), zeile(900), zeile(901), zeile(902), zeile(903)], [], katalog, eintraege)
  pruefe('Laid-Off Cheat-Granting Mage: Zeile hinter dem Schalter entfällt zugunsten des Katalogtitels (Folgenzahl dort offen)', u.zeilenWeg.get(zeile(21236)) === 207329)
  pruefe('The Big O: gleiche MAL, Format, Jahr und Folgen → eine Zeile', u.zeilenWeg.get(zeile(1022)) === 567)
  pruefe('Ein Special unter der MAL der Serie bleibt (anderes Format)', !u.zeilenWeg.has(zeile(900)))
  pruefe('Eine Zeile mit geplantem Deutsch bleibt (die Handdatei bindet sie, die Erstausgabe geht sonst verloren)', !u.zeilenWeg.has(zeile(901)))
  pruefe('Zwei Zeilen für einen Katalogtitel: keine wird geraten', !u.zeilenWeg.has(zeile(902)) && !u.zeilenWeg.has(zeile(903)))
  const haupt = findeAnisearchDubletten([], [zeile(1022)], katalog, eintraege)
  pruefe('Steht die Zeile im Hauptbestand (Termin, Meldung), entfällt der Katalogtitel statt ihrer', haupt.katalogWeg.get(567) === zeile(1022) && haupt.zeilenWeg.size === 0)
  const magical = { '18711': { mal: 56733, ty: 'TV-Serie', y: 2026, f: 13, dub: '-' } }
  pruefe('Magical Explorer: aniSearch „TV-Serie", AniList ONA, gleiche MAL und 13 Folgen → eine Zeile',
    findeAnisearchDubletten([zeile(18711)], [], [{ id: 169581, mal: 56733, format: 'ONA', jahr: 2026, folgen: 13 }], magical).zeilenWeg.get(zeile(18711)) === 169581)
  const ausgabe = [{ id: 169581, anisearchId: 18711, malId: 56733, format: 'ONA', jpYear: 2026, episodes: 13 }, { id: zeile(18711) }]
  pruefe('Ausgabe-Invariante: Zeile und AniList-Titel mit ihrer Kennung stehen beide da → Fehler', anisearchZeilenDoppelt(ausgabe, magical).length === 1)
  pruefe('Ausgabe-Invariante: nur der AniList-Titel (Zeile entfallen) → in Ordnung', anisearchZeilenDoppelt(ausgabe.slice(0, 1), magical).length === 0)
  pruefe('Ausgabe-Invariante: ohne Kennung, aber gleiche MAL/Format/Jahr/Folgen → Fehler', anisearchZeilenDoppelt([{ ...ausgabe[0]!, anisearchId: undefined }, ausgabe[1]!], magical).length === 1)
  pruefe('Ausgabe-Invariante: Zeile mit Deutsch (Handdatei) und begründete Ausnahme (MAL_AUSNAHMEN) melden nichts',
    anisearchZeilenDoppelt(ausgabe, { '18711': { ...magical['18711'], dub: 'd' } }).length === 0 && anisearchZeilenDoppelt([{ id: 5, anisearchId: 3873 }, { id: zeile(3873) }], { '3873': { ty: 'TV-Serie', dub: '-' } }).length === 0)
  pruefe('Jahr daneben (mehr als eins) oder andere Folgenzahl: kein gleiches Werk',
    !gleichesWerk({ mal: 5, ty: 'TV-Serie', y: 2000, f: 12, dub: '-' }, { id: 1, mal: 5, format: 'TV', jahr: 2003, folgen: 12 }) &&
      !gleichesWerk({ mal: 5, ty: 'TV-Serie', y: 2000, f: 12, dub: '-' }, { id: 1, mal: 5, format: 'TV', jahr: 2000, folgen: 24 }))
}

console.log('\nKatalog: Einträge ohne Startdatum werden nach Kennung aufgefrischt:')
{
  const liste = [{ id: 163794, start: null }, { id: 5, start: '2026-10-07' }, { id: 9, start: undefined }, { id: 7, start: '2026' }]
  pruefe('„The Boxer" (angekündigt ohne Datum, alte Kennung) ist dabei, datierte Einträge nicht', undatierteKennungen(liste).join() === '9,163794')
  pruefe('höchstens `grenze` Kennungen je Lauf', undatierteKennungen(liste, 1).length === 1)
}

console.log('\nAusgelieferter Datensatz:')
{
  type Zeile = { id: number; malId?: number; format?: string; jpYear?: number; episodes?: number; ohneSynchro?: boolean; dubConfidence?: string }
  const eintraege = lies<Record<string, { mal?: number; ty: string; y?: number; f?: number; dub: string }>>('data/anisearch-eintraege.json')
  const titel = lies<Zeile[]>('public/data/titles.json')
  const ohne = lies<Zeile[]>('public/data/ohne-synchro.json')
  const katalog: KatalogKandidat[] = ohne.filter((t) => t.id < BASIS).map((t) => ({ id: t.id, mal: t.malId, format: t.format, jahr: t.jpYear, folgen: t.episodes }))
  const hinter = ohne.filter((t) => t.id >= BASIS).map((t) => t.id)
  const haupt = titel.filter((t) => t.id >= BASIS).map((t) => t.id)
  const u = findeAnisearchDubletten(hinter, haupt, katalog, eintraege)
  const doppelt = [...u.zeilenWeg, ...u.katalogWeg].map(([a, b]) => `${a} ↔ ${b}`)
  const bis = todayIso() <= UEBERGANG_BIS
  pruefe(
    `kein Werk steht als aniSearch-Zeile und als AniList-Katalogtitel zugleich (Übergang bis ${UEBERGANG_BIS}: ${doppelt.length} Paare)`,
    doppelt.length === 0 || bis,
    doppelt.slice(0, 5),
  )
  const ausgeliefert = anisearchZeilenDoppelt([...titel, ...ohne], eintraege)
  pruefe(`Ausgabe-Invariante auf dem Bestand (Übergang bis ${UEBERGANG_BIS}: ${ausgeliefert.length} Paare; der Bau selbst bricht ohne Übergang ab)`, ausgeliefert.length === 0 || bis, ausgeliefert.slice(0, 3))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
