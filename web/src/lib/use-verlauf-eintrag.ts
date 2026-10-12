import { useEffect, useRef } from 'react'

/**
 * Solange ein Fenster offen ist, steht dafür ein Verlaufseintrag: „Zurück" schließt es, statt die Seite zu verlassen.
 * Ein Zurück zählt nur, wenn der Eintrag weg ist **und** die Adresse dieselbe blieb — die Datenbank schreibt bei jeder
 * Filteränderung `location.hash` und legt damit selbst Einträge an, die das Fenster nicht schließen dürfen.
 */
export function useVerlaufEintrag(offen: boolean, schliessen: () => void): void {
  const zu = useRef(schliessen)
  zu.current = schliessen
  useEffect(() => {
    if (!offen) return
    const href = location.href
    history.pushState({ filter: 1 }, '')
    const zurueck = () => {
      if (!history.state?.filter && location.href === href) zu.current()
    }
    window.addEventListener('popstate', zurueck)
    return () => {
      window.removeEventListener('popstate', zurueck)
      if (history.state?.filter) history.back()
    }
  }, [offen])
}
