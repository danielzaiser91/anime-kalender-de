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

/**
 * Die Bau-Zeile zu `setzeJoynDeutsch`: gesetzte Wege und die übrigen Joyn-Wege, die ihr eigenes Urteil behalten (nicht
 * gesetzt, davon ohne Deutsch). Nach dem Setzen aufrufen; ohne Joyn-Weg leer.
 */
export function joynZeile(titles: Iterable<Title>, gesetzt: number): string {
  let behalten = 0
  let davonNein = 0
  for (const title of titles) {
    for (const stream of title.streams) {
      if (stream.platform !== 'joyn' || stream.dubAbgeleitet) continue
      behalten++
      if (stream.dub === false) davonNein++
    }
  }
  if (!gesetzt && !behalten) return ''
  return `${gesetzt} Joyn-Verweis(e) als deutsch gesetzt — deutscher Anbieter; ${behalten} mit eigenem Urteil unverändert (${davonNein} ohne Deutsch)`
}
