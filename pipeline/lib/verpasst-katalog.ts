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
  if (f.verfuegbarAb) {
    const zeit = new Date(f.verfuegbarAb)
    if (!Number.isNaN(zeit.getTime())) return toIsoDate(zeit)
  }
  return f.gesehenAm && /^\d{4}-\d{2}-\d{2}$/.test(f.gesehenAm) ? f.gesehenAm : undefined
}

/** Folgen, für die auch der Rückfall keinen Tag liefert: sie können keinen Vermerk „nicht erschienen“ aufheben. */
export function katalogOhneTag(folgen: NeueFolge[]): NeueFolge[] {
  return folgen.filter((f) => !katalogTag(f))
}

/**
 * Deutsche Folgen der Serie `serieId` und Staffel `staffel` aus `data/crunchyroll-neu.json` als Beobachtungen (Tag Berlin).
 *
 * Lehre (26.10.2026, Aristocrat S3 Folge 2): Der Katalog sah die Folge am 25.10., der Simulcast-Kalender zeigte sie nicht,
 * und „⚠ Folge 2 ist nicht erschienen“ blieb stehen. Folgennummern zählen je Staffel: Schwesterstaffeln einer Serienkennung zählen nicht.
 */
export function katalogBeobachtungen(
  folgen: NeueFolge[],
  serieId: string | undefined,
  staffel: number | undefined,
  heute: string,
): { date: string; episode: number }[] {
  if (!serieId || staffel === undefined) return []
  const raus: { date: string; episode: number }[] = []
  for (const f of folgen) {
    if (f.serieId !== serieId || !Number.isInteger(f.nummer) || (f.nummer as number) < 1) continue
    const ihre = f.staffel === f.serie ? 1 : Number(STAFFEL_IM_NAMEN.exec(f.staffel ?? '')?.[1])
    if (ihre !== staffel) continue
    const date = katalogTag(f)
    if (!date) continue
    /* Eine angekündigte Folge (Tag nach `heute`, Berliner Tag wie bei beobachtetAusRelease) ist keine Sichtung. */
    if (date <= heute) raus.push({ date, episode: f.nummer as number })
  }
  return raus
}
