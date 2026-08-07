import { RELEASE_TYPES } from '@shared/types.ts'
import type { ReleaseType } from '@shared/types.ts'
import { VIEWS, type ViewId } from '../lib/router.ts'
import { addDays, addMonths, formatDateLong, monthName, startOfWeek, todayIso } from '@shared/time.ts'

function ThemeToggle() {
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
      aria-label="Hell/Dunkel umschalten"
      className="rounded-lg px-2.5 py-2 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
    >
      <span className="hidden dark:inline">☀️</span>
      <span className="dark:hidden">🌙</span>
    </button>
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
    if (view === 'agenda') return `ab ${formatDateLong(date)}`
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
          className="flex items-center gap-2 text-left"
        >
          <span className="text-xl" aria-hidden="true">
            📺
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-slate-900 dark:text-white">
              Anime-Kalender DE
            </span>
            <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">
              alles mit deutscher Synchro
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
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                view === v.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              ].join(' ')}
            >
              {v.label}
            </button>
          ))}
        </nav>

        {isCalendar && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="zurück"
              className="rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => onDate(todayIso())}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium transition hover:bg-slate-200/60 dark:hover:bg-white/10"
            >
              heute
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="vor"
              className="rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
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
            className="rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Kalender-Abo
          </button>
          <button
            type="button"
            onClick={() => onView('newsletter')}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            Newsletter
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      <span className="font-semibold uppercase tracking-wider">Farbe = Release-Art:</span>
      {(Object.keys(RELEASE_TYPES) as ReleaseType[]).map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5" title={RELEASE_TYPES[t].hint}>
          <span className="h-2.5 w-1 rounded-sm" style={{ background: RELEASE_TYPES[t].color }} />
          {RELEASE_TYPES[t].name}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-amber-500">≈</span> Termin abgeleitet, nicht offiziell bestätigt
      </span>
    </div>
  )
}
