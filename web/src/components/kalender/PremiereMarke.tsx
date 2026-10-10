import type { PlatformId } from '@shared/types.ts'
import { premiereHinweis, premiereLabel, type PremiereVorher } from '@shared/premiere.ts'
import { Tooltip } from '../ui.tsx'

/** „Premiere“ bzw. „Premiere*“ (mit Tooltip, wenn es die Fassung vorher auf Disc oder im Kino gab). */
export function PremiereMarke({ platform, vorher, className }: { platform: PlatformId; vorher?: PremiereVorher; className: string }) {
  const marke = (
    <span className={`rounded-full bg-orange-500 text-[10px] font-extrabold uppercase tracking-wider text-white ${className}`}>
      {premiereLabel(vorher)}
    </span>
  )
  return vorher ? (
    <Tooltip text={premiereHinweis(platform, vorher)} seite="oben">
      {marke}
    </Tooltip>
  ) : (
    marke
  )
}
