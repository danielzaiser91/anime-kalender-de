import { useEffect, useRef } from 'react'

export interface EscapeOptionen {
  /** Wo der Hörer hängt; `window` kommt in der Blasenphase nach `document`. */
  ziel?: 'window' | 'document'
  /** Fangphase, damit der Hörer vor allen anderen läuft. */
  capture?: boolean
}

/** Ruft `beiEscape`, sooft Escape gedrückt wird, solange `aktiv` gilt. Jeder Escape-Hörer auf Fenster-/Dokumentebene geht hierüber. */
export function useEscape(aktiv: boolean, beiEscape: (e: KeyboardEvent) => void, { ziel = 'window', capture = false }: EscapeOptionen = {}) {
  const neu = useRef(beiEscape)
  neu.current = beiEscape
  useEffect(() => {
    if (!aktiv) return
    const quelle = ziel === 'window' ? window : document
    const taste = (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') neu.current(e as KeyboardEvent)
    }
    quelle.addEventListener('keydown', taste, capture)
    return () => quelle.removeEventListener('keydown', taste, capture)
  }, [aktiv, ziel, capture])
}
