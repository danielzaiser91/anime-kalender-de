/**
 * Neue Serien und Filme bei ADN, ohne den Wochenlauf abzuwarten (13.10.2026).
 *
 * Anlass: Vier Bleach-Filme gingen am 12.10.2026 um 07:00 UTC online, mit `vde` an der Folge. Der Katalog-Lauf (montags 05:41) war eine
 * Stunde vorher fertig, der Kalender-Endpunkt führt Filme nicht, `--laufend` kennt nur, was schon im Archiv liegt: Der Datensatz sah die
 * Filme erst eine Woche später und zeigte „Sprache offen“. Der Lauf `--laufend` (alle sechs Stunden) fragt deshalb zusätzlich jede Serie
 * der ADN-Liste, die Katalog und Archiv noch nicht kennen.
 */
import type { AdnShow } from './adn.ts'
import { katalogShowAus, type AdnListenEintrag, type AdnVideo } from './adn-folgen.ts'

/** Die Serien der Liste, deren Kennung weder im Katalog noch im Archiv steht. */
export function unbekannteSerien(liste: ReadonlyMap<number, AdnListenEintrag>, bekannt: ReadonlySet<number>): AdnListenEintrag[] {
  return [...liste.values()].filter((e) => !bekannt.has(e.id))
}

export interface NeuzugangErgebnis {
  /** Neue Katalogeinträge (nur Serien mit mindestens einer Folge `vde`). */
  shows: AdnShow[]
  /** Antworten, die ins Archiv gehören (auch ohne `vde`: Das Archiv hält jede Folge, damit die Serie nicht bei jedem Lauf neu gefragt wird). */
  archiv: Map<number, AdnVideo[]>
  /** Serien, deren Abruf fehlschlug — sie bleiben unbekannt und kommen im nächsten Lauf wieder dran. */
  offen: number[]
}

/** Fragt jede neue Serie einmal (`lade` ist der Abruf je Serie, `pause` die Wartezeit dazwischen). */
export async function sammleNeuzugaenge(
  neu: AdnListenEintrag[],
  lade: (id: number) => Promise<{ videos: AdnVideo[]; abbruch?: string }>,
  pause: () => Promise<void>,
): Promise<NeuzugangErgebnis> {
  const ergebnis: NeuzugangErgebnis = { shows: [], archiv: new Map(), offen: [] }
  for (const eintrag of neu) {
    const antwort = await lade(eintrag.id)
    if (antwort.abbruch) {
      ergebnis.offen.push(eintrag.id)
    } else {
      if (antwort.videos.length) ergebnis.archiv.set(eintrag.id, antwort.videos)
      const show = katalogShowAus(eintrag, antwort.videos)
      if (show) ergebnis.shows.push(show)
    }
    await pause()
  }
  return ergebnis
}

/** Der Katalog mit den neuen Serien dahinter; was schon drin steht, bleibt unverändert. */
export function katalogMitNeuen(katalog: AdnShow[], neu: AdnShow[]): AdnShow[] {
  const vorhanden = new Set(katalog.map((s) => s.showId))
  return [...katalog, ...neu.filter((s) => !vorhanden.has(s.showId))]
}
