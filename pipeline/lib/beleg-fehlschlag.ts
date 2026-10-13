/**
 * Fehlschlag-Marke je Adresse (12.10.2026): Eine Adresse, die dauerhaft scheitert (Sperrseite, gelöschter Artikel), stand sonst jeden Tag vorn in der
 * Schlange und verbrauchte einen der Plätze eines Laufs. Die Marke (`data/beleg-fehlschlaege.json`, getrennt von `beleg-lesungen.json`, weil dort ein
 * Eintrag ohne Lesung als „geprüft" gelesen würde) reiht sie hinter die übrigen ein, bis ihre Pause um ist. Fehlt die Marke, ist die Adresse nie gescheitert.
 */
export interface Fehlschlag {
  /** Tag des letzten Fehlschlags (Europe/Berlin). */
  am: string
  /** Fehlschläge in Folge; eine gelesene Adresse löscht die Marke. */
  anzahl: number
}

export type Fehlschlaege = Record<string, Fehlschlag>

/** Längste Pause in Tagen — danach wird eine kaputte Adresse spätestens wieder gefragt. */
export const PAUSE_MAX_TAGE = 14

/** 1, 2, 4, 8 Tage, dann höchstens `PAUSE_MAX_TAGE`. */
export const pausenTage = (anzahl: number): number => Math.min(2 ** Math.max(0, anzahl - 1), PAUSE_MAX_TAGE)

/** Liegt der letzte Fehlschlag so kurz zurück, dass die Adresse noch hinter den übrigen steht? */
export function inPause(f: Fehlschlag | undefined, heute: string): boolean {
  return Boolean(f) && (Date.parse(heute) - Date.parse(f!.am)) / 86_400_000 < pausenTage(f!.anzahl)
}

export function merkeFehlschlag(marken: Fehlschlaege, url: string, heute: string): void {
  marken[url] = { am: heute, anzahl: (marken[url]?.anzahl ?? 0) + 1 }
}

export function vergissFehlschlag(marken: Fehlschlaege, url: string): void {
  delete marken[url]
}
