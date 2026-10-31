import type { AdnEpisode } from './adn.ts'
import { log } from './util.ts'

type Zeitpunkt = Pick<AdnEpisode, 'date' | 'time'>

const schluessel = (e: Zeitpunkt) => `${e.date} ${e.time}`

/**
 * Früheste und späteste Folge nach Termin, nicht nach Nummer: Stellt ADN eine
 * einzelne Folge Jahre später neu ein (Spirou 729: Folge 1 am 2025-05-05, die
 * übrigen 25 am 2021-06-16), wäre „erste Nummer" = „letzter Termin".
 */
export function terminSpanne<T extends Zeitpunkt>(folgen: T[], name = ''): { fruehste: T; spaetste: T; nachNummerVerdreht: boolean } {
  let fruehste = folgen[0]
  let spaetste = folgen[0]
  for (const e of folgen) {
    if (schluessel(e) < schluessel(fruehste)) fruehste = e
    if (schluessel(e) > schluessel(spaetste)) spaetste = e
  }
  const nachNummerVerdreht = fruehste !== folgen[0] || spaetste !== folgen.at(-1)
  if (name && nachNummerVerdreht) {
    log(`${name}: Folgentermine nicht nach Nummer geordnet — Spanne ${fruehste.date} bis ${spaetste.date} aus den Terminen.`)
  }
  return { fruehste, spaetste, nachNummerVerdreht }
}
