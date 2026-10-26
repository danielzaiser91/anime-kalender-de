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
    /* Nur ein Starttermin ohne Folgenzahl sagt nichts über den Plan (213805: Netflix-Start, womöglich Komplettdrop). */
    if (!r.schedule.episodeCount) continue
    const mitNummer = expandEvents(r).filter((e) => typeof e.episode === 'number')
    if (!mitNummer.length) continue
    const erschienen = mitNummer.filter((e) => istErschienen(e, jetzt)).map((e) => e.episode as number)
    hoechste.set(r.platform, Math.max(hoechste.get(r.platform) ?? 0, ...erschienen))
  }
  return hoechste
}
