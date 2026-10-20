/**
 * Zusicherung (20.10.2026): Eine Widerlegung löst den geteilten Crunchyroll-Weg nicht, wenn der Katalog
 * deutsche Folgen ab dem Tag der Widerlegung führt (Reincarnated Aristocrat S3: Folge 1 deutsch ab 18.10.).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-widerlegung-de-folgen.ts`
 */
import type { Release, Title } from '../shared/types.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import { deutscheBereicheSeit, loeseGeteilteWegeVonWiderlegten } from './bau/widerlegung-woche.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL_A = 'https://www.crunchyroll.com/de/series/GTESTA/a'
const URL_B = 'https://www.crunchyroll.com/de/series/GTESTB/b'
const URL_C = 'https://www.crunchyroll.com/de/series/GTESTC/c'
const URL_D = 'https://www.crunchyroll.com/series/GTESTD/d'
const folge = (nummer: number, verfuegbarAb?: string) => ({ nummer, guid: `G${nummer}`, verfuegbarAb })
const serie = (url: string, deutscheFolgen: ReturnType<typeof folge>[]) => ({
  url,
  katalog: 'de',
  geprueftAm: '2026-10-19',
  staffeln: [{ name: 'S', folgen: 12, kacheln: 12, deutsch: 1, fremd: 0, deutscheFolgen }],
})
const crDub = {
  scrapedAt: '',
  serien: [
    serie(URL_A, [folge(5, '2026-10-01T15:00:00Z'), folge(1, '2026-10-18T15:00:00Z'), folge(2, '2026-10-25T15:00:00Z'), folge(3, '2026-10-26T15:00:00Z'), folge(9, undefined)]),
    serie(URL_B, [folge(4, '2026-10-17T23:00:00Z')]),
    serie(URL_C, []),
    { ...serie(URL_D, [folge(1, '2026-10-20T15:00:00Z')]), katalog: 'ja' },
  ],
} as unknown as CrDubData

const titel = (id: number, url: string): Title =>
  ({ id, titleDe: 'T', streams: [{ platform: 'crunchyroll', url, dub: true, sharedWith: 3 }] }) as unknown as Title
const release = (titleId: number, am: string): Release =>
  ({ slug: `r${titleId}-${am}`, titleId, platform: 'crunchyroll', widerlegt: { am, grund: 'x', gemeldet: true } }) as unknown as Release
const ranges = (von: number, bis: number) => JSON.stringify([{ from: von, to: bis, dub: true }])

function lauf(url: string, am: string): Title {
  const t = titel(900001, url)
  loeseGeteilteWegeVonWiderlegten([release(900001, am)], new Map([[900001, t]]), crDub)
  return t
}

console.log('\nWiderlegung und deutsche Folgen danach:')
{
  const bleibt = lauf(URL_A, '2026-10-18')
  pruefe('deutsche Folge am Tag der Widerlegung: Weg bleibt mit den Folgen ab da', bleibt.streams[0].dub === true && JSON.stringify(bleibt.streams[0].dubRanges) === ranges(1, 3), bleibt.streams[0])
  const spaeter = lauf(URL_A, '2026-10-19')
  pruefe('nur spätere Folgen zählen: Bereich 2 bis 3', JSON.stringify(spaeter.streams[0].dubRanges) === ranges(2, 3), spaeter.streams[0])
  const danach = lauf(URL_A, '2026-10-27')
  pruefe('keine deutsche Folge nach der Widerlegung: Weg gelöst', danach.streams[0].dub === undefined && !danach.streams[0].dubRanges, danach.streams[0])
  const davor = lauf(URL_B, '2026-10-18')
  pruefe('deutsche Folge einen Tag vor der Widerlegung: Weg gelöst', davor.streams[0].dub === undefined, davor.streams[0])
  const leer = lauf(URL_C, '2026-10-18')
  pruefe('Serie ohne deutsche Folgen: Weg gelöst', leer.streams[0].dub === undefined, leer.streams[0])
  const ausland = lauf(URL_D, '2026-10-18')
  pruefe('Katalog nicht deutsch: Weg gelöst', ausland.streams[0].dub === undefined, ausland.streams[0])
  const fremd = lauf('https://www.crunchyroll.com/de/series/GFREMD/x', '2026-10-18')
  pruefe('Serie nicht im Katalog: Weg gelöst', fremd.streams[0].dub === undefined, fremd.streams[0])
  const ohneDatum = deutscheBereicheSeit(crDub, URL_A, '2026-10-01')
  pruefe('Folge ohne Datum zählt nicht, Lücken trennen Bereiche', JSON.stringify(ohneDatum.map((b) => [b.from, b.to])) === JSON.stringify([[1, 3], [5, 5]]), ohneDatum)
  const zwei = titel(900002, URL_A)
  const n = loeseGeteilteWegeVonWiderlegten([release(900002, '2026-10-18'), release(900002, '2026-10-26')], new Map([[900002, zwei]]), crDub)
  pruefe('mehrere Widerlegungen: die späteste entscheidet', n === 0 && JSON.stringify(zwei.streams[0].dubRanges) === ranges(3, 3), zwei.streams[0])
}

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\nWiderlegung und deutsche Folgen: alle Prüfungen bestanden')
