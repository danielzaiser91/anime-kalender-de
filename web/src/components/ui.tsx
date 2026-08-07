import type { ReactNode } from 'react'
import { FSK_COLORS, PLATFORMS, RELEASE_TYPES } from '@shared/types.ts'
import type { Fsk, PlatformId, ReleaseStatus, ReleaseType } from '@shared/types.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'

/** Gemeinsamer Fokus- und Zeigerstil aller anklickbaren Elemente. */
const CLICKABLE = 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'

export function Chip({
  active,
  onClick,
  children,
  color,
  title,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  color?: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
        CLICKABLE,
        active
          ? 'border-transparent bg-slate-100 text-slate-900 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-300/70 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/40 dark:hover:text-white',
      ].join(' ')}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />}
      {children}
    </button>
  )
}

export function PlatformBadge({ platform, small }: { platform: PlatformId; small?: boolean }) {
  const p = PLATFORMS[platform]
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wide',
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
      ].join(' ')}
      style={{ background: `${p.color}22`, color: p.color, boxShadow: `inset 0 0 0 1px ${p.color}55` }}
    >
      {p.name}
    </span>
  )
}

export function FskBadge({ fsk, small }: { fsk: Fsk; small?: boolean }) {
  const bg = FSK_COLORS[fsk]
  const dark = fsk === 0 || fsk === 6
  return (
    <span
      title={`FSK ${fsk}`}
      className={[
        'inline-flex items-center justify-center rounded-sm font-bold',
        small ? 'h-4 min-w-6 text-[10px]' : 'h-5 min-w-7 text-xs',
      ].join(' ')}
      style={{ background: bg, color: dark ? '#111' : '#fff', border: '1px solid rgba(0,0,0,.25)' }}
    >
      {fsk}
    </span>
  )
}

export function ReleaseTypeBadge({ type, small }: { type: ReleaseType; small?: boolean }) {
  const { tRelease } = useLang()
  const style = RELEASE_TYPES[type]
  return (
    <span
      title={tRelease(type, 'hint')}
      className={[
        'inline-flex items-center gap-1 rounded font-semibold',
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
      ].join(' ')}
      style={{ background: `${style.color}22`, color: style.color, boxShadow: `inset 0 0 0 1px ${style.color}55` }}
    >
      {tRelease(type, 'short')}
    </span>
  )
}

const STATUS_STYLE: Record<ReleaseStatus, string> = {
  airing: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/40',
  abgeschlossen: 'bg-slate-500/15 text-slate-400 ring-slate-500/40',
  tba: 'bg-amber-500/15 text-amber-400 ring-amber-500/40',
  erschienen: 'bg-sky-500/15 text-sky-400 ring-sky-500/40',
  unbekannt: 'bg-slate-500/10 text-slate-500 ring-slate-500/30',
}

const STATUS_KEY: Record<ReleaseStatus, TranslationKey> = {
  airing: 'status.airing',
  abgeschlossen: 'status.abgeschlossen',
  tba: 'status.tba',
  erschienen: 'status.erschienen',
  unbekannt: 'status.unbekannt',
}

export function StatusBadge({ status, small }: { status: ReleaseStatus; small?: boolean }) {
  const { t } = useLang()
  return (
    <span
      className={[
        'inline-flex items-center rounded font-semibold ring-1',
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        STATUS_STYLE[status],
      ].join(' ')}
    >
      {t(STATUS_KEY[status])}
    </span>
  )
}

export function Button({
  children,
  onClick,
  href,
  variant = 'default',
  size = 'md',
  title,
  download,
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
  variant?: 'default' | 'primary' | 'ghost'
  size?: 'sm' | 'md'
  title?: string
  download?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
    CLICKABLE,
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
    variant === 'primary'
      ? 'bg-sky-500 text-white hover:bg-sky-400'
      : variant === 'ghost'
        ? 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10'
        : 'bg-slate-200/70 text-slate-800 hover:bg-slate-300/70 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20',
  ].join(' ')

  if (href) {
    return (
      <a
        className={cls}
        href={href}
        title={title}
        download={download}
        target={download ? undefined : '_blank'}
        rel="noreferrer noopener"
      >
        {children}
      </a>
    )
  }
  return (
    <button
      type={type}
      className={`${cls}${disabled ? ' cursor-not-allowed opacity-50' : ''}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {children}
    </h2>
  )
}

/** Stern zum Merken eines Titels. */
export function FavoriteStar({
  active,
  onToggle,
  size = 'md',
}: {
  active: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}) {
  const { t } = useLang()
  return (
    <button
      type="button"
      aria-pressed={active}
      title={t(active ? 'card.unfavourite' : 'card.favourite')}
      aria-label={t(active ? 'card.unfavourite' : 'card.favourite')}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={[
        'inline-flex items-center justify-center rounded-full transition',
        CLICKABLE,
        size === 'sm' ? 'size-5 text-[13px]' : 'size-7 text-base',
        active
          ? 'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,.55)]'
          : 'text-slate-400/70 hover:text-amber-300 dark:text-slate-500 dark:hover:text-amber-300',
      ].join(' ')}
    >
      {active ? '★' : '☆'}
    </button>
  )
}

/** Schalter für Ja/Nein-Einstellungen. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${CLICKABLE}`} title={hint}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          'relative h-5 w-9 rounded-full transition',
          checked ? 'bg-sky-500' : 'bg-slate-300 dark:bg-white/20',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[1.125rem]' : 'left-0.5',
          ].join(' ')}
        />
      </span>
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
    </label>
  )
}
