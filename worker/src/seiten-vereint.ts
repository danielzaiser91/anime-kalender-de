/**
 * **Eine Seite aus mehreren Quellen** (13.10.2026): Die Auszüge `?rohfolgen=1` und `?alle=1` setzen über eine
 * einzige Zahl (`nach`/`weiter`) fort, auch wenn ihre Zeilen aus mehreren Tabellen stammen. Jede Quelle bekommt
 * einen eigenen Id-Bereich (`ab`), die Bereiche steigen mit der Reihenfolge der Quellen.
 */

/** Zeilen je Seite; eine volle Seite trägt die Fortsetzung (`weiter`). */
export const SEITE = 5000

export type Zeile = { id: number; url: string }
export type Seite = { zeilen: Zeile[]; weiter: number | null }

/** Eine Quelle: ihre Ids beginnen bei `ab`; `lies` liefert höchstens `anzahl` Zeilen mit Id über `von` (relativ zu `ab`). */
export type Quelle = { ab: number; lies: (von: number, anzahl: number) => Promise<Zeile[]> }

const mitWeiter = (zeilen: Zeile[]): Seite => ({
  zeilen,
  weiter: zeilen.length === SEITE ? zeilen[zeilen.length - 1]!.id : null,
})

/** Die Quellen der Reihe nach, bis die Seite voll ist. */
export async function vereint(nach: number, quellen: Quelle[]): Promise<Seite> {
  const start = Number.isFinite(nach) ? nach : 0
  const zeilen: Zeile[] = []
  for (const q of quellen) {
    if (zeilen.length >= SEITE) break
    zeilen.push(...(await q.lies(Math.max(start, q.ab) - q.ab, SEITE - zeilen.length)))
  }
  return mitWeiter(zeilen)
}
