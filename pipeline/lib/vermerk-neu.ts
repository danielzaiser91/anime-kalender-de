/** Ein neuer Vermerk „Termin nicht eingehalten“ (Zeile in `data/termine-verpasst.json`) aus dem Plan-Ereignis, das ausblieb. */
export interface AusgebliebenesEreignis {
  id: string
  releaseSlug: string
  titleId: number
  name: string
  platform: string
}

export function neuerVermerk(e: AusgebliebenesEreignis, folge: number | null, erwartetAm: string, bemerktAm: string, folgenVerfuegbar: number | null) {
  return {
    id: e.id,
    slug: e.releaseSlug,
    titleId: e.titleId,
    name: e.name,
    platform: e.platform,
    episode: folge,
    erwartetAm,
    bemerktAm,
    erschienenAm: null,
    verzugStunden: null,
    folgenVerfuegbar,
    neuErwartet: null,
    recherche: null,
  }
}
