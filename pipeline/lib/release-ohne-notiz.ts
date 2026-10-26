import type { Release } from '../../shared/types.ts'

/** `note` ist eine interne Notiz (Recherche, Quelle, Stand der Sichtung) und wird nie ausgeliefert (Daniel, 26.10.2026). */
export function ohneNotiz(r: Release): Release {
  const { note: _intern, ...rest } = r
  return rest
}

/** Schreibt `releases.json` ohne Notizen; `schreibe` und `pfad` als Parameter, damit ein Test den Weg ohne Bau durchläuft. */
export function schreibeReleasesJson(releases: Release[], pfad: string, schreibe: (pfad: string, daten: unknown) => void): void {
  schreibe(pfad, releases.map(ohneNotiz))
}
