import type { Title } from '@shared/types.ts'
import { titleStatus } from '@shared/logic.ts'
import { anzeigeName } from '@shared/titles.ts'
import type { Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { coverBild } from '../lib/cover.ts'
import { FundstellenZeichen, TrefferName } from './Suchtreffer.tsx'
import { FavoriteStar, FskBadge, HideEye, PlatformBadge, ShareIcon, StatusBadge, Tooltip } from './ui.tsx'

export interface DbKarteProps {
  main: Title
  members: Title[]
  data: Dataset
  today: string
  grouped: boolean
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  onOpenTitle: (id: number) => void
  share: (slug: string, title: string) => Promise<void>
  copiedSlug: string | undefined
}

/** Eine Kachel der Datenbank (oder, ausgeblendet, ihr Platzhalter). */
export function DbKarte({ main, members, data, today, grouped, favorites, hidden, onToggleFavorite, onToggleHidden, onOpenTitle, share, copiedSlug }: DbKarteProps) {
  const { t } = useLang()
  const releases = members.flatMap((m) => data.releasesByTitle.get(m.id) ?? [])
  const status = titleStatus(releases, today, main)
  const favorite = members.some((m) => favorites.has(m.id))
  // Eine Reihe gilt als ausgeblendet, sobald eine ihrer Staffeln es ist —
  // sonst käme das Cover über den Umweg der Fortsetzung doch wieder.
  const isHidden = members.some((m) => hidden.has(m.id))
  const platform = releases[0]?.platform ?? main.streams[0]?.platform
  /**
   * Ein Titel ohne belegte deutsche Synchro. Er sieht bewusst anders
   * aus als der gepflegte Bestand: gestrichelter Rahmen, entsättigtes
   * Cover, eigene Kennzeichnung. Wer die Liste überfliegt, soll die
   * beiden Sorten nicht verwechseln können (Daniel, 13.08.2026:
   * „prevent confusion by making it obvious through styling").
   *
   * Der Stern bleibt trotzdem da — er ist der einzige Grund, warum
   * diese Titel überhaupt angezeigt werden.
   *
   * **`every`, nicht `main.ohneSynchro`:** Eine Reihe kann die Grenze
   * überschreiten — Serie mit Synchro, ein Special ohne. Solange
   * irgendein Teil eine deutsche Fassung hat, ist die Kachel ein
   * normaler Eintrag; die Lücke steht dann in der Staffelliste des
   * Detail-Panels, wo sie hingehört.
   */
  const keinDub = members.every((m) => m.ohneSynchro)
  const teilbar = main.slug && !main.ohneSynchro && main.id > 0 ? main.slug : undefined

  if (isHidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-3 text-center dark:border-white/15 dark:bg-white/[0.02]">
        <span className="line-clamp-3 text-xs italic text-slate-400 dark:text-slate-500">{anzeigeName(main)}</span>
        <HideEye hidden onToggle={() => onToggleHidden(main.id)} />
      </div>
    )
  }

  return (
    /* Kein Knopf aus Knöpfen: wie die Kalenderkarte (EventCard, 18.09.2026). */
    <div
      onClick={() => onOpenTitle(main.id)}
      className={[
        'group flex cursor-pointer flex-col overflow-hidden rounded-xl text-left transition',
        keinDub ? 'border border-dashed' : 'border',
        favorite
          ? 'border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,.3)]'
          : keinDub
            ? 'border-slate-400/60 hover:border-slate-500 dark:border-white/25 dark:hover:border-white/40'
            : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/25',
        keinDub ? 'bg-slate-100/70 hover:shadow-md dark:bg-white/[0.015]' : 'bg-white hover:shadow-lg dark:bg-white/[0.03]',
        'has-[.ak-oeffnen:focus-visible]:ring-2 has-[.ak-oeffnen:focus-visible]:ring-sky-400',
      ].join(' ')}
    >
      <button
        type="button"
        className="ak-oeffnen sr-only"
        onClick={(e) => {
          e.stopPropagation()
          onOpenTitle(main.id)
        }}
      >
        {t('card.details', { titel: anzeigeName(main) })}
      </button>
      <div className="relative aspect-[2/3] overflow-hidden bg-slate-200 dark:bg-white/5">
        {main.coverImage && (
          <img
            {...coverBild(main.coverImage, 262, '(min-width: 1280px) min(17vw, 262px), (min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw')}
            alt=""
            loading="lazy"
            className={[
              'h-full w-full object-cover transition group-hover:scale-105',
              // Entsättigt statt blass: Ein blasses Bild sieht nach
              // Ladefehler aus, ein graues nach Absicht. Beim Zeigen
              // kommt die Farbe zurück — dann schaut jemand genau hin.
              keinDub ? 'opacity-80 grayscale group-hover:opacity-100 group-hover:grayscale-0' : '',
            ].join(' ')}
          />
        )}
        {/*
          **Ein Cartoon sagt, dass er einer ist.**

          Daniel wollte sie sichtbar haben, nicht versteckt — aber
          ununterscheidbar sollen sie auch nicht sein: Die Seite
          verspricht Anime, und „Avatar" ist keiner im Sinne der
          Datenbanken. Die Marke steht oben, damit sie nicht mit dem
          „ohne Synchro"-Band unten kollidiert; beides zugleich kommt
          vor.
        */}
        {main.westlich && (
          <span className="absolute left-1 top-1 rounded bg-slate-600/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-[1px]">
            <Tooltip text={t('db.westlichHinweis')} eigenerFokus>
              {t('db.westlich')}
            </Tooltip>
          </span>
        )}
        {keinDub && (
          <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-200 backdrop-blur-[1px]">
            {t('db.noDubBadge')}
          </span>
        )}
        <KartenKnoepfe
          main={main}
          favorite={favorite}
          onToggleFavorite={() => onToggleFavorite(main.id)}
          onToggleHidden={() => onToggleHidden(main.id)}
          onShare={teilbar ? () => share(teilbar, main.titleDe ?? main.titleEn ?? main.titleRomaji ?? '') : undefined}
          copied={!!teilbar && copiedSlug === teilbar}
        />
        {grouped && members.length > 1 && (
          /*
            Über den Balken statt darauf: Der Hinweis „keine deutsche
            Synchro" läuft über die volle Breite am unteren Rand. Ohne
            das Ausweichen läge die Staffelzahl mitten darin, sobald
            eine Reihe ohne Synchro gebündelt wird — und das tut sie,
            seit der Katalog die Beziehungen mitbringt.
          */
          <span
            className={[
              'absolute right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white',
              keinDub ? 'bottom-7' : 'bottom-1',
            ].join(' ')}
          >
            {t('db.seasons', { count: members.length })}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="flex items-start gap-0.5">
          <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
            <TrefferName text={anzeigeName(main)} schluessel={String(main.id)} />
          </span>
          <FundstellenZeichen text={anzeigeName(main)} schluessel={String(main.id)} />
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {main.jpYear ?? '—'}
          {main.episodes ? ` · ${t('db.episodes', { count: main.episodes })}` : ''}
        </span>
        <span className="mt-auto flex flex-wrap items-center gap-1">
          {keinDub ? (
            /*
              Kein Status, keine Plattform — beides gibt es nicht, und
              „Termin unbekannt" wäre die falsche Auskunft: Unbekannt
              ist nicht der Termin, sondern ob es je eine Synchro gibt.
              Stattdessen steht hier, wozu die Kachel da ist.
            */
            <span
              className={[
                'text-[10px] leading-snug',
                favorite ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400',
              ].join(' ')}
            >
              {favorite ? t('db.noDubWatched') : t('db.noDubWatch')}
            </span>
          ) : (
            <>
              <StatusBadge status={status} small />
              {platform && <PlatformBadge platform={platform} small />}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

const KNOPF_GRUND = 'flex flex-col items-center rounded-full bg-[rgba(13,15,20,.72)] p-0.5 text-[#f2f1ee]'
const ERST_BEIM_ZEIGEN = 'transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0'

/**
 * FSK und Bedienung in **einer** Spalte oben rechts; das Cover bleibt links frei, dort steht meist das Gesicht.
 *
 * Die FSK ist eine Angabe und steht immer. Stern, Auge und Teilen erscheinen wie in der Wochen-Kachel erst beim
 * Zeigen oder per Tastatur — vorher lag ein dunkler Streifen auf jedem Cover, im hellen Thema am auffälligsten.
 * Ein gesetzter Stern bleibt sichtbar. Der Stern ist auf jedem Gerät ein Knopf (28 px, kein zusätzlicher
 * Treffer-Wrapper); Auge und Teilen gibt es auf dem Handy (unter `sm`) im Panel, nicht auf dem Bild.
 */
function KartenKnoepfe({ main, favorite, onToggleFavorite, onToggleHidden, onShare, copied }: {
  main: Title
  favorite: boolean
  onToggleFavorite: () => void
  onToggleHidden: () => void
  onShare?: () => void
  copied: boolean
}) {
  return (
    <span className="absolute right-1 top-1 flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      {main.fsk !== undefined && <FskBadge fsk={main.fsk} quelle={main.fskQuelle} small />}
      <span className={`${KNOPF_GRUND} ${favorite ? '' : ERST_BEIM_ZEIGEN}`}>
        <FavoriteStar active={favorite} onToggle={onToggleFavorite} grosseFlaeche />
      </span>
      <span className={`${KNOPF_GRUND} hidden sm:flex ${ERST_BEIM_ZEIGEN}`}>
        <HideEye hidden={false} onToggle={onToggleHidden} />
        {onShare && <ShareIcon onShare={onShare} copied={copied} />}
      </span>
    </span>
  )
}
