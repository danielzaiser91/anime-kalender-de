import type { Ref } from 'react'
import type { ReleaseEvent, Title } from '@shared/types.ts'
import type { KachelAngabe } from '@shared/laeuft-jetzt.ts'
import { PLATFORMS } from '@shared/types.ts'
import { istAusgeblieben } from '@shared/logic.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useShare } from '../../lib/share.ts'
import { useAbSm } from '../../lib/use-breit.ts'
import { teilbarerSlug } from '@shared/teilen.ts'
import { coverBild, KACHEL_DICHTE } from '../../lib/cover.ts'
import { FavoriteStar, HideEye, ShareIcon, Tooltip } from '../ui.tsx'
import { anbieterZeile, SpracheMarke, VerpasstMarke, weitereFolgen, ZeitMarke } from './Marken.tsx'
import { AnbieterAngaben } from './AnbieterAngaben.tsx'
import { anbieterVerlauf, zeitGemeinsam, type AnbieterKachel } from '../../lib/anbieter-kachel.ts'
import { PremiereMarke } from './PremiereMarke.tsx'
import { ART_STIL, artName, istBreit, randKlassen, type KartenArt } from '../../lib/kachel-folgen.ts'
import { istKinoSaal, KinoBuehne, SAAL_FENSTER, SAAL_KNOEPFE, SAAL_MARKEN, SAAL_STERN } from './KinoBuehne.tsx'
import { FundstellenZeichen, TrefferName } from '../Suchtreffer.tsx'

const KNOPF_GRUND = 'flex items-center gap-0.5 rounded-full bg-[rgba(13,15,20,.72)] px-0.5 text-[#f2f1ee]'
const ERST_BEIM_ZEIGEN = 'transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0'

export interface PosterKarteProps {
  event: ReleaseEvent
  title?: Title
  art?: KartenArt
  /** Alle Termine desselben Titels beim selben Anbieter am selben Tag (`buendeleTermine`); der erste ist `event`. */
  buendel?: ReleaseEvent[]
  /** Derselbe Titel bei mehreren Anbietern am selben Tag (`vereineAnbieter`): geteilte Farbleiste, Angaben je Anbieter. */
  anbieter?: AnbieterKachel
  favorite: boolean
  hidden: boolean
  /** Schon vorbei (heute vor der aktuellen Uhrzeit) — tritt zurück. */
  vorbei?: boolean
  /** Heute: "seit 17:00" statt "17:00", an der nächsten Kachel dazu "in 12 Min" (`kachelAngabe`). */
  zeitAngabe?: KachelAngabe
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
 * Text steht wie bei jeder Kachel darunter.
 *
 * Die Kachel ist kein Knopf, sie enthält einen: Stern, Auge und Teilen liegen darin, und ein Knopf
 * aus Knöpfen ist für Vorlesende unbedienbar (axe „nested-interactive", 18.09.2026).
 */
export function PosterKarte(p: PosterKarteProps) {
  const { t } = useLang()
  if (p.hidden) return <AusgeblendeteKarte name={p.event.name} onToggleHidden={p.onToggleHidden} />
  const breit = istBreit(p.art)
  const saal = istKinoSaal(p.event, p.art, !!p.anbieter)
  const ueberholt = istAusgeblieben(p.event)
  return (
    <article
      ref={p.anker}
      onClick={p.onOpen}
      className={[
        'group relative flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl',
        'has-[.ak-oeffnen:focus-visible]:outline-2 has-[.ak-oeffnen:focus-visible]:outline-offset-2 has-[.ak-oeffnen:focus-visible]:outline-ak-fokus',
        breit || saal ? 'col-span-2' : '',
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
      <PosterCover {...p} breit={breit} saal={saal} />
      <span
        className={[
          'ak-titel flex items-start gap-0.5',
          saal ? 'text-lg font-extrabold leading-tight' : 'text-sm font-bold leading-snug',
          ueberholt ? 'text-ak-sehr-leise line-through decoration-ak-fehler/60' : 'text-ak-text',
        ].join(' ')}
      >
        <span className="line-clamp-2">
          <TrefferName text={p.event.name} schluessel={p.event.releaseSlug} />
        </span>
        <FundstellenZeichen text={p.event.name} schluessel={p.event.releaseSlug} />
      </span>
      <Unterzeile {...p} saal={saal} />
    </article>
  )
}

/** „Anbieter · Folge" samt Marken (neu, verpasst, Sprache) unter dem Titel. */
export function Unterzeile(p: PosterKarteProps & { saal: boolean }) {
  const { t } = useLang()
  /* Im Saal steht „Kino“ schon auf dem Behang; die Zeile bleibt nur für Marken und das „+N“ gebündelter Termine. */
  const weitere = (p.buendel?.length ?? 1) - 1
  if (p.saal && !weitere && !p.neu && !p.event.verpasst && !p.event.sprache) return null
  return (
    <span className="-mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ak-leise">
      {p.saal && !!weitere && <span className="text-sm font-bold text-ak-text">{t('kal.buendelTvOhneZeit', { n: weitere })}</span>}
      {!p.saal &&
        (p.anbieter ? (
          <AnbieterAngaben kachel={p.anbieter} t={t} />
        ) : (
          <>
            <span>{anbieterZeile(p.event, t, p.buendel, p.art)}</span>
            {!!weitereFolgen(p.buendel, t) && <span className="font-semibold text-ak-text">{weitereFolgen(p.buendel, t)}</span>}
          </>
        ))}
      {!!p.neu && (
        <span className="rounded bg-ak-akzent/15 px-1 font-semibold text-ak-akzent-text">{t('fav.neuSeit', { n: p.neu })}</span>
      )}
      <VerpasstMarke event={p.event} t={t} /><SpracheMarke event={p.event} t={t} />
    </span>
  )
}

function PosterCover(p: PosterKarteProps & { breit: boolean; saal: boolean }) {
  const { t } = useLang()
  const cover = p.title?.coverImage
  const farbe = anbieterVerlauf((p.anbieter ?? [[p.event]]).map((b) => PLATFORMS[b[0]!.platform]?.color ?? '#888'))
  const zwei = p.breit || p.saal
  const rand = randKlassen(p.art, p.favorite)
  const bild = coverBild(cover, zwei ? 320 : 160, zwei ? '(min-width: 1024px) 320px, 92vw' : '(min-width: 1024px) 160px, 46vw', KACHEL_DICHTE)
  return (
    <div className="relative">
    <div
      className={[
        'ak-ring-oben-leiste relative overflow-hidden rounded-t-xl bg-ak-flaeche-2',
        /* Breit: so hoch wie die schmalen Nachbarn — zwei Spalten minus Lücke, mal 3/4. */
        zwei ? 'ak-breit-cover h-0' : 'aspect-[2/3]',
        p.favorite ? 'ring-3' : p.breit ? 'ring-2' : '',
        p.saal ? 'ak-saal' : '',
        /* Der Saal-Rand weicht dem Favoriten-Ring (ein Saal hat nie eine Art), sonst schlüge seine Ringfarbe im CSS die goldene (Reihenfolge der Stylesheet-Regeln). */
        p.saal && !p.favorite ? 'ring-1 ring-white/10' : '',
        rand.aussen,
        p.art === 'katalog' && !p.favorite ? 'ak-katalog-glanz' : '',
      ].join(' ')}
    >
      {p.saal && <KinoBuehne />}
      {cover ? (
        <img
          {...bild}
          alt=""
          loading="lazy"
          className={[p.saal ? SAAL_FENSTER : 'absolute inset-0 size-full', 'object-cover', zwei ? 'object-[50%_22%]' : ''].join(' ')}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-ak-sehr-leise">
          {p.event.name}
        </span>
      )}
      {rand.innen && <span className={`pointer-events-none absolute inset-0 rounded-t-xl border border-ak-grund inset-ring-2 ${rand.innen}`} />}
      <span className={['absolute flex flex-wrap items-center gap-1.5', p.saal ? SAAL_MARKEN : 'top-2 left-2'].join(' ')}>
        {(!p.anbieter || zeitGemeinsam(p.anbieter)) && <ZeitMarke event={p.event} t={t} angabe={p.zeitAngabe} />}
        {p.art && <ArtFahne art={p.art} termine={(p.anbieter ?? [p.buendel ?? [p.event]]).flat()} />}
        {p.event.premiere && <PremiereMarke platform={p.event.platform} vorher={p.event.premiereVorher} className="px-2 py-0.5" />}
      </span>
      <CoverAktionen {...p} saal={p.saal} />
    </div>
    {/*
      **Die Anbieterleiste schließt das Cover unten ab, mit oder ohne Ring** (Daniel, 04.10. und 17.10.2026): Der Ring endet über der Leiste
      (`ak-ring-oben-leiste` schneidet ihn 1 px über der Unterkante ab, Begründung in `styles.css`), die unteren Ecken sind eckig; sonst bliebe dort eine Lücke zwischen Ring und Leiste.
    */}
    <span
      className="pointer-events-none absolute inset-x-0 bottom-0 h-1"
      style={{ background: farbe }}
    />
    </div>
  )
}

/** Stern, Teilen und Ausblenden auf dem Cover (Handy: nur der gesetzte Stern). */
function CoverAktionen(p: PosterKarteProps & { saal: boolean }) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const desktop = useAbSm()
  const teilbar = teilbarerSlug(p.title)
  return (
    <>
      {/*
        Teilen und Ausblenden erst beim Zeigen; der Stern bleibt, sobald er gesetzt ist. Unten rechts,
        damit sie Uhrzeit und Fähnchen nicht verdecken. Auf dem Handy wären sie 20-px-Ziele — dort
        steht nur der gesetzte Stern als Zeichen, bedient wird im Panel.
      */}
      {p.favorite && (
        <span className={`absolute ${p.saal ? SAAL_STERN : 'right-2 bottom-3'} text-base text-ak-favorit drop-shadow-[0_1px_2px_rgba(0,0,0,.8)] sm:hidden`} role="img" aria-label={t('kal.favorit')}>
          ★
        </span>
      )}
      {desktop && (
        <span className={`absolute ${p.saal ? SAAL_KNOEPFE : 'right-1.5 bottom-2.5'} flex items-center gap-1`} onClick={(e) => e.stopPropagation()}>
          <span className={`${KNOPF_GRUND} ${ERST_BEIM_ZEIGEN}`}>
            {teilbar && <ShareIcon onShare={() => void share(teilbar, p.event.name)} copied={copiedSlug === teilbar} size="sm" />}
            {p.onToggleHidden && <HideEye hidden={false} onToggle={p.onToggleHidden} size="sm" />}
          </span>
          {p.onToggleFavorite && (
            <span className={`${KNOPF_GRUND} ${p.favorite ? '' : ERST_BEIM_ZEIGEN}`}>
              <FavoriteStar active={p.favorite} onToggle={p.onToggleFavorite} size="sm" />
            </span>
          )}
        </span>
      )}
    </>
  )
}

function ArtFahne({ art, termine }: { art: KartenArt; termine: ReleaseEvent[] }) {
  const { t } = useLang()
  return (
    <Tooltip text={t(ART_STIL[art].hinweis)} seite="oben">
      <span
        className={['rounded-2xl px-2 py-0.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.08em] text-[#0d0f14]', ART_STIL[art].fahne].join(' ')}
      >
        {artName(art, termine, t)}
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
