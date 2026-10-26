import type { Title } from '../../shared/types.ts'
import { toIsoDate } from '../../shared/time.ts'
import { STAFFEL_IM_NAMEN, staffelDesTitels } from '../bau/widerlegung-staffel.ts'
import type { NeueFolge } from './cr-neu-wache.ts'

/**
 * Die Staffel, unter der der Crunchyroll-Katalog die Folgen dieses Titels führt: allein in seiner Reihe Staffel 1,
 * sonst die errechnete Staffelnummer; `undefined`, wenn sie nicht eindeutig ist (dann zählt der Katalog nicht als Beleg).
 */
export function katalogStaffel(title: Title | undefined, titles: Title[]): number | undefined {
  if (!title) return undefined
  const allein = !titles.some((x) => x.id !== title.id && x.franchiseId !== undefined && x.franchiseId === title.franchiseId)
  return allein ? 1 : staffelDesTitels(title, titles)
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
): { date: string; episode: number }[] {
  if (!serieId || staffel === undefined) return []
  const raus: { date: string; episode: number }[] = []
  for (const f of folgen) {
    if (f.serieId !== serieId || !f.verfuegbarAb || !Number.isInteger(f.nummer) || (f.nummer as number) < 1) continue
    const ihre = f.staffel === f.serie ? 1 : Number(STAFFEL_IM_NAMEN.exec(f.staffel ?? '')?.[1])
    if (ihre !== staffel) continue
    raus.push({ date: toIsoDate(new Date(f.verfuegbarAb)), episode: f.nummer as number })
  }
  return raus
}
