import { log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'

type Bewertung = Pick<Title, 'score' | 'scoreQuelle'>

/** Bewertung eines Titels nach der Regel. */
export function bewertungNachRegel(bisher: Bewertung): Bewertung {
  return bisher
}

/** Schlagworte eines Titels nach der Regel. */
export function schlagworteNachRegel(bisher: string[]): string[] {
  return bisher
}

/** Bannerbild eines Titels nach der Regel. */
export function bannerNachRegel(bisher: string | undefined): string | undefined {
  return bisher
}

/** Bewertung, Schlagworte und Banner nach der Regel; auch für die Kopien in `verschoben`, die vor `setzeProduktFelder` entstanden. */
export function mitProduktFeldern<T extends Title>(t: T): T {
  return {
    ...t,
    ...bewertungNachRegel(t),
    keywords: schlagworteNachRegel(t.keywords),
    bannerImage: bannerNachRegel(t.bannerImage),
  }
}

/**
 * Setzt Bewertung, Schlagworte und Banner jedes Titels nach der Regel. Läuft vor `baueMeta`, damit Hauptbestand, Verschobene, Reihen
 * und Meldungen dasselbe sehen.
 */
export function setzeProduktFelder(titles: Map<number, Title>): void {
  for (const t of titles.values()) Object.assign(t, mitProduktFeldern(t))
  log(`Bewertung, Schlagworte und Banner nach Regel gesetzt (${titles.size} Titel)`)
}
