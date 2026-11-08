/**
 * Kalender-Show übernimmt die `titleId` der Katalog-Show gleicher `showId` (`adnShowsMitKatalogKennung`, `bau/adn-show-titel.ts`).
 * Anlass: Madoka Film 3 (Show 1321, Titel 11981) verlor am 06.11.2026 seinen ADN-Weg, weil nur der Katalog die `titleId` trägt.
 * Die Bestandsprobe über die echten Dateien steht in `check-adn-kennung-bestand.ts`.
 */
import { adnShowsMitKatalogKennung } from './bau/adn-show-titel.ts'
import type { AdnShow } from './lib/adn.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const show = (showId: number, titleId?: number): AdnShow => ({ showId, title: `Show ${showId}`, episodes: [], titleId }) as unknown as AdnShow
const idsVon = (shows: AdnShow[]) => shows.map((s) => `${s.showId}:${s.titleId}`)

console.log('\nADN-Kalender übernimmt die Titelkennung des Katalogs:')
const kalender = [show(1321), show(7), show(8, 500)]
const katalog = [show(1321, 11981), show(9, 42), show(8, 600)]
const ergebnis = adnShowsMitKatalogKennung(kalender, katalog)
pruefe('Kalender-Show ohne titleId bekommt die des Katalogs (Madoka 1321 → 11981)', ergebnis.find((s) => s.showId === 1321)?.titleId === 11981, idsVon(ergebnis))
pruefe('Kalender-Show ohne Katalogeintrag bleibt ohne titleId', ergebnis.find((s) => s.showId === 7)?.titleId === undefined)
pruefe('eigene titleId des Kalenders gewinnt gegen den Katalog', ergebnis.find((s) => s.showId === 8)?.titleId === 500, idsVon(ergebnis))
pruefe('nur im Katalog stehende Show bleibt mit ihrer titleId dabei', ergebnis.find((s) => s.showId === 9)?.titleId === 42)
pruefe('keine Show doppelt: 1321, 7, 8, 9', ergebnis.length === 4, idsVon(ergebnis))
pruefe('Eingabe bleibt unverändert (Kalender-Show 1321 ohne titleId)', kalender[0].titleId === undefined)
pruefe('Katalog ohne titleId (Zuordnung verworfen) lässt den Kalender ohne', adnShowsMitKatalogKennung([show(5)], [show(5)])[0].titleId === undefined)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
