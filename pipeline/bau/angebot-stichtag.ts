/**
 * **Erfassungsstichtag ist kein Angebotstag** (Daniel/Dirigent, 13.10.2026).
 *
 * MOTN nennt je Anbieter, seit wann es einen Titel führt (`seit`). Beginnt MOTN, einen Anbieterkatalog zu erfassen, bekommen alle Titel, die schon da
 * waren, denselben Tag. Gemessen am 13.10.2026 an `data/motn.json` (1.943 Shows, 197 Anbietertage): Titel je Anbietertag, Anzahl der Tage —
 * 1: 113, 2: 33, 3: 22, 4: 6, 5: 3, 6: 3, 7: 3, 8: 1, 9: 1, 10: 2 (Disney+ 25.09.2024, Prime Video 29.12.2025), dann nichts bei 11 bis 13, danach
 * 14 (Netflix 05.03.2024), 18, 19 (3 Tage), 21 (2), 25, 29 (Crunchyroll 08.01.2026) und 234 (Crunchyroll 31.03.2026, darunter Fairy Tail von 2017).
 * Der Normalfall endet bei 10, die Wellen beginnen bei 14; die Schwelle 12 liegt in der Mitte der Lücke. Ein solcher Tag ist ein Erfassungsstichtag,
 * kein belegtes „im Angebot seit“: Für diese Titel entsteht weder ein Termin noch ein `angebotSeit` (nichts behaupten, was nicht belegt ist;
 * „früheste Beobachtung“ ist nicht der Angebotstag).
 */
export const STICHTAG_AB = 12

type MitDiensten = { dienste?: Record<string, { seit?: string }> }

export const stichtagSchluessel = (anbieter: string, seit: string): string => `${anbieter}|${seit}`

/** Alle Anbietertage, an denen MOTN mindestens `ab` Titel desselben Anbieters führt — gezählt über das ganze Archiv, nicht nur über unsere Titel. */
export function erfassungsStichtage(shows: Iterable<MitDiensten>, ab = STICHTAG_AB): Set<string> {
  const jeTag = new Map<string, number>()
  for (const show of shows) {
    for (const [anbieter, dienst] of Object.entries(show.dienste ?? {})) {
      if (!dienst.seit) continue
      const schluessel = stichtagSchluessel(anbieter, dienst.seit)
      jeTag.set(schluessel, (jeTag.get(schluessel) ?? 0) + 1)
    }
  }
  return new Set([...jeTag].filter(([, n]) => n >= ab).map(([schluessel]) => schluessel))
}
