import type { Title } from '../../shared/types.ts'
import { toIsoDate } from '../../shared/time.ts'
import { STAFFEL_IM_NAMEN, staffelDesTitels } from '../bau/widerlegung-staffel.ts'
import type { NeueFolge } from './cr-neu-wache.ts'

/**
 * Die Staffel, unter der der Crunchyroll-Katalog die Folgen dieses Titels führt: allein in seiner Reihe Staffel 1,
 * sonst die errechnete Staffelnummer (der Katalog führt einen Titel ohne Schwestertitel als Staffel 1, auch eine
 * AniList-Fortsetzung; Folgennummern zählen dort je Staffel neu); `undefined`, wenn sie nicht eindeutig ist (dann zählt der Katalog nicht als Beleg).
 */
export function katalogStaffel(title: Title | undefined, titles: Title[]): number | undefined {
  if (!title) return undefined
  const allein = !titles.some((x) => x.id !== title.id && x.franchiseId !== undefined && x.franchiseId === title.franchiseId)
  return allein ? 1 : staffelDesTitels(title, titles)
}

/**
 * Der Tag, an dem die Folge spätestens abrufbar war: `verfuegbarAb` (Berliner Tag), fehlt es, der Tag des ersten Katalogfundes
 * (`gesehenAm`, steht dort immer). Ohne beides `undefined`.
 */
export function katalogTag(f: NeueFolge): string | undefined {
  return tagAusVerfuegbarAb(f) ?? rueckfallTag(f)
}

function tagAusVerfuegbarAb(f: NeueFolge): string | undefined {
  if (!f.verfuegbarAb) return undefined
  const zeit = new Date(f.verfuegbarAb)
  return Number.isNaN(zeit.getTime()) ? undefined : toIsoDate(zeit)
}

/**
 * Rückfall: Der Tag des ersten Katalogfundes. „Früheste Beobachtung“ ist nicht „erschienen am“ (bei den ersten fünf Fällen
 * lag er 10–34 Tage nach `ausstrahlung`): er belegt, dass die Folge da war, nicht seit wann.
 */
function rueckfallTag(f: NeueFolge): string | undefined {
  return f.gesehenAm && /^\d{4}-\d{2}-\d{2}$/.test(f.gesehenAm) ? f.gesehenAm : undefined
}

/** Folgen, für die auch der Rückfall keinen Tag liefert: sie können keinen Vermerk „nicht erschienen“ aufheben. */
export function katalogOhneTag(folgen: NeueFolge[]): NeueFolge[] {
  return folgen.filter((f) => !katalogTag(f))
}

/** Zähler der Verwerfungspfade von `katalogBeobachtungen` (Skill stille-ausfaelle-verhindern). */
export interface KatalogVerworfen {
  /** Aufruf ohne Serienkennung oder Staffel: der Titel hat nichts zum Suchen. */
  ohneSerieOderStaffel: number
  /** Folge der Serie ohne ganze Nummer ab 1. */
  ohneNummer: number
  /** Folge einer anderen Staffel derselben Serie. */
  andereStaffel: number
  /** Weder `verfuegbarAb` noch `gesehenAm` lesbar. */
  ohneTag: number
  /** Tag nach `heute`: angekündigt, keine Sichtung. */
  angekuendigt: number
}

export const keinVerworfen = (): KatalogVerworfen => ({ ohneSerieOderStaffel: 0, ohneNummer: 0, andereStaffel: 0, ohneTag: 0, angekuendigt: 0 })

/** Eine Katalog-Sichtung; `rueckfall`: Tag aus `gesehenAm`, also ein Beleg „war da“, kein Erscheinungstag. */
export interface KatalogSichtung {
  date: string
  episode: number
  rueckfall?: true
}

/**
 * Deutsche Folgen der Serie `serieId` und Staffel `staffel` aus `data/crunchyroll-neu.json` als Beobachtungen (Tag Berlin).
 *
 * Lehre (26.10.2026, Aristocrat S3 Folge 2): Der Katalog sah die Folge am 25.10., der Simulcast-Kalender zeigte sie nicht,
 * und „⚠ Folge 2 ist nicht erschienen“ blieb stehen. Folgennummern zählen je Staffel: Schwesterstaffeln einer Serienkennung zählen nicht.
 * Jede Verwerfung (außer „andere Serie“, das ist die Auswahl) zählt in `verworfen`.
 */
export function katalogBeobachtungen(
  folgen: NeueFolge[],
  serieId: string | undefined,
  staffel: number | undefined,
  heute: string,
  verworfen: KatalogVerworfen = keinVerworfen(),
): KatalogSichtung[] {
  if (!serieId || staffel === undefined) {
    verworfen.ohneSerieOderStaffel++
    return []
  }
  const raus: KatalogSichtung[] = []
  for (const f of folgen) {
    if (f.serieId !== serieId) continue
    if (!Number.isInteger(f.nummer) || (f.nummer as number) < 1) {
      verworfen.ohneNummer++
      continue
    }
    const ihre = f.staffel === f.serie ? 1 : Number(STAFFEL_IM_NAMEN.exec(f.staffel ?? '')?.[1])
    if (ihre !== staffel) {
      verworfen.andereStaffel++
      continue
    }
    const date = katalogTag(f)
    if (!date) {
      verworfen.ohneTag++
      continue
    }
    /* Eine angekündigte Folge (Tag nach `heute`, Berliner Tag wie bei beobachtetAusRelease) ist keine Sichtung. */
    if (date > heute) {
      verworfen.angekuendigt++
      continue
    }
    raus.push({ date, episode: f.nummer as number, ...(tagAusVerfuegbarAb(f) ? {} : { rueckfall: true as const }) })
  }
  return raus
}
