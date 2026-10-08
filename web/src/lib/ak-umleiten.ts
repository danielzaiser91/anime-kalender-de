/** Reine Umschreibung gemerkter Titel nach `ak-umleitung.json` (`[alt, neu]`); getrennt von `ak-umleitung.ts`, damit `check:logic` sie ohne Browser prüft. */
type Abbild = Map<number, number>

export function umleiteListe(alt: unknown[], abbild: Abbild): number[] {
  const neu = alt.filter((id): id is number => typeof id === 'number').map((id) => abbild.get(id) ?? id)
  return [...new Set(neu)]
}

/** Treffen zwei Einträge zusammen, gilt bei Zahlen (gesehen bis Folge) der größere, bei Tagen (gemerkt seit) der frühere Wert. */
export function umleiteKarte(alt: Record<string, unknown>, abbild: Abbild): Record<string, unknown> {
  const neu: Record<string, unknown> = {}
  for (const [id, wert] of Object.entries(alt)) {
    const ziel = String(abbild.get(Number(id)) ?? id)
    const bisher = neu[ziel]
    const besser = typeof wert === 'number' && typeof bisher === 'number' ? wert > bisher : String(wert) < String(bisher)
    if (!(ziel in neu) || besser) neu[ziel] = wert
  }
  return neu
}
