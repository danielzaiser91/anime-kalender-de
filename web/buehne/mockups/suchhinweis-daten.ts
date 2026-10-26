import { useEffect, useState, useSyncExternalStore } from 'react'
import { todayIso } from '@shared/time.ts'
import { loadAllTitles, loadOhneSynchro, loadSynonyme, synonymeFuer } from '../../src/lib/data.ts'
import { filterTitles, type FilterState } from '../../src/lib/filters.ts'
import { titelQuelle } from '../../src/lib/titel-quelle.ts'
import { useDatensatz } from '../ausschnitte/datensatz.ts'
import { nurMitSchalter, zaehleZusatz, type ZusatzTreffer } from './suchhinweis-zaehlen.ts'

/**
 * Die Zahl der Treffer, die nur der Schalter dazuholt. Die Menge ohne Synchro wird erst geladen, wenn gesucht wird
 * (Ladeweg der echten Umsetzung: siehe Bericht); solange sie fehlt oder die Suche nicht zur Zahl passt, kommt `undefined`.
 */
export function useZusatzTreffer(suche: string, filters: FilterState): ZusatzTreffer | undefined {
  const data = useDatensatz()
  const [stand, setStand] = useState<{ suche: string; treffer: ZusatzTreffer }>()
  useEffect(() => {
    if (!data || !suche.trim()) return
    let aktiv = true
    void Promise.all([loadAllTitles(data), loadOhneSynchro(data), loadSynonyme()]).then(([alle, ohne]) => {
      if (!aktiv) return
      const mit = titelQuelle(data.titles, alle, ohne, true, undefined)
      const kandidaten = nurMitSchalter(mit, titelQuelle(data.titles, alle, ohne, false, undefined))
      const treffer = filterTitles(kandidaten, data, filters, todayIso(), new Set())
      setStand({ suche, treffer: zaehleZusatz(treffer, suche, synonymeFuer) })
    })
    return () => {
      aktiv = false
    }
  }, [data, suche, filters])
  return stand?.suche === suche ? stand.treffer : undefined
}

/** Was Kopf, Raster und Leer-Anzeige der Datenbank gemeinsam brauchen; der Kopf trägt es ein, die anderen lesen es. */
export interface HinweisStand {
  suche: string
  filters: FilterState
  ohneSynchro: boolean
  ergebnisse: number
  einschalten: (next: boolean) => void
}

let aktuell: HinweisStand | undefined
const hoerer = new Set<() => void>()

export function merkeStand(neu: HinweisStand): void {
  const gleich = aktuell && aktuell.suche === neu.suche && aktuell.filters === neu.filters && aktuell.ohneSynchro === neu.ohneSynchro && aktuell.ergebnisse === neu.ergebnisse
  aktuell = neu
  if (!gleich) hoerer.forEach((h) => h())
}

export function useHinweisStand(): HinweisStand | undefined {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => aktuell,
  )
}
