import type { Title } from '@shared/types.ts'
import { Tooltip } from '../ui.tsx'
import type { Translate } from '../../lib/i18n.tsx'

/** Die Wertung nennt ihre Quelle (aniSearch, bei Cartoons TMDB) — sonst läse sich „★ 8.4“ wie unsere eigene. Auf dem Bild mit eigenem dunklem Grund (Kontrast). */
export function Bewertung({ title, t }: { title: Title; t: Translate }) {
  if (title.score === undefined) return null
  const quelle = title.scoreQuelle === 'tmdb' ? 'TMDB' : 'aniSearch'
  return (
    <Tooltip text={t('detail.scoreHint', { quelle })} seite="oben">
      <span className="inline-flex min-h-11 shrink-0 cursor-help items-center gap-1 rounded-full bg-black/65 px-3 text-xs text-white backdrop-blur-[3px]">
        <span>{quelle}</span>
        <span className="text-amber-300" aria-hidden="true">★</span>
        <span className="font-semibold tabular-nums">{(title.score / 10).toFixed(1)}</span>
      </span>
    </Tooltip>
  )
}
