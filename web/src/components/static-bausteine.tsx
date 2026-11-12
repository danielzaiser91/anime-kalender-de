import { type PlatformId, PLATFORMS } from '@shared/types.ts'

export const WORKER_URL = import.meta.env.VITE_NEWSLETTER_API ?? ''

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      {children}
    </div>
  )
}

export function PlatformToggleList({
  platforms,
  selected,
  onToggle,
  allLabel,
  onAll,
}: {
  platforms: PlatformId[]
  selected: PlatformId[] | 'all'
  onToggle: (p: PlatformId) => void
  allLabel?: string
  onAll?: () => void
}) {
  const isAll = selected === 'all'
  return (
    <div className="flex flex-wrap gap-1.5">
      {allLabel && onAll && (
        <button
          type="button"
          onClick={onAll}
          className={[
            'ak-tz cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition',
            isAll
              ? 'border-transparent bg-slate-100 text-slate-900'
              : 'border-slate-300/70 text-slate-600 dark:border-white/15 dark:text-slate-300',
          ].join(' ')}
        >
          {allLabel}
        </button>
      )}
      {platforms.map((p) => {
        const active = !isAll && selected.includes(p)
        return (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            className={[
              'ak-tz cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition',
              active
                ? 'border-transparent bg-slate-100 text-slate-900'
                : 'border-slate-300/70 text-slate-600 hover:border-ak-leise dark:border-white/15 dark:text-slate-300',
            ].join(' ')}
          >
            {PLATFORMS[p].name}
          </button>
        )
      })}
    </div>
  )
}

export type FormState = 'idle' | 'sending' | 'ok' | 'error'
