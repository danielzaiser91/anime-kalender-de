import type { Release, Title } from '../../shared/types.ts'

/**
 * **Wonach im Artikel die Fundstelle gesucht wird** (Daniel, 04.10.2026, „Zur Fundstelle" im Beleg-Dialog): die Namen der Titel, deren Termine
 * der Artikel belegt — der ausführlichste zuerst, dann der Name vor dem Doppelpunkt („Tokyo Revengers" statt „Tokyo Revengers: War of the Three Titans").
 */
export function suchbegriffeJeAdresse(releases: Release[], titles: Title[]): Map<string, string[]> {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const je = new Map<string, Set<string>>()
  for (const r of releases) {
    const t = nachId.get(r.titleId)
    const namen = [r.name, t?.titleDe, t?.titleEn, t?.titleRomaji].filter((n): n is string => Boolean(n))
    const urls = new Set([...(r.sources ?? []), ...(r.quellen ?? []).map((q) => q.url)])
    for (const url of urls) {
      const menge = je.get(url) ?? new Set<string>()
      for (const n of namen) {
        menge.add(n)
        const kopf = n.split(':')[0]!.trim()
        if (kopf.length >= 5) menge.add(kopf)
      }
      je.set(url, menge)
    }
  }
  return new Map([...je].map(([url, menge]) => [url, [...menge].sort((a, b) => b.length - a.length)]))
}

/** Die Starttage, die ein Artikel belegt (`YYYY-MM-DD`) — die Stützstelle im Artikel nennt Titel **und** einen davon (`beleg-stelle.ts`). */
export function tageJeAdresse(releases: Release[]): Map<string, string[]> {
  const je = new Map<string, Set<string>>()
  for (const r of releases) {
    const tag = r.schedule?.firstEpisodeDate
    if (!tag) continue
    for (const url of new Set([...(r.sources ?? []), ...(r.quellen ?? []).map((q) => q.url)])) je.set(url, (je.get(url) ?? new Set<string>()).add(tag))
  }
  return new Map([...je].map(([url, tage]) => [url, [...tage]]))
}
