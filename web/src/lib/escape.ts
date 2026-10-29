import { useEffect, useRef } from 'react'

export interface EscapeOptionen {
  /** Wo der Hörer hängt; `window` kommt in der Blasenphase nach `document`. */
  ziel?: 'window' | 'document'
  /** Fangphase, damit der Hörer vor allen anderen läuft. */
  capture?: boolean
}

/**
 * Ruft `beiEscape`, sooft Escape gedrückt wird, solange `aktiv` gilt, und nur wenn nicht schon jemand Escape verbraucht hat
 * (`defaultPrevented`). Jeder Escape-Hörer auf Fenster-/Dokumentebene geht hierüber (Wächter: `pipeline/check-escape-hoerer.ts`).
 * Die oberste Ebene hängt am früheren Ziel: `document` läuft vor `window`, die Fangphase vor beiden.
 */
export function useEscape(aktiv: boolean, beiEscape: (e: KeyboardEvent) => void, { ziel = 'window', capture = false }: EscapeOptionen = {}) {
  const neu = useRef(beiEscape)
  neu.current = beiEscape
  useEffect(() => {
    if (!aktiv) return
    const quelle = ziel === 'window' ? window : document
    const taste = (e: Event) => {
      const k = e as KeyboardEvent
      if (k.key !== 'Escape' || k.defaultPrevented) return
      /* Wer Escape verbraucht, markiert es: die Ebene darunter (Panel hinter Dialog) sieht es und bleibt offen. */
      k.preventDefault()
      neu.current(k)
    }
    quelle.addEventListener('keydown', taste, capture)
    return () => quelle.removeEventListener('keydown', taste, capture)
  }, [aktiv, ziel, capture])
}
