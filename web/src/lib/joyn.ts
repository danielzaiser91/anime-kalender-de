/**
 * **Was die Joyn-Pille über die abrufbaren Folgen sagt** (22.09.2026).
 *
 * Die Fenster sind aus den ProSieben-MAXX-Terminen gerechnet, nicht bei Joyn gemessen — daher „≈".
 * Gerechnet wird beim Anzeigen: Bei Dragon Ball Super kamen täglich zwei Folgen dazu und zwei fielen
 * heraus, der Datensatz ist bis zu einem Tag alt.
 */
import type { FolgenFenster } from '@shared/types.ts'
import { jetztBerlin } from './toggo.ts'

/** „≈ Fg. 126–127 · Fg. 128 ab 17:05", „Fg. 130 ab 23.09." — `undefined` ohne bekanntes Fenster. */
export function joynAngabe(fenster: FolgenFenster[] | undefined, jetzt = jetztBerlin()): string | undefined {
  if (!fenster?.length) return undefined
  const offen = fenster.filter((f) => f.ab <= jetzt && jetzt < f.ende).map((f) => f.nr).sort((a, b) => a - b)
  const bereiche: [number, number][] = []
  for (const nr of offen) {
    const l = bereiche[bereiche.length - 1]
    if (l && nr === l[1] + 1) l[1] = nr
    else bereiche.push([nr, nr])
  }
  const naechste = fenster.filter((f) => f.ab > jetzt).sort((a, b) => a.ab.localeCompare(b.ab))[0]
  const wann = naechste
    ? naechste.ab.slice(0, 10) === jetzt.slice(0, 10)
      ? naechste.ab.slice(11, 16)
      : `${naechste.ab.slice(8, 10)}.${naechste.ab.slice(5, 7)}.`
    : undefined
  const teile = [
    bereiche.length ? `≈ Fg. ${bereiche.map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(', ')}` : undefined,
    naechste ? `Fg. ${naechste.nr} ab ${wann}` : undefined,
  ].filter(Boolean)
  return teile.length ? teile.join(' · ') : undefined
}
