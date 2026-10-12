/** Friert die Uhr ein: `new Date()` und `Date.now()` liefern immer denselben Zeitpunkt, damit ein Fall jedes Mal gleich aussieht. */
export function friereZeitEin(iso: string): void {
  const fest = Date.parse(iso)
  class FesteZeit extends Date {
    constructor(...a: [] | [number | string | Date]) {
      super(...((a.length ? a : [fest]) as [number]))
    }
    static override now(): number {
      return fest
    }
  }
  globalThis.Date = FesteZeit as DateConstructor
}
