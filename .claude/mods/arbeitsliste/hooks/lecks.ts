// Anzeige „Lecks n/5“ (Daniel, 11.10.2026): Zähler der Prozess-Inventur nach Subagenten-Enden.
// Quelle: C:/code/ai/__assets/tools/prozess-inventur/daten/zaehler.json (schreibt nach-agent.mjs).
export const LECKS_DATEI = 'C:/code/ai/__assets/tools/prozess-inventur/daten/zaehler.json'
export const BERICHT_ALLE = 5

export type Urteil = 'sauber' | 'leck' | null
// n = gezählte Agentenenden seit dem letzten Bericht (0–4), urteil = Ergebnis des letzten Berichts.
export type Lecks = { n: number; urteil: Urteil; tooltip: string }

function datum(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

// Zählerdatei -> Anzeige; fehlt oder kaputt: null (nichts zeichnen).
export function zaehleLecks(text: string): Lecks | null {
  try {
    const z = JSON.parse(text) as { seitBericht?: number; letzterBericht?: { zeit: string; leck: boolean; waisen: number } | null }
    const n = Math.max(0, Math.min(BERICHT_ALLE - 1, Number(z.seitBericht ?? 0)))
    const b = z.letzterBericht
    const urteil: Urteil = b ? (b.leck ? 'leck' : 'sauber') : null
    const letzter = b ? `Letzter Bericht ${datum(b.zeit)}: ${b.leck ? 'Leck' : 'sauber'}, ${b.waisen} Waisen` : 'Noch kein Bericht'
    return { n, urteil, tooltip: `Prozess-Lecks: ${n} von ${BERICHT_ALLE} Agentenenden bis zum nächsten Bericht. ${letzter}` }
  } catch {
    return null
  }
}

export const lecksText = (l: Lecks): string => `Lecks ${l.n}/${BERICHT_ALLE}${l.urteil === 'sauber' ? ' ✓' : l.urteil === 'leck' ? ' ⚠' : ''}`
