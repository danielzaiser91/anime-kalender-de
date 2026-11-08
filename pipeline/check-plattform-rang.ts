/**
 * Zusicherung: Pluto TV hat einen festen Platz in der Reihenfolge der Haupt-Plattformen (`shared/plattform-rang.ts`, PR 3197).
 * Ohne den Eintrag liefert `indexOf` -1, und ein Pluto-Weg wanderte in jeder Sortierung (`sort` in `titel-hilfen.ts` und `03-reihen.ts`) an die Spitze.
 * Die erwartete Reihenfolge steht hier fest, sie wird nicht aus dem Modul abgeleitet.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-plattform-rang.ts`
 */
import { PLATFORM_PRIORITY } from '../shared/plattform-rang.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const ERWARTET = ['crunchyroll', 'netflix', 'disneyplus', 'primevideo', 'paramountplus', 'adn', 'aniverse', 'wow', 'joyn', 'rtlplus', 'plutotv', 'youtube', 'tv', 'disc', 'kino']
pruefe('Reihenfolge der Haupt-Plattformen', JSON.stringify(PLATFORM_PRIORITY) === JSON.stringify(ERWARTET), PLATFORM_PRIORITY)

/** Wie die Sortierungen im Bau: nach dem Rang in `PLATFORM_PRIORITY`. */
const sortiert = (ids: string[]): string => [...ids].sort((a, b) => PLATFORM_PRIORITY.indexOf(a as never) - PLATFORM_PRIORITY.indexOf(b as never)).join()
pruefe('Pluto TV steht hinter Joyn und RTL+, vor YouTube (Eingabe in umgekehrter Reihenfolge)', sortiert(['youtube', 'plutotv', 'rtlplus', 'joyn']) === 'joyn,rtlplus,plutotv,youtube')
pruefe('Pluto TV steht hinter den Bezahl-Anbietern, nicht an der Spitze', sortiert(['plutotv', 'netflix']) === 'netflix,plutotv')
pruefe('Pluto TV steht vor Fernsehen und Disc', sortiert(['disc', 'tv', 'plutotv']) === 'plutotv,tv,disc')
pruefe('jede Plattform kommt genau einmal vor', new Set(PLATFORM_PRIORITY).size === PLATFORM_PRIORITY.length)

console.log(`check-plattform-rang: ${faelle} Fälle ${fehler ? 'FEHLER' : 'ok'} (Pluto TV zwischen RTL+ und YouTube).`)
if (fehler) process.exit(1)
