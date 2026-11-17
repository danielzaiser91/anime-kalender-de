import type { Release } from '../../shared/types.ts'
import { expandEvents, istErschienen } from '../../shared/logic.ts'
import { abstandSeitTermin } from '../../shared/termin-zustand.ts'
import { nachBerlin, reichsteSerieJeKennung } from './crunchyroll-termine.ts'
import type { CrSerie } from './crunchyroll-dub.ts'

/** Ein Tag früher oder später: Der Katalog stempelt in UTC, der Termin zählt in Berlin. */
const TOLERANZ_TAGE = 1

const tage = (a: string, b: string): number => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

/** Länger als so viele Tage ohne Sichtung gilt als Lücke im Plan (Messung 15.11.2026: 4 von 7 je „fälligen“ Folgen standen > 7 Tage). */
export const OHNE_SICHTUNG_WARNUNG_TAGE = 7

/** Termine, die seit mehr als `tageMax` Tagen verstrichen sind, ohne dass eine Sichtung sie belegt (`ohneSichtung`); die Seite zeigt sie nach 24 h wieder als erschienen (≈). */
export function ohneSichtungLange(releases: Release[], jetzt: Date, tageMax = OHNE_SICHTUNG_WARNUNG_TAGE): { slug: string; folge: number; tage: number }[] {
  const raus: { slug: string; folge: number; tage: number }[] = []
  for (const r of releases) {
    for (const e of expandEvents(r)) {
      const alter = abstandSeitTermin(e, jetzt) / 86_400_000
      if (e.ohneSichtung && e.episode != null && alter > tageMax) raus.push({ slug: r.slug, folge: e.episode, tage: Math.floor(alter) })
    }
  }
  return raus
}

/** Die Zeile für `commit-data.sh` (zeigt `⚠ WARNUNG`-Zeilen im Lauf-Log); `undefined`, wenn nichts auffällt. */
export function ohneSichtungWarnzeile(liste: { slug: string; folge: number; tage: number }[]): string | undefined {
  if (!liste.length) return undefined
  const namen = liste.map((o) => `${o.slug} Folge ${o.folge} (${o.tage} Tage)`).join('; ')
  return `⚠ WARNUNG Crunchyroll-Termin seit mehr als ${OHNE_SICHTUNG_WARNUNG_TAGE} Tagen ohne Sichtung: ${namen} — die Seite zeigt ihn als erschienen (≈)`
}

/**
 * Laufende Crunchyroll-Wochentermine mit mindestens einer Beobachtung (der Anker der Paarung in `beobachtungenAusBlock`), die eine erschienene Folge
 * schätzen, obwohl der deutsche Katalog sie führt. Ohne Beobachtung ist der Termin eine Ankündigung, nichts wird nachgetragen.
 * Der Block des Termins ist der, dessen erster deutscher Tag am Starttag des Termins liegt (unabhängig von den Beobachtungen);
 * führt er eine Folge dieser Nummer (Crunchyrolls Nummer oder Stelle im Block) mit Stempel in der Vergangenheit, ist die „≈“-Lage vermeidbar.
 */
export function schaetzungTrotzKatalog(releases: Release[], serien: CrSerie[], jetzt: Date): { slug: string; folge: number }[] {
  const jeKennung = reichsteSerieJeKennung(serien)
  const raus: { slug: string; folge: number }[] = []
  for (const r of releases) {
    if (r.platform !== 'crunchyroll' || r.releaseType !== 'weekly' || r.schedule.lastEpisodeDate || !r.schedule.firstEpisodeDate) continue
    if (!Object.keys(r.schedule.observed ?? {}).length) continue
    const serie = jeKennung.get(/series\/([A-Z0-9]+)/.exec(r.platformUrl ?? '')?.[1] ?? '')
    if (!serie) continue
    const start = r.schedule.firstEpisodeDate
    const bloecke = (serie.staffeln ?? []).filter((st) => {
      const ersterTag = (st.deutscheFolgen ?? []).flatMap((f) => (f.verfuegbarAb ? [nachBerlin(f.verfuegbarAb)!.datum] : [])).sort()[0]
      return ersterTag !== undefined && tage(ersterTag, start) <= TOLERANZ_TAGE
    })
    if (bloecke.length !== 1) continue
    const gefuehrt = new Set(
      (bloecke[0]!.deutscheFolgen ?? [])
        .filter((f) => f.verfuegbarAb && Date.parse(f.verfuegbarAb) <= jetzt.getTime())
        .flatMap((f) => [f.nummer, f.laufend]),
    )
    /* „Fällig ohne Sichtung“ zählt hier als verstrichen: Die Wache sucht gerade die Folgen, die der Katalog führt und die der Plan noch nicht als beobachtet trägt. */
    for (const e of expandEvents(r).map((x) => ({ ...x, ohneSichtung: false }))) {
      if (istErschienen(e, jetzt) && e.estimated && e.episode != null && gefuehrt.has(e.episode)) raus.push({ slug: r.slug, folge: e.episode })
    }
  }
  return raus
}
