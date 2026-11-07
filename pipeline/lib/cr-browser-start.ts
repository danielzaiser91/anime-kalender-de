/**
 * Chromium startet nur einmal je Lauf, und die erste Anforderung nennt den Grund im Log.
 * So zeigt der nächste Lauf direkt, welcher Weg den Browser gebraucht hat (Zugangspaket fehlt, Adresse ohne Serienkennung).
 */
import type { Browser } from 'playwright'

export function browserHolerMit(starte: () => Promise<Browser>, meldung: (zeile: string) => void) {
  let browser: Browser | undefined
  return {
    holen: async (grund: string): Promise<Browser> => {
      if (!browser) {
        browser = await starte()
        meldung(`[cr-dub] Browser gestartet: ${grund}`)
      }
      return browser
    },
    aktuell: (): Browser | undefined => browser,
  }
}
