import { useEffect } from 'react'

/**
 * Solange ein Fenster über der Seite liegt, bleibt die Seite dahinter stehen und ihre Bildlaufleiste verschwindet.
 * Ohne die Sperre wandert die Seite beim Wischen im Fenster mit, und „Zurück" stellt beim Schließen die alte Stelle her.
 */
export function useSeiteGesperrt(aktiv: boolean): void {
  useEffect(() => {
    if (!aktiv) return
    const html = document.documentElement
    const vorher = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = vorher
    }
  }, [aktiv])
}
