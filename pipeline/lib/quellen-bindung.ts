/**
 * **Eine Quelle muss zum Titel gehören** (01.10.2026).
 *
 * Beim Apothekerin-Fall stand als Quelle für Staffel 3 eine aniSearch-Adresse zu
 * Staffel 2 (`/anime/20083`) — der Beleg führte also zum falschen Titel. Wer den
 * Termin nachprüfen will, landet bei einer anderen Staffel, und die Belegkette
 * behauptet eine Herkunft, die es nicht gibt.
 *
 * Prüfen lässt sich das nur, wo die Adresse die Werkkennung selbst trägt:
 * aniSearch-Anime-Seiten der Form `/anime/<id>`. Alles andere (News-Artikel,
 * Anbieterseiten, Suche) gilt als passend — lieber eine ungeprüfte Quelle als
 * ein falsches Nein.
 */

/** Die aniSearch-Anime-Kennung aus einer Adresse — `undefined`, wenn keine. */
export function anisearchAnimeId(url: string): number | undefined {
  const m = /^https?:\/\/www\.anisearch\.(?:de|com)\/anime\/(\d+)/i.exec(url)
  return m ? Number(m[1]) : undefined
}

/**
 * Gehört diese Adresse zu einem Titel mit dieser `anisearchId`?
 *
 * `true` heißt „nicht prüfbar oder passend". `false` nur, wenn die Adresse eine
 * aniSearch-Anime-Kennung trägt, die von unserem Titel abweicht.
 */
export function quelleGehoertZumTitel(url: string, anisearchId: number | undefined): boolean {
  const id = anisearchAnimeId(url)
  if (id === undefined) return true
  return anisearchId === id
}

/** Quellen prüfen und den Termin ableiten: ohne passende Quelle gilt er als Schätzung. */
export function quellenUndTermin<T extends { estimated?: boolean }>(
  quellen: string[],
  anisearchId: number | undefined,
  basis: T,
  melde?: (verworfen: number) => void,
): { sources: string[]; schedule: T } {
  const sources = quellen.filter((u) => quelleGehoertZumTitel(u, anisearchId))
  const verworfen = quellen.length - sources.length
  if (verworfen) melde?.(verworfen)
  const schedule = { ...basis }
  if (verworfen && !sources.length && !basis.estimated) schedule.estimated = true
  return { sources, schedule }
}
