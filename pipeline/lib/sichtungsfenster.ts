/**
 * Uhrzeit aus einer eigenen Sichtung (Ausnahme von „keine erfundenen Uhrzeiten", 18.10.2026, F39): `schedule.time` ist der
 * Regeltermin aller Folgen, `schedule.timeSighting` belegt das Fenster, in dem sie liegt. Ein Fenster unter einer Stunde
 * gilt als belegt (kein `timeEstimated`), ab einer Stunde bleibt die Zeit „≈". Abweichungen einzelner Folgen: `schedule.zeiten`.
 */
import type { Release, Schedule } from '../../shared/types.ts'
import '../../shared/sichtung.ts'

export const BELEGT_UNTER_MINUTEN = 60

/** Benannte Altausnahmen: festgelegte Uhrzeit (`time` + `timeEstimated`) ohne Sichtung, Slug → Beleg und letzter Gültigkeitstag. */
export type Ausnahmen = Record<string, { beleg: string; bis: string }>
export const FESTGELEGTE_ZEITEN: Ausnahmen = {}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const ISO = /^\d{4}-\d{2}-\d{2}$/

const minuten = (z: string): number => Number(z.slice(0, 2)) * 60 + Number(z.slice(3))

/** Ausnahme abgelaufen: `bis` liegt vor `heute` (ISO). */
export const ausnahmeAbgelaufen = (slug: string, heute: string, ausnahmen: Ausnahmen = FESTGELEGTE_ZEITEN): boolean => {
  const a = ausnahmen[slug]
  return a !== undefined && heute > a.bis
}

/** Streng ist die Frist lokal und im PR (`pull_request`); jeder andere CI-Lauf (Deploy, Wecker) warnt nur. */
export const fristStrengIn = (env: Record<string, string | undefined>): boolean =>
  !env.GITHUB_ACTIONS || env.GITHUB_EVENT_NAME === 'pull_request'

/** Alle Fehler rund um die Uhrzeit eines kuratierten Zeitplans (Format, festgelegte Zeit, Sichtung); `heute` ISO. */
export function zeitFehler(s: Schedule, heute: string, slug: string, fristStreng = true, ausnahmen: Ausnahmen = FESTGELEGTE_ZEITEN): string[] {
  const format = s.time && !/^\d{2}:\d{2}$/.test(s.time) ? [`time "${s.time}" ist nicht HH:MM`] : []
  const festgelegt = s.time && s.timeEstimated && !s.timeSighting && !ausnahmen[slug]
  const ohneAusnahme = festgelegt ? ['time + timeEstimated ohne benannte Ausnahme (timeSighting oder FESTGELEGTE_ZEITEN)'] : []
  const abgelaufen = fristStreng && s.time && s.timeEstimated && !s.timeSighting && ausnahmeAbgelaufen(slug, heute, ausnahmen)
  const frist = abgelaufen ? [`Ausnahme FESTGELEGTE_ZEITEN ist seit ${ausnahmen[slug]!.bis} abgelaufen: Zeit messen und als timeSighting eintragen`] : []
  return [...format, ...ohneAusnahme, ...frist, ...sichtungsFehler(s, heute)]
}

/** Meldungen für `data:validate`: Fehler, bei abgelaufener Ausnahme im Deploy nur eine Warnung auf der Konsole. */
export function zeitMeldungen(at: string, s: Schedule, slug: string, heute: string, env: Record<string, string | undefined>): string[] {
  if (ausnahmeAbgelaufen(slug, heute) && !fristStrengIn(env)) console.warn(`WARNUNG ${at}: Ausnahme FESTGELEGTE_ZEITEN abgelaufen`)
  return zeitFehler(s, heute, slug, fristStrengIn(env)).map((f) => `${at}: ${f}`)
}

/** Fenstermeldungen ohne Präfix; leer, wenn der Zeitplan keine Sichtung nennt oder alles stimmt. */
export function sichtungsFehler(s: Schedule, heute: string): string[] {
  const w = s.timeSighting
  if (!w) return []
  if (!s.time) return ['timeSighting: der Regeltermin schedule.time fehlt']
  if (!w.notSeen || !w.seen || !w.date || !w.source) return ['timeSighting braucht notSeen, seen, date und source']
  if (!HHMM.test(w.notSeen) || !HHMM.test(w.seen) || !HHMM.test(s.time) || !ISO.test(w.date)) return ['timeSighting: Zeiten HH:MM, date ISO']
  if (w.date < s.firstEpisodeDate) return [`timeSighting: date ${w.date} liegt vor der ersten Folge ${s.firstEpisodeDate}`]
  if (w.date > heute) return [`timeSighting: date ${w.date} liegt in der Zukunft`]
  const von = minuten(w.notSeen)
  const bis = minuten(w.seen)
  if (bis < von) return [`timeSighting: seen ${w.seen} liegt vor notSeen ${w.notSeen}`]
  const t = minuten(s.time)
  if (t < von || t > bis) return [`timeSighting: time ${s.time} liegt außerhalb des Fensters ${w.notSeen}–${w.seen}`]
  const soll = bis - von >= BELEGT_UNTER_MINUTEN
  if (Boolean(s.timeEstimated) !== soll) return [`timeSighting: Fenster ${w.notSeen}–${w.seen} verlangt timeEstimated: ${soll}`]
  return []
}

/** Ergebniszeile für das Bau-Log: welche Regeltermine aus Sichtungen stammen. */
export function sichtungsZeilen(releases: Release[]): string[] {
  const treffer = releases.filter((r) => r.schedule?.timeSighting && !r.widerlegt)
  if (!treffer.length) return []
  const liste = treffer.map((r) => `${r.slug} ${r.schedule.timeSighting!.notSeen}–${r.schedule.timeSighting!.seen} → ${r.schedule.timeEstimated ? '≈' : ''}${r.schedule.time}`)
  return [`${treffer.length} Regeltermin aus Sichtung: ${liste.join(', ')}`]
}
