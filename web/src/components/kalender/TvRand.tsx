import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLang } from '../../lib/i18n.tsx'

/**
 * Vorschau „tv-kasten", Variante mehr: Der Kasten rollt in Zeilenhöhe wie bisher, zeigt aber unten einen Verlauf
 * und „+N weitere", solange Zeilen verdeckt sind. Messen läuft passiv und höchstens einmal je Bild.
 */
export function TvRand({ children }: { children: ReactNode }) {
  const { t } = useLang()
  const rolle = useRef<HTMLDivElement>(null)
  const [mehr, setMehr] = useState(0)
  useEffect(() => {
    const el = rolle.current
    if (!el) return
    let wartet = false
    const messen = () => {
      wartet = false
      const unten = el.scrollTop + el.clientHeight
      let n = 0
      for (const z of el.querySelectorAll<HTMLElement>('[data-tv-zeile]')) if (z.offsetTop + z.offsetHeight - 4 > unten) n++
      setMehr(n)
    }
    const planen = () => {
      if (wartet) return
      wartet = true
      requestAnimationFrame(messen)
    }
    el.addEventListener('scroll', planen, { passive: true })
    const beobachter = new ResizeObserver(planen)
    beobachter.observe(el)
    if (el.firstElementChild) beobachter.observe(el.firstElementChild)
    planen()
    return () => {
      el.removeEventListener('scroll', planen)
      beobachter.disconnect()
    }
  }, [])
  return (
    <div className="relative lg:min-h-0">
      <div ref={rolle} className="lg:absolute lg:inset-0 lg:overflow-y-auto lg:rounded-2xl">
        {children}
      </div>
      {mehr > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-end justify-center rounded-b-2xl bg-linear-to-t from-ak-tv-grund via-ak-tv-grund/80 to-transparent pt-8 pb-1.5 text-xs font-bold text-ak-tv lg:flex">
          {t('kal.tvWeitere', { n: mehr })}
        </div>
      )}
    </div>
  )
}
