import type { ReleaseEvent } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { Tooltip } from '../ui.tsx'

/** Uhrzeit auf dem Cover. Ohne Uhrzeit steht dort nichts — bei einer Disc „im Handel". */
export function ZeitMarke({ event, t }: { event: ReleaseEvent; t: Translate }) {
  const text = event.time
    ? `${event.timeEstimated || event.estimated ? '≈ ' : ''}${event.time}`
    : event.releaseType === 'disc'
      ? t('card.inStores')
      : event.estimated
        ? '≈'
        : ''
  if (!text) return null
  const hinweis = event.timeEstimated ? t('card.zeitVoraussichtlich') : event.estimated ? t('legend.estimated') : ''
  const marke = (
    <span className="rounded-md bg-[rgba(13,15,20,.85)] px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#f2f1ee]">
      {text}
    </span>
  )
  return hinweis ? (
    <Tooltip text={hinweis} seite="oben">
      {marke}
    </Tooltip>
  ) : (
    marke
  )
}

/** „Anbieter · Folge 3/12" unter dem Titel; im Fernsehen der Sender. */
export function anbieterUndFolge(event: ReleaseEvent, t: Translate): string {
  const anbieter = event.platform === 'tv' ? (event.sender ?? PLATFORMS.tv.name) : PLATFORMS[event.platform].name
  /* Ein Film hat keine Folgen, eine TV-Sichtung zählt Sichtungen — beide ohne Angabe (17.09.2026). */
  if (!event.episode || event.sichtung || event.releaseType === 'movie') {
    return event.episodeCount && event.episodeCount > 1 && !event.episode ? `${anbieter} · ${t('kal.folgen', { n: event.episodeCount })}` : anbieter
  }
  /* Im Fernsehen nur die Folge: tv.de kennt die Gesamtzahl nicht (23.09.2026). */
  const gesamt = event.platform === 'tv' ? undefined : event.episodeCount
  return `${anbieter} · ${gesamt ? t('kal.folgeVon', { n: event.episode, von: gesamt }) : t('kal.folge', { n: event.episode })}`
}

/**
 * **Ein nicht eingehaltener Termin bleibt stehen und sagt, was los ist** — dass wir nachgesehen
 * haben, wie viele Folgen der Anbieter zeigt und wann wir wieder nachsehen (Daniel, 01.09.2026).
 */
export function VerpasstMarke({ event, t }: { event: ReleaseEvent; t: Translate }) {
  const v = event.verpasst
  if (!v) return null
  const hinweis = [
    t('card.missed'),
    v.folgenVerfuegbar != null && t('card.missedCount', { n: v.folgenVerfuegbar }),
    v.neuErwartet ? t('card.missedNext', { d: v.neuErwartet.slice(0, 10) }) : t('card.missedCheck'),
    v.recherche,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Tooltip text={hinweis} seite="oben">
      <span className="rounded bg-rose-500/15 px-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
        {v.erschienenAm && v.verzugStunden != null
          ? `↻ ${t('card.missedLateBadge', { d: v.erschienenAm.slice(0, 10) })}`
          : `⚠ ${t('card.missedBadge')}`}
      </span>
    </Tooltip>
  )
}

/**
 * „8 Termine · 9 im TV" — Termine sind alles außer Fernsehen (Stream, Disc, Kino). Eine Null
 * entfällt: „0 Termine" neben „Kein Termin an diesem Tag" stünde doppelt da.
 */
export function zaehlung(termine: number, tv: number, t: Translate): string {
  const teile: string[] = []
  if (termine) teile.push(termine === 1 ? t('kal.einTermin') : t('kal.termine', { n: termine }))
  if (tv) teile.push(t('kal.imTvZahl', { n: tv }))
  return teile.join(' · ')
}
