import { useEffect, useRef, useState } from 'react'
import { RELEASE_TYPES } from '@shared/types.ts'
import type { ReleaseType } from '@shared/types.ts'
import { VIEWS, type ViewId } from '../lib/router.ts'
import { addDays, addMonths, formatDateLong, monthName, startOfWeek, todayIso } from '@shared/time.ts'
import { LANGUAGES, useLang, type TranslationKey } from '../lib/i18n.tsx'
import { Flag } from './Flags.tsx'

function ThemeToggle() {
  const { t } = useLang()
  const toggle = () => {
    const root = document.documentElement
    const dark = root.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    root.style.colorScheme = dark ? 'dark' : 'light'
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('nav.theme')}
      title={t('nav.theme')}
      className="cursor-pointer rounded-lg px-2.5 py-2 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
    >
      <span className="hidden dark:inline">☀️</span>
      <span className="dark:hidden">🌙</span>
    </button>
  )
}

function LanguagePicker() {
  const { lang, setLang, t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((l) => l.id === lang)!

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.language')}
        title={`${t('nav.language')}: ${current.label}`}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 transition hover:bg-slate-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-white/10"
      >
        <Flag lang={current.id} size={22} />
        <span aria-hidden="true" className="text-[9px] text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="animate-fade-in absolute right-0 z-30 mt-1 min-w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-white/15 dark:bg-[#141b2b]"
        >
          {LANGUAGES.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={l.id === lang}
                onClick={() => {
                  setLang(l.id)
                  setOpen(false)
                }}
                className={[
                  'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition',
                  l.id === lang
                    ? 'bg-sky-500/10 font-semibold text-sky-500'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10',
                ].join(' ')}
              >
                <Flag lang={l.id} size={20} />
                {l.label}
                {l.id === lang && <span className="ml-auto">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
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
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => {
            onView('woche')
            onDate(todayIso())
          }}
          className="flex cursor-pointer items-center gap-2 text-left"
        >
          <span className="text-xl" aria-hidden="true">
            📺
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-slate-900 dark:text-white">
              {t('app.title')}
            </span>
            <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">
              {t('app.subtitle')}
            </span>
          </span>
        </button>

        <nav className="flex gap-0.5 rounded-lg bg-slate-200/60 p-0.5 dark:bg-white/5" aria-label="Ansicht">
          {VIEWS.filter((v) => v.inNav).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onView(v.id)}
              aria-current={view === v.id}
              className={[
                'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition',
                view === v.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              ].join(' ')}
            >
              {t(`view.${v.id}` as TranslationKey)}
            </button>
          ))}
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

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onView('abo')}
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10"
          >
            {t('view.abo')}
          </button>
          <button
            type="button"
            onClick={() => onView('newsletter')}
            className="cursor-pointer rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            {t('view.newsletter')}
          </button>
          <LanguagePicker />
          <ThemeToggle />
        </div>
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
        <span key={type} className="inline-flex items-center gap-1.5" title={tRelease(type, 'hint')}>
          <span className="h-2.5 w-1 rounded-sm" style={{ background: RELEASE_TYPES[type].color }} />
          {tRelease(type)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-amber-500">≈</span> {t('legend.estimated')}
      </span>
    </div>
  )
}
