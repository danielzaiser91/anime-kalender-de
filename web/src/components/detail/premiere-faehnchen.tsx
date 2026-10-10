import type { Release } from '@shared/types.ts'
import { premiereHinweis, premiereLabel } from '@shared/premiere.ts'
import { useLang } from '../../lib/i18n.tsx'
import { Tooltip } from '../ui.tsx'

/** Fernsehen: gilt für die nächste Sendung (`tvPremiere` aus `tvAngabe`); Streaming: für das Release laut Handbeleg. */
export function zeigtPremiere(release: Release, tvPremiere: boolean | undefined): boolean {
  return release.platform === 'tv' ? !!tvPremiere : release.premiere?.weg === 'stream'
}

/**
 * **Premiere als Fähnchen auf der Kante** der Pille: links neben dem Namen, rechts der Blase — mit der
 * Unterkante auf der Oberkante der Pille, sonst ragt es in die Namenszeile. „Premiere*“ trägt den
 * Tooltip „Erstmals … Vorher nur …“; ohne Vorgänger gilt im Fernsehen der bisherige Hinweis.
 */
export function PremiereFaehnchen({ release }: { release: Release }) {
  const { t } = useLang()
  const tv = release.platform === 'tv'
  const vorher = release.premiere?.vorher
  return (
    <span className={`absolute -top-[11px] ${tv ? 'left-[22px]' : 'left-[10px]'} z-10`}>
      <Tooltip text={tv && !vorher ? t('tv.premiereHinweis') : premiereHinweis(release.platform, vorher)} seite="oben">
        <span className="block rounded-md bg-orange-500 px-1.5 py-px text-[9px] font-extrabold uppercase leading-tight tracking-wider text-white shadow-[0_0_8px_rgba(249,115,22,.6)]">
          ✦ {premiereLabel(vorher)}
        </span>
      </Tooltip>
    </span>
  )
}
