import type { ReleaseEvent } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { KlappeZeichen } from './Zeichen.tsx'

/**
 * Kino-Termine stehen im „Saal": zwei Spalten breit, Cover als Fenster zwischen Vorhängen, Querbehang mit dem Wort „Kino".
 * Ein Staffelstart/-finale (Ring) und ein Titel bei mehreren Anbietern behalten die gewohnte Kachel.
 */
export const istKinoSaal = (event: ReleaseEvent, art: unknown, mehrereAnbieter: boolean): boolean =>
  event.platform === 'kino' && !art && !mehrereAnbieter

/** Das Cover als Fenster der Bühne (Behang oben, Vorhänge seitlich). */
export const SAAL_FENSTER = 'absolute left-[11%] top-[21%] h-[68%] w-[78%]'
/** Lage von Marken und Knöpfen im Saal: innerhalb des Fensters, nicht auf Behang oder Vorhang. */
export const SAAL_MARKEN = 'top-[17%] left-[13%] z-10'
export const SAAL_STERN = 'right-[13%] bottom-[13%] z-10'
export const SAAL_KNOEPFE = 'right-[12%] bottom-[12%] z-10'

/** Die Bühne als reine Zeichnung (CSS): Vorhänge, Lichtkegel, Querbehang. Liegt vor dem Cover-Fenster. */
export function KinoBuehne() {
  return (
    <>
      <i className="ak-saal-vorhang ak-saal-vorhang-l" aria-hidden="true" />
      <i className="ak-saal-vorhang ak-saal-vorhang-r" aria-hidden="true" />
      <i className="ak-saal-licht" aria-hidden="true" />
      <span className="ak-saal-behang">
        <KlappeZeichen groesse={12} />
        {PLATFORMS.kino.name}
      </span>
    </>
  )
}
