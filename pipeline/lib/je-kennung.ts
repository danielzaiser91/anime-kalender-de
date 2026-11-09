/**
 * Gruppiert Einträge nach Plattform-Kennung und behält jeden. Ein `new Map(…map)` über Kennungen
 * lässt bei einer Doppelung still den zuletzt gelesenen gewinnen (Crunchyroll: 219 von 768
 * Serienkennungen stehen unter zwei Adressen, mit verschieden frischen Abrufen).
 */
export function gruppiereJeKennung<T>(eintraege: Iterable<T>, kennungVon: (e: T) => string | undefined): Map<string, T[]> {
  const raus = new Map<string, T[]>()
  for (const e of eintraege) {
    const k = kennungVon(e)
    if (!k) continue
    const liste = raus.get(k)
    if (liste) liste.push(e)
    else raus.set(k, [e])
  }
  return raus
}

/** Kennungen mit mehr als einem Eintrag. */
export function doppelteKennungen<T>(gruppen: Map<string, T[]>): string[] {
  return [...gruppen].filter(([, liste]) => liste.length > 1).map(([k]) => k)
}
