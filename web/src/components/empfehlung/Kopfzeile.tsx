import { useLang } from '../../lib/i18n.tsx'
import type { Phase } from '../../lib/empfehlung-ablauf.ts'

const KNOPF = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-ak-rand bg-ak-flaeche px-3 text-[13px]'

/** Kopfzeile der Fläche: Rückweg zum Kalender, je nach Phase „← Vorschläge“ bzw. „Von vorn“, am Handy der Anbieter-Knopf. */
export function Kopfzeile({ phase, anbieter, blattOffen, vorschlaege, vonVorn, blatt }: {
  phase: Phase
  anbieter: number
  blattOffen: boolean
  vorschlaege: () => void
  vonVorn: () => void
  blatt: () => void
}) {
  const { t } = useLang()
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4 py-2">
      <a href="#/woche" title={t('empf.zumKalender')} className="inline-flex min-h-11 items-center font-bold tracking-wide text-ak-text no-underline">
        {t('view.entdecken')}
      </a>
      <span className="flex items-center gap-1.5">
        {phase === 'leinwand' && (
          <button type="button" className={KNOPF} onClick={vorschlaege}>
            {t('empf.zuVorschlaegen')}
          </button>
        )}
        {phase === 'ergebnis' && (
          <button type="button" className={KNOPF} onClick={vonVorn}>
            {t('empf.vonVorn')}
          </button>
        )}
        {phase !== 'start' && (
          <button type="button" className={`${KNOPF} min-[900px]:hidden`} aria-expanded={blattOffen} onClick={blatt}>
            {t('empf.anbieter')}
            {anbieter > 0 && <b className="rounded-full bg-ak-akzent px-1.5 text-[11px] text-ak-auf-akzent">{anbieter}</b>}
          </button>
        )}
      </span>
    </header>
  )
}

/** Schmale Lasche am rechten Rand (Rechner), öffnet dasselbe Blatt wie der Handy-Knopf. */
export function AnbieterLasche({ anbieter, offen, umschalten }: { anbieter: number; offen: boolean; umschalten: () => void }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      onClick={umschalten}
      aria-expanded={offen}
      className="fixed right-0 top-1/2 z-30 hidden min-h-11 -translate-y-1/2 rounded-l-xl border border-r-0 border-ak-rand bg-ak-flaeche px-3 py-3.5 text-[13px] text-ak-leise [writing-mode:vertical-rl] min-[900px]:block"
    >
      {t('empf.anbieter')}
      {anbieter > 0 && <b className="text-ak-text"> · {anbieter}</b>}
    </button>
  )
}
