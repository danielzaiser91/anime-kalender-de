/**
 * Folgewirkungen des Disc-Wegs im Bau (PR-Prüfer, 06.11.2026):
 * 1. `ergaenzeWegeOhneWeg` (11-2-2): Der aniSearch-Disc-Weg schließt den Riegel „ohne jeden Weg" nicht — sonst verlieren Titel ihre
 *    JustWatch-Rückfallwege (Fate/Grand Order Camelot: Netflix, Kizumonogatari I: ADN, Super Wings: Rtl+).
 * 2. `japanStartTag`: Ist Japan nicht das Original, gibt es keinen japanischen Start (Pac-Man: Englisch 15.06.2013, Japanisch 05.04.2014
 *    ist eine Synchro); der Bauschritt `werteWeitereQuellenAus` läuft wirklich gegen eine Kulisse (`AK_ROOT`, Kennungen ab 900201).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'disc-folgewirkung-'))
process.env.AK_ROOT = kulisse
/* Erst nach dem Setzen von `AK_ROOT`: `lib/util.ts` merkt sich die Wurzel beim Laden. */
const { ergaenzeWegeOhneWeg } = await import('./bau/11-2-2-wege-ohne-weg.ts')
const { japanStartTag } = await import('./lib/nah-am-japan-start.ts')
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\n11-2-2: JustWatch-Rückfallwege neben dem Disc-Weg')
{
  const AS = { name: 'aniSearch', url: 'https://www.anisearch.de/article/33705,x', kind: 'buy', zugang: 'kauf' }
  const jw = { angebote: [{ anbieter: 'Netflix', art: 'FLATRATE', url: 'https://www.netflix.com/title/82850891' }, { anbieter: 'Zavvi', art: 'BUY', url: 'https://www.zavvi.de/p/blu-ray/x/1/' }] }
  const titel = (id: number, extra: object = {}) => ({ id, streams: [], ...extra }) as unknown as Title
  const lauf = (t: Title) => {
    ergaenzeWegeOhneWeg({ titles: new Map([[t.id, t]]), jw: { [t.id]: jw }, handNein: new Set(), tmdbMehrdeutig: new Set(), istTot: () => false })
    return (t.watchLinks ?? []).map((w) => w.name)
  }
  pruefe('nur der aniSearch-Disc-Weg: Netflix und Zavvi kommen dazu, der Disc-Weg bleibt (zuletzt)', lauf(titel(900301, { watchLinks: [AS] })).join() === 'Netflix,Zavvi,aniSearch')
  pruefe('Kontrolle: ganz ohne Weg bekommt dasselbe, ohne Disc-Weg', lauf(titel(900302)).join() === 'Netflix,Zavvi')
  pruefe('„Ausgabe bei aniSearch" (Sprachblock, 11-1 zweite Stufe) bleibt Weg und schließt den Riegel', lauf(titel(900303, { watchLinks: [{ ...AS, name: 'Ausgabe bei aniSearch' }] })).join() === 'Ausgabe bei aniSearch')
  pruefe('ein anderer Kauflink neben dem Disc-Weg schließt den Riegel', lauf(titel(900304, { watchLinks: [AS, { name: 'Amazon', url: 'https://www.amazon.de/dp/B0X', kind: 'buy' }] })).join() === 'aniSearch,Amazon')
  pruefe('ein Stream am Titel schließt den Riegel', lauf(titel(900305, { streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1' }], watchLinks: [AS] })).join() === 'aniSearch')
  pruefe('ein Stream-Weg namens aniSearch ist kein Disc-Weg', lauf(titel(900306, { watchLinks: [{ ...AS, kind: 'stream' }] })).join() === 'aniSearch')
}

console.log('\njapanStartTag')
{
  const jp = (l: string, released: string) => ({ language: l, released })
  const tag = (s: string) => Date.parse(s)
  pruefe('Japan ist das Original: Starttag bleibt', japanStartTag([jp('Japanisch', '05.04.2014 - 25.04.2015'), jp('Deutsch', '19.04.2014 - ?')]) === tag('2014-04-05'))
  pruefe('Pac-Man wörtlich: Englisch beginnt früher → kein japanischer Start', japanStartTag([jp('Japanisch', '05.04.2014 - 25.04.2015'), jp('Englisch', '15.06.2013 - ?'), jp('Deutsch', '19.04.2014 - ?')]) === undefined)
  pruefe('Englisch später als Japanisch (Crunchyroll-Dub): Starttag bleibt', japanStartTag([jp('Japanisch', '05.04.2014'), jp('Englisch', '06.04.2014 - ?')]) === tag('2014-04-05'))
  pruefe('ein Tag früher (Zeitzone, Simulcast): Starttag bleibt', japanStartTag([jp('Japanisch', '05.04.2014'), jp('Englisch', '04.04.2014 - ?')]) === tag('2014-04-05'))
  pruefe('genau 180 Tage früher: Starttag bleibt', japanStartTag([jp('Japanisch', '05.04.2014'), jp('Englisch', '07.10.2013 - ?')]) === tag('2014-04-05'))
  pruefe('181 Tage früher: kein japanischer Start', japanStartTag([jp('Japanisch', '05.04.2014'), jp('Englisch', '06.10.2013 - ?')]) === undefined)
  pruefe('gleicher Tag: Starttag bleibt', japanStartTag([jp('Japanisch', '05.04.2014'), jp('Englisch', '05.04.2014')]) === tag('2014-04-05'))
  pruefe('ein früherer Block ohne Datum ("?") zählt nicht', japanStartTag([jp('Japanisch', '05.04.2014'), jp('Englisch', '?')]) === tag('2014-04-05'))
  pruefe('ein deutscher Block weit vor Japan zählt nicht', japanStartTag([jp('Japanisch', '05.04.2014'), jp('Deutsch', '01.01.2013')]) === tag('2014-04-05'))
  pruefe('ohne japanischen Block: undefined', japanStartTag([jp('Deutsch', '19.04.2014')]) === undefined)
}

console.log('\nBauschritt werteWeitereQuellenAus: früheste Disc ersetzt das deutsche Datum nur bei japanischem Original')
try {
  const sprachen = (original: object[]) => ({ info: { languages: [...original, { language: 'Deutsch', status: 'Abgeschlossen', dubbed: true, released: '19.04.2014 - ?', publisher: ['Universal Pictures Germany'] }] } })
  const japanOriginal = [{ language: 'Japanisch', released: '05.04.2014 - 25.04.2015' }]
  const usOriginal = [...japanOriginal, { language: 'Englisch', dubbed: true, released: '15.06.2013 - ?' }]
  schreibe('data/anisearch.json', JSON.stringify({ 900201: sprachen(usOriginal), 900202: sprachen(japanOriginal) }))
  schreibe('data/disc-ausgaben.json', JSON.stringify({ 900201: [{ edition: 'X - Vol. 01', datum: '2014-10-10' }], 900202: [{ edition: 'Y - Vol. 01', datum: '2014-10-10' }] }))
  schreibe('data/anisearch-ids-hand.yaml', '{}\n')
  schreibe('data/anisearch-dubs.json', '{}')
  schreibe('data/justwatch-audio.json', '{}')
  for (const leer of ['kino-ankuendigungen.yaml', 'ankuendigungen.yaml', 'offizielle-meldungen.yaml', 'folgen-hinweise.yaml']) schreibe(`data/${leer}`, '[]\n')
  const { werteWeitereQuellenAus } = await import('./bau/09-5-weitere-quellen.ts')
  const mk = (id: number): Title => ({ id, streams: [], titleRomaji: `Kulisse ${id}`, format: 'TV', jpYear: 2014 }) as unknown as Title
  const titles = new Map([900201, 900202].map((id) => [id, mk(id)]))
  werteWeitereQuellenAus({ releases: [] as Release[], titles, adnKatalog: { shows: [] } as never, adnVerweiseErgaenzt: 0, verweiseEntfernt: [], schreibWurzel: kulisse })
  pruefe('Original englisch (Pac-Man): das deutsche Datum 19.04.2014 bleibt', titles.get(900201)!.deErstausgabe?.von === '2014-04-19', titles.get(900201)!.deErstausgabe)
  pruefe('Original japanisch, deutsches Datum 14 Tage nach Japan, Disc später: Disc-Datum gilt', titles.get(900202)!.deErstausgabe?.von === '2014-10-10', titles.get(900202)!.deErstausgabe)
} catch (e) {
  fehler++
  console.error(`  ✖ Bauschritt lief nicht: ${(e as Error).stack}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(`\nDisc-Folgewirkung: ${faelle} Fälle, ${fehler} Fehler`)
if (fehler) process.exit(1)
