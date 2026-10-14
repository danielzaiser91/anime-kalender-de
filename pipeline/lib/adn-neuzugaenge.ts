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

/**
 * So lange bleibt eine Serie ohne deutsche Folge nach einer leeren Antwort ungefragt (14.10.2026). Sieben Serien ohne Videos (Madoka-Filme, Utena, Hei II) wurden in
 * jedem Lauf alle sechs Stunden neu gefragt, 28 Abrufe am Tag für nichts. Die Frist gilt nicht, wenn die Liste selbst `vde` nennt (siehe `unbekannteSerien`).
 */
export const LEERE_ANTWORT_FRIST_MS = 24 * 3600_000

/**
 * Die Serien der Liste, deren Kennung weder im Katalog noch im Archiv steht.
 * `gefragtAm` ist der Stand des Katalog-Durchgangs (Kennung → ISO-Zeit der letzten Antwort): Wer vor weniger als `LEERE_ANTWORT_FRIST_MS` ohne Videos geantwortet hat
 * und in der Liste noch kein `vde` führt, bleibt zurückgestellt. Ein neues `vde` in der Liste hebt die Frist auf, spätestens nach der Frist wird in jedem Fall
 * wieder gefragt: Eine Serie, die ADN freischaltet, ist also nach höchstens sechs Stunden (Liste nennt `vde`) oder 24 Stunden plus einem Lauf (Liste hinkt) im Katalog.
 */
export function unbekannteSerien(
  liste: ReadonlyMap<number, AdnListenEintrag>,
  bekannt: ReadonlySet<number>,
  gefragtAm: Readonly<Record<string, string>> = {},
  jetzt = Date.now(),
): AdnListenEintrag[] {
  const zurueckgestellt = (e: AdnListenEintrag): boolean => {
    const zuletzt = Date.parse(gefragtAm[String(e.id)] ?? '')
    return jetzt - zuletzt < LEERE_ANTWORT_FRIST_MS && !e.languages?.includes('vde')
  }
  return [...liste.values()].filter((e) => !bekannt.has(e.id) && !zurueckgestellt(e))
}

export interface NeuzugangErgebnis {
  /** Neue Katalogeinträge (nur Serien mit mindestens einer Folge `vde`). */
  shows: AdnShow[]
  /** Antworten, die ins Archiv gehören (auch ohne `vde`: Das Archiv hält jede Folge, damit die Serie nicht bei jedem Lauf neu gefragt wird). */
  archiv: Map<number, AdnVideo[]>
  /** Serien, deren Abruf fehlschlug — sie bleiben unbekannt und kommen im nächsten Lauf wieder dran. */
  offen: number[]
  /** Serien, die geantwortet haben (mit oder ohne Videos): Ihre Zeit gehört in den Stand, damit eine leere Antwort nicht in jedem Lauf wiederholt wird. */
  gefragt: number[]
}

/** Fragt jede neue Serie einmal (`lade` ist der Abruf je Serie, `pause` die Wartezeit dazwischen). */
export async function sammleNeuzugaenge(
  neu: AdnListenEintrag[],
  lade: (id: number) => Promise<{ videos: AdnVideo[]; abbruch?: string }>,
  pause: () => Promise<void>,
): Promise<NeuzugangErgebnis> {
  const ergebnis: NeuzugangErgebnis = { shows: [], archiv: new Map(), offen: [], gefragt: [] }
  for (const eintrag of neu) {
    const antwort = await lade(eintrag.id)
    if (antwort.abbruch) {
      ergebnis.offen.push(eintrag.id)
    } else {
      ergebnis.gefragt.push(eintrag.id)
      if (antwort.videos.length) ergebnis.archiv.set(eintrag.id, antwort.videos)
      const show = katalogShowAus(eintrag, antwort.videos)
      if (show) ergebnis.shows.push(show)
    }
    await pause()
  }
  return ergebnis
}

/**
 * Ein Durchgang `--laufend` über die neuen Serien: zurückgestellte aussortieren, die übrigen fragen, die Zeit jeder Antwort in den Stand schreiben.
 * `stand` wird nicht verändert; der neue steht im Ergebnis und gehört in `data/adn-katalog-stand.json` (der Aufrufer in `fetch-adn.ts` schreibt ihn).
 */
export async function fragNeuzugaenge(
  liste: ReadonlyMap<number, AdnListenEintrag>,
  bekannt: ReadonlySet<number>,
  stand: Readonly<Record<string, string>>,
  lade: (id: number) => Promise<{ videos: AdnVideo[]; abbruch?: string }>,
  pause: () => Promise<void>,
  jetzt = Date.now(),
): Promise<NeuzugangErgebnis & { anzahl: number; stand: Record<string, string> }> {
  const neu = unbekannteSerien(liste, bekannt, stand, jetzt)
  const ergebnis = await sammleNeuzugaenge(neu, lade, pause)
  const neuerStand = { ...stand }
  for (const id of ergebnis.gefragt) neuerStand[String(id)] = new Date(jetzt).toISOString()
  return { ...ergebnis, anzahl: neu.length, stand: neuerStand }
}

/** Der Katalog mit den neuen Serien dahinter; was schon drin steht, bleibt unverändert. */
export function katalogMitNeuen(katalog: AdnShow[], neu: AdnShow[]): AdnShow[] {
  const vorhanden = new Set(katalog.map((s) => s.showId))
  return [...katalog, ...neu.filter((s) => !vorhanden.has(s.showId))]
}
