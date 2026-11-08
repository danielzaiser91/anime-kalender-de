/**
 * Welcher deutsche Crunchyroll-Katalogblock gehört zu einem Titel an einer Serie? Gemeinsam für OmU-Begleiter
 * (`pipeline/bau/omu-synchro-begleiter.ts`) und Wache (`tools/synchro-wartezeit.mjs`). Nur Node-Bordmittel (Wache ohne `npm ci`).
 */
import { katalogBlock } from './cr-katalogblock.mjs'

/**
 * @param {import('../pipeline/lib/crunchyroll-dub.ts').CrSerie[]} serien
 * @param {string} kennung
 * @param {{ nummern: number[], namen?: string[], folgen?: number, geteilt?: boolean }} titel
 * @returns {{ treffer: { block: object, url: string } | null, weg?: string, grund?: string }}
 */
export function blockWahl(serien, kennung, titel) {
  const treffer = katalogBlock(serien, kennung, titel.nummern)
  return treffer ? { treffer, weg: 'zahl' } : { treffer: null, grund: 'kein Block mit passender Staffelnummer' }
}
