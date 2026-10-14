import { istKeineTitelseite } from './11-7-wege-aus-terminen.ts'
import { type Release } from '../../shared/types.ts'

const ADN_EIGEN = /^adn-/

/**
 * **Ein kuratierter ADN-Termin und der ADN-Termin desselben Titels am selben Tag sind ein Termin** (13.10.2026, vier Bleach-Filme: kuratiert aus
 * dem Anime2You-Artikel, danach kam derselbe Film mit Uhrzeit aus ADNs Schnittstelle, und die Woche zeigte zwei Kacheln).
 * Der kuratierte bleibt (Slug, Name, Quelle); von ADN übernimmt er die Adresse, wenn er keine oder nur eine Suche trägt, und die Uhrzeit, wenn er
 * keine hat. Der ADN-Eintrag fällt weg; seine Quellen wandern an den kuratierten.
 * Gibt zurück, wie viele ADN-Einträge aufgegangen sind.
 */
export function verschmelzeAdnMitKuratiertem(releases: Release[]): number {
  let aufgegangen = 0
  for (const adn of [...releases]) {
    if (adn.platform !== 'adn' || !ADN_EIGEN.test(adn.slug) || adn.titleId <= 0) continue
    const kuratiert = releases.find(
      (k) => k !== adn && k.platform === 'adn' && !ADN_EIGEN.test(k.slug) && k.titleId === adn.titleId && k.schedule.firstEpisodeDate === adn.schedule.firstEpisodeDate,
    )
    if (!kuratiert) continue
    if (adn.platformUrl && (!kuratiert.platformUrl || istKeineTitelseite(kuratiert.platformUrl))) kuratiert.platformUrl = adn.platformUrl
    if (adn.schedule.time && !kuratiert.schedule.time) kuratiert.schedule.time = adn.schedule.time
    kuratiert.sources = [...new Set([...(kuratiert.sources ?? []), ...(adn.sources ?? [])])]
    releases.splice(releases.indexOf(adn), 1)
    aufgegangen++
  }
  return aufgegangen
}
