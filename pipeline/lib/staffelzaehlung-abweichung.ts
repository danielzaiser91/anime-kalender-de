import type { Title } from '../../shared/types.ts'
import { zaehleHauptstaffeln } from '../../shared/staffel-zaehlung.ts'
import { anzeigeName } from '../../shared/titles.ts'
import { remakeVonDerReihe } from '../bau/remake-von.ts'

export type Abweichung = 'gleich' | 'neuverfilmung' | 'teil' | 'unerklaert'

/**
 * Urteil über die Staffelnummer eines Titels in Pipeline (`pipeline`) und Kachel-Marke (`marke`): gleich, oder erklärt durch
 * (a) eine Neuverfilmung in der Reihe (die Marke kennt `remakeVon` nicht) oder (b) einen Teil einer Staffel (`staende.teil`: die Pipeline
 * nennt keine Nummer, die Marke fällt auf „Staffel N“ zurück), sonst unerklärt.
 */
export function bewerteAbweichung(
  t: Title,
  reihe: Title[],
  pipeline: number | undefined,
  marke: number | undefined,
  remakeQuellen?: Parameters<typeof remakeVonDerReihe>[1],
): Abweichung {
  if (pipeline === marke) return 'gleich'
  if (remakeVonDerReihe(reihe, remakeQuellen).size) return 'neuverfilmung'
  const { staende } = zaehleHauptstaffeln(reihe.map((x) => ({ ...x, name: anzeigeName(x) })))
  return staende.get(t.id)?.teil !== undefined ? 'teil' : 'unerklaert'
}
