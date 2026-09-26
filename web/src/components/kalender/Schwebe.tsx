import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Eine schwebende Karte an einem Auslöser: beim Zeigen (`zeigen`), per Klick (`klick`) oder beides.
 *
 * Anders als `Tooltip` darf der Inhalt bedienbar sein (Listen mit Einträgen zum Anklicken). Deshalb
 * schließt sie beim Verlassen erst nach einer kurzen Frist — lang genug, um mit der Maus vom
 * Auslöser in die Karte zu wechseln. Per Portal am `body`, damit kein `overflow` sie abschneidet.
 */
export function Schwebe({
  inhalt,
  children,
  art = 'zeigen',
  breite = 320,
  className = '',
  label,
}: {
  inhalt: ReactNode
  children: ReactNode
  art?: 'zeigen' | 'klick' | 'beides'
  breite?: number
  className?: string
  /** Name der Karte für Vorlesende. */
  label?: string
}) {
  const [offen, setOffen] = useState(false)
  const [fest, setFest] = useState(false)
  const anker = useRef<HTMLSpanElement>(null)
  const karte = useRef<HTMLDivElement>(null)
  const zu = useRef<number>(undefined)
  const id = useId()
  const pos = useKartenPosition(offen, anker, karte)
  const zeigen = art !== 'klick'

  useEffect(() => {
    if (!offen) return
    const schliessen = () => {
      setFest(false)
      setOffen(false)
    }
    const draussen = (e: MouseEvent) => {
      const ziel = e.target as Node
      if (!anker.current?.contains(ziel) && !karte.current?.contains(ziel)) schliessen()
    }
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      schliessen()
      anker.current?.querySelector<HTMLElement>('button')?.focus()
    }
    /* Die Karte steht `fixed` — rollt die Seite, gehört sie nicht mehr zu ihrem Auslöser. */
    const rollen = (e: Event) => !karte.current?.contains(e.target as Node) && schliessen()
    document.addEventListener('mousedown', draussen)
    document.addEventListener('keydown', taste)
    window.addEventListener('scroll', rollen, true)
    return () => {
      document.removeEventListener('mousedown', draussen)
      document.removeEventListener('keydown', taste)
      window.removeEventListener('scroll', rollen, true)
    }
  }, [offen])

  /*
    Per Klick geöffnet, bekommt die Karte den Fokus: Sie hängt am Ende des `body`, mit Tab käme
    man sonst nie hinein. Escape schließt und gibt den Fokus an den Auslöser zurück.
  */
  useEffect(() => {
    if (!fest || !pos) return
    karte.current?.querySelector<HTMLElement>('button, a[href], input')?.focus()
  }, [fest, pos])

  const umschalten = () => {
    if (art === 'zeigen') return
    if (fest) {
      setFest(false)
      setOffen(false)
    } else {
      setFest(true)
      setOffen(true)
    }
  }
  const betreten = () => {
    window.clearTimeout(zu.current)
    if (zeigen) setOffen(true)
  }
  const verlassen = () => {
    if (fest) return
    zu.current = window.setTimeout(() => setOffen(false), 140)
  }

  return (
    <span
      ref={anker}
      className={`relative ${className}`}
      onMouseEnter={betreten}
      onMouseLeave={verlassen}
      onFocus={betreten}
      onBlur={(e) => !fest && !e.currentTarget.contains(e.relatedTarget as Node) && !karte.current?.contains(e.relatedTarget as Node) && setOffen(false)}
      /* Klicks in der Karte kommen über das Portal hier an — sie schalten nicht um. */
      onClick={(e) => !karte.current?.contains(e.target as Node) && umschalten()}
      aria-describedby={offen ? id : undefined}
    >
      {children}
      {offen &&
        createPortal(
          <div
            ref={karte}
            id={id}
            role="dialog"
            aria-label={label}
            onMouseEnter={betreten}
            onMouseLeave={verlassen}
            /* Ein Eintrag mit `data-schliesst` führt woandershin — dann hat die Karte ihren Zweck erfüllt. */
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('[data-schliesst]')) return
              setFest(false)
              setOffen(false)
            }}
            style={{ width: `min(${breite}px, calc(100vw - 16px))`, ...(pos ?? { left: -9999, top: 0 }) }}
            className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-ak-rand bg-ak-flaeche p-2 text-ak-text shadow-[0_18px_40px_rgba(0,0,0,.45)]"
          >
            {inhalt}
          </div>,
          document.body,
        )}
    </span>
  )
}

/** Unter dem Auslöser, sonst darüber; waagerecht im Fenster gehalten. */
function useKartenPosition(
  offen: boolean,
  anker: React.RefObject<HTMLSpanElement | null>,
  karte: React.RefObject<HTMLDivElement | null>,
) {
  const [pos, setPos] = useState<{ left: number; top: number }>()
  useLayoutEffect(() => {
    if (!offen) {
      setPos(undefined)
      return
    }
    const a = anker.current?.getBoundingClientRect()
    const b = karte.current?.getBoundingClientRect()
    if (!a || !b) return
    const rand = 8
    const left = Math.min(Math.max(a.left, rand), Math.max(rand, window.innerWidth - b.width - rand))
    const unten = a.bottom + 6
    const top = unten + b.height <= window.innerHeight - rand ? unten : Math.max(rand, a.top - b.height - 6)
    setPos({ left, top })
  }, [offen, anker, karte])
  return pos
}
