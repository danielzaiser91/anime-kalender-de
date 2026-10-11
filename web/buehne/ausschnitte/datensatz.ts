import { useEffect, useState } from 'react'
import type { Title } from '@shared/types.ts'
import { loadAllTitles, loadDataset, loadOhneSynchro, type Dataset } from '../../src/lib/data.ts'

/** Der Datensatz des Falls, so wie ihn die Seite aus den drei Kerndateien aufbaut. */
export function useDatensatz(): Dataset | undefined {
  const [data, setData] = useState<Dataset>()
  useEffect(() => {
    void loadDataset().then(setData)
  }, [])
  return data
}

/** Die vollständige Titelliste, getrennt nach Titeln mit und ohne Synchro — wie die Datenbank sie nachlädt. */
export function useTitelListen(data: Dataset | undefined): { mit: Title[]; ohne: Title[] } | undefined {
  const [listen, setListen] = useState<{ mit: Title[]; ohne: Title[] }>()
  useEffect(() => {
    if (data) void Promise.all([loadAllTitles(data), loadOhneSynchro(data)]).then(([mit, ohne]) => setListen({ mit, ohne }))
  }, [data])
  return listen
}
