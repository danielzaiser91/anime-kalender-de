import { ShareIcon } from './hilfen.tsx'
import { CoverMaximieren } from './cover-max.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { HideEye, FavoriteStar, ReihenStern } from '../ui.tsx'
import { TIPPFLAECHE_KINDER } from './tippziel.ts'
import { useVorschau } from '../../lib/vorschau.ts'
import { type Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'

/**
 * Die Knopfleiste an der rechten Kante der Bühne: Schließen, Reihen-Stern, Merken, Ausblenden, Teilen.
 * Jedes Symbol behält seinen dunklen Grund (auf hellem Cover wäre ein blankes Symbol unlesbar); gerundet ist nur die Kante zum Bild.
 */
export function BuehnenLeiste({ title, favorites, onToggleFavorite, onToggleHidden, reihenIds, onClose, t, buehnenBild, grossBild }: {
  title: Title
  favorites: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  reihenIds: number[]
  onClose: () => void
  t: Translate
  buehnenBild: string | undefined
  grossBild?: [string, number, number]
}) {
  /* Tipp-Ziele 44 px: unsichtbare Flächen über den Knöpfen, der Abstand ist so groß, dass sie sich nicht überdecken. */
  const gross = useVorschau('tippziele') === 'gross'
  return (
    <div
      className={`absolute right-0 top-0 z-10 flex flex-col items-center rounded-bl-lg bg-slate-900/85 px-1.5 py-2 backdrop-blur-[3px] ${gross ? `gap-4 ${TIPPFLAECHE_KINDER}` : 'gap-1.5'}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('detail.close')}
        className={`cursor-pointer px-1 text-sm text-white transition hover:opacity-70 ${gross ? 'py-1.5' : ''}`}
      >
        ✕
      </button>
      {reihenIds.length > 1 && (
        <ReihenStern
          alleGemerkt={reihenIds.every((id) => favorites.has(id))}
          anzahl={reihenIds.length}
          onMerken={() => {
            for (const id of reihenIds) if (!favorites.has(id)) onToggleFavorite(id)
          }}
        />
      )}
      <FavoriteStar active={favorites.has(title.id)} onToggle={() => onToggleFavorite(title.id)} />
      <HideEye hidden={false} onToggle={() => onToggleHidden(title.id)} />
      <ShareIcon slug={title.slug} name={anzeigeName(title)} />
      <CoverMaximieren bild={buehnenBild} gross={grossBild} titel={anzeigeName(title)} />
    </div>
  )
}
