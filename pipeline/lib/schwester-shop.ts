import type { Title, WatchLink } from '../../shared/types.ts'

/**
 * **freenet meinVOD übernimmt Deutsch von den Schwester-Shops** (Daniel, 13.10.2026, Variante A).
 *
 * JustWatch nennt bei keinem freenet-Angebot eine Tonspur; die freenet-Seiten lesen wir nicht (robots.txt
 * sperrt KI-Bots). maxdome, MagentaTV und Videoload gehören zum selben Verbund und führen dieselben
 * Titel. Belegt ein Schwester-Shop Deutsch und keiner widerspricht, trägt der freenet-Weg
 * `dubAbgeleitet: 'schwester-shop'` — ohne `dubRanges`, also nie als Beleg.
 */
const SCHWESTERN = /^(maxdome|magentatv|videoload)$/i

const istFreenet = (w: WatchLink): boolean => /^freenet meinvod$/i.test(w.name)
const hatDeutsch = (w: WatchLink): boolean => (w.dubRanges ?? []).some((r) => r.dub)
const verneint = (w: WatchLink): boolean => (w.dubRanges ?? []).length > 0 && !hatDeutsch(w)

/** Mindestens ein Schwester-Shop belegt Deutsch, und keiner verneint es. */
export function schwesterBelegtDeutsch(wege: WatchLink[]): boolean {
  const schwestern = wege.filter((w) => SCHWESTERN.test(w.name))
  return schwestern.some(hatDeutsch) && !schwestern.some(verneint)
}

/** Kennzeichnet die freenet-Wege eines Titels; gibt ihre Zahl zurück. Ein Weg mit eigener Angabe bleibt, wie er ist. */
export function kennzeichneFreenet(wege: WatchLink[]): number {
  if (!schwesterBelegtDeutsch(wege)) return 0
  const offen = wege.filter((w) => istFreenet(w) && !w.dubRanges?.length && !w.dubAbgeleitet)
  for (const w of offen) w.dubAbgeleitet = 'schwester-shop'
  return offen.length
}

/** Zusicherung für den Bau: Die Kennzeichnung steht nur an freenet, nie neben einem Beleg, und nur mit Grund. */
export function schwesterFehler(titles: Iterable<Title>): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    for (const w of t.watchLinks ?? []) {
      if (!w.dubAbgeleitet) continue
      if (!istFreenet(w)) fehler.push(`Anime ${t.id}: „${w.name}" trägt dubAbgeleitet „schwester-shop", ist aber nicht freenet`)
      else if (w.dubRanges?.length) fehler.push(`Anime ${t.id}: freenet trägt „laut Schwester-Shop" und zugleich dubRanges`)
      else if (!schwesterBelegtDeutsch(t.watchLinks ?? [])) fehler.push(`Anime ${t.id}: freenet „laut Schwester-Shop" ohne Deutsch-Beleg eines Schwester-Shops`)
    }
  }
  return fehler
}
