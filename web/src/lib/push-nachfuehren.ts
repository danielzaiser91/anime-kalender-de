import { useEffect } from 'react'
import { schreibeTerminFilter } from '@shared/push-filter.ts'
import type { FilterState } from './filters.ts'
import { pushAktivGemerkt, pushFavoritenNachfuehren, pushFilterMerken } from './push.ts'

/** Wartezeit, bis Favoriten- und Filteränderungen gesammelt gehen: `/push/abo` erlaubt 30 Anfragen je Stunde und IP. */
export const NACHFUEHR_PAUSE_MS = 2000

/** Der Teil des Kalenderfilters, den der Push kennt (`shared/push-filter.ts`); `null`, wenn nichts gefiltert wird. */
export const pushFilterWert = (f: FilterState, tvAus: boolean): Record<string, unknown> | null => schreibeTerminFilter({ ...f, tvAus })

/**
 * Hält Favoriten und Filter beim Push-Dienst aktuell, solange Push eingeschaltet ist, damit die Benachrichtigung nur meldet,
 * was der Kalender zeigt. Sitzt in `App`, nicht am Schalter: Der steht im Abo-Menü und ist meist gar nicht geöffnet.
 */
export function usePushNachfuehren(favorites: Set<number>, filter: Record<string, unknown> | null): void {
  const liste = [...favorites].sort((a, b) => a - b).join(',')
  const filterText = JSON.stringify(filter)
  useEffect(() => {
    pushFilterMerken(filter)
    if (!pushAktivGemerkt()) return
    const timer = setTimeout(() => void pushFavoritenNachfuehren(liste ? liste.split(',').map(Number) : [], filter), NACHFUEHR_PAUSE_MS)
    return () => clearTimeout(timer)
    // `filter` ist eine neue Hülle je Aufruf; sein Inhalt steht in `filterText`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste, filterText])
}
