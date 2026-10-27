import { useEffect, useMemo, useState } from 'react'
import { todayIso } from '@shared/time.ts'
import type { Title } from '@shared/types.ts'
import { loadAllTitles, loadOhneSynchro, loadSynonyme, synonymeFuer, type Dataset } from './data.ts'
import { filterTitles, titelFuerAnsichtGen, type FilterState } from './filters.ts'
import { berechneHinweisGen, type Suchhinweis } from './suchhinweis.ts'
import { titelQuelle } from './titel-quelle.ts'
import { useZeitscheibe } from './use-zeitscheibe.ts'

/** Erst nach einer kurzen Pause im Tippen laden: die Datei der Titel ohne Synchro ist groß (7 MB, gzip 1,7 MB). */
const PAUSE_MS = 600
const MIN_ZEICHEN = 2

function* nichts(): Generator<void, undefined> {
  return undefined
}

export interface Mengen {
  alle: Title[]
  ohne: Title[]
}

/** Die beiden Titelmengen samt Synonymen (dieselben Versprechen wie in der App: jede Datei kommt nur einmal). */
export async function ladeMengen(data: Dataset): Promise<Mengen> {
  const [alle, ohne] = await Promise.all([loadAllTitles(data), loadOhneSynchro(data), loadSynonyme()])
  return { alle, ohne }
}

/** Lädt beide Titelmengen, sobald gesucht wird. */
function useMengen(data: Dataset, suche: string, lade: typeof ladeMengen): Mengen | undefined {
  const [mengen, setMengen] = useState<Mengen>()
  const sucht = suche.trim().length >= MIN_ZEICHEN
  useEffect(() => {
    if (!sucht || mengen) return
    let aktiv = true
    const timer = window.setTimeout(() => {
      void lade(data).then((m) => {
        if (aktiv) setMengen(m)
      })
    }, PAUSE_MS)
    return () => {
      aktiv = false
      window.clearTimeout(timer)
    }
  }, [data, sucht, mengen, lade])
  return mengen
}

export interface HinweisStand {
  data: Dataset
  suche: string
  filters: FilterState
  ohneSynchro: boolean
  gruppiert: boolean
  /** Die Liste, die die Datenbank gerade zeigt. */
  sichtbar: Title[]
  favorites: Set<number>
}

/** Der Hinweis zum Stand der Datenbank; `undefined`, solange nichts gesucht wird, die Mengen laden oder die Rechnung dem Stand hinterherläuft. */
export function useSuchhinweis(s: HinweisStand, lade = ladeMengen): Suchhinweis | undefined {
  const mengen = useMengen(s.data, s.suche, lade)
  const quellen = useMemo(
    () => mengen && { mit: titelQuelle(s.data.titles, mengen.alle, mengen.ohne, true, undefined), ohne: titelQuelle(s.data.titles, mengen.alle, mengen.ohne, false, undefined) },
    [s.data, mengen],
  )
  const aktiv = !!quellen && s.suche.trim().length >= MIN_ZEICHEN
  const { wert, veraltet } = useZeitscheibe(
    () => {
      if (!quellen || !aktiv) return nichts()
      const heute = todayIso()
      return berechneHinweisGen({
        ...quellen,
        sichtbar: s.sichtbar,
        suche: s.suche,
        filters: s.filters,
        ohneSynchro: s.ohneSynchro,
        gruppiert: s.gruppiert,
        synonymeFuer,
        filtere: function* (titel, f) {
          return (yield* titelFuerAnsichtGen(titel, s.data, f, heute, s.favorites, s.gruppiert)).liste
        },
        passtZuFiltern: (t, f) => filterTitles([t], s.data, { ...f, search: '' }, heute, s.favorites).length > 0,
      })
    },
    [quellen, aktiv, s.suche, s.filters, s.ohneSynchro, s.gruppiert, s.sichtbar, s.favorites],
    undefined as Suchhinweis | undefined,
  )
  return aktiv && !veraltet ? wert : undefined
}
