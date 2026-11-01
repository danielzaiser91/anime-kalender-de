import type { Title } from '../../shared/types.ts'

/**
 * Je Titel führt Crunchyroll genau eine Adresse zur Serie: Ein Folgen-Link (`/watch/…`) neben der Serienseite (`/series/…`) wäre
 * ein zweiter Anbieter mit eigener (leerer) Sprachangabe — The Vermilion Mask zeigte am 01.11.2026 „Crunchyroll ✓ Deutsch“ und
 * darunter „Crunchyroll nur Untertitel“. Mehrere Wege bei Prime (je Staffel eine ASIN) und Netflix (je Staffel eine Titelseite)
 * sind dagegen gewollt und bleiben außen vor.
 */
export function crWegDoppelt(titles: Map<number, Title>): string[] {
  const fehler: string[] = []
  for (const t of titles.values()) {
    const cr = t.streams.filter((s) => s.platform === 'crunchyroll')
    const serien = cr.filter((s) => /\/series\//.test(s.url))
    if (serien.length && cr.length > serien.length) fehler.push(`Anime ${t.id}: Crunchyroll-Folgen-Link neben der Serienseite (${cr.map((s) => s.url).join(' | ')})`)
  }
  return fehler
}
