import type { Release } from '../../shared/types.ts'
import { berlinToUtc } from '../../shared/time.ts'
import { expandEvents, istErschienen } from '../../shared/logic.ts'

/**
 * Höchste bereits erschienene Folge je Anbieter aus dessen nummerierten Wochenplänen (26.10.2026, Beyblade X: „128 von 128“
 * bei belegten 122). Ein Anbieter ohne nummerierte Termine (Komplettdrop, Katalog) fehlt: sein Weg gilt dann weiter für
 * alle erschienenen Folgen. Läuft der Plan, aber nichts ist erschienen, steht 0 da. Ob der Plan noch läuft, spielt keine
 * Rolle: belegt ist, was er ausgespielt hat (`jpEnd` taugt nicht, Beyblade X trägt das Ende der ersten Staffel).
 */
export function hoechsteFolgeJeAnbieter(releases: Release[], heute: string): Map<string, number> {
  const jetzt = berlinToUtc(heute, '23:59')
  const hoechste = new Map<string, number>()
  for (const r of releases) {
    if (r.releaseType !== 'weekly') continue
    if (!r.schedule.episodeCount) {
      hoechste.set(r.platform, Math.max(hoechste.get(r.platform) ?? 0, wochenAbStart(r, heute)))
      continue
    }
    const mitNummer = expandEvents(r).filter((e) => typeof e.episode === 'number')
    if (!mitNummer.length) continue
    const erschienen = mitNummer.filter((e) => istErschienen(e, jetzt)).map((e) => e.episode as number)
    hoechste.set(r.platform, Math.max(hoechste.get(r.platform) ?? 0, ...erschienen))
  }
  return hoechste
}

/**
 * Wochenplan ohne Folgenzahl (213805, 28.10.2026: Quelle „Simulcast: Jeden Donnerstag eine neue Episode“, „1 verfügbar“;
 * der Bau zeigte 12 von 12): eine Folge je volle Woche seit dem Start, ab `firstEpisodeNumber`. Vor dem Start 0.
 */
function wochenAbStart(r: Release, heute: string): number {
  const start = r.schedule.firstEpisodeDate
  if (!start || start > heute) return 0
  const tage = (Date.parse(`${heute}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
  return (r.schedule.firstEpisodeNumber ?? 1) - 1 + Math.floor(tage / 7) + 1
}
