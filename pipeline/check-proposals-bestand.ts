/**
 * Zusicherungen zur Zusammenführung frischer Anime2You-Vorschläge mit dem Bestand (`lib/proposals-bestand.ts`).
 * Läuft in `check:logic`.
 */
import { vorschlaegeMitBestand } from './lib/proposals-bestand.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

interface V {
  articleUrl: string
  publishedAt: string
  sammel?: unknown
  sammelGelesen?: string
  volltextGelesen?: string
  dates?: string[]
}

const ALT: V = { articleUrl: 'https://x/alt', publishedAt: '2026-10-01' }
const frisch = (p: V): V => ({ articleUrl: p.articleUrl, publishedAt: p.publishedAt })

const ohneFeed = vorschlaegeMitBestand<V>([ALT], [])
pruefe('Bestand ohne Feed-Treffer bleibt', ohneFeed.length === 1 && ohneFeed[0]!.articleUrl === 'https://x/alt', ohneFeed)

const neu = vorschlaegeMitBestand<V>([ALT], [{ articleUrl: 'https://x/neu', publishedAt: '2026-10-02' }])
pruefe('neuer Treffer kommt zum Bestand', neu.map((p) => p.articleUrl).join() === 'https://x/alt,https://x/neu', neu)

const mitSammel: V = { ...ALT, sammel: [{ titel: 'A' }], sammelGelesen: '2026-10-05' }
const sammel = vorschlaegeMitBestand<V>([mitSammel], [frisch(mitSammel)])
pruefe('gelesene Sammelartikel-Liste bleibt', JSON.stringify(sammel[0]!.sammel) === '[{"titel":"A"}]' && sammel[0]!.sammelGelesen === '2026-10-05', sammel)

const mitVolltext: V = { ...ALT, volltextGelesen: '2026-10-05', dates: ['2026-11-01'] }
const volltext = vorschlaegeMitBestand<V>([mitVolltext], [{ ...frisch(mitVolltext), dates: [] }])
pruefe('Tage aus dem Volltext bleiben', volltext[0]!.dates?.join() === '2026-11-01' && volltext[0]!.volltextGelesen === '2026-10-05', volltext)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nVorschläge mit Bestand: alle Zusicherungen erfüllt')
