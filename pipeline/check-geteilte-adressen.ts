/**
 * Zusicherungen zu `bau/geteilte-adressen.ts` (16.11.2026, Mängel-Register, Iruma-kun 107693/184492): `sharedWith` zählt Einträge je
 * Adresse, ein Weg ohne Adresse teilt nichts, und der Wege-Abschluss vermerkt auch Wege, die erst in Phase 11 entstehen.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-geteilte-adressen.ts`
 */
import type { StreamLink, Title } from '../shared/types.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { vermerkeGeteilteAdressen } from './bau/geteilte-adressen.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const DISNEY = 'https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51'
const weg = (url: string, platform = 'disneyplus'): StreamLink => ({ platform, url, zugang: 'abo' }) as StreamLink
const titel = (id: number, streams: StreamLink[]): Title => ({ id, jpYear: 2021, streams, watchLinks: [], keywords: [], genres: [] }) as unknown as Title

console.log('Regel:')
{
  const a = titel(1, [weg(DISNEY), weg('')])
  const b = titel(2, [weg(DISNEY), weg('')])
  const c = titel(3, [weg(`${DISNEY}-x`)])
  const n = vermerkeGeteilteAdressen([a, b, c])
  pruefe('zwei Titel, eine Adresse: beide Wege tragen sharedWith 2', n === 2 && a.streams[0]!.sharedWith === 2 && b.streams[0]!.sharedWith === 2, { n })
  pruefe('Grenzfall: zwei Wege mit leerer Adresse teilen nichts', a.streams[1]!.sharedWith === undefined && b.streams[1]!.sharedWith === undefined)
  pruefe('ein einzelner Weg bleibt ohne sharedWith', c.streams[0]!.sharedWith === undefined)
  b.streams = []
  vermerkeGeteilteAdressen([a, b, c])
  pruefe('Zweitlauf nach entferntem Weg: der Rest sharedWith fällt weg', a.streams[0]!.sharedWith === undefined, a.streams[0])
  const einmalig =[titel(4, [weg(DISNEY)]), titel(5, [weg(DISNEY)])]
  const gen = (function* () { yield* einmalig })()
  pruefe('ein Iterator (titles.values()) genügt, er wird nur einmal gelesen', vermerkeGeteilteAdressen(gen) === 2)
}

console.log('\nVerdrahtung (schliesseWegeAb):')
{
  suchadressenInTemp()
  const a = titel(9000050, [weg(DISNEY)])
  const b = titel(9000051, [weg(DISNEY)])
  schliesseWegeAb({
    titles: new Map([[a.id, a], [b.id, b]]),
    anisearch: {},
    releases: [],
    zugangJeAdresse: new Map(),
    tmdbMehrdeutig: new Set(),
    toteAdressen: new Set(),
    linkBefunde: {},
    verweiseEntfernt: [],
    crAdresseZu: () => undefined,
    beantworteteSuchen: new Set(),
    suchOffen: [],
    alleChecks: [],
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => undefined,
  })
  const gesetzt = [a, b].map((t) => t.streams.find((s) => s.url === DISNEY)?.sharedWith)
  pruefe('nach dem Abschluss tragen beide Disney+-Wege sharedWith 2', gesetzt.every((x) => x === 2), gesetzt)
}

if (verletzt) {
  console.error(`${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('check-geteilte-adressen: ok')
