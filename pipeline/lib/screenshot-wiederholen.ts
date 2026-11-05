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
