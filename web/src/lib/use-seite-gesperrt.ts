import { useEffect } from 'react'

/** Wie viele Fenster die Seite gerade sperren: Panel und Beleg-Dialog können gleichzeitig offen sein und in beliebiger Reihenfolge schließen. */
let sperrer = 0

/**
 * Solange ein Fenster über der Seite liegt, bleibt die Seite dahinter stehen und ihre Bildlaufleiste verschwindet.
 * Ohne die Sperre wandert die Seite beim Wischen im Fenster mit, und „Zurück" stellt beim Schließen die alte Stelle her.
 */
export function useSeiteGesperrt(aktiv: boolean): void {
  useEffect(() => {
    if (!aktiv) return
    const html = document.documentElement
    sperrer++
    html.style.overflow = 'hidden'
    return () => {
      sperrer--
      if (sperrer === 0) html.style.overflow = ''
    }
  }, [aktiv])
}
