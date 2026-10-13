import type { Title } from '../../shared/types.ts'

/**
 * **Videoload gilt als deutsch** (Daniel, 22.09.2026: Telekom Deutschland, Katalog durchstöbert, „bis wir
 * irgendwann ein Gegenteil beweisen"). Ein Weg mit eigener Angabe (`dubRanges`) behält sie.
 * Gibt die Zahl der gesetzten Wege zurück.
 */
export function setzeTelekomAnnahme(title: Title): number {
  let gesetzt = 0
  for (const w of title.watchLinks ?? []) {
    if (w.name !== 'Videoload' || w.dubRanges?.length) continue
    w.dubRanges = [{ from: 1, to: title.format === 'MOVIE' ? 1 : Math.max(1, title.episodes ?? 1), dub: true }]
    gesetzt++
  }
  return gesetzt
}
