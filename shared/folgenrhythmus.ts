/**
 * **Folgenrhythmus einer Quelle (Handbeleg `Release.rhythmus`)** — Avatar: Die sieben Häfen (12.10.2026).
 *
 * Eine Quelle sagt, wie viele Folgen pro Woche bis zu welchem Tag erscheinen („bis zum 30. Oktober wöchentlich
 * jeweils drei bis vier"). Das ist eine eigene Aussage mit eigenem Tag und Beleg und bekommt eine eigene Meldung
 * (`pipeline/lib/news-rhythmus.ts`); sie steht nicht im Start-Eintrag, weil dessen Artikel ein anderer ist.
 */

/** Der Handbeleg am kuratierten Release. */
export interface ReleaseRhythmus {
  /** Tag der Quelle (Veröffentlichung) — an ihm steht die Meldung. */
  stand: string
  /** Die Quelle; muss in `sources` des Releases stehen. */
  quelle: string
  /** Letzter Tag des genannten Rhythmus. */
  bis: string
  /** Folgen pro Woche, von–bis (gleich, wenn die Quelle eine feste Zahl nennt). */
  proWoche: [number, number]
}

/** „3–4" bzw. „3". */
export function folgenProWoche([von, bis]: [number, number]): string {
  return von === bis ? String(von) : `${von}–${bis}`
}
