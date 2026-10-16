/**
 * Zusicherung: Die aniSearch-Folgentitel im TV-Bau (`bau/08-news-tv.ts`) finden die Kennung auch dort, wo sie nur über den Titel kommt
 * (Hand, Katalog, MAL-Brücke, reiner aniSearch-Titel) und nicht in `data/anisearch.json` steht. 17.10.2026: im Bestand 4 Titel mit Folgen, 272 Titel ohne Tabellenzeile.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-folgen-kennung.ts`
 */
import { folgenListen } from './bau/08-news-tv.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const folge = (nr: number, de: string) => ({ nr, de })
const dateien: Record<string, unknown> = {
  'data/anisearch.json': { '1': { anisearchId: 101 }, '3': { anisearchId: 103 }, '7': { anisearchId: 107 } },
  'data/anisearch-folgen.json': {
    '101': { folgen: [folge(1, 'Eins')] },
    '102': { folgen: [folge(1, 'Zwei')] },
    '103': { folgen: [folge(1, 'Drei')] },
    '104': { folgen: [folge(1, 'Vier')] },
    '203': { folgen: [folge(1, 'Hand')] },
    '107': { folgen: [folge(1, 'Sieben')] },
  },
}
/* Kulisse prüft den Pfad: ein unbekannter Pfad ist ein Fehler, keine leere Antwort wie bei `readJson`. */
const lies = ((pfad: string, rueck: unknown) => {
  if (pfad in dateien) return dateien[pfad]
  if (['data/tmdb-folgen.json', 'data/rtlplus-folgen.json', 'data/wikipedia-folgen.json'].includes(pfad)) return rueck
  throw new Error(`unerwarteter Pfad ${pfad}`)
}) as never

const titel = (id: number, mal?: number) => [id, { id, malId: mal } as Title] as const
const titles = new Map<number, Title>([titel(1, 11), titel(2, 22), titel(3, 33), titel(4, 44), titel(5, 55)])
let gesehen: { id: number; mal?: number }[] = []
const kennungen = (liste: { id: number; mal?: number }[]) => {
  gesehen = liste
  return new Map<number, number>([[2, 102], [3, 203], [4, 104]])
}

console.log('\naniSearch-Folgentitel: Kennung aus Tabelle und Titel:')
const liste = folgenListen(titles, { lies, kennungen })
pruefe('Tabellenzeile am Rand gilt (Titel 1)', liste['1']?.folgen[0]?.dt === 'Eins', liste['1'])
pruefe('Kennung nur im Titel, in der Mitte, gilt (Titel 2)', liste['2']?.folgen[0]?.dt === 'Zwei', liste['2'])
pruefe('Bei Streit gewinnt die Kennung des Titels (Hand vor Tabelle, Titel 3)', liste['3']?.folgen[0]?.dt === 'Hand', liste['3'])
pruefe('Kennung nur im Titel, hinten, gilt (Titel 4)', liste['4']?.folgen[0]?.dt === 'Vier', liste['4'])
pruefe('Gegenprobe: Titel ohne Kennung bekommt keine Liste (Titel 5)', liste['5'] === undefined, liste['5'])
pruefe('Tabellenzeile ohne Titel im Bau bleibt (7)', liste['7']?.folgen[0]?.dt === 'Sieben', liste['7'])
pruefe('Die Adresse trägt die Kennung des Titels (102)', liste['2']?.url === 'https://www.anisearch.de/anime/102/episodes', liste['2']?.url)
pruefe('Alle Titel des Baus (mit MAL) gehen an die Kennungssuche', gesehen.length === 5 && gesehen.map((t) => t.mal).join() === '11,22,33,44,55', gesehen)

/* Die echte Kennungssuche (ohne Einspringen): ein reiner aniSearch-Titel trägt 10.000.000 + Kennung, ohne Tabellenzeile. */
dateien['data/anisearch-folgen.json'] = { '15611': { folgen: [folge(1, 'Eigen')] } }
const echt = folgenListen(new Map([titel(10_015_611)]), { lies })
pruefe('Reiner aniSearch-Titel bekommt seine Folgen über die echte Kennungssuche', echt['10015611']?.folgen[0]?.dt === 'Eigen', echt)

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\nAlle Prüfungen bestanden')
