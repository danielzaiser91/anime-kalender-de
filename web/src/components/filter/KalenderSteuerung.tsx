import type { ViewId } from '../../lib/router.ts'
import { addDays, addMonths, todayIso } from '@shared/time.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useHeuteLage } from '../../lib/heute-im-bild.ts'
import { HEUTE_TEXT } from '../kalender/KalenderKopf.tsx'
import { LinksZeichen, RechtsZeichen } from '../kalender/Zeichen.tsx'
import { Tooltip } from '../ui.tsx'

/** Ein Knopf für die Ansicht, zu der er umschaltet: in der Woche „Monat", im Monat „Woche". Immer neutral, 60 px fest. */
export function AnsichtKnopf({ view, onWoche, onMonat }: { view: ViewId; onWoche: () => void; onMonat: () => void }) {
  const { t } = useLang()
  const monat = view === 'monat'
  return (
    <button
      type="button"
      onClick={monat ? onWoche : onMonat}
      aria-label={t(monat ? 'view.woche' : 'view.monat')}
      className="h-11 w-[60px] shrink-0 cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche text-sm font-bold text-ak-text transition"
    >
      {t(monat ? 'view.woche' : 'view.monat')}
    </button>
  )
}

/**
 * ‹ heute › in einer Pille. Liegt heute außerhalb des Sichtbaren, ist die Mitte orange; die Richtung steht
 * im Tooltip und im `aria-label`. In der Woche scrollt die Mitte zum heutigen Tag, im Monat ist sie dann gesperrt.
 */
export function HeuteChip({ view, date, onDate }: { view: ViewId; date: string; onDate: (d: string) => void }) {
  const { t } = useLang()
  const monat = view === 'monat'
  const lage = useHeuteLage(monat, date)
  const hier = lage === 'hier'
  const text = hier && !monat ? t('nav.todayScroll') : t(HEUTE_TEXT[lage])
  const schritt = (dir: number) => onDate(monat ? addMonths(date, dir) : addDays(date, dir * 7))
  const kreis = 'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ak-flaeche-2 text-ak-text'
  return (
    <div role="group" aria-label={t('kal.zeitraum')} className="flex h-11 shrink-0 items-center rounded-full border border-ak-rand bg-ak-flaeche p-0.5">
      <button type="button" onClick={() => schritt(-1)} aria-label={t('kal.voriger')} className={kreis}>
        <LinksZeichen />
      </button>
      <Tooltip text={text} seite="oben" eigenerFokus>
        <button
          type="button"
          onClick={() => {
            onDate(todayIso())
            if (!monat) window.dispatchEvent(new Event('ak-zu-heute'))
          }}
          disabled={hier && monat}
          aria-label={`${t('nav.today')}: ${text}`}
          aria-current={hier ? 'date' : undefined}
          className={[
            'h-10 w-14 shrink-0 cursor-pointer rounded-full text-sm font-bold transition disabled:cursor-default disabled:opacity-40',
            hier ? 'text-ak-text' : 'bg-ak-akzent text-ak-auf-akzent',
          ].join(' ')}
        >
          {t('nav.today')}
        </button>
      </Tooltip>
      <button type="button" onClick={() => schritt(1)} aria-label={t('kal.naechster')} className={kreis}>
        <RechtsZeichen />
      </button>
    </div>
  )
}
