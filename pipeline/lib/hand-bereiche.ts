/**
 * Handkorrekturen von Folgenbereichen, die eine spätere Meldung nicht überschreiben darf.
 *
 * Disney+ zählt Naruto Shippuden je Staffel neu (1–53, 1–59, 1–54); die Erweiterungsmeldung legte die
 * Zählungen übereinander und ergab „Fg. 1–59". Daniels Prüfung vom 08.10.2026 steht in
 * `dub-confirmed.yaml`; eine jüngere Meldung mit kleinerem Bereich würde sie still ersetzen
 * (`verschmelze()`: das jüngere `checkedAt` gewinnt). Dann bricht `check-handbelege`.
 */
import type { DubCheck } from './dub-confirmed.ts'

export const HAND_BEREICHE = [
  { anilistId: 1735, platform: 'disneyplus', von: 1, bis: 166, beleg: 'Daniel, Disney+, 08.10.2026' },
]

/** Meldet jede Handkorrektur, die im gelesenen Datensatz nicht mehr gilt; true, wenn mindestens eine verloren ging. */
export function verloreneHandBereiche(belege: DubCheck[], melde: (text: string) => void): boolean {
  const verloren = HAND_BEREICHE.flatMap((h) => {
    const b = belege.find((x) => x.anilistId === h.anilistId && x.platform === h.platform)
    const deckt = (b?.dubRanges ?? []).some((r) => r.dub && r.from <= h.von && r.to >= h.bis)
    return deckt
      ? []
      : [`${h.anilistId}/${h.platform}: Handbeleg Folgen ${h.von}–${h.bis} (${h.beleg}) geht verloren, gelesen: ${JSON.stringify(b?.dubRanges ?? null)}`]
  })
  verloren.forEach(melde)
  return verloren.length > 0
}
