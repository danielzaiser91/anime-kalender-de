import { createContext, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { SprecherGruppe, SprecherIndex, SprecherTitel } from '@shared/sprecher.ts'
import { loadJson } from './data.ts'
import { baueAuswahl, type SprecherAuswahl } from './sprecher-auswahl.ts'
import type { FilterState } from './filters.ts'

/**
 * Sprecher-Filter der Datenbank — Daten nachladen. Gebaut wird der Index in `pipeline/bau/sprecher-index.ts`:
 * `sprecher.json` (Namen, Titelzahl, Gruppe; gepackt ~20 KB) kommt erst, wenn jemand im Sprecher-Feld tippt;
 * `sprecher/<gruppe>.json` (Titel je Name, bis 51 KB gepackt, Stand 11.10.2026) nur für Gruppen, deren Sprecher gewählt oder vorgeschlagen sind.
 * Welche Gruppe zu einem Namen gehört, steht im Index (dritter Wert je Eintrag), nicht in einer Regel hier — so bleibt jeder Datenstand lesbar.
 * Nichts davon steht in `titles.json`. Die Eingabe verlässt das Gerät nie: abgerufen werden feste Dateien.
 */

/** Titelnamen für die Vorschläge; `SprecherLeiste` stellt sie in der Datenbank bereit. Wo sie fehlen (Kalender), gibt es keinen Sprecher-Filter. */
export const TitelNamenContext = createContext<((id: number) => string | undefined) | undefined>(undefined)

let indexPromise: Promise<SprecherIndex> | undefined
const gruppenPromise = new Map<string, Promise<void>>()
const GRUPPEN = new Map<string, SprecherGruppe>()
/** Gruppe je Name, gefüllt mit dem Index; `indexDa` sagt, ob er schon geladen ist. */
const GRUPPE_VON = new Map<string, string>()
let indexDa = false
/** Schlüssel im Fehlerzustand für den Index selbst (Gruppen heißen nie so). */
const INDEX_FEHLER = '*'

/** Ein Fehlschlag bleibt nicht im Zwischenspeicher, sonst wäre „erneut versuchen" wirkungslos. */
function einmal<T>(laden: () => Promise<T>, vergessen: () => void): Promise<T> {
  const p = laden()
  p.catch(vergessen)
  return p
}

function merkeGruppen(index: SprecherIndex): SprecherIndex {
  for (const [name, , gruppe] of index.sprecher) GRUPPE_VON.set(name, gruppe)
  indexDa = true
  return index
}

export function ladeSprecherIndex(): Promise<SprecherIndex> {
  indexPromise ??= einmal(
    () => loadJson<SprecherIndex>('sprecher.json').then(merkeGruppen),
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

/** Holt für die Namen erst den Index (Name → Gruppe), dann die Gruppen. */
function holeFuer(namen: readonly string[]): void {
  if (!indexDa) {
    ladeSprecherIndex().then(
      () => {
        holeFuer(namen)
        melde()
      },
      () => {
        FEHLER.add(INDEX_FEHLER)
        melde()
      },
    )
    return
  }
  gruppenDer(namen).forEach(holeGruppe)
}

function gruppenDer(namen: readonly string[]): string[] {
  return [...new Set(namen.map((n) => GRUPPE_VON.get(n)).filter((g): g is string => g !== undefined))]
}

/** Die Titel eines Sprechers; `undefined`, solange Index oder Gruppe fehlen. Ein Name ohne Eintrag (veralteter Link) hat keine Titel. */
function titelVon(name: string): SprecherTitel[] | undefined {
  if (!indexDa) return undefined
  const gruppe = GRUPPE_VON.get(name)
  if (gruppe === undefined) return []
  const inhalt = GRUPPEN.get(gruppe)
  return inhalt ? (inhalt[name] ?? []) : undefined
}

/** Die Gruppen der angeforderten Namen; `titel(name)` ist erst nach dem Laden gefüllt, ein Abschluss löst ein neues Rendern aus. */
export function useSprecherGruppen(namen: readonly string[]): Laden & { titel: (name: string) => SprecherTitel[] | undefined; stand: number } {
  const schluessel = [...new Set(namen)].sort().join('\n')
  const jetzt = useSyncExternalStore(abonniere, () => stand)
  useEffect(() => {
    if (schluessel) holeFuer(schluessel.split('\n'))
  }, [schluessel])
  const noetig = schluessel ? schluessel.split('\n') : []
  const gruppen = indexDa ? gruppenDer(noetig) : []
  const indexFehler = FEHLER.has(INDEX_FEHLER)
  const nochmal = () => {
    FEHLER.delete(INDEX_FEHLER)
    gruppen.forEach((g) => FEHLER.delete(g))
    if (noetig.length) holeFuer(noetig)
    melde()
  }
  return {
    titel: titelVon,
    laedt: noetig.length > 0 && !indexFehler && (!indexDa || gruppen.some((g) => !GRUPPEN.has(g) && !FEHLER.has(g))),
    fehler: indexFehler || gruppen.some((g) => FEHLER.has(g)),
    nochmal,
    stand: jetzt,
  }
}

/**
 * Die Auswahl für die Titelliste. Solange die Gruppen unterwegs sind oder fehlen, ist sie leer (`baueAuswahl`) —
 * die Seite zeigt dann „lädt" bzw. den Fehler statt eines Bestands, der den Filter ignoriert.
 */
export function useSprecherAuswahl(f: FilterState): Laden & { auswahl?: SprecherAuswahl } {
  const mit = f.sprecher
  const ohne = f.excluded.sprecher
  const { titel, laedt, fehler, nochmal, stand } = useSprecherGruppen([...mit, ...ohne])
  const auswahl = useMemo(
    () => baueAuswahl(mit, ohne, (n) => titel(n)?.map((t) => t.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stand` zeigt an, dass `titel` neue Daten hat
    [mit, ohne, stand],
  )
  return { auswahl, laedt, fehler, nochmal }
}
