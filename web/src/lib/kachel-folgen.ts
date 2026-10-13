import type { ReleaseEvent } from '@shared/types.ts'
import { istStaffelfinale, istStaffelstart } from '@shared/tv-signale.ts'

/** Was eine Kachel an Auszeichnung trägt: Katalog-Release schlägt Staffelstart, der schlägt das Finale. */
export type KartenArt = 'start' | 'finale' | 'katalog' | 'katalogVermutlich'

/** Ring um das Cover, Farbe der Fahne und Texte (`kal.*`) je Auszeichnung — Woche und Monat teilen sie. */
export const ART_STIL = {
  start: { ring: 'ring-ak-akzent', fahne: 'bg-ak-akzent', name: 'kal.start', hinweis: 'kal.startHinweis' },
  finale: { ring: 'ring-ak-finale', fahne: 'bg-ak-finale', name: 'kal.finale', hinweis: 'kal.finaleHinweis' },
  katalog: { ring: 'ring-ak-katalog', fahne: 'bg-ak-katalog', name: 'kal.katalog', hinweis: 'kal.katalogHinweis' },
  katalogVermutlich: { ring: 'ring-ak-katalog', fahne: 'bg-ak-katalog', name: 'kal.katalogVermutlich', hinweis: 'kal.katalogVermutlichHinweis' },
} as const

export interface FolgenSpanne {
  von: number
  bis: number
}

/**
 * Die Folgen eines Bündels als lückenlose Spanne („13–14“); `undefined` bei einer einzigen Folge, bei Terminen ohne Nummer
 * oder mit Lücke — dort stünde „11–13“ für Folgen, die der Tag nicht bringt.
 */
export function folgenSpanne(buendel: ReleaseEvent[] | undefined): FolgenSpanne | undefined {
  if (!buendel || buendel.length < 2 || buendel.some((e) => !e.episode)) return undefined
  const nummern = buendel.map((e) => e.episode!).sort((a, b) => a - b)
  const von = nummern[0]!
  const bis = nummern.at(-1)!
  return nummern.every((n, i) => n === von + i) ? { von, bis } : undefined
}

type MitReleases = Parameters<typeof istStaffelstart>[1]

/** Die Auszeichnung der Kachel aus ihrem ganzen Bündel: Das Finale steht jetzt neben den anderen Folgen des Tages. */
export function kartenArt(buendel: ReleaseEvent[], data: MitReleases): KartenArt | undefined {
  if (buendel.some((e) => e.katalog === 'belegt')) return 'katalog'
  if (buendel.some((e) => e.katalog)) return 'katalogVermutlich'
  if (buendel.some((e) => istStaffelstart(e, data))) return 'start'
  return buendel.some((e) => istStaffelfinale(e, data)) ? 'finale' : undefined
}
