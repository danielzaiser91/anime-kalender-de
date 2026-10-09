import { createContext, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { sprecherGruppe, type SprecherGruppe, type SprecherIndex } from '@shared/sprecher.ts'
import { loadJson } from './data.ts'
import { baueAuswahl, type SprecherAuswahl } from './sprecher-auswahl.ts'
import type { FilterState } from './filters.ts'

/**
 * Sprecher-Filter der Datenbank — Daten nachladen. Gebaut wird der Index in `pipeline/bau/sprecher-index.ts`:
 * `sprecher.json` (Namen, Titelzahl, Gruppe; gepackt ~20 KB) kommt erst, wenn jemand im Sprecher-Feld tippt;
 * `sprecher/<buchstabe>.json` (Titel je Name, 10–36 KB gepackt) nur für Gruppen, deren Sprecher gewählt oder vorgeschlagen sind.
 * Nichts davon steht in `titles.json`. Die Eingabe verlässt das Gerät nie: abgerufen werden feste Dateien.
 */

/** Titelnamen für die Vorschläge; `SprecherLeiste` stellt sie in der Datenbank bereit. Wo sie fehlen (Kalender), gibt es keinen Sprecher-Filter. */
export const TitelNamenContext = createContext<((id: number) => string | undefined) | undefined>(undefined)

let indexPromise: Promise<SprecherIndex> | undefined
const gruppenPromise = new Map<string, Promise<void>>()
const GRUPPEN = new Map<string, SprecherGruppe>()

/** Ein Fehlschlag bleibt nicht im Zwischenspeicher, sonst wäre „erneut versuchen" wirkungslos. */
function einmal<T>(laden: () => Promise<T>, vergessen: () => void): Promise<T> {
  const p = laden()
  p.catch(vergessen)
  return p
}

export function ladeSprecherIndex(): Promise<SprecherIndex> {
  indexPromise ??= einmal(
    () => loadJson<SprecherIndex>('sprecher.json'),
    () => (indexPromise = undefined),
  )
  return indexPromise
}

/**
 * Gemeinsamer Stand der Gruppen für alle Aufrufer (Titelliste in `App`, Filterfeld, Vorschläge): Ein Abschluss oder Fehler
 * meldet sich bei allen, damit auch die Instanz neu rechnet, die den Abruf nicht selbst angestoßen hat.
 */
let stand = 0
const hoerer = new Set<() => void>()
const FEHLER = new Set<string>()
const abonniere = (h: () => void) => (hoerer.add(h), () => void hoerer.delete(h))
const melde = () => {
  stand++
  hoerer.forEach((h) => h())
}

function holeGruppe(gruppe: string): void {
  if (GRUPPEN.has(gruppe) || gruppenPromise.has(gruppe) || FEHLER.has(gruppe)) return
  gruppenPromise.set(
    gruppe,
    loadJson<SprecherGruppe>(`sprecher/${gruppe}.json`)
      .then((g) => void GRUPPEN.set(gruppe, g))
      .catch(() => void FEHLER.add(gruppe))
      .finally(() => {
        gruppenPromise.delete(gruppe)
        melde()
      }),
  )
}

export interface Laden {
  laedt: boolean
  fehler: boolean
  nochmal: () => void
}

/** Der Sprecher-Index, geholt beim ersten `starten()` (Fokus im Sprecher-Feld). */
export function useSprecherIndex(): Laden & { index?: SprecherIndex; starten: () => void } {
  const [index, setIndex] = useState<SprecherIndex>()
  const [fehler, setFehler] = useState(false)
  const [an, setAn] = useState(false)
  const [versuch, setVersuch] = useState(0)
  useEffect(() => {
    if (!an) return
    let aktiv = true
    setFehler(false)
    ladeSprecherIndex()
      .then((i) => aktiv && setIndex(i))
      .catch(() => aktiv && setFehler(true))
    return () => {
      aktiv = false
    }
  }, [an, versuch])
  const starten = useCallback(() => setAn(true), [])
  return { index, starten, laedt: an && !index && !fehler, fehler, nochmal: () => setVersuch((v) => v + 1) }
}

/** Die angeforderten Gruppen; `gruppe(id)` ist erst nach dem Laden gefüllt, ein Abschluss löst ein neues Rendern aus. */
export function useSprecherGruppen(ids: readonly string[]): Laden & { gruppe: (id: string) => SprecherGruppe | undefined; stand: number } {
  const schluessel = [...new Set(ids)].sort().join('|')
  const jetzt = useSyncExternalStore(abonniere, () => stand)
  useEffect(() => {
    if (schluessel) schluessel.split('|').forEach(holeGruppe)
  }, [schluessel])
  const noetig = schluessel ? schluessel.split('|') : []
  const nochmal = () => {
    noetig.forEach((g) => FEHLER.delete(g))
    noetig.forEach(holeGruppe)
    melde()
  }
  return {
    gruppe: (id) => GRUPPEN.get(id),
    laedt: noetig.some((g) => !GRUPPEN.has(g) && !FEHLER.has(g)),
    fehler: noetig.some((g) => FEHLER.has(g)),
    nochmal,
    stand: jetzt,
  }
}

/** Die Gruppen der gewählten Namen (mit und ohne). */
export function gruppenDer(namen: readonly string[]): string[] {
  return [...new Set(namen.map(sprecherGruppe))]
}

/**
 * Die Auswahl für die Titelliste. Solange die Gruppen unterwegs sind oder fehlen, ist sie leer (`baueAuswahl`) —
 * die Seite zeigt dann „lädt" bzw. den Fehler statt eines Bestands, der den Filter ignoriert.
 */
export function useSprecherAuswahl(f: FilterState): Laden & { auswahl?: SprecherAuswahl } {
  const mit = f.sprecher
  const ohne = f.excluded.sprecher
  const { gruppe, laedt, fehler, nochmal, stand } = useSprecherGruppen(gruppenDer([...mit, ...ohne]))
  const auswahl = useMemo(
    () => baueAuswahl(mit, ohne, (n) => gruppe(sprecherGruppe(n))?.[n]?.map((t) => t.id) ?? (gruppe(sprecherGruppe(n)) ? [] : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stand` zeigt an, dass `gruppe` neue Daten hat
    [mit, ohne, stand],
  )
  return { auswahl, laedt, fehler, nochmal }
}
