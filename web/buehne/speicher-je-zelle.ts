/**
 * Jede Zelle der Bühne hat ihren eigenen, flüchtigen Browser-Speicher. Alle Zellen liegen unter derselben Herkunft;
 * ohne Ersatz teilen sie `localStorage` (Schnellfilter „Vorlieben“, TV, Gesehen, Favoriten …) und eine Wahl in
 * Variante A stünde in Variante B und nach jedem Neuladen wieder da.
 */
export class FluechtigerSpeicher implements Storage {
  private readonly daten = new Map<string, string>()

  get length(): number {
    return this.daten.size
  }

  clear(): void {
    this.daten.clear()
  }

  getItem(schluessel: string): string | null {
    return this.daten.get(String(schluessel)) ?? null
  }

  key(index: number): string | null {
    return [...this.daten.keys()][index] ?? null
  }

  removeItem(schluessel: string): void {
    this.daten.delete(String(schluessel))
  }

  setItem(schluessel: string, wert: string): void {
    this.daten.set(String(schluessel), String(wert))
  }
}

/** Legt frische flüchtige Speicher über `localStorage` und `sessionStorage` des Ziels (dem `window` der Zelle). */
export function isoliereSpeicher(ziel: object): void {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(ziel, name, { value: new FluechtigerSpeicher(), configurable: true })
  }
}

/** Nur eine Zelle (`#zelle?…`) bekommt flüchtigen Speicher; Rahmen und Leiste behalten den echten. */
export function bereiteSpeicherVor(modus: string, ziel: object): void {
  if (modus === 'zelle') isoliereSpeicher(ziel)
}
