import { Tooltip } from '../ui.tsx'

/** Spielzeichen (Dreieck) — kennzeichnet den Livestream-Link neben dem Fernseh-Zeichen. */
function SpielZeichen() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} className="size-3.5 shrink-0" fill="currentColor">
      <path d="M7 4v16l13-8z" />
    </svg>
  )
}

/** Führt zum Livestream des Senders; steht neben dem Programm-Link der TV-Zeile. */
export function LiveLink({ url, hinweis }: { url: string; hinweis: string }) {
  return (
    <Tooltip text={hinweis} seite="oben" eigenerFokus className="shrink-0">
      <a
        href={url}
        target="_blank"
        rel="noopener"
        aria-label={hinweis}
        className="grid size-11 place-items-center rounded-full text-ak-leise transition hover:text-ak-text"
      >
        <SpielZeichen />
      </a>
    </Tooltip>
  )
}

/** Die Folge ist ab Sendeende auf Joyn abrufbar; führt zur Joyn-Seite des Titels (Pille selbst ist schon ein Link, darum daneben). */
export function JoynDanach({ joynSeite, text }: { joynSeite: string; text: string }) {
  return (
    <a href={joynSeite} target="_blank" rel="noopener" className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-1 text-t4 text-ak-leise underline-offset-2 transition hover:text-ak-text hover:underline">
      {text}
    </a>
  )
}
