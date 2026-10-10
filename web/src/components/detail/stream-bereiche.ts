import { bereicheMitTermin } from '@shared/logic.ts'
import type { Release, Title } from '@shared/types.ts'

/**
 * **Belegte Bereiche plus erschienene Folgen des deutschen Wochenplans** (25.09.2026,
 * `bereicheMitTermin`): Sonst zählte das Panel bei einer laufenden Serie nur den Beleg vom
 * Prüftag — „10 von 12" neben „Ep 12/12" in der Woche (Vom Landei zum Schwertheiligen II).
 */
export function titelMitTerminBereichen(titel: Title | undefined, releases: Release[]): Title | undefined {
  if (!titel?.streams?.length) return titel
  if (!releases.some((r) => r.releaseType === 'weekly')) return titel
  return {
    ...titel,
    streams: titel.streams.map((s) => ({ ...s, dubRanges: bereicheMitTermin(s.dubRanges, releases, s.platform) })),
  }
}
