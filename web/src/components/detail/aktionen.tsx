import type { ReactNode } from 'react'
import { anzeigeName } from '@shared/titles.ts'
import { teilbarerSlug } from '@shared/teilen.ts'
import type { Title } from '@shared/types.ts'
import { useShare } from '../../lib/share.ts'
import type { Translate } from '../../lib/i18n.tsx'

const KNOPF =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm text-slate-800 transition hover:bg-slate-500/10 dark:border-white/20 dark:text-slate-100 dark:hover:bg-white/10'
const AN = 'border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-200'

function Augenzeichen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  )
}

/**
 * **Merken, Teilen, Ausblenden als Knöpfe mit Wort** (Daniel, 11.10.2026): 44 px hoch statt vier Symbole an der Kante;
 * der Trailer-Knopf (nur bei Filmen) steht in derselben Reihe.
 */
export function PanelAktionen({ title, favorites, onToggleFavorite, onToggleHidden, t, trailer }: {
  title: Title
  favorites: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  t: Translate
  trailer: ReactNode
}) {
  const { share, copiedSlug } = useShare()
  const gemerkt = favorites.has(title.id)
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      <button type="button" aria-pressed={gemerkt} onClick={() => onToggleFavorite(title.id)} className={`${KNOPF} ${gemerkt ? AN : ''}`}>
        <span aria-hidden="true">{gemerkt ? '★' : '☆'}</span>
        {t(gemerkt ? 'kopf.gemerkt' : 'kopf.merken')}
      </button>
      {teilbarerSlug(title) && (
        <button type="button" onClick={() => share(title.slug, anzeigeName(title))} className={KNOPF}>
          <span aria-hidden="true">{copiedSlug === title.slug ? '✓' : '🔗'}</span>
          {t(copiedSlug === title.slug ? 'kopf.kopiert' : 'detail.share')}
        </button>
      )}
      <button type="button" onClick={() => onToggleHidden(title.id)} className={KNOPF}>
        <Augenzeichen />
        {t('kopf.ausblenden')}
      </button>
      {trailer}
    </div>
  )
}
