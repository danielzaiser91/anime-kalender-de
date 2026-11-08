import type { Release } from '../../shared/types.ts'
import { expandEvents, istErschienen } from '../../shared/logic.ts'
import { nachBerlin, reichsteSerieJeKennung } from './crunchyroll-termine.ts'
import type { CrSerie } from './crunchyroll-dub.ts'

/** Ein Tag früher oder später: Der Katalog stempelt in UTC, der Termin zählt in Berlin. */
const TOLERANZ_TAGE = 1

const tage = (a: string, b: string): number => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

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
    for (const e of expandEvents(r)) {
      if (istErschienen(e, jetzt) && e.estimated && e.episode != null && gefuehrt.has(e.episode)) raus.push({ slug: r.slug, folge: e.episode })
    }
  }
  return raus
}
