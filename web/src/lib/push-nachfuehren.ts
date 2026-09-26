import { useEffect } from 'react'
import { pushAktivGemerkt, pushFavoritenNachfuehren } from './push.ts'

/**
 * Hält die Favoriten beim Push-Dienst aktuell, solange Push eingeschaltet ist. Sitzt in `App`,
 * nicht am Schalter: Der steht im Abo-Menü und ist meist gar nicht geöffnet.
 */
export function usePushNachfuehren(favorites: Set<number>): void {
  const liste = [...favorites].sort((a, b) => a - b).join(',')
  useEffect(() => {
    if (pushAktivGemerkt()) void pushFavoritenNachfuehren(liste ? liste.split(',').map(Number) : [])
  }, [liste])
}
