/** Welche ADN-Serien zählen je Staffel neu und haben unter ihren Titeln keinen Eintrag in `data/adn-staffelzuordnung.yaml`? */
import { zaehltJeStaffel } from './meldungen-bereiche.ts'

export interface AdnRohSerie {
  showId: number
  videos: { type: string; season: string; shortNumber: string }[]
}

export interface AdnStaffelLuecke {
  showId: number
  /** Romaji-Name des Titels mit der kleinsten Kennung an dieser Serie. */
  name: string
  titel: number[]
}

interface TitelMitAdnWeg {
  id: number
  titleRomaji?: string
  streams?: { platform: string; url?: string }[]
}

/** Ein Handbeleg (`data/dub-confirmed.yaml`) hängt einen Titel auch dann an eine ADN-Serie, wenn `titles.json` keinen ADN-Weg trägt. */
export interface AdnHandbeleg {
  anilistId: number
  platform: string
  url?: string
}

/** Wahr, wo eine spätere Staffel der Rohantwort wieder bei Folge 1 beginnt (Archiv, nicht Meldungen). */
export function rohZaehltJeStaffel(serie: AdnRohSerie): boolean {
  const folgen = serie.videos
    .filter((v) => v.type === 'EPS')
    .map((v) => ({ folge_nr: Number(v.shortNumber), staffel: Number(v.season) }))
    .filter((v) => Number.isFinite(v.folge_nr) && Number.isFinite(v.staffel))
  return zaehltJeStaffel(folgen)
}

/** Die ADN-showId aus der Adresse eines Streams, sonst undefined. */
function showIdAusStream(url: string | undefined): number | undefined {
  const m = /\/video\/(\d+)/.exec(url ?? '')
  return m ? Number(m[1]) : undefined
}

/**
 * Serien, die je Staffel neu zählen, deren Titel (mit ADN-Weg) alle nicht in der Zuordnung stehen — wie `bereicheJeAdnTitel`, das dann
 * auf den durchgezählten Weg zurückfällt. Nur Serien, an denen mindestens ein Titel hängt: ohne Titel wird nichts verteilt.
 */
export function adnStaffelLuecken(
  serien: AdnRohSerie[],
  titel: TitelMitAdnWeg[],
  zuordnung: Record<number, string>,
  belege: AdnHandbeleg[] = [],
): AdnStaffelLuecke[] {
  const jeSerie = new Map<number, TitelMitAdnWeg[]>()
  const haenge = (id: number | undefined, t: TitelMitAdnWeg | undefined): void => {
    if (id === undefined || !t || jeSerie.get(id)?.includes(t)) return
    jeSerie.set(id, [...(jeSerie.get(id) ?? []), t])
  }
  for (const t of titel) for (const s of t.streams ?? []) if (s.platform === 'adn') haenge(showIdAusStream(s.url), t)
  const nachId = new Map(titel.map((t) => [t.id, t]))
  for (const b of belege) if (b.platform === 'adn') haenge(showIdAusStream(b.url), nachId.get(b.anilistId))
  const luecken: AdnStaffelLuecke[] = []
  for (const serie of serien) {
    const dran = jeSerie.get(serie.showId)
    if (!dran?.length || !rohZaehltJeStaffel(serie)) continue
    if (dran.some((t) => zuordnung[t.id])) continue
    const ids = dran.map((t) => t.id).sort((a, b) => a - b)
    luecken.push({ showId: serie.showId, name: dran.find((t) => t.id === ids[0])?.titleRomaji ?? String(ids[0]), titel: ids })
  }
  return luecken.sort((a, b) => a.showId - b.showId)
}
