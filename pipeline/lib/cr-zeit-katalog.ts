/**
 * **Die Uhrzeit eines laufenden Crunchyroll-Wochentermins kommt aus dem Katalogstempel seiner jüngsten Folge**
 * (14.11.2026, The Vermilion Mask: Wochenprogramm 10:30, Folge 2 und 3 kamen um 11:30 — live stand eine Stunde „seit 10:30“).
 *
 * Gemessen am 14.11.2026 über 37 Wochenprogramm-Zeilen seit dem 20.10.: Der Stempel `verfuegbarAb` passte in 32 von 32
 * messbaren Fällen zum stündlichen Abruf (zuletzt ohne, erstmals mit der Folge), die Wochenprogramm-Zeit in 22 davon nicht
 * (28.10.–01.11. eine Stunde zu spät, ab 02.11. eine Stunde zu früh). Am ersten Tag gilt das Wochenprogramm
 * nur in der Woche nach einer Umstellung (`cr-zeit-woche.ts`, Psyren), danach der Stempel (Vermilion).
 */
import type { Schedule } from '../../shared/types.ts'
import type { CrSerie } from './crunchyroll-dub.ts'
import { blockZumTermin, nachBerlin } from './crunchyroll-termine.ts'
import { zeitAusWochenprogramm, type WocheBelege } from './cr-zeit-woche.ts'

export interface KatalogZeit {
  /** Die Zeit der jüngsten gepaarten Folge — sie gilt auch für die kommenden. */
  time: string
  /** Frühere Folgen mit anderer Zeit (Feld `schedule.zeiten`). */
  zeiten: Record<number, string>
}

/**
 * Die Zeiten der Folgen, deren Katalogtag mit dem beobachteten Tag übereinstimmt (Paarung wie `beobachtungenAusBlock`).
 * `start` ersetzt die Zeit am ersten Tag, wenn das Wochenprogramm sie dort belegt.
 */
export function zeitenAusBlock(
  serie: CrSerie,
  beobachtet: Record<number, string>,
  start?: { datum: string; zeit: string },
): KatalogZeit | undefined {
  const block = blockZumTermin(serie, beobachtet)
  if (!block) return undefined
  const folgen = (block.st.deutscheFolgen ?? []).flatMap((f) => {
    const nr = f[block.zaehlung]
    const b = f.verfuegbarAb ? nachBerlin(f.verfuegbarAb) : null
    if (!nr || !b || beobachtet[nr] !== b.datum) return []
    return [{ nr, datum: b.datum, zeit: b.datum === start?.datum ? start.zeit : b.zeit }]
  })
  folgen.sort((a, b) => a.datum.localeCompare(b.datum) || a.nr - b.nr)
  const juengste = folgen.at(-1)
  if (!juengste) return undefined
  const zeiten = Object.fromEntries(folgen.filter((f) => f.zeit !== juengste.zeit).map((f) => [f.nr, f.zeit]))
  return { time: juengste.zeit, zeiten }
}

/**
 * Setzt `time` (und `zeiten`) eines Wochentermins nach dem Katalog; gibt zurück, ob sich etwas änderte.
 * Nur bei einer belegten Zeit: geschätzte Zeiten und schon gesetzte Zeiten je Folge (TV-Sichtung) bleiben.
 */
export function setzeKatalogZeit(schedule: Schedule, serie: CrSerie, belege: WocheBelege): boolean {
  if (!schedule.time || schedule.timeEstimated || schedule.zeiten || !schedule.observed) return false
  const woche = zeitAusWochenprogramm(belege, serie.seriesId, schedule.firstEpisodeDate)
  const k = zeitenAusBlock(serie, schedule.observed, woche && { datum: schedule.firstEpisodeDate, zeit: woche.zeit })
  const frueher = Object.keys(k?.zeiten ?? {}).length
  if (!k || (k.time === schedule.time && !frueher)) return false
  schedule.time = k.time
  if (frueher) schedule.zeiten = k.zeiten
  return true
}
