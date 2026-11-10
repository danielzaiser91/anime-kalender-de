/**
 * Crunchyrolls Tages-Platzhalter beim deutschen Termin (10.11.2026, Wochenlauf, PR 3372).
 *
 * Bei 6 von 11 Staffeln, deren Berliner Starttag sich im Lauf änderte, trägt das `premium_available_date` des deutschen Objekts
 * bei allen oder einem Teil der Folgen genau 23:59 Pacific (06:59Z im Sommer, 07:59Z im Winter) und liegt vor dem zuvor
 * gelesenen Termin (Demon Lord: 2018-07-06 statt 2021-10-21, die deutsche Fassung gab es 2018 nicht). Eine Minute vor Mitternacht ist
 * keine Veröffentlichungszeit, sondern ein Datum ohne Uhrzeit. Ein solcher Wert ersetzt keinen zuvor gelesenen Termin mit echter Uhrzeit.
 */
import type { CrSerie } from './crunchyroll-dub.ts'

const ZEIT_PAZIFIK = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Der Termin ist 23:59 Pacific, also ein Tagesdatum ohne Uhrzeit. */
export function istTagesPlatzhalter(iso: string | undefined): boolean {
  if (!iso) return false
  const t = new Date(iso)
  return !Number.isNaN(t.getTime()) && ZEIT_PAZIFIK.format(t) === '23:59'
}

/** Übernimmt je Folge (Kennung) den zuvor gelesenen Termin, wo der neue ein Tages-Platzhalter ist und der alte keiner. Gibt die neue Serie und die Zahl der gehaltenen Folgen zurück. */
export function halteBelegteTermine(vorher: CrSerie | undefined, neu: CrSerie): { serie: CrSerie; gehalten: number } {
  if (!vorher?.staffeln || !neu.staffeln) return { serie: neu, gehalten: 0 }
  const alt = new Map<string, string>()
  for (const st of vorher.staffeln) for (const f of st.deutscheFolgen ?? []) if (f.verfuegbarAb && !istTagesPlatzhalter(f.verfuegbarAb)) alt.set(f.guid, f.verfuegbarAb)
  let gehalten = 0
  const staffeln = neu.staffeln.map((st) => {
    if (!st.deutscheFolgen) return st
    const deutscheFolgen = st.deutscheFolgen.map((f) => {
      const bisher = alt.get(f.guid)
      if (!bisher || !istTagesPlatzhalter(f.verfuegbarAb)) return f
      gehalten++
      return { ...f, verfuegbarAb: bisher }
    })
    return { ...st, deutscheFolgen }
  })
  return gehalten ? { serie: { ...neu, staffeln }, gehalten } : { serie: neu, gehalten: 0 }
}
