/**
 * Test der Wache `lib/cr-auftakt-wache.ts`: Psyren (26.10.2026) wörtlich aus `public/data/releases.json`, `data/crunchyroll-dub.json`
 * (Block „Staffel 1“, 4 Folgen, 1 deutsch) und `titles.json` (jpYear 2026). Gegenfälle: Katalognachschub (jpYear 2015, Block 24, eine
 * deutsche Folge), wöchentlicher Termin, anderer Anbieter, Block vollständig deutsch, Jahr fehlt, Termin ein Tag daneben und eine Woche daneben.
 * Aufruf: npx tsx pipeline/check-cr-auftakt-wache.ts
 */
import type { Release, Title } from '../shared/types.ts'
import type { CrSerie } from './lib/crunchyroll-dub.ts'
import { auftaktAlsKatalog, startetImTerminjahr } from './lib/cr-auftakt-wache.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL = 'https://www.crunchyroll.com/de/series/GT00371866/psyren'
const release = (aenderung: Partial<Release> = {}): Release =>
  ({ slug: 'psyren-crunchyroll-de-2026-10-26', titleId: 204011, platform: 'crunchyroll', platformUrl: URL, releaseType: 'batch', dateMeaning: 'available-from', schedule: { firstEpisodeDate: '2026-10-26', episodeCount: 1 }, ...aenderung }) as unknown as Release
const am = (tag: string) => ({ schedule: { firstEpisodeDate: tag, episodeCount: 1 } }) as unknown as Partial<Release>
const titel = (jpYear: number | undefined, id = 204011) => new Map([[id, { id, jpYear } as Title]])
const serie = (deutsch: string[], folgen = 4): CrSerie =>
  ({ url: URL, seriesId: 'GT00371866', staffeln: [{ name: 'Staffel 1', folgen, deutsch: deutsch.length, deutscheFolgen: deutsch.map((verfuegbarAb, i) => ({ nummer: i + 1, guid: `g${i}`, verfuegbarAb })) }] }) as unknown as CrSerie
const ERSTE = ['2026-10-26T14:30:00Z']
const VIER = [...ERSTE, '2026-11-02T15:30:00Z', '2026-11-09T15:30:00Z', '2026-11-16T15:30:00Z']

pruefe('Psyren: Katalogtermin einer 2026 gestarteten Serie mit 1 von 4 deutschen Folgen wird gemeldet', auftaktAlsKatalog([release()], titel(2026), [serie(ERSTE)]).length === 1)
pruefe('Katalognachschub (jpYear 2015, Block 24, 1 deutsche Folge): nicht gemeldet', auftaktAlsKatalog([release()], titel(2015), [serie(ERSTE, 24)]).length === 0)
pruefe('Serie aus dem Vorjahr (2025) gegen Termin 2026: nicht gemeldet', auftaktAlsKatalog([release()], titel(2025), [serie(ERSTE)]).length === 0)
pruefe('ohne jpYear: nicht gemeldet', auftaktAlsKatalog([release()], titel(undefined), [serie(ERSTE)]).length === 0)
pruefe('wöchentlicher Termin (nach dem Fix): nicht gemeldet', auftaktAlsKatalog([release({ releaseType: 'weekly', dateMeaning: undefined })], titel(2026), [serie(ERSTE)]).length === 0)
pruefe('anderer Anbieter: nicht gemeldet', auftaktAlsKatalog([release({ platform: 'adn' })], titel(2026), [serie(ERSTE)]).length === 0)
pruefe('Block vollständig deutsch (4 von 4): nicht gemeldet', auftaktAlsKatalog([release()], titel(2026), [serie(VIER)]).length === 0)
pruefe('Termin einen Tag nach dem Blockbeginn (UTC gegen Berlin): gemeldet', auftaktAlsKatalog([release(am('2026-10-27'))], titel(2026), [serie(ERSTE)]).length === 1)
pruefe('Termin eine Woche nach dem Blockbeginn: nicht gemeldet', auftaktAlsKatalog([release(am('2026-11-02'))], titel(2026), [serie(ERSTE)]).length === 0)
pruefe('zwei deutsche Folgen am Starttag (Abwurf, Auslegung bleibt): nicht gemeldet', auftaktAlsKatalog([release()], titel(2026), [serie([...ERSTE, ...ERSTE])]).length === 0)
pruefe('Serie nicht im Dub-Bestand: nicht gemeldet', auftaktAlsKatalog([release()], titel(2026), []).length === 0)
pruefe('Jahresgrenze: Serie 2026, Termin 31.12.2026 gilt, Termin 01.01.2027 nicht', startetImTerminjahr({ jpYear: 2026 }, '2026-12-31') && !startetImTerminjahr({ jpYear: 2026 }, '2027-01-01'))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
