/**
 * Zusicherung: JustWatchs Werbetarif („Netflix Standard with Ads“) ist derselbe Weg wie der Anbieter
 * selbst — er erscheint nie als eigener Weg und belegt keinen der vier Plätze (03.11.2026).
 * Echte Auslöser: die fünf Titel mit Doppelung im Bestand, Angebote wörtlich aus `data/justwatch-audio.json`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-werbetarif-weg.ts`
 */
import { providerName } from '../shared/mappings.ts'
import type { Title } from '../shared/types.ts'
import { ergaenzeWegeOhneWeg, type JwEintrag } from './bau/11-2-2-wege-ohne-weg.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nWerbetarif als eigener Weg:')
const namen: Record<string, string> = {
  'Netflix Standard with Ads': 'Netflix',
  'Amazon Prime Video with Ads': providerName('Amazon Prime Video'),
  'Amazon Prime Video Free with Ads': providerName('Amazon Prime Video'),
}
for (const [roh, soll] of Object.entries(namen)) {
  pruefe(`providerName("${roh}") == "${soll}"`, providerName(roh) === soll, providerName(roh))
}
pruefe('Kontrolle: „Netflix“ bleibt „Netflix“', providerName('Netflix') === 'Netflix')
pruefe('Kontrolle: „Ads“ im Namen ohne Werbetarif-Endung bleibt', providerName('Ads Plus Tv') === 'Ads Plus Tv', providerName('Ads Plus Tv'))

const jw = readJson<Record<string, JwEintrag>>('data/justwatch-audio.json', {})
const IDS = [103276, 10014120, 10018789, 10019343, 10020483]
const titles = new Map<number, Title>(IDS.map((id) => [id, { id, streams: [], keywords: [], genres: [] } as unknown as Title]))
ergaenzeWegeOhneWeg({ titles, jw, handNein: new Set(), tmdbMehrdeutig: new Set(), istTot: () => false })
let mitNetflix = 0
for (const id of IDS) {
  const wege = titles.get(id)?.watchLinks ?? []
  const namenDa = wege.map((w) => w.name)
  const hatWerbe = (jw[String(id)]?.angebote ?? []).some((a) => /with ads/i.test(a.anbieter))
  if (!hatWerbe) continue
  mitNetflix++
  pruefe(`${id}: kein Weg mit „Ads“ im Namen`, !namenDa.some((n) => /\bads\b/i.test(n)), namenDa)
  pruefe(`${id}: jeder Name nur einmal`, new Set(namenDa).size === namenDa.length, namenDa)
}
pruefe('Vorbedingung: mindestens ein Titel der Liste hat Werbetarif-Angebote in justwatch-audio.json', mitNetflix > 0, mitNetflix)

console.log(`\nWerbetarif-Weg: ${verletzt === 0 ? 'ok' : `${verletzt} Verstöße`} (${mitNetflix} Titel mit Werbetarif geprüft)`)
if (verletzt) process.exit(1)
