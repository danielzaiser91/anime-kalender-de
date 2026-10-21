import type { StreamLink } from '../../shared/types.ts'
import { kanalSchluessel } from './kanal-titel.ts'

/**
 * **Darf ein Urteil „deutsch“ aus Stufe 3 diesen Weg belegen?** Nicht auf einem Prime-Kanal (Kanal-Adresse aus den Handbelegen
 * oder `kanal` am Weg): Amazons Sprachliste eines Kanal-Titels belegt keine Synchro (quellen.md, 11.10.2026). Und nicht, wenn
 * alle Termine des Anbieters eine Sprachkennzeichnung tragen (`alleTermineGekennzeichnet`): Dann bricht `deutschNurAusSpracheTermin`
 * jedes Ja ab. Bau und Plausibilitätsprüfung fragen dasselbe, damit die Prüfung nichts verlangt, was der Bau nicht darf.
 */
export function urteilDarfBelegen(
  titleId: number,
  s: Pick<StreamLink, 'platform' | 'url' | 'seite' | 'kanal'>,
  kanal: ReadonlySet<string>,
  gekennzeichnet: ReadonlySet<string>,
): boolean {
  /* Auch `seite`: Hat die gti-Brücke die Adresse schon umgestellt, steht die Amazon-Seite (der Kanal-Schlüssel) dort. */
  const kanalAdresse = [s.url, s.seite].some((u) => u && kanal.has(kanalSchluessel(titleId, u)))
  if (s.platform === 'primevideo' && (s.kanal || kanalAdresse)) return false
  return !gekennzeichnet.has(`${titleId}|${s.platform}`)
}
