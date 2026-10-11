/** Eine Staffel eines Cartoons; `start` ist der Erstausstrahlungstag laut TMDB. */
export interface CartoonStaffel {
  nr: number
  folgen: number
  start?: string
}

/*
  Die Staffelfelder von `Title` (nur Cartoons, 11.10.2026) stehen hier statt in `types.ts`, das über der Dateigrenze
  liegt. `staffeln`: `nr` aufsteigend, ohne Specials (Staffel 0). `staffelnQuelle` sagt, woher sie stammen; bei `tmdb`
  sind die Zahlen „laut TMDB“ (Fremddaten, nicht anbieternah) und so zu kennzeichnen.
*/
declare module './types.ts' {
  interface Title {
    staffeln?: CartoonStaffel[]
    staffelnQuelle?: 'justwatch' | 'tmdb'
  }
}
