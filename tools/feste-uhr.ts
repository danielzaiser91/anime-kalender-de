/**
 * Hält `new Date()`, `Date()` und `Date.now()` eines Tests auf einem festen Zeitpunkt, damit er an keinem Tageswechsel
 * (UTC, Berlin) und zu keiner Wochenstunde anders ausfällt. Datumsangaben mit Argumenten (`new Date(2026, 9, 12)`,
 * `Date.UTC`, `Date.parse`) verhalten sich wie beim echten Date. Gibt die Funktion zurück, die die echte Uhr zurückgibt.
 */
export function festeUhr(iso: string): () => void {
  const Echt = globalThis.Date
  const fest = new Echt(iso).getTime()
  class FesteZeit extends Echt {
    constructor(...a: unknown[]) {
      super(...((a.length ? a : [fest]) as [number]))
    }
    static override now() {
      return fest
    }
  }
  // `Date()` ohne new liefert den Zeitstempel als Text; eine Klasse kann man nicht aufrufen, ein Proxy schon.
  const Ersatz = new Proxy(FesteZeit, { apply: () => new Echt(fest).toString() })
  globalThis.Date = Ersatz as DateConstructor
  return () => {
    globalThis.Date = Echt
  }
}
