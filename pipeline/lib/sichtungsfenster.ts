/**
 * Uhrzeit aus einem eigenen Sichtungsfenster (Ausnahme von „keine erfundenen Uhrzeiten", 18.10.2026):
 * eine Folge fehlte zu `notSeen` und war zu `seen` da, höchstens 30 Minuten später; `time` liegt im Fenster.
 */
import type { Schedule } from '../../shared/types.ts'

/** Sichtung als Zusatz zum Zeitplan; bewusst nicht in shared/types.ts (Datei über der Umfanggrenze). */
export type SichtungsZeitplan = Schedule & { timeSighting?: { notSeen: string; seen: string; date: string; source: string } }

export const FENSTER_MAX_MINUTEN = 30

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const ISO = /^\d{4}-\d{2}-\d{2}$/

const minuten = (z: string): number => Number(z.slice(0, 2)) * 60 + Number(z.slice(3))

/** Alle Fehler rund um `time` eines kuratierten Zeitplans (Format und Sichtung); `heute` ISO. */
export function zeitFehler(s: SichtungsZeitplan, heute: string): string[] {
  const format = s.time && !/^\d{2}:\d{2}$/.test(s.time) ? [`time "${s.time}" ist nicht HH:MM`] : []
  return [...format, ...sichtungsFehler(s, heute)]
}

/** Fehlertexte ohne Präfix; leer, wenn der Zeitplan keine Sichtung nennt oder alles stimmt. */
export function sichtungsFehler(s: SichtungsZeitplan, heute: string): string[] {
  const w = s.timeSighting
  if (!w) return []
  if (!s.time) return ['timeSighting ohne time']
  if (!s.timeEstimated) return ['timeSighting braucht timeEstimated: true']
  if (!w.notSeen || !w.seen || !w.date || !w.source) return ['timeSighting braucht notSeen, seen, date und source']
  if (!HHMM.test(w.notSeen) || !HHMM.test(w.seen) || !HHMM.test(s.time) || !ISO.test(w.date)) return ['timeSighting: Zeiten HH:MM, date ISO']
  if (w.date < s.firstEpisodeDate) return [`timeSighting: date ${w.date} liegt vor der ersten Folge ${s.firstEpisodeDate}`]
  if (w.date > heute) return [`timeSighting: date ${w.date} liegt in der Zukunft`]
  const von = minuten(w.notSeen)
  const bis = minuten(w.seen)
  if (bis < von || bis - von > FENSTER_MAX_MINUTEN) return [`timeSighting: Fenster ${w.notSeen}–${w.seen} ist länger als ${FENSTER_MAX_MINUTEN} min`]
  const t = minuten(s.time)
  if (t < von || t > bis) return [`timeSighting: time ${s.time} liegt außerhalb des Fensters ${w.notSeen}–${w.seen}`]
  return []
}
