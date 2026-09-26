import { Tooltip } from './ui.tsx'
import type { Translate } from '../lib/i18n.tsx'
import type { JSX } from 'react'
import { coverBild } from '../lib/cover.ts'

export type Fahne = 'premiere' | 'start'

const START_HINWEIS = 'Ab hier gibt es diese Staffel mit deutscher Synchro.'

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
 *
 * `flex leading-none` an der Hülle: Ohne sie gab die Zeilenhöhe dem Tooltip 8 px Vorlauf, die Plakette
 * rutschte in die Karte und verdeckte Uhrzeit und Cover (26.09.2026).
 */
export function MitFaehnchen({ t, kachel, art }: {
  t: Translate
  kachel: JSX.Element
  art: Fahne
}) {
  return (
    <div className="relative">
      <span className="ak-fahne absolute -top-1.5 left-3 z-10 flex leading-none">
        <Tooltip text={art === 'premiere' ? t('tv.premiereHinweis') : START_HINWEIS} seite="oben">
          <span
            className={[
              'block rounded-md bg-gradient-to-r px-1.5 py-px text-[9px] font-extrabold uppercase leading-tight tracking-wider text-white',
              art === 'premiere'
                ? 'from-fuchsia-600 to-amber-500 shadow-[0_0_8px_rgba(217,70,239,.7)]'
                : 'from-sky-600 to-emerald-500 shadow-[0_0_8px_rgba(14,165,233,.7)]',
            ].join(' ')}
          >
            {art === 'premiere' ? '✦ Premiere' : '✦ Start'}
          </span>
        </Tooltip>
      </span>
      {kachel}
    </div>
  )
}

/**
 * Das Cover einer Terminkarte. Klein neben der Kopfzeile; beim Staffelstart groß über die ganze
 * Kartenbreite — der seltene Termin, für den jemand die Woche aufschlägt, soll man nicht suchen.
 * Oberer Bildteil, weil Figuren und Schriftzug auf Covern meist oben sitzen.
 */
export function KartenCover({ cover, gross }: { cover: string; gross?: boolean }) {
  if (!gross) {
    return <img {...coverBild(cover, 28)} alt="" loading="lazy" className="h-10 w-7 shrink-0 rounded object-cover" />
  }
  return (
    <img
      {...coverBild(cover, 160, '(min-width: 1280px) 160px, (min-width: 640px) 45vw, 100vw')}
      alt=""
      loading="lazy"
      className="aspect-[3/2] max-h-40 w-full rounded-md object-cover object-[50%_20%]"
    />
  )
}
