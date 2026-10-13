/**
 * Zusicherung: ein Termin „im Angebot seit“ (`imAngebot`) trägt auf der Kachel die Marke „Im Angebot“ (Woche, Monat) und damit nicht den Anschein einer
 * Neuerscheinung (Dirigent, 13.10.2026). Muster: Katalog-Release (`check-kachel-katalog.ts`); ein Katalog-Release schlägt die Marke.
 * Aufruf: `npm run check:logic`.
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { ART_STIL, kartenArt } from '../web/src/lib/kachel-folgen.ts'
import { TEXTE_KALENDER } from '../web/src/lib/i18n-kalender.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ev = (o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: 'x@2026-03-31', releaseSlug: 'motn-1-crunchyroll', titleId: 1, name: 'X', date: '2026-03-31', releaseType: 'batch', platform: 'crunchyroll', episodeCount: 24, ...o }) as unknown as ReleaseEvent
const data = { releaseBySlug: new Map() }

console.log('\nIm Angebot seit auf der Kachel:')
pruefe('Kachel mit imAngebot trägt die Marke', kartenArt([ev({ imAngebot: true })], data) === 'imAngebot', kartenArt([ev({ imAngebot: true })], data))
pruefe('ohne imAngebot: keine Marke', kartenArt([ev()], data) === undefined)
pruefe('ein Katalog-Release schlägt die Marke', kartenArt([ev({ imAngebot: true, katalog: 'belegt' })], data) === 'katalog')
pruefe('Name und Hinweis stehen in den Texten', ART_STIL.imAngebot.name in TEXTE_KALENDER && ART_STIL.imAngebot.hinweis in TEXTE_KALENDER)
pruefe('der Hinweis sagt, dass es nicht der Erscheinungstag ist', TEXTE_KALENDER['kal.imAngebotHinweis'].includes('nicht der Erscheinungstag'))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
