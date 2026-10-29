import { useEffect, useRef } from 'react'

export interface EscapeOptionen {
  /** Wo der Hörer hängt; `window` kommt in der Blasenphase nach `document`. */
  ziel?: 'window' | 'document'
  /** Fangphase, damit der Hörer vor allen anderen läuft. */
  capture?: boolean
}

/** Ein Ziel, an dem ein Hörer hängen kann (`window`, `document`, im Test eine Attrappe). */
export type EscapeQuelle = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/** Offene Ebenen in der Reihenfolge, in der sie aufgegangen sind; die letzte ist die oberste. */
const ebenen: object[] = []

/**
 * Hängt einen Escape-Hörer an `quelle` und gibt die Rücknahme zurück. Escape gilt nur der obersten Ebene (zuletzt geöffnet, egal ob
 * ihr Hörer an `document` oder `window` hängt) und nur, wenn nicht schon jemand es verbraucht hat (`defaultPrevented`, z. B. die
 * Sprecher-Eingabe); wer es nimmt, markiert es mit `preventDefault()`.
 */
export function haengeEscape(quelle: EscapeQuelle, capture: boolean, aufruf: (e: KeyboardEvent) => void): () => void {
  const marke = {}
  ebenen.push(marke)
  const taste = (e: Event) => {
    const k = e as KeyboardEvent
    if (k.key !== 'Escape' || k.defaultPrevented || ebenen[ebenen.length - 1] !== marke) return
    k.preventDefault()
    aufruf(k)
  }
  quelle.addEventListener('keydown', taste, capture)
  return () => {
    quelle.removeEventListener('keydown', taste, capture)
    ebenen.splice(ebenen.indexOf(marke), 1)
  }
}

/** Ruft `beiEscape`, sooft Escape gedrückt wird, solange `aktiv` gilt. Jeder Escape-Hörer auf Fenster-/Dokumentebene geht hierüber (Wächter: `pipeline/check-escape-hoerer.ts`). */
export function useEscape(aktiv: boolean, beiEscape: (e: KeyboardEvent) => void, { ziel = 'window', capture = false }: EscapeOptionen = {}) {
  const neu = useRef(beiEscape)
  neu.current = beiEscape
  useEffect(() => {
    if (!aktiv) return
    return haengeEscape(ziel === 'window' ? window : document, capture, (e) => neu.current(e))
  }, [aktiv, ziel, capture])
}
