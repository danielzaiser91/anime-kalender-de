import { useEffect, useState, useSyncExternalStore } from 'react'
import { todayIso } from '@shared/time.ts'
import type { Title } from '@shared/types.ts'
import type { Dataset } from '../../src/lib/data.ts'
import { loadAllTitles, loadOhneSynchro, loadSynonyme, synonymeFuer } from '../../src/lib/data.ts'
import { filterTitles, type FilterState } from '../../src/lib/filters.ts'
import { titelQuelle } from '../../src/lib/titel-quelle.ts'
import { findeBlockade, type Blockade } from '../../src/lib/suchhinweis-filter.ts'
import { nurMitSchalter, passtGenau, zaehleZusatz, type ZusatzTreffer } from '../../src/lib/suchhinweis-zaehlen.ts'

/** Was der Hinweis wissen muss: die Treffer, die der Schalter dazuholt, und was den exakten Treffer versteckt. */
export interface Suchhinweis {
  zusatz: ZusatzTreffer
  blockade?: Blockade<Title>
}

/** Passt ein einzelner Titel zu den Filtern? Die Suche bleibt außen vor: „exakt“ ist hier der Name. */
const passtZuFiltern = (data: Dataset) => (t: Title, f: FilterState): boolean => filterTitles([t], data, { ...f, search: '' }, todayIso(), new Set()).length > 0

function berechne(data: Dataset, alle: Title[] | undefined, ohne: Title[] | undefined, stand: HinweisStand): Suchhinweis {
  const mit = titelQuelle(data.titles, alle, ohne, true, undefined)
  const nurSchalter = nurMitSchalter(mit, titelQuelle(data.titles, alle, ohne, false, undefined))
  const zusatz = zaehleZusatz(filterTitles(nurSchalter, data, stand.filters, todayIso(), new Set()), stand.suche, synonymeFuer)
  const ueberSchalter = new Set(nurSchalter.map((t) => t.id))
  const exakte = mit.filter((t) => passtGenau(t, stand.suche, synonymeFuer(t.id))).map((titel) => ({ titel, nurMitSchalter: ueberSchalter.has(titel.id) }))
  return { zusatz, blockade: findeBlockade(exakte, stand.filters, stand.ohneSynchro, passtZuFiltern(data)) }
}

/**
 * Der Hinweis zum Stand der Datenbank. Die Menge ohne Synchro wird erst geladen, wenn gesucht wird
 * (Ladeweg der echten Umsetzung: siehe Bericht); solange sie fehlt oder die Suche nicht zur Zahl passt, kommt `undefined`.
 */
export function useSuchhinweis(stand: HinweisStand | undefined): Suchhinweis | undefined {
  const data = useHinweisDaten()
  const [fertig, setFertig] = useState<{ stand: HinweisStand; hinweis: Suchhinweis }>()
  const suche = stand?.suche ?? ''
  useEffect(() => {
    if (!data || !stand || !suche.trim()) return
    let aktiv = true
    void Promise.all([loadAllTitles(data), loadOhneSynchro(data), loadSynonyme()]).then(([alle, ohne]) => {
      if (aktiv) setFertig({ stand, hinweis: berechne(data, alle, ohne, stand) })
    })
    return () => {
      aktiv = false
    }
  }, [data, suche, stand?.filters, stand?.ohneSynchro])
  const passt = fertig && stand && fertig.stand.suche === stand.suche && fertig.stand.filters === stand.filters && fertig.stand.ohneSynchro === stand.ohneSynchro
  return passt ? fertig.hinweis : undefined
}

/** Was Kopf, Zählzeile und Hinweis der Datenbank gemeinsam brauchen; der Kopf trägt es ein, die anderen lesen es. */
export interface HinweisStand {
  suche: string
  filters: FilterState
  ohneSynchro: boolean
  ergebnisse: number
  einschalten: (next: boolean) => void
  filterAendern: (next: FilterState) => void
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

let appDaten: Dataset | undefined

/**
 * Der Datensatz der laufenden App (das Raster der Datenbank trägt ihn ein). Ein eigener `loadDataset()` wäre ein zweiter Datensatz:
 * `loadOhneSynchro` füllt nur den Index seines ersten Aufrufers, und das Panel der App fände die Titel ohne Synchro nicht („keine Metadaten“).
 */
export function merkeDaten(data: Dataset): void {
  if (appDaten === data) return
  appDaten = data
  hoerer.forEach((h) => h())
}

export function useHinweisDaten(): Dataset | undefined {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => appDaten,
  )
}

/** Der jüngste Stand des Kopfes, auch nach einem Wechsel zwischen Aufruf und Ausführung. */
export const leseStand = (): HinweisStand | undefined => aktuell
