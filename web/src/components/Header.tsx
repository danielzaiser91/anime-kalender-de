import { RELEASE_TYPES } from '@shared/types.ts'
import type { ReleaseType } from '@shared/types.ts'
import { VIEWS, type ViewId } from '../lib/router.ts'
import { addDays, addMonths, formatDateLong, monthName, startOfWeek, todayIso } from '@shared/time.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { InstallButton } from './InstallPrompt.tsx'
import { Tooltip } from './ui.tsx'

function ThemeToggle() {
  const { t } = useLang()
  const toggle = () => {
    const root = document.documentElement
    const dark = root.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    root.style.colorScheme = dark ? 'dark' : 'light'
  }
  return (
    <Tooltip text={t('nav.theme')}>
      <button
        type="button"
        onClick={toggle}
        aria-label={t('nav.theme')}
        className="cursor-pointer rounded-lg px-2.5 py-2 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
      >
        <span className="hidden dark:inline">☀️</span>
        <span className="dark:hidden">🌙</span>
      </button>
    </Tooltip>
  )
}


/** Reiter, die auf schmalen Schirmen eine kürzere Beschriftung tragen. */
const KURZ_IM_NAV: Partial<Record<ViewId, TranslationKey>> = {
  wo: 'view.wo.short',
}

export function Header({
  view,
  date,
  onView,
  onDate,
}: {
  view: ViewId
  date: string
  onView: (v: ViewId) => void
  onDate: (d: string) => void
}) {
  const { t } = useLang()
  const isCalendar = view === 'woche' || view === 'monat' || view === 'agenda'
  const step = view === 'monat' ? 'month' : view === 'agenda' ? 'agenda' : 'week'

  const shift = (dir: number) => {
    if (step === 'month') onDate(addMonths(date, dir))
    else if (step === 'agenda') onDate(addDays(date, dir * 14))
    else onDate(addDays(date, dir * 7))
  }

  const label = (() => {
    if (view === 'monat') {
      const [y, m] = date.split('-').map(Number)
      return `${monthName(m - 1)} ${y}`
    }
    if (view === 'agenda') return t('nav.from', { date: formatDateLong(date) })
    const monday = startOfWeek(date)
    const sunday = addDays(monday, 6)
    return `${formatDateLong(monday).replace(/ \d{4}$/, '')} – ${formatDateLong(sunday)}`
  })()

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f6f7fb]/85 backdrop-blur dark:border-white/10 dark:bg-[#0a0e17]/85">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        {/*
          Auf dem Handy bilden Titel und Symbole eine gemeinsame erste Zeile —
          sonst kostet jede Schaltfläche eine eigene Reihe und die Kopfleiste
          frisst den halben Bildschirm. Ab `sm` löst sich diese Hülle per
          `display: contents` auf; dann liegen Titel und Symbolgruppe direkt in
          der Kopfzeile, und `order-last` schiebt die Gruppe wieder nach rechts.
        */}
        <div className="flex w-full items-center gap-2 sm:contents">
          <button
            type="button"
            onClick={() => {
              onView('woche')
              onDate(todayIso())
            }}
            className="flex min-w-0 cursor-pointer items-center gap-2 text-left"
          >
            <span className="text-xl" aria-hidden="true">
              📺
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
                {t('app.title')}
              </span>
              <span className="block truncate text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                {t('app.subtitle')}
              </span>
            </span>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:order-last">
            <InstallButton />
            <button
              type="button"
              onClick={() => onView('abo')}
              className="hidden cursor-pointer rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-200/60 sm:block dark:text-slate-300 dark:hover:bg-white/10"
            >
              {t('view.abo')}
            </button>
            <button
              type="button"
              onClick={() => onView('newsletter')}
              aria-label={t('view.newsletter')}
              className="cursor-pointer rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
            >
              {/* Auf schmalen Schirmen genügt das Symbol — der Knopf ist der
                  auffälligste im Kopf, seine Bedeutung geht nicht verloren. */}
              <span className="sm:hidden" aria-hidden="true">
                ✉
              </span>
              <span className="hidden sm:inline">{t('view.newsletter')}</span>
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/*
          `max-w-full overflow-x-auto` ist die Reißleine, nicht der Normalfall:
          Fünf Reiter passen mit den Kurzformen unten auch auf 375 px. Käme ein
          sechster dazu, rollt die Leiste, statt die ganze Seite waagrecht
          aufzuschieben — genau das passierte beim Reiter „Wo sehen?"
          (13.08.2026), und ein waagrechter Rollbalken über der kompletten Seite
          fällt niemandem als Navigationsproblem auf.
        */}
        <nav
          className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-slate-200/60 p-0.5 dark:bg-white/5"
          aria-label="Ansicht"
        >
          {VIEWS.filter((v) => v.inNav).map((v) => {
            const kurz = KURZ_IM_NAV[v.id]
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onView(v.id)}
                aria-current={view === v.id}
                className={[
                  'shrink-0 cursor-pointer whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition sm:px-3',
                  view === v.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                ].join(' ')}
              >
                {kurz ? (
                  <>
                    <span className="sm:hidden">{t(kurz)}</span>
                    <span className="hidden sm:inline">{t(`view.${v.id}` as TranslationKey)}</span>
                  </>
                ) : (
                  t(`view.${v.id}` as TranslationKey)
                )}
              </button>
            )
          })}
        </nav>

        {isCalendar && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label={t('nav.back')}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => onDate(todayIso())}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium transition hover:bg-slate-200/60 dark:hover:bg-white/10"
            >
              {t('nav.today')}
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label={t('nav.forward')}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
            >
              →
            </button>
            <span className="ml-1 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
          </div>
        )}

      </div>
    </header>
  )
}

export function Legend() {
  const { t, tRelease } = useLang()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      <span className="font-semibold uppercase tracking-wider">{t('legend.colour')}</span>
      {(Object.keys(RELEASE_TYPES) as ReleaseType[]).map((type) => (
        <Tooltip key={type} text={tRelease(type, 'hint')}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-1 rounded-sm" style={{ background: RELEASE_TYPES[type].color }} />
            {tRelease(type)}
          </span>
        </Tooltip>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-amber-500">≈</span> {t('legend.estimated')}
      </span>
    </div>
  )
}
