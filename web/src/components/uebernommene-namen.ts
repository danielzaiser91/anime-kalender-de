import { useEffect, useState } from 'react'
import { loadAllTitles, loadOhneSynchro, type Dataset } from '../lib/data.ts'

/**
 * Namen der übernommenen Titel — nur dann geholt, wenn es welche gibt.
 *
 * Die Newsletter-Seite kennt sonst nur Kennungen. Der vollständige Bestand ist mehrere Megabyte
 * groß und wird nur in diesem seltenen Moment nachgeladen, und nur so weit wie nötig: erst der
 * gepflegte Bestand, und nur wenn danach Kennungen offen sind, die Titel ohne deutsche Synchro.
 */
export function useUebernommeneNamen(uebernommen: number[], data: Dataset): Map<number, string> {
  const [namen, setNamen] = useState<Map<number, string>>(new Map())
  useEffect(() => {
    if (!uebernommen.length) return
    let alive = true
    const sammeln = (quelle: { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string }[]) => {
      if (!alive) return
      setNamen((bisher) => {
        const neu = new Map(bisher)
        for (const t of quelle) {
          if (uebernommen.includes(t.id)) neu.set(t.id, t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`)
        }
        return neu
      })
    }
    sammeln([...data.titleById.values()])
    loadAllTitles(data).then((alle) => {
      sammeln(alle)
      const offen = uebernommen.filter((id) => !alle.some((t) => t.id === id) && !data.titleById.has(id))
      if (offen.length) loadOhneSynchro(data).then(sammeln)
    })
    return () => {
      alive = false
    }
  }, [uebernommen, data])
  return namen
}
