/**
 * Hält `new Date()` und `Date.now()` eines Tests auf einem festen Zeitpunkt, damit er an keinem Tageswechsel
 * (UTC, Berlin) und zu keiner Wochenstunde anders ausfällt. Gibt die Funktion zurück, die die echte Uhr zurückgibt.
 */
export function festeUhr(iso: string): () => void {
  const Echt = globalThis.Date
  const fest = new Echt(iso).getTime()
  class FesteZeit extends Echt {
    constructor(...a: [] | [number | string]) {
      super(a.length ? (a[0] as number) : fest)
    }
    static override now() {
      return fest
    }
  }
  globalThis.Date = FesteZeit as DateConstructor
  return () => {
    globalThis.Date = Echt
  }
}
