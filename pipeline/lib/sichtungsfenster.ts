/**
 * Uhrzeit aus einem eigenen Sichtungsfenster (Ausnahme von „keine erfundenen Uhrzeiten", 18.10.2026):
 * eine Folge fehlte zu `notSeen` und war zu `seen` da, höchstens 30 Minuten später; `timeSighting.time` liegt im Fenster.
 * Die Zeit steht nur dort, nie in `schedule.time`: Einziger Leser ist `setzeSichtungszeit` (shared/sichtung.ts).
 */
import type { Release, ReleaseEvent, Schedule } from '../../shared/types.ts'
import '../../shared/sichtung.ts'

export const FENSTER_MAX_MINUTEN = 30

/** Benannte Altausnahmen: festgelegte Uhrzeit (`time` + `timeEstimated`) ohne Sichtungsfenster, Slug → Beleg und Stand. */
export const FESTGELEGTE_ZEITEN: Record<string, string> = {
  'avatar-die-sieben-haefen-paramountplus': 'Daniel sah F4–6 am 16.10.2026 um 11:42 schon da und legte 11:00 fest; Fenster fehlt, am 23.10. genauer messen',
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const ISO = /^\d{4}-\d{2}-\d{2}$/

const minuten = (z: string): number => Number(z.slice(0, 2)) * 60 + Number(z.slice(3))

/** Alle Fehler rund um die Uhrzeit eines kuratierten Zeitplans (Format, festgelegte Zeit, Sichtung); `heute` ISO. */
export function zeitFehler(s: Schedule, heute: string, slug: string): string[] {
  const format = s.time && !/^\d{2}:\d{2}$/.test(s.time) ? [`time "${s.time}" ist nicht HH:MM`] : []
  const festgelegt = s.time && s.timeEstimated && !s.timeSighting && !FESTGELEGTE_ZEITEN[slug]
  const ohneAusnahme = festgelegt ? ['time + timeEstimated ohne benannte Ausnahme (timeSighting oder FESTGELEGTE_ZEITEN)'] : []
  return [...format, ...ohneAusnahme, ...sichtungsFehler(s, heute)]
}

/** Fehlertexte ohne Präfix; leer, wenn der Zeitplan keine Sichtung nennt oder alles stimmt. */
export function sichtungsFehler(s: Schedule, heute: string): string[] {
  const w = s.timeSighting
  if (!w) return []
  if (s.time) return ['timeSighting: die Zeit gehört nach timeSighting.time, schedule.time bleibt leer']
  if (!w.time || !w.notSeen || !w.seen || !w.date || !w.source) return ['timeSighting braucht time, notSeen, seen, date und source']
  if (!HHMM.test(w.notSeen) || !HHMM.test(w.seen) || !HHMM.test(w.time) || !ISO.test(w.date)) return ['timeSighting: Zeiten HH:MM, date ISO']
  if (w.date < s.firstEpisodeDate) return [`timeSighting: date ${w.date} liegt vor der ersten Folge ${s.firstEpisodeDate}`]
  if (w.date > heute) return [`timeSighting: date ${w.date} liegt in der Zukunft`]
  const von = minuten(w.notSeen)
  const bis = minuten(w.seen)
  if (bis < von || bis - von > FENSTER_MAX_MINUTEN) return [`timeSighting: Fenster ${w.notSeen}–${w.seen} ist länger als ${FENSTER_MAX_MINUTEN} min`]
  const t = minuten(w.time)
  if (t < von || t > bis) return [`timeSighting: time ${w.time} liegt außerhalb des Fensters ${w.notSeen}–${w.seen}`]
  return []
}

const traegtZeit = (events: ReleaseEvent[], slug: string, datum: string): boolean =>
  events.some((e) => e.releaseSlug === slug && e.date === datum && e.time)

/** Eine Sichtung, deren Tag keinen Termin mit Uhrzeit ergibt, bewirkt nichts — das darf nicht still bleiben (Bau-Ende, `pruefeErgebnis`). */
export function sichtungOhneUhrzeit(releases: Release[], events: ReleaseEvent[]): string[] {
  const fehler: string[] = []
  for (const r of releases) {
    const w = r.schedule?.timeSighting
    if (!w || r.widerlegt) continue
    if (traegtZeit(events, r.slug, w.date)) continue
    fehler.push(`"${r.slug}": timeSighting.date ${w.date} ergibt keinen Termin mit Uhrzeit (Folgenzahl oder Datum prüfen)`)
  }
  return fehler
}

/** Ergebniszeile für das Bau-Log: welche Uhrzeiten aus Sichtungen stammen. */
export function sichtungsZeilen(releases: Release[], events: ReleaseEvent[]): string[] {
  const treffer = releases.filter((r) => r.schedule?.timeSighting && !r.widerlegt && traegtZeit(events, r.slug, r.schedule.timeSighting.date))
  if (!treffer.length) return []
  const liste = treffer.map((r) => `${r.slug} ${r.schedule.timeSighting!.date} ≈${r.schedule.timeSighting!.time}`)
  return [`${treffer.length} Uhrzeit aus Sichtung: ${liste.join(', ')}`]
}
