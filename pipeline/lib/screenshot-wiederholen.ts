/** Playwright meldet gelegentlich „Unable to capture screenshot“ (Kette rot bei PR 1574, 1612, 1713; jeder Neulauf grün). Nur dieser Fehler wird einmal wiederholt. */
export const SCREENSHOT_FEHLER = /Unable to capture screenshot/

export async function einmalWiederholen<T>(lauf: () => Promise<T>, melde: (zeile: string) => void): Promise<T> {
  try {
    return await lauf()
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e)
    if (!SCREENSHOT_FEHLER.test(text)) throw e
    melde(`Screenshot-Fehler, einmal wiederholt: ${text.split('\n')[0]}`)
    return await lauf()
  }
}

/** Zählt die Fälle, die nicht in Ordnung sind; jeder Fall bekommt seine eine Wiederholung. */
export async function faelleDurchlaufen<F>(faelle: F[], pruefe: (f: F) => Promise<boolean>, melde: (zeile: string) => void): Promise<number> {
  let fehler = 0
  for (const f of faelle) {
    if (!(await einmalWiederholen(() => pruefe(f), melde))) fehler++
  }
  return fehler
}
