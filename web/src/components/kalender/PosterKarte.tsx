import type { Ref } from 'react'
import type { ReleaseEvent, Title } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { istAusgeblieben } from '@shared/logic.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useShare } from '../../lib/share.ts'
import { coverBild } from '../../lib/cover.ts'
import { FavoriteStar, HideEye, ShareIcon, Tooltip } from '../ui.tsx'
import { anbieterUndFolge, VerpasstMarke, ZeitMarke } from './Marken.tsx'

export type KartenArt = 'start' | 'finale'

const KNOPF_GRUND = 'flex items-center gap-0.5 rounded-full bg-[rgba(13,15,20,.72)] px-0.5 text-[#f2f1ee]'
const ERST_BEIM_ZEIGEN = 'transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0'

export interface PosterKarteProps {
  event: ReleaseEvent
  title?: Title
  art?: KartenArt
  /** Weitere Folgen desselben Titels am selben Tag (`buendeleTermine`). */
  weitere?: number
  favorite: boolean
  hidden: boolean
  /** Schon vorbei (heute vor der aktuellen Uhrzeit) — tritt zurück. */
  vorbei?: boolean
  /** Folgen seit „gesehen bis" (nur Favoriten mit Eintrag). */
  neu?: number
  anker?: Ref<HTMLElement>
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
  onOpen: () => void
}

/**
 * Eine Kachel der Poster-Woche: Cover im Hochformat, darunter Titel und „Anbieter · Folge".
 * Staffelstart und -finale nehmen zwei Spalten ein; das Cover füllt dann die ganze Breite, der
 * Text steht wie bei jeder Kachel darunter (Daniel, 26.09.2026).
 *
 * Die Kachel ist kein Knopf, sie enthält einen: Stern, Auge und Teilen liegen darin, und ein Knopf
 * aus Knöpfen ist für Vorlesende unbedienbar (axe „nested-interactive", 18.09.2026).
 */
export function PosterKarte(p: PosterKarteProps) {
  const { t } = useLang()
  if (p.hidden) return <AusgeblendeteKarte name={p.event.name} onToggleHidden={p.onToggleHidden} />
  const breit = !!p.art
  const ueberholt = istAusgeblieben(p.event)
  return (
    <article
      ref={p.anker}
      onClick={p.onOpen}
      className={[
        'group relative flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl outline-none',
        'has-[.ak-oeffnen:focus-visible]:ring-2 has-[.ak-oeffnen:focus-visible]:ring-ak-akzent has-[.ak-oeffnen:focus-visible]:ring-offset-4 has-[.ak-oeffnen:focus-visible]:ring-offset-ak-grund',
        breit ? 'col-span-2' : '',
        p.vorbei && !p.favorite ? 'ak-vorbei' : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="ak-oeffnen sr-only"
        onClick={(e) => {
          e.stopPropagation()
          p.onOpen()
        }}
      >
        {t('card.details', { titel: p.event.name })}
      </button>
      <PosterCover {...p} breit={breit} />
      <span
        className={[
          'ak-titel line-clamp-2 text-sm font-bold leading-snug',
          ueberholt ? 'text-ak-sehr-leise line-through decoration-rose-500/60' : 'text-ak-text',
        ].join(' ')}
      >
        {p.event.name}
      </span>
      <span className="-mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ak-leise">
        <span>{anbieterUndFolge(p.event, t)}</span>
        {!!p.weitere && <span className="font-semibold text-ak-text">{t('kal.buendelStream', { n: p.weitere })}</span>}
        {!!p.neu && (
          <span className="rounded bg-ak-akzent/15 px-1 font-semibold text-ak-akzent-text">{t('fav.neuSeit', { n: p.neu })}</span>
        )}
        <VerpasstMarke event={p.event} t={t} />
      </span>
    </article>
  )
}

function PosterCover(p: PosterKarteProps & { breit: boolean }) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const cover = p.title?.coverImage
  const farbe = PLATFORMS[p.event.platform]?.color ?? '#888'
  const bild = coverBild(cover, p.breit ? 320 : 160, p.breit ? '(min-width: 1024px) 320px, 92vw' : '(min-width: 1024px) 160px, 46vw')
  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl bg-ak-flaeche-2',
        /* Breit: so hoch wie die schmalen Nachbarn — zwei Spalten minus Lücke, mal 3/4. */
        p.breit ? 'ak-breit-cover h-0 ring-2' : 'aspect-[2/3]',
        p.art === 'start' ? 'ring-ak-akzent' : p.art === 'finale' ? 'ring-ak-finale' : '',
      ].join(' ')}
    >
      {cover ? (
        <img
          {...bild}
          alt=""
          loading="lazy"
          className={['absolute inset-0 size-full object-cover', p.breit ? 'object-[50%_22%]' : ''].join(' ')}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-ak-sehr-leise">
          {p.event.name}
        </span>
      )}
      <span className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
        <ZeitMarke event={p.event} t={t} />
        {p.art && <ArtFahne art={p.art} />}
      </span>
      {/*
        Teilen und Ausblenden erst beim Zeigen; der Stern bleibt, sobald er gesetzt ist. Unten rechts,
        damit sie Uhrzeit und Fähnchen nicht verdecken. Auf dem Handy wären sie 20-px-Ziele — dort
        steht nur der gesetzte Stern als Zeichen, bedient wird im Panel.
      */}
      {p.favorite && (
        <span className="absolute right-2 bottom-3 text-base text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,.8)] sm:hidden" role="img" aria-label={t('kal.favorit')}>
          ★
        </span>
      )}
      <span className="absolute right-1.5 bottom-2.5 hidden items-center gap-1 sm:flex" onClick={(e) => e.stopPropagation()}>
        <span className={`${KNOPF_GRUND} ${ERST_BEIM_ZEIGEN}`}>
          <ShareIcon onShare={() => void share(p.event.releaseSlug, p.event.name)} copied={copiedSlug === p.event.releaseSlug} size="sm" />
          {p.onToggleHidden && <HideEye hidden={false} onToggle={p.onToggleHidden} size="sm" />}
        </span>
        {p.onToggleFavorite && (
          <span className={`${KNOPF_GRUND} ${p.favorite ? '' : ERST_BEIM_ZEIGEN}`}>
            <FavoriteStar active={p.favorite} onToggle={p.onToggleFavorite} size="sm" />
          </span>
        )}
      </span>
      <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: farbe }} />
    </div>
  )
}

function ArtFahne({ art }: { art: KartenArt }) {
  const { t } = useLang()
  return (
    <Tooltip text={t(art === 'start' ? 'kal.startHinweis' : 'kal.finaleHinweis')} seite="oben">
      <span
        className={[
          'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#0d0f14]',
          art === 'start' ? 'bg-ak-akzent' : 'bg-ak-finale',
        ].join(' ')}
      >
        {t(art === 'start' ? 'kal.start' : 'kal.finale')}
      </span>
    </Tooltip>
  )
}

/**
 * Ausgeblendet: der Termin bleibt an seinem Platz, aber nur als Name — kein Bild, kein Öffnen.
 * Sonst wäre das Ausblenden eine Attrappe.
 */
function AusgeblendeteKarte({ name, onToggleHidden }: { name: string; onToggleHidden?: () => void }) {
  return (
    <div className="flex min-w-0 items-start gap-1 rounded-xl border border-dashed border-ak-rand p-2">
      <span className="line-clamp-3 min-w-0 flex-1 text-xs italic text-ak-sehr-leise">{name}</span>
      {onToggleHidden && <HideEye hidden onToggle={onToggleHidden} size="sm" />}
    </div>
  )
}
