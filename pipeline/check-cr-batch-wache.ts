/**
 * Test der Wache `lib/cr-batch-wache.ts`: Ein Crunchyroll-Abwurf („Neu bei Crunchyroll“) behauptet nie mehr Folgen, als belegt sind.
 * Der Anlass ist Aoashi Staffel 2 (26.10.2026) mit Herkunft, Typ und Zahl wörtlich aus `public/data/releases.json`: eine belegte
 * Folge, „24 Folgen“. Gegenfälle: ein Film (1 von 1), ein vollständiger Abwurf, eine andere Plattform, ein Wochentakt.
 * Aufruf: npx tsx pipeline/check-cr-batch-wache.ts
 */
import type { Release } from '../shared/types.ts'
import { batchUeberBelegt, belegteFolgen, crHerkunft } from './lib/cr-batch-wache.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const release = (slug: string, herkunft: string, anzahl: number, aenderung: Partial<Release> = {}): Release =>
  ({
    slug,
    titleId: 1,
    platform: 'crunchyroll',
    releaseType: 'batch',
    herkunft,
    schedule: { firstEpisodeDate: '2026-10-25', episodeCount: anzahl },
    ...aenderung,
  }) as unknown as Release

const AOASHI = 'Deutsche Fassung bei Crunchyroll — 1 Folgen mit belegtem Termin (Block „Staffel 2“)'
const namen = (liste: Release[]): string[] => batchUeberBelegt(liste).map((r) => r.slug)

pruefe('Herkunft wörtlich (Aoashi): 1 belegte Folge', belegteFolgen(AOASHI) === 1, belegteFolgen(AOASHI))
pruefe('Der Erzeuger der Herkunft und der Leser passen zusammen', belegteFolgen(crHerkunft(7, 'Staffel 2')) === 7 && crHerkunft(1, 'Staffel 2') === AOASHI, crHerkunft(1, 'Staffel 2'))
pruefe('ohne Herkunft: keine Zahl', belegteFolgen(undefined) === null && belegteFolgen('Kalender') === null)
pruefe('Aoashi: 1 belegt, 24 behauptet — gemeldet', namen([release('aoashi', AOASHI, 24)]).join() === 'aoashi', namen([release('aoashi', AOASHI, 24)]))
pruefe('Film (1 von 1): nicht gemeldet', namen([release('film', crHerkunft(1, 'Film'), 1)]).length === 0)
pruefe('vollständiger Abwurf (24 von 24): nicht gemeldet', namen([release('voll', crHerkunft(24, 'Staffel 1'), 24)]).length === 0)
pruefe('eine Folge mehr behauptet als belegt (2 von 3): gemeldet', namen([release('knapp', crHerkunft(2, 'Staffel 1'), 3)]).join() === 'knapp')
pruefe('eine Zahl darunter (3 von 2) kommt nicht vor, wäre aber kein Verstoß dieser Wache', namen([release('weniger', crHerkunft(3, 'S'), 2)]).length === 0)
pruefe('Wochentakt mit Werkszahl: nicht gemeldet', namen([release('woche', AOASHI, 24, { releaseType: 'weekly' })]).length === 0)
pruefe('andere Plattform: nicht gemeldet', namen([release('adn', AOASHI, 24, { platform: 'adn' })]).length === 0)
pruefe('Abwurf ohne Zahl: nicht gemeldet', namen([release('ohne', AOASHI, 0, { schedule: { firstEpisodeDate: '2026-10-25' } as Release['schedule'] })]).length === 0)
pruefe('Abwurf ohne Herkunftszahl (Kalender-Quelle): nicht gemeldet', namen([release('kal', 'Crunchyroll-Kalender', 24)]).length === 0)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
