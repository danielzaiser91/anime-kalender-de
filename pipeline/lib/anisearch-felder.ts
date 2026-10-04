/**
 * Felder, die aus dem aniSearch-Bestand an den Titel kommen: Disc-Bonus-Beleg und Laufzeit.
 *
 * Laufzeit (Daniel, 04.10.2026): Ein Special mit drei Folgen à zwei Minuten ist für Nutzer weniger interessant
 * als eines in Serien- oder Filmlänge — die Angabe gehört in jedes Detail-Panel. Quelle ist die Laufzeit je
 * Folge laut aniSearch (`info.runtimeMinutes`, bei 3.166 von 3.190 Einträgen gesetzt, 04.10.2026).
 */
import type { Title } from '../../shared/types.ts'
import { discBonusAnwenden } from './disc-bonus.ts'
import { readJson } from './util.ts'

export function anisearchFelderAnwenden(titles: Map<number, Title>): string {
  const bonus = discBonusAnwenden(titles)
  const roh = readJson<Record<string, { info?: { runtimeMinutes?: number } }>>('data/anisearch.json', {})
  let laufzeit = 0
  for (const t of titles.values()) {
    const min = roh[String(t.id)]?.info?.runtimeMinutes
    if (min && min > 0) {
      t.runtimeMin = min
      laufzeit++
    }
  }
  return `${bonus} Titel als Bonus auf einer deutschen Disc belegt, ${laufzeit} mit Laufzeit aus aniSearch`
}

let laufzeiten: Map<number, number> | undefined

/** Für Titel, die nicht durch die Titelkarte laufen (Katalog hinter dem Toggle): Laufzeit aus aniSearch, wo bekannt. */
export function mitLaufzeit<T extends { id: number; runtimeMin?: number }>(t: T): T {
  laufzeiten ??= new Map(
    Object.entries(readJson<Record<string, { info?: { runtimeMinutes?: number } }>>('data/anisearch.json', {}))
      .filter(([, e]) => (e.info?.runtimeMinutes ?? 0) > 0)
      .map(([id, e]) => [Number(id), e.info!.runtimeMinutes!]),
  )
  const min = laufzeiten.get(t.id)
  return min && t.runtimeMin === undefined ? { ...t, runtimeMin: min } : t
}
