import type { Title } from '../../shared/types.ts'

/**
 * Joyn ist ein deutscher Anbieter (Daniel, 02.09.2026: „join titel immer als deutsch markieren“): Jeder Joyn-Verweis ohne
 * eigenes Urteil bekommt `dub: true`. Ein Weg mit Handbeleg oder anderem Urteil (`dub` gesetzt) bleibt, wie er ist.
 * Gibt die Zahl der gesetzten Wege zurück.
 */
export function setzeJoynDeutsch(titles: Iterable<Title>): number {
  let joynJa = 0
  for (const title of titles) {
    for (const stream of title.streams) {
      if (stream.platform !== 'joyn' || stream.dub !== undefined) continue
      stream.dub = true
      stream.dubAbgeleitet = 'joyn-pauschal'
      joynJa++
    }
  }
  return joynJa
}
