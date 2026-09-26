import { Tooltip, ShareIcon, HideEye, FavoriteStar } from './ui.tsx'
import { type ReleaseEvent } from '@shared/types.ts'
import type { Translate } from '../lib/i18n.tsx'

/** Die Kopfzeile einer Terminkarte: Uhrzeit, Folge, Hinweise und die Knöpfe Teilen, Auge, Stern. */
export function KartenKopf({ event, ueberholt, t, gesamtFolgen, share, copiedSlug, onToggleHidden, onToggleFavorite, favorite }: {
  event: ReleaseEvent
  ueberholt: boolean
  t: Translate
  gesamtFolgen: number | undefined
  share: (slug: string, title: string, art?: 'r' | 't') => Promise<void>
  copiedSlug: string | undefined
  onToggleHidden: (() => void) | undefined
  onToggleFavorite: (() => void) | undefined
  favorite: boolean | undefined
}) {
  return (
    <>
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
            title={event.timeEstimated ? t('card.zeitVoraussichtlich') : undefined}
          >
            {event.timeEstimated ? `≈ ${event.time}` : event.time}
          </span>
        ) : event.releaseType === 'disc' ? (
          <span>{t('card.inStores')}</span>
        ) : null}
        {/* Eine TV-Sichtung zählt unsere Sichtungen, keine Folgen der Serie — keine Angabe statt „Ep 1/1“. */}
        {/* Ein Film hat keine Folgen — „Ep 1/1“ über einem Kinostart sagt nichts (17.09.2026). */}
        {event.episode && !event.sichtung && event.releaseType !== 'movie' && (
          <span className="rounded bg-slate-200/70 px-1 tabular-nums dark:bg-white/10">
            {t('card.episode', { n: event.episode })}
            {gesamtFolgen ? `/${gesamtFolgen}` : ''}
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
    </>
  )
}
