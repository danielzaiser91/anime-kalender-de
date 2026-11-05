import type { Browser, BrowserContextOptions, Page } from 'playwright'

/** Playwright meldet gelegentlich „Unable to capture screenshot“ (Kette rot bei PR 1574, 1612, 1713; am 05.11.2026 zweimal trotz einer Wiederholung auf derselben Sitzung). Nur dieser Fehler wird wiederholt, und zwar auf frischer Seite. */
export const SCREENSHOT_FEHLER = /Unable to capture screenshot/
export const VERSUCHE = 3

/** Führt `lauf` bis zu `VERSUCHE`-mal aus; nur der Screenshot-Fehler löst einen neuen Versuch aus, jeder andere Fehler geht sofort durch. */
export async function mitWiederholung<T>(lauf: () => Promise<T>, melde: (zeile: string) => void): Promise<T> {
  for (let versuch = 1; ; versuch++) {
    try {
      return await lauf()
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      if (!SCREENSHOT_FEHLER.test(text)) throw e
      const erste = text.split('\n')[0]
      if (versuch >= VERSUCHE) throw new Error(`Screenshot-Fehler auch im ${VERSUCHE}. Versuch (jeweils neue Seite): ${erste}`)
      melde(`Screenshot-Fehler, Versuch ${versuch} von ${VERSUCHE}, neue Seite: ${erste}`)
    }
  }
}

/** Jeder Versuch öffnet eine neue Seite und schließt sie auch bei einem Fehler; die Sitzung des Fehlers wird nie wiederverwendet. */
export function mitNeuerSeite<T>(browser: Browser, optionen: BrowserContextOptions, lauf: (seite: Page) => Promise<T>, melde: (zeile: string) => void): Promise<T> {
  return mitWiederholung(async () => {
    const seite = await browser.newPage(optionen)
    try {
      return await lauf(seite)
    } finally {
      await seite.close()
    }
  }, melde)
}

/** Zählt die Fälle, die nicht in Ordnung sind; jeder Fall bekommt seine Wiederholungen. */
export async function faelleDurchlaufen<F>(faelle: F[], pruefe: (f: F) => Promise<boolean>, melde: (zeile: string) => void): Promise<number> {
  let fehler = 0
  for (const f of faelle) {
    if (!(await mitWiederholung(() => pruefe(f), melde))) fehler++
  }
  return fehler
}
