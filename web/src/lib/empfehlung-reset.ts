import { EMPFEHLUNG_SCHLUESSEL } from './empfehlung-speicher.ts'

/** Das schmale Stück von `Storage`, das das Zurücksetzen braucht; Tests setzen eine Attrappe ein. */
export interface SpeicherLoeschen {
  removeItem: (key: string) => void
}

/**
 * Löscht alles, was „Entdecken“ im Browser abgelegt hat (gewählte Anbieter der Reise, Geguckt, Verworfen).
 * Favoriten, ausgeblendete Titel und „Meine Anbieter“ der Datenbank bleiben. Gibt die Zahl der Schlüssel zurück,
 * die angefasst wurden; ein gesperrter Speicher wirft nicht.
 */
export function empfehlungenZuruecksetzen(speicher: SpeicherLoeschen = localStorage): number {
  let n = 0
  for (const schluessel of EMPFEHLUNG_SCHLUESSEL) {
    try {
      speicher.removeItem(schluessel)
      n++
    } catch {
      /* Gesperrter Speicher: dort steht auch nichts. */
    }
  }
  return n
}
