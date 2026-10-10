import type { PlatformId } from './types.ts'

/**
 * Warum bei dieser Plattform keine Uhrzeit steht.
 *
 * **Wo keine Uhrzeit steht, steht seit dem 01.09.2026 gar nichts** — vorher
 * stand dort „Zeit offen", und das warf beim Leser die Frage auf, was denn
 * offen sei. Daniel: „führt zu unnötiger verwirrung … und dann zweifeln
 * [Nutzer] das die daten überhaupt stimmen, und vertrauen zu uns verlieren."
 *
 * Die Erklärung gehört trotzdem irgendwohin — nur nicht in die Zeile, in der
 * eine Uhrzeit stünde. Sie steht hier, je Anbieter, und erscheint im
 * Detail-Panel: Meist gibt es die Angabe schlicht nicht, und das lässt sich
 * sagen, ohne nach einem Versäumnis auszusehen.
 *
 * Nur Netflix macht dazu eine belastbare Aussage, und die steht in ihrer
 * eigenen Hilfe. Für Disney+ und Prime Video gibt es keine — hier steht
 * deshalb genau das und keine Faustregel aus dem Internet. Eine plausible
 * Uhrzeit als `time` einzutragen wäre der bequemere Weg und genau die Art
 * Falschangabe, die dieses Projekt vermeiden will.
 */
export const PLATFORM_TIME_NOTE: Partial<
  Record<PlatformId, { de: string; source?: string }>
> = {
  netflix: {
    de: 'Netflix nennt je Titel keine Uhrzeit. Eigenproduktionen erscheinen weltweit um 00:00 Uhr Pacific Time — in Berlin also am frühen Vormittag. Lizenzierte Titel schaltet Netflix um Mitternacht Ortszeit frei.',
    source: 'https://help.netflix.com/en/node/118959',
  },
  disneyplus: {
    de: 'Disney+ veröffentlicht für Deutschland keine feste Uhrzeit.',
  },
  primevideo: {
    de: 'Prime Video macht zur Uhrzeit keine Angabe.',
  },
  aniverse: {
    de: 'aniverse nennt keine Uhrzeit.',
  },
}
