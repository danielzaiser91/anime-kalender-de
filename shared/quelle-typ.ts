/**
 * Eine Quelle mit Herkunftsangabe — nicht bloß eine Adresse.
 *
 * Nach zwei Vorbildern gebaut (14.08.2026):
 *
 * - **W3C PROV-DM**: Herkunft ist eigene Information, kein Feld am Rand. Wer
 *   hat wann was behauptet.
 * - **Wikipedia:Link rot**: „Do not delete cited information solely because the
 *   URL to the source does not work." Eine überholte Quelle wird **markiert,
 *   nicht entfernt** — dort über `url-status`, hier über `stand`.
 *
 * Der Grund ist nicht Ordnungsliebe: Wer nur die neueste Quelle führt, verliert
 * die Spur, sobald sich zwei widersprechen. Genau das ist bei „Inazuma Eleven"
 * passiert — die ältere Angabe verschwand, und niemand konnte mehr sagen,
 * woher die neue kam.
 */
export interface Quelle {
  url: string
  /** Anzeigename, meist der Hostname: „anime2you.de". */
  name: string
  /** Wann ein Lauf diese Quelle zum ersten Mal gesehen hat. */
  gesehenAm: string
  /** Nur API-Quellen, deren Messung ein Beleg zeigt (ADN): der Tag, an dem ein Lauf die Daten zuletzt gelesen hat (`pipeline/bau/adn-lesetag.ts`). */
  gelesenAm?: string
  /** Mit `gelesenAm`: das Datum des Termins, das jener Abruf gezeigt hat. Nicht `sagt`: das hält die erste Aussage fest, oft unseren Termin von damals. */
  bestaetigt?: string
  /** Was die Quelle sagt, sofern auslesbar — etwa ein Datum. */
  sagt?: string
  /** Laut Artikel (Beleg-Lesung); `ausgabeAm`: bei einer Produktseite der Erscheinungstag der Ausgabe, kein Textdatum. */
  veroeffentlichtAm?: string; aktualisiertAm?: string; ausgabeAm?: string; bild?: string; markierung?: [number, number, number, number] // `bild`: Schlüssel des privaten Beleg-Bilds; `markierung`: Fundstelle darin als Anteile
  /**
   * `aktuell`              — deckt sich mit dem geführten Stand.
   * `ueberholt`            — eine neuere Quelle widerspricht, und wir sind sicher.
   * `vermutlich-ueberholt` — sie widerspricht, aber wir sind es nicht.
   */
  stand?: 'aktuell' | 'ueberholt' | 'vermutlich-ueberholt'
  /** Warum überholt — steht in der Oberfläche hinter der ausgegrauten Quelle. */
  grund?: string
}
