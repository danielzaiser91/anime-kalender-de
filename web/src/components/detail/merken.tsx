import { type Release } from '@shared/types.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useState, useRef, useEffect } from 'react'
import { expandEvents, istAusgeblieben } from '@shared/logic.ts'
import { Tooltip } from '../ui.tsx'
import { createPortal } from 'react-dom'
import { googleCalendarUrl } from '@shared/ics.ts'
import { downloadIcs } from './hilfen.tsx'

/**
 * **„Merken" — ein Symbol, ein Wort, zwei Wege dahinter.**
 *
 * Steht in jeder Pille, die einen künftigen Termin trägt: an der Release-Pille
 * einer Disc ebenso wie an der Anbieter-Pille einer laufenden Serie. Steht
 * nichts mehr aus, erscheint er nicht — ein Kalendereintrag für etwas
 * Vergangenes ist kein Angebot, sondern ein Fehlgriff.
 */
export function MerkenKnopf({
  release,
  today,
  farbe,
}: {
  release?: Release
  today: string
  /**
   * Mit Farbe: Eckknopf unten rechts an der Pille, Rand und Symbol in der Markenfarbe
   * (Daniel, 19.09.2026, Entwurf A2). Ohne: rund in der Zeile (Kino-Banner).
   */
  farbe?: string
}) {
  const { t } = useLang()
  const [merkenOffen, setMerkenOffen] = useState(false)
  /**
   * **Wo das Menü steht — gemessen, nicht per CSS.**
   *
   * Es hing als `absolute` im Knopf und lag damit in derselben Box wie die
   * Pille. Die Anbieterliste des Panels scrollt, und ein Kind, das unten
   * hinausragt, verlängert dort den Inhalt: Statt über der Liste zu liegen,
   * erzeugte das Menü eine Bildlaufleiste und war selbst nicht zu sehen
   * (Daniel, 10.09.2026, mit zwei Bildern). Am `<body>` kann das nicht mehr
   * passieren — derselbe Weg wie beim Hinweis-Baustein in `ui.tsx`.
   */
  const knopf = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!merkenOffen) return
    /* Scrollt die Liste unter dem offenen Menü weg, stimmt seine Stelle nicht mehr. */
    const zu = () => setMerkenOffen(false)
    window.addEventListener('scroll', zu, true)
    window.addEventListener('resize', zu)
    return () => {
      window.removeEventListener('scroll', zu, true)
      window.removeEventListener('resize', zu)
    }
  }, [merkenOffen])
  /* Ein ausgebliebener Termin ist keiner, den man sich eintragen könnte. */
  const kuenftige = release ? expandEvents(release).filter((e) => e.date >= today && !istAusgeblieben(e)) : []
  const ev = kuenftige[0]
  if (!ev || !release) return null
  return (
      <span className={farbe ? 'absolute -bottom-1.5 -right-1.5 z-10' : 'relative ml-2 shrink-0'}>
        <Tooltip text={t('detail.merkenTitel')} seite="oben">
        <button
          type="button"
          ref={knopf}
          /**
           * **Der Knopf sitzt in einem Verweis — der Klick darf ihn nicht auslösen.**
           *
           * Die Pille ist ein `<a>` auf die Anbieterseite, und „Merken" steht
           * darin. Ohne diese beiden Zeilen führte jeder Klick auf den Knopf zu
           * Crunchyroll, und das Menü öffnete sich erst auf der Rückkehr
           * (Daniel, 10.09.2026: „klick auf merken leitet direkt auf crunchyroll
           * weiter").
           */
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (merkenOffen) {
              setMerkenOffen(false)
              return
            }
            const r = knopf.current?.getBoundingClientRect()
            if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
            setMerkenOffen(true)
          }}
          aria-expanded={merkenOffen}
          /* Nur das Symbol, rund (Daniel, 19.09.2026, Entwurf K3) — ~24 px statt ~80 px, gut tippbar. */
          aria-label={t('detail.merkenTitel')}
          className={
            farbe
              ? 'grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-full bg-white transition hover:brightness-110 dark:bg-[#162238]'
              : 'grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-slate-500/10 text-slate-700 transition hover:bg-slate-500/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
          }
          style={farbe ? { color: farbe, boxShadow: `0 0 0 1px ${farbe}` } : undefined}
        >
          {/*
            Gezeichnet, nicht als Zeichen: Ein 🗓-Emoji kam in der
            Oberflächenschrift nicht vor und erschien als leeres Kästchen
            (gesehen am 25.08.2026 in beiden Themen). Ein Pfad hängt an keiner
            Schrift.
          */}
          {/* Google Material Symbols „calendar_add_on" (Apache 2.0) — Daniels Wahl vom 19.09.2026. */}
          <svg viewBox="0 -960 960 960" className={farbe ? 'size-3.5' : 'size-4'} fill="currentColor" aria-hidden="true">
            <path d="M700-200h-90q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h90v-90q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v90h90q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5h-90v90q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63Q700-97.25 700-110v-90Zm-520 40q-24 0-42-18t-18-42v-540q0-24 18-42t42-18h65v-28q0-13.6 9-22.8 9-9.2 23.02-9.2t23.5 9.2Q310-861.6 310-848v28h260v-28q0-13.6 9-22.8 9-9.2 23.02-9.2t23.5 9.2Q635-861.6 635-848v28h65q24 0 42 18t18 42v269q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-79H180v350h290q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H180Zm0-470h520v-130H180v130Zm0 0v-130 130Z" />
          </svg>
        </button>
        </Tooltip>
        {merkenOffen &&
          createPortal(
            <>
              {/* Ein Klick daneben schließt — sonst bliebe das Menü am Rand des
                  Bildschirms stehen, während darunter weitergeklickt wird. */}
              <span
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMerkenOffen(false)
                }}
                className="fixed inset-0 z-40"
              />
              <span
                style={pos ? { top: pos.top, right: pos.right } : { left: -9999, top: 0 }}
                className="fixed z-50 flex w-max flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-[12px] shadow-lg dark:border-white/10 dark:bg-[#141b2d]"
              >
                <a
                  href={googleCalendarUrl(ev)}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMerkenOffen(false)
                  }}
                  className="px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  {t('detail.merkenGoogle')}
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    /* Alle künftigen Folgen, nicht nur die nächste — genau
                       dafür lädt jemand eine Kalenderdatei statt einen
                       Einzeltermin einzutragen. */
                    downloadIcs(kuenftige, release.slug)
                    setMerkenOffen(false)
                  }}
                  className="cursor-pointer px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  {t('detail.merkenIcs')}
                </button>
              </span>
            </>,
            document.body,
          )}
      </span>
  )
}
