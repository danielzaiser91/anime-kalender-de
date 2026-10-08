import { useEffect, useState } from 'react'
import type { Title } from '@shared/types.ts'
import { loadAllTitles, loadSynonyme, type Dataset } from './data.ts'
import { EMPTY_FILTERS, titelFuerAnsichtGen } from './filters.ts'
import { istOhneBelegteSynchro } from './titel-sortierung.ts'
import { leeresErgebnis, useZeitscheibe } from './use-zeitscheibe.ts'
import { todayIso } from '@shared/time.ts'

const KEINE_FAVORITEN = new Set<number>()
const LEER = { liste: [] as Title[], fundstellen: new Map() }

/**
 * **Wie viele Titel die Datenbank zu diesem Suchbegriff zeigen würde** — ohne die anderen Filter.
 * Die volle Titelliste lädt erst, wenn `aktiv` wird (Vorschau an und Suche nicht leer), nie im Startpfad;
 * sie ist dieselbe, gemerkte Datei wie in der Datenbank. Gerechnet wird in Zeitscheiben.
 * Ergebnis `undefined`, solange noch geladen oder gerechnet wird.
 */
export function useDbTreffer(data: Dataset, suche: string, aktiv: boolean): number | undefined {
  const [alle, setAlle] = useState<Title[]>()
  useEffect(() => {
    if (!aktiv || alle) return
    let verworfen = false
    Promise.all([loadAllTitles(data), loadSynonyme()])
      .then(([titel]) => !verworfen && setAlle(titel))
      .catch(() => undefined)
    return () => {
      verworfen = true
    }
  }, [aktiv, alle, data])
  const { wert, laeuft } = useZeitscheibe(
    () => {
      if (!aktiv || !alle) return leeresErgebnis(LEER)
      const basis = alle.filter((t) => !istOhneBelegteSynchro(t))
      return titelFuerAnsichtGen(basis, data, { ...EMPTY_FILTERS, search: suche }, todayIso(), KEINE_FAVORITEN)
    },
    [aktiv, alle, data, suche],
    LEER,
  )
  return aktiv && alle && !laeuft ? wert.liste.length : undefined
}
