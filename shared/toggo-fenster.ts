import type { WatchLink } from './types.ts'

export type ToggoBlock = NonNullable<WatchLink['toggo']>[number]
/** Ein offenes Fenster `[ab, ende)` in Berliner Ortszeit (`YYYY-MM-DDTHH:MM`). */
export type ToggoFenster = [ab: string, ende: string]

/**
 * Vereinigung der Fenster aller Blöcke, die ab `jetzt` noch offen sind oder werden: sortiert, überlappende und anstoßende zusammengelegt.
 * Schon geschlossene Fenster fallen weg (die Zeit läuft nur vorwärts). So bleibt für die Kachel nur, *wann* mindestens eine Folge frei ist —
 * die Folgennummern braucht dort niemand (Filter „kostenlos“ fragt nur Ja/Nein).
 */
export function offeneFenster(bloecke: readonly ToggoBlock[], jetzt: string): ToggoFenster[] {
  const sortiert = bloecke.filter((b) => b.bis >= b.von && b.ende > jetzt).sort((a, b) => (a.ab < b.ab ? -1 : a.ab > b.ab ? 1 : 0))
  const aus: ToggoFenster[] = []
  for (const b of sortiert) {
    const letztes = aus[aus.length - 1]
    if (letztes && b.ab <= letztes[1]) letztes[1] = b.ende > letztes[1] ? b.ende : letztes[1]
    else aus.push([b.ab, b.ende])
  }
  return aus
}

/** Ob zu `jetzt` ein Fenster offen ist (`ab` eingeschlossen, `ende` ausgeschlossen — wie `folgenFuer` in `kostenlos.ts`). */
export const fensterOffen = (fenster: readonly ToggoFenster[], jetzt: string): boolean => fenster.some(([ab, ende]) => ab <= jetzt && jetzt < ende)

/** Ob mindestens ein Block zu `jetzt` offen ist. */
export const bloeckeOffen = (bloecke: readonly ToggoBlock[], jetzt: string): boolean => bloecke.some((b) => b.bis >= b.von && b.ab <= jetzt && jetzt < b.ende)

/** Zeitpunkte, an denen sich „offen“ bei Blöcken oder Fenstern ändern kann (ab `jetzt`), dazu `jetzt` selbst: dazwischen bleibt der Zustand beider gleich. */
export function pruefZeiten(bloecke: readonly ToggoBlock[], fenster: readonly ToggoFenster[], jetzt: string): string[] {
  return [...new Set([jetzt, ...bloecke.flatMap((b) => [b.ab, b.ende]), ...fenster.flat()])].filter((z) => z >= jetzt).sort()
}
