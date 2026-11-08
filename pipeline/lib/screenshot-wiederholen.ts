import type { Browser, BrowserContextOptions, Page } from 'playwright'

/** Playwright meldet gelegentlich „Unable to capture screenshot“ (Kette rot bei PR 1574, 1612, 1713, 2792; jeder Neulauf grün). Nur dieser Fehler wird einmal wiederholt. */
export const SCREENSHOT_FEHLER = /Unable to capture screenshot/

/** Pause vor der Wiederholung: die sofortige Wiederholung scheiterte nach 0,09 s am selben Fehler (PR 2792). */
export const PAUSE_MS = 1500

const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** `lauf(2)` ist die Wiederholung; der Aufrufer kann dort einen frischen Browser nehmen. Jeder Fehlschlag wird gemeldet. */
export async function einmalWiederholen<T>(
  lauf: (versuch: 1 | 2) => Promise<T>,
  melde: (zeile: string) => void,
  warte: (ms: number) => Promise<void> = schlafen,
): Promise<T> {
  try {
    return await lauf(1)
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e)
    if (!SCREENSHOT_FEHLER.test(text)) throw e
    melde(`Screenshot-Fehler, einmal wiederholt: ${text.split('\n')[0]}`)
    await warte(PAUSE_MS)
    try {
      const ergebnis = await lauf(2)
      melde('Screenshot-Wiederholung ok')
      return ergebnis
    } catch (e2) {
      melde('Screenshot-Wiederholung gescheitert')
      throw e2
    }
  }
}

/** Zählt die Fälle, die nicht in Ordnung sind; jeder Fall bekommt seine eine Wiederholung. */
export async function faelleDurchlaufen<F>(
  faelle: F[],
  pruefe: (f: F, versuch: 1 | 2) => Promise<boolean>,
  melde: (zeile: string) => void,
  warte?: (ms: number) => Promise<void>,
): Promise<number> {
  let fehler = 0
  for (const f of faelle) {
    if (!(await einmalWiederholen((v) => pruefe(f, v), melde, warte))) fehler++
  }
  return fehler
}

/** Fälle durchlaufen; jede Wiederholung (Versuch 2) bekommt den frischen Browser aus `browser.fuer`. */
export function faelleMitFrischemBrowser<F, B>(
  faelle: F[],
  browser: { fuer(versuch: 1 | 2): Promise<B> },
  pruefe: (b: B, f: F) => Promise<boolean>,
  melde: (zeile: string) => void,
  warte?: (ms: number) => Promise<void>,
): Promise<number> {
  return faelleDurchlaufen(faelle, async (f, versuch) => pruefe(await browser.fuer(versuch), f), melde, warte)
}

/** Browser je Versuch: Versuch 1 nutzt den laufenden, Versuch 2 schließt ihn und startet einen frischen. */
export function mitFrischemBrowser<B>(erster: B, starte: () => Promise<B>, schliesse: (b: B) => Promise<void>) {
  let aktuell = erster
  return {
    browser: () => aktuell,
    async fuer(versuch: 1 | 2): Promise<B> {
      if (versuch === 2) {
        await schliesse(aktuell).catch(() => {})
        aktuell = await starte()
      }
      return aktuell
    },
  }
}

/** Gesamtzahl der Versuche von `mitWiederholung` (Kette rot am 05.11.2026 trotz einer Wiederholung auf derselben Sitzung). */
export const VERSUCHE = 3

/** Führt `lauf` bis zu `VERSUCHE`-mal mit Pause aus; nur der Screenshot-Fehler löst einen neuen Versuch aus, jeder andere Fehler geht sofort durch. */
export async function mitWiederholung<T>(
  lauf: () => Promise<T>,
  melde: (zeile: string) => void,
  warte: (ms: number) => Promise<void> = schlafen,
): Promise<T> {
  for (let versuch = 1; ; versuch++) {
    try {
      return await lauf()
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      if (!SCREENSHOT_FEHLER.test(text)) throw e
      const erste = text.split('\n')[0]
      if (versuch >= VERSUCHE) throw new Error(`Screenshot-Fehler auch im ${VERSUCHE}. Versuch (jeweils neue Seite): ${erste}`)
      melde(`Screenshot-Fehler, Versuch ${versuch} von ${VERSUCHE}, neue Seite: ${erste}`)
      await warte(PAUSE_MS)
    }
  }
}

/** Jeder Versuch öffnet eine neue Seite und schließt sie auch bei einem Fehler; die Sitzung des Fehlers wird nie wiederverwendet. */
export function mitNeuerSeite<T>(
  browser: Browser,
  optionen: BrowserContextOptions,
  lauf: (seite: Page) => Promise<T>,
  melde: (zeile: string) => void,
  warte?: (ms: number) => Promise<void>,
): Promise<T> {
  return mitWiederholung(async () => {
    const seite = await browser.newPage(optionen)
    try {
      return await lauf(seite)
    } finally {
      await seite.close()
    }
  }, melde, warte)
}

/** Jeder Versuch beginnt mit `zuruecksetzen` (z. B. Fehlerzähler auf 0) und lässt weder die ersetzte Abruffunktion noch das Token für den nächsten Versuch zurück, auch nicht nach einem Fehler. */
export function mitRuecksetzung<S>(lauf: (s: S) => Promise<void>, zuruecksetzen: () => void): (s: S) => Promise<void> {
  return async (s) => {
    zuruecksetzen()
    const echtFetch = globalThis.fetch
    try {
      await lauf(s)
    } finally {
      globalThis.fetch = echtFetch
      delete process.env.LAUF_TOKEN
    }
  }
}
