import { useEffect, useMemo, useRef, useState } from 'react'
import type { Antwort } from '@shared/empfehlung-kern.ts'
import { baueDuellAnbindung, type Stand } from '../../lib/empfehlung-duell-anbindung.ts'
import { browserLader } from '../../lib/empfehlung-duell-bilder.ts'
import type { DuellSchritt } from '../../lib/empfehlung-duell-steuerung.ts'

/** Hängt die Duell-Anbindung (`empfehlung-duell-anbindung.ts`) an React: Schritt und Wahl als Zustand, der Rest ist dort getestet. */
export function useDuell(stand: Stand) {
  const [schritt, setSchritt] = useState<DuellSchritt>('bereit')
  const [gewaehlt, setGewaehlt] = useState<Antwort>()
  const neu = useRef(stand)
  neu.current = stand
  const anbindung = useMemo(
    () =>
      baueDuellAnbindung({
        plane: (f, ms) => window.setTimeout(f, ms),
        loesche: (h) => window.clearTimeout(h),
        meldeSchritt: setSchritt,
        setzeGewaehlt: setGewaehlt,
        aktuell: () => neu.current,
        lader: browserLader,
        reduziert: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }),
    [],
  )
  useEffect(() => anbindung.abbrechen, [anbindung])
  return { schritt, gewaehlt, waehle: anbindung.waehle, zurueckGehen: anbindung.zurueckGehen }
}
