import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Translate } from '../../lib/i18n.tsx'
import { nachbarKarte, pfeilZustand, setzeStart, springeSpur, verfolgeSpur } from './reihen-spur-regeln.ts'

/** Vor der ersten Messung gelten die Pfeile als überflüssig — sie erscheinen erst, wenn wirklich etwas überläuft. */
const OHNE_MESSUNG = { versteckt: true, zurueckAus: true, weiterAus: false }

function PfeilKnopf({ richtung, label, aus, spurId, onClick }: { richtung: '‹' | '›'; label: string; aus: boolean; spurId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-controls={spurId}
      disabled={aus}
      onClick={onClick}
      className="min-h-11 min-w-11 cursor-pointer rounded-lg text-xl leading-none text-ak-text hover:bg-ak-flaeche-2 focus-visible:outline-2 focus-visible:outline-ak-fokus disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <span aria-hidden="true">{richtung}</span>
    </button>
  )
}

/** Rechts im Gruppenkopf; ohne Überlauf fehlen beide, ohne feinen Zeiger (`pointer: fine`, Handy) wischt man stattdessen. */
export function PfeilPaar({ zustand, spurId, t, springe }: { zustand: typeof OHNE_MESSUNG; spurId: string; t: Translate; springe: (richtung: 1 | -1) => void }) {
  if (zustand.versteckt) return null
  return (
    <div className="hidden gap-0.5 pointer-fine:flex">
      <PfeilKnopf richtung="‹" label={t('detail.reiheZurueck')} aus={zustand.zurueckAus} spurId={spurId} onClick={() => springe(-1)} />
      <PfeilKnopf richtung="›" label={t('detail.reiheWeiter')} aus={zustand.weiterAus} spurId={spurId} onClick={() => springe(1)} />
    </div>
  )
}

/** Folgt der Spur: misst bei jedem Scrollen (ein Frame) und bei Größenänderung, welche Pfeile gelten. */
function useSpurMessung(spur: React.RefObject<HTMLDivElement | null>) {
  const [zustand, setZustand] = useState(OHNE_MESSUNG)
  const messen = useCallback(() => {
    const el = spur.current
    if (!el) return
    const neu = pfeilZustand(el.scrollLeft, el.clientWidth, el.scrollWidth)
    setZustand((alt) => (alt.versteckt === neu.versteckt && alt.zurueckAus === neu.zurueckAus && alt.weiterAus === neu.weiterAus ? alt : neu))
  }, [spur])
  useLayoutEffect(() => {
    const el = spur.current
    if (!el) return
    const aufraeumen = verfolgeSpur(
      el,
      messen,
      {
        resize: typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver,
        mutation: typeof MutationObserver === 'undefined' ? undefined : MutationObserver,
      },
      { an: (f) => requestAnimationFrame(f), ab: (id) => cancelAnimationFrame(id) },
    )
    messen()
    return aufraeumen
  }, [spur, messen])
  return zustand
}

/** Pfeiltasten bewegen den Fokus zur Nachbarkarte; der Browser zieht die Spur zum Fokus nach. */
function pfeiltaste(e: KeyboardEvent<HTMLDivElement>): void {
  const karten = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not(:disabled)')]
  const ziel = nachbarKarte(karten.indexOf(document.activeElement as HTMLElement), karten.length, e.key)
  if (ziel === undefined) return
  e.preventDefault()
  karten[ziel]?.focus()
}

/**
 * Eine Gruppe der Reihe (Hauptserie, Filme, Specials) als Zeile: Überschrift mit Pfeilen rechts (nur mit Maus, nur bei Überlauf), darunter die wischbare Spur.
 * Ein Pfeilklick springt um so viele Karten, wie ganz hineinpassen. Beim Öffnen und beim Wechsel des Teils steht die Spur an der Sprungkante des gewählten Teils —
 * gesetzt wird nur `scrollLeft` der Spur, nie `scrollIntoView` (das scrollte das Panel vor, 09.10.2026).
 */
export function ReihenSpur({ titel, gewaehltId, erste, t, children }: { titel: string; gewaehltId: number; erste: boolean; t: Translate; children: ReactNode }) {
  const kennung = useId()
  const spur = useRef<HTMLDivElement>(null)
  const zustand = useSpurMessung(spur)
  useLayoutEffect(() => {
    const el = spur.current
    if (el) setzeStart(el, el.querySelector<HTMLElement>('[aria-selected="true"]'))
  }, [gewaehltId])
  const springe = (richtung: 1 | -1) => {
    const el = spur.current
    if (!el) return
    springeSpur(el, richtung, matchMedia)
  }
  return (
    <div className={erste ? '' : 'mt-1.5'}>
      <div className="flex min-h-8 items-center gap-2">
        <span id={`${kennung}-titel`} className="text-t5 uppercase tracking-[.08em] text-ak-sehr-leise">
          {titel}
        </span>
        <span className="h-px flex-1 bg-ak-linie" />
        <PfeilPaar zustand={zustand} spurId={`${kennung}-spur`} t={t} springe={springe} />
      </div>
      <div
        ref={spur}
        id={`${kennung}-spur`}
        role="tablist"
        aria-labelledby={`${kennung}-titel`}
        onKeyDown={pfeiltaste}
        className="relative -m-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-px-1 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  )
}
