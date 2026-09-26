import { nowHhMm, todayIso } from '@shared/time.ts'
import type { Dataset } from '../../lib/data.ts'
import { useLang } from '../../lib/i18n.tsx'
import { neuesteErschienen, neuSeitGesehen, useGesehen } from '../../lib/gesehen.ts'

/**
 * „Gesehen bis Folge n" im Panel eines Favoriten — seit dem 26.09.2026 hier statt im entfallenen
 * Favoriten-Reiter. Gezählt wird bis zur neuesten erschienenen Folge des Kalenders.
 */
export function Fortschritt({ data, titelId }: { data: Dataset; titelId: number }) {
  const { t } = useLang()
  const [bis, setzen] = useGesehen(titelId)
  const neueste = neuesteErschienen(data.events, titelId, todayIso(), nowHhMm())
  if (!neueste) return null
  const neu = neuSeitGesehen(bis, neueste)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ak-rand bg-ak-flaeche px-4 py-3 text-sm text-ak-text">
      <label className="flex items-center gap-2" title={t('fav.gesehenHinweis', { n: neueste })}>
        <span className="font-semibold">{t('fav.gesehenBis')}</span>
        <input
          type="number"
          min={0}
          max={neueste}
          value={bis ?? ''}
          placeholder="–"
          onChange={(e) => setzen(e.target.value === '' ? undefined : Math.min(neueste, Math.max(0, Number(e.target.value))))}
          className="w-16 rounded-lg border border-ak-rand bg-transparent px-2 py-1 text-right tabular-nums"
        />
        <span className="text-ak-leise">/ {neueste}</span>
      </label>
      {neu > 0 && (
        <span className="rounded-full bg-ak-akzent/15 px-2 py-0.5 text-xs font-bold text-ak-akzent-text">{t('fav.neuSeit', { n: neu })}</span>
      )}
    </div>
  )
}
