import { Tooltip } from './ui.tsx'
import type { Translate } from '../lib/i18n.tsx'
import type { JSX } from 'react'

/**
 * **Premiere als Fähnchen auf der Kante** (Daniel, 22.09.2026, Entwurf P2) — dasselbe Zeichen wie an
 * der TV-Pille im Panel. Die Kachel schneidet mit `overflow-hidden` ab, das Fähnchen sitzt deshalb
 * auf einer Hülle darüber.
 *
 * **Die Hülle bekommt keinen Abstand** (Daniel, 23.09.2026: „das premiere label führt zu komischen
 * verschiebungen im kalender"). Sie trug `mt-3`, damit das Fähnchen Platz hat — nur steht es
 * `absolute` und braucht im Fluss gar keinen. Gemessen in der Wochenansicht: 18 px über einer
 * Kachel mit Fähnchen gegen 6 px überall sonst, also ein sichtbarer Versatz gegen die Nachbarspalte.
 * Ohne den Abstand ragt das Fähnchen mit `-top-1.5` genau 6 px hoch — es füllt den Zwischenraum
 * und berührt die Kachel darüber nicht (gemessen: Überlappung 0 px).
 */
export function MitFaehnchen({ t, kachel }: {
  t: Translate
  kachel: JSX.Element
}) {
  return (
    <div className="relative">
      <span className="absolute -top-1.5 left-3 z-10">
        <Tooltip text={t('tv.premiereHinweis')} seite="oben">
          <span className="block rounded-md bg-gradient-to-r from-fuchsia-600 to-amber-500 px-1.5 py-px text-[9px] font-extrabold uppercase leading-tight tracking-wider text-white shadow-[0_0_8px_rgba(217,70,239,.7)]">
            ✦ Premiere
          </span>
        </Tooltip>
      </span>
      {kachel}
    </div>
  )
}
