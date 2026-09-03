import type { Fsk, ReleaseEvent, Title } from '@shared/types.ts'
import { RELEASE_TYPES } from '@shared/types.ts'
import { todayIso } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { useShare } from '../lib/share.ts'
import { FavoriteStar, FskBadge, HideEye, PlatformBadge, ShareIcon,
  Tooltip,
} from './ui.tsx'

export function EventCard({
  event,
  title,
  fsk,
  favorite,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onOpen,
  dense,
}: {
  event: ReleaseEvent
  title?: Title
  fsk?: Fsk
  favorite?: boolean
  hidden?: boolean
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
  onOpen: () => void
  dense?: boolean
}) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const type = RELEASE_TYPES[event.releaseType]
  const cover = title?.coverImage

  /**
   * Ausgeblendet: Der Termin bleibt an seinem Platz, aber nur als Name.
   *
   * Kein Bild, keine Schlagworte, keine Plattform, kein Öffnen — sonst wäre
   * das Ausblenden eine Attrappe. Genau darum ist die ganze Karte hier auch
   * kein Knopf mehr: Ein versehentlicher Klick soll nicht zeigen, was jemand
   * bewusst nicht sehen wollte.
   */
  if (hidden) {
    return (
      <div
        className={[
          'flex w-full items-center gap-2 overflow-hidden rounded-lg border border-dashed',
          'border-slate-300 bg-slate-100/60 text-left dark:border-white/15 dark:bg-white/[0.02]',
          dense ? 'p-1.5' : 'p-2',
        ].join(' ')}
      >
        <span className="line-clamp-1 min-w-0 flex-1 text-[13px] italic text-slate-400 dark:text-slate-500">
          {event.name}
        </span>
        {onToggleHidden && <HideEye hidden onToggle={onToggleHidden} size="sm" />}
      </div>
    )
  }

  /*
    **Ein überholter Termin wird durchgestrichen, nicht entfernt.**

    Daniel am 01.09.2026: „wir haben es erst auf dem kalender gezeigt, dann
    ändert sich das, wir sollten es dort dann rot markieren oder durchstreichen
    oder so, damit weiterhin sichtbar ist, das es dort stand, aber die echte neue
    info es nachweislich überschreibt."

    Wer den Tag im Kopf hatte, sucht ihn — und findet ihn, mitsamt der Auskunft,
    was daraus geworden ist. Nachgeholt (`erschienenAm`) zählt nicht mehr dazu:
    Dann ist die Folge da, und der Termin war nur zu früh.
  */
  const ueberholt = Boolean(event.verpasst && !event.verpasst.erschienenAm)

  /*
    **Was vorbei ist, tritt zurück.**

    Daniel am 03.09.2026: „grauton/opacity für termine in vergangenheit
    abschwächen." Eine Kalenderwoche zeigt Montag bis Sonntag, und an einem
    Donnerstag ist die Hälfte davon Geschichte — gleich hell dargestellt
    konkurriert sie mit dem, was noch kommt.

    **Weg ist sie damit nicht**, und das ist Absicht: Wer nachsieht, ob etwas
    erschienen ist, sucht genau dort. Sie ist nur leiser — und beim Zeigen
    kommt sie voll zurück. Gemerkte Titel bleiben immer hell; sie sind der
    Grund, warum jemand die Woche überhaupt aufschlägt.
  */
  const vergangen = event.date < todayIso()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={[
        'group relative flex w-full cursor-pointer gap-2 overflow-hidden rounded-lg border text-left transition',
        favorite
          ? 'border-amber-400/70 bg-amber-400/[0.07] shadow-[0_0_0_1px_rgba(251,191,36,.25)] hover:border-amber-300'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/25 dark:hover:bg-white/[0.08]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        /* 78 % statt 60 — zurückgenommen, nicht ausgeblendet (Daniel, 03.09.2026). */
        vergangen && !favorite ? 'opacity-[0.78] transition-opacity hover:opacity-100' : '',
        dense ? 'p-1.5' : 'p-2',
      ].join(' ')}
      /*
        Die Farbe der linken Kante ist die Release-Art — so steht es in der
        Legende. Eine zweite Bedeutung (Strichart für die Uhrzeit) stand hier am
        03.09.2026 für eine halbe Stunde und ist auf Daniels Wunsch wieder
        gewichen: „offen-border wieder rückgängig machen." Die Trennüberschriften
        bleiben trotzdem weg — die Uhrzeit steht an der Kachel.
      */
      style={{ borderLeft: `3px solid ${type.color}` }}
    >
      {cover && !dense && (
        <img src={cover} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Umbrechend, weil die Reihe je nach Titel bis zu sechs Dinge trägt:
            Uhrzeit, Folgennummer, das ≈, Teilen, Auge, Stern. In einer schmalen
            Tagesspalte passte das nicht mehr nebeneinander, und der Stern stand
            am Ende außerhalb der Kachel (10.08.2026). Bricht die Reihe um,
            schiebt `ml-auto` die Icons in der zweiten Zeile nach rechts. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {/*
            Ohne Uhrzeit steht hier nichts. „Zeit offen" führte zu der Frage,
            was denn offen sei (Daniel, 01.09.2026); warum ein Anbieter keine
            nennt, steht im Detail-Panel.
          */}
          {event.time ? (
            <span
              className={
                ueberholt
                  ? 'tabular-nums text-rose-600/70 line-through dark:text-rose-400/70'
                  : 'tabular-nums text-slate-700 dark:text-slate-200'
              }
            >
              {event.time}
            </span>
          ) : event.releaseType === 'disc' ? (
            <span>{t('card.inStores')}</span>
          ) : null}
          {event.episode && (
            <span className="rounded bg-slate-200/70 px-1 tabular-nums dark:bg-white/10">
              {t('card.episode', { n: event.episode })}
              {event.episodeCount ? `/${event.episodeCount}` : ''}
            </span>
          )}
          {event.estimated && !event.verpasst && (
            <Tooltip text={t('legend.estimated')} seite="oben">
              <span className="text-amber-500">≈</span>
            </Tooltip>
          )}
          {event.verpasst && (
            /*
              **Der Termin bleibt stehen und sagt, was los ist.**

              Ihn auszublenden wäre die zweitschlechteste Lösung: Wer ihn im
              Kalender hatte, sucht ihn dann und findet nichts. Der Hinweis nennt
              deshalb drei Dinge — dass er nicht eingehalten wurde, wie viele
              Folgen der Anbieter wirklich zeigt, und wann wir nachsehen. Ist die
              Folge nachgeholt, steht dort ihr echtes Datum samt Verzug.

              **Und er sagt, dass wir nachgesehen haben.** Daniel am 01.09.2026:
              „wenn wir selbst herausfinden das ein datum nicht stimmt … ebenfalls
              angeben, weil das etwas positives ist." Ein Kalender, der eigene
              Termine überprüft und das Ergebnis zeigt, ist mehr wert als einer,
              der stillschweigend richtig liegt — der Leser sieht die Arbeit nur,
              wenn sie einmal etwas findet.
            */
            <Tooltip
              text={[
                t('card.missed'),
                event.verpasst.folgenVerfuegbar != null &&
                  t('card.missedCount', { n: event.verpasst.folgenVerfuegbar }),
                event.verpasst.neuErwartet
                  ? t('card.missedNext', { d: event.verpasst.neuErwartet.slice(0, 10) })
                  : t('card.missedCheck'),
                event.verpasst.recherche,
              ]
                .filter(Boolean)
                .join(' · ')}
              seite="oben"
            >
              <span className="rounded bg-rose-500/15 px-1 font-medium text-rose-600 dark:text-rose-400">
                {event.verpasst.erschienenAm && event.verpasst.verzugStunden != null
                  ? `↻ ${t('card.missedLateBadge', { d: event.verpasst.erschienenAm.slice(0, 10) })}`
                  : `⚠ ${t('card.missedBadge')}`}
              </span>
            </Tooltip>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            <ShareIcon
              onShare={() => share(event.releaseSlug, event.name)}
              copied={copiedSlug === event.releaseSlug}
              size="sm"
            />
            {onToggleHidden && <HideEye hidden={false} onToggle={onToggleHidden} size="sm" />}
            {onToggleFavorite && (
              <FavoriteStar active={!!favorite} onToggle={onToggleFavorite} size="sm" />
            )}
          </span>
        </div>
        <span
          className={[
            /*
              Drei Zeilen statt zwei (Daniel, 03.09.2026): Gemessen waren **28
              von 42** sichtbaren Titeln nach zwei Zeilen gekappt — „Skeleton
              Knight in…", „Mushoku Tensei: Joble…". Die dritte Zeile holt acht
              davon zurück und kostet 18 px.
            */
            'line-clamp-3 text-[13px] font-medium leading-snug',
            ueberholt
              ? 'text-slate-400 line-through decoration-rose-500/60 dark:text-slate-500'
              : 'text-slate-900 dark:text-slate-100',
          ].join(' ')}
        >
          {event.name}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <PlatformBadge platform={event.platform} small />
          {fsk !== undefined && <FskBadge fsk={fsk} small />}
        </span>
      </div>
    </div>
  )
}
