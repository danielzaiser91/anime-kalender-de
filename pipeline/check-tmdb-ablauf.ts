/**
 * Zusicherungen zu `lib/tmdb-ablauf.ts`: TMDB-Inhalt wird nach 150 Tagen gestrichen, die Zuordnung bleibt (API-Bedingungen: höchstens 6 Monate).
 * Aufruf: `npm run check:logic`.
 */
import { alterInTagen, inhaltsStand, streicheAbgelaufenes, type MitInhaltsstand } from './lib/tmdb-ablauf.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const jetzt = new Date('2026-10-12T12:00:00Z')
const vorTagen = (tage: number): string => new Date(jetzt.getTime() - tage * 86_400_000).toISOString()
type Eintrag = MitInhaltsstand & { tmdbId: number; kind: string; jahr: number; overviewDe?: string; offers?: unknown[] }
const eintrag = (stand: Partial<MitInhaltsstand>): Eintrag => ({ tmdbId: 7, kind: 'tv', jahr: 2020, overviewDe: 'Handlung', offers: [], ...stand })

console.log('\nTMDB-Ablauf: Alter')
pruefe('Alter in vollen Tagen', alterInTagen(vorTagen(150), jetzt) === 150)
pruefe('ohne Datum ist das Alter unbekannt', alterInTagen(undefined, jetzt) === undefined)
pruefe('inhaltAm gilt vor fetchedAt', inhaltsStand({ inhaltAm: 'a', fetchedAt: 'b' }) === 'a')
pruefe('ohne inhaltAm gilt fetchedAt', inhaltsStand({ fetchedAt: 'b' }) === 'b')

console.log('\nTMDB-Ablauf: Streichung')
const cache: Record<string, Eintrag> = {
  frisch: eintrag({ fetchedAt: vorTagen(10), inhaltAm: vorTagen(10) }),
  grenze: eintrag({ fetchedAt: vorTagen(150), inhaltAm: vorTagen(150) }),
  alt: eintrag({ fetchedAt: vorTagen(151), inhaltAm: vorTagen(151) }),
  /* Fehltreffer setzt fetchedAt neu, der Inhalt ist aber alt: inhaltAm entscheidet. */
  fehltreffer: eintrag({ fetchedAt: vorTagen(1), inhaltAm: vorTagen(200) }),
  ohneDatum: eintrag({}),
  ohneInhalt: { tmdbId: 8, kind: 'tv', jahr: 2021, fetchedAt: vorTagen(400) },
}
const gestrichen = streicheAbgelaufenes(cache, jetzt)
pruefe('gestrichen: nur Einträge mit altem oder unbekanntem Inhaltsstand', gestrichen.join() === 'alt,fehltreffer,ohneDatum', gestrichen)
pruefe('frisch und genau 150 Tage bleiben', Boolean(cache.frisch?.overviewDe) && Boolean(cache.grenze?.overviewDe))
pruefe('Handlung und Anbieter sind weg', cache.alt?.overviewDe === undefined && cache.alt?.offers === undefined)
pruefe('Zuordnung bleibt', cache.alt?.tmdbId === 7 && cache.alt?.kind === 'tv' && cache.alt?.jahr === 2020)
pruefe('ein Eintrag ohne Inhalt wird nicht angefasst', JSON.stringify(cache.ohneInhalt) === JSON.stringify({ tmdbId: 8, kind: 'tv', jahr: 2021, fetchedAt: vorTagen(400) }))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Ablauf: alle Zusicherungen halten.')
