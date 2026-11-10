// Zeichenhelfer der Pixelkrabbe; die Rollen-Kostüme (Bauer, Prüfer, Entdecker) folgen in `rollen-kostueme.ts`.
export const CLAY = '#D97757'

// `cls` puts a pixel in a named group: `bd` (the default) is the body and its
// costume, `la`/`lb` the leg pairs, anything else a prop with its own motion.
export type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

export const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))
