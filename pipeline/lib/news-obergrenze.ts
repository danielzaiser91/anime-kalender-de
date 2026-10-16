import { addDays } from '../../shared/time.ts'
import type { NewsEintrag } from '../../shared/types.ts'
import { traegtOffizielle } from './news-offiziell.ts'

/** So lange gelten Folgen- und Termin-Meldungen einer laufenden Serie als Vorgeschichte, die die Obergrenze nicht kappt. */
const LAUFEND_TAGE = 56
/** Auch mit Ausnahme wächst die Datei nicht darüber (ohne offizielle Meldungen); `news.json` lädt jede Seite (16.10.2026: 434 Einträge, 61 KB gzip). */
export const GESAMT_HOECHSTENS = 440

/** Trägt der Eintrag Folgen, Verspätungen oder Nachreichungen der letzten acht Wochen? */
const laufendeSerie = (e: NewsEintrag, heute: string): boolean =>
  e.am >= addDays(heute, -LAUFEND_TAGE) && e.meldungen.some((m) => m.art === 'folgen' || m.art === 'verspaetet' || m.art === 'nachgereicht' || m.art === 'takt')

/**
 * Bleibt der Eintrag an Platz `i` der nach Tag sortierten Liste? Die ersten `hoechstens` immer, offizielle Meldungen immer,
 * laufende Serien bis Platz `GESAMT_HOECHSTENS` — sonst fällt bei einer Serie mit Pause die Meldung vor der Pause heraus
 * (Re:ZERO Staffel 4: „Folgen 12–13 am 09.09." war am 16.10.2026 weg, 401 Einträge).
 */
export function behalteEintrag(e: NewsEintrag, i: number, heute: string, hoechstens: number): boolean {
  if (i < hoechstens || traegtOffizielle(e)) return true
  return i < GESAMT_HOECHSTENS && laufendeSerie(e, heute)
}
