import { useEffect, useState } from 'react'
import { startOfWeek, todayIso } from '@shared/time.ts'
import { klebendeUnterkante } from './woche-sprung.ts'

/**
 * Wo „heute" gerade liegt, gemessen an dem, was man sieht:
 * `hier` im Bild, `frueher`/`spaeter` in einer anderen Woche bzw. einem anderen Monat,
 * `oben`/`unten` in der gezeigten Woche, aber weggescrollt.
 */
export type HeuteLage = 'hier' | 'frueher' | 'spaeter' | 'oben' | 'unten'

/** Lage nur aus dem gewählten Zeitraum — ohne Scrollstand. */
function lageImZeitraum(monat: boolean, date: string): HeuteLage {
  const heute = todayIso()
  const [h, d] = monat ? [heute.slice(0, 7), date.slice(0, 7)] : [startOfWeek(heute), startOfWeek(date)]
  return h === d ? 'hier' : h < d ? 'frueher' : 'spaeter'
}

/**
 * Zustand für den „heute"-Knopf. Der Scrollstand kommt aus einem IntersectionObserver auf den
 * heutigen Tageskopf (kein Scroll-Listener); in der Monatsansicht zählt nur der Zeitraum.
 */
export function useHeuteLage(monat: boolean, date: string): HeuteLage {
  const imZeitraum = lageImZeitraum(monat, date)
  const [scroll, setScroll] = useState<'oben' | 'unten' | undefined>(undefined)

  useEffect(() => {
    setScroll(undefined)
    if (monat || imZeitraum !== 'hier') return
    let io: IntersectionObserver | undefined
    // Die Wochenliste steht erst nach dem Zeichnen im DOM.
    const start = window.setTimeout(() => {
      const tag = document.querySelector<HTMLElement>('[data-heute="1"]')
      if (!tag) return
      const richtung = (top: number) => (top < 0 ? 'oben' : 'unten')
      io = new IntersectionObserver(
        ([e]) => setScroll(e.isIntersecting ? undefined : richtung(e.boundingClientRect.top)),
        // Oben verdeckt die klebende Kopfleiste, unten die Steuerleiste einen Streifen.
        { rootMargin: `-${Math.round(klebendeUnterkante())}px 0px -88px 0px` },
      )
      io.observe(tag)
      /*
        Der Observer meldet nur das Ein- und Austreten. Ein Sprung von weit unterhalb nach weit
        oberhalb von heute ändert daran nichts, die Richtung aber schon — deshalb schaut ein
        Scroll-Hörer nach, aber nur, solange heute außer Sicht ist (ein Lesevorgang je Bild).
      */
      let wartet = false
      aufScroll = () => {
        if (wartet) return
        wartet = true
        requestAnimationFrame(() => {
          wartet = false
          setScroll((alt) => (alt ? richtung(tag.getBoundingClientRect().top) : alt))
        })
      }
      window.addEventListener('scroll', aufScroll, { passive: true })
    }, 150)
    let aufScroll: (() => void) | undefined
    return () => {
      window.clearTimeout(start)
      io?.disconnect()
      if (aufScroll) window.removeEventListener('scroll', aufScroll)
    }
  }, [monat, date, imZeitraum])

  return imZeitraum === 'hier' ? (scroll ?? 'hier') : imZeitraum
}
