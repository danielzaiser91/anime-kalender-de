/** Lädt alle Mockups; jede Datei unter `mockups/` meldet sich beim Laden selbst an (`register.ts`). */
export function ladeMockups(): void {
  import.meta.glob('./mockups/*.tsx', { eager: true })
}
