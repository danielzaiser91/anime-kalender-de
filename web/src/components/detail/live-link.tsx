import { Tooltip } from '../ui.tsx'
import { useLang } from '../../lib/i18n.tsx'

/** Spielzeichen (Dreieck) — kennzeichnet den Livestream-Link. */
function SpielZeichen() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} className="size-3.5 shrink-0" fill="currentColor">
      <path d="M7 4v16l13-8z" />
    </svg>
  )
}

/** Führt zum Livestream des Senders; mit `sender` steht „<Sender> live“ am Knopf, sonst nur das Zeichen. */
export function LiveLink({ url, hinweis, sender }: { url: string; hinweis: string; sender?: string }) {
  const { t } = useLang()
  const text = sender ? t('tv.liveKnopf', { sender }) : undefined
  const klasse = text
    ? 'inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-ak-flaeche-2 px-3 text-t3 font-semibold text-ak-text transition hover:bg-ak-pille-hover'
    : 'grid size-11 place-items-center rounded-full text-ak-leise transition hover:text-ak-text'
  return (
    <Tooltip text={hinweis} seite="oben" eigenerFokus className="shrink-0">
      <a href={url} target="_blank" rel="noopener" aria-label={hinweis} className={klasse}>
        {text ? <span className="text-ak-tv"><SpielZeichen /></span> : <SpielZeichen />}
        {text && <span className="truncate">{text}</span>}
      </a>
    </Tooltip>
  )
}
