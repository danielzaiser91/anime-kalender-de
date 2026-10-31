import type { ReactNode } from 'react'
import { anzeigeName } from '@shared/titles.ts'
import { teilbarerSlug } from '@shared/teilen.ts'
import type { Title } from '@shared/types.ts'
import { useShare } from '../../lib/share.ts'
import type { Translate } from '../../lib/i18n.tsx'

const KNOPF =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-3.5 text-t3 font-semibold text-ak-text transition hover:bg-ak-flaeche-2 dark:border-white/20'
/** Nur das Zeichen: 44 × 44, rund — „Ausblenden“ braucht kein Wort, der Name steht in `aria-label` und `title`. */
const KNOPF_ZEICHEN =
  'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-ak-text transition hover:bg-ak-flaeche-2 dark:border-white/20'
const AN = 'border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-200'

/** Zeichen der Knöpfe: 18 px, Strich in der Textfarbe (SVG statt Emoji, damit sie in beiden Themen gleich aussehen). */
function Zeichen({ children, gefuellt }: { children: ReactNode; gefuellt?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={gefuellt ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
      {children}
    </svg>
  )
}

export const Stern = ({ gefuellt }: { gefuellt: boolean }) => (
  <Zeichen gefuellt={gefuellt}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z" />
  </Zeichen>
)
const Kette = () => (
  <Zeichen>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Zeichen>
)
const Auge = () => (
  <Zeichen>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.7" />
  </Zeichen>
)

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
    <div className="flex flex-wrap gap-2 px-4 pb-4">
      <button type="button" aria-pressed={gemerkt} onClick={() => onToggleFavorite(title.id)} className={`${KNOPF} ${gemerkt ? AN : ''}`}>
        <Stern gefuellt={gemerkt} />
        {t(gemerkt ? 'kopf.gemerkt' : 'kopf.merken')}
      </button>
      {teilbarerSlug(title) && (
        <button type="button" onClick={() => share(title.slug, anzeigeName(title))} className={KNOPF}>
          <Kette />
          {t(copiedSlug === title.slug ? 'kopf.kopiert' : 'detail.share')}
        </button>
      )}
      <button type="button" onClick={() => onToggleHidden(title.id)} aria-label={t('kopf.ausblenden')} title={t('kopf.ausblenden')} className={KNOPF_ZEICHEN}>
        <Auge />
      </button>
      {trailer}
    </div>
  )
}
