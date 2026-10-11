import { useEffect, useState } from 'react'
import { loadDataset, type Dataset } from '../../src/lib/data.ts'

/** Der Datensatz des Falls, so wie ihn die Seite aus den drei Kerndateien aufbaut. */
export function useDatensatz(): Dataset | undefined {
  const [data, setData] = useState<Dataset>()
  useEffect(() => {
    void loadDataset().then(setData)
  }, [])
  return data
}
