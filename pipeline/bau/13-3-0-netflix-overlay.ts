import { netflixTitelAdresse } from '../lib/netflix-adresse.ts'

/** `/browse?jbv=<id>` ist ein Overlay: auf die Titelseite umschreiben (samt Umleitungstabelle); liefert die Zahl der Umschreibungen. */
export function berichtigeNetflixOverlay(slim: { streams?: { platform?: string; url: string }[] }[]): number {
  let berichtigt = 0
  for (const eintrag of slim) {
    for (const s of eintrag.streams ?? []) {
      if (s.platform !== 'netflix') continue
      const id = /\/browse\?jbv=(\d+)/.exec(s.url)?.[1]
      if (!id) continue
      s.url = netflixTitelAdresse(`https://www.netflix.com/title/${id}`)
      berichtigt++
    }
  }
  return berichtigt
}
