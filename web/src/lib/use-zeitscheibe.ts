import { useEffect, useRef, useState } from 'react'

/** Wie lange ein Stück am Stück rechnen darf, bevor der Hauptfaden wieder frei wird (unter der 50-ms-Grenze für „lange Aufgaben"). */
const BUDGET_MS = 12

type Scheduler = { yield?: () => Promise<void> }

/** Gibt den Hauptfaden frei: Eingaben, Tippen und Zeichnen kommen dazwischen dran. */
function abgeben(): Promise<void> {
  const s = (globalThis as { scheduler?: Scheduler }).scheduler
  return s?.yield ? s.yield() : new Promise((fertig) => setTimeout(fertig, 0))
}

/**
 * **Eine lange Rechnung, die die Seite nie einfriert** (Daniel, 07.10.2026: „kein Webseite-Einfrieren beim Eintippen"; gemessen mit
 * Handy-Drosselung: die Titelsuche blockierte bis zu 3 Sekunden am Stück).
 *
 * `erzeuge` liefert einen Generator, der zwischendurch `yield`et (siehe `sucheGen`). Das Ergebnis erscheint, sobald er fertig ist; bis dahin
 * bleibt das vorige stehen und `laeuft` ist wahr. Ändert sich `abhaengig` währenddessen, wird der alte Lauf verworfen — es rechnet immer
 * nur der jüngste. Ist die Rechnung billig (leere Suche), steht das Ergebnis schon im ersten Durchgang da, ohne Zwischenbild.
 */
export function useZeitscheibe<T>(erzeuge: () => Generator<void, T>, abhaengig: unknown[], leer: T): { wert: T; laeuft: boolean } {
  /* Der erste Lauf beginnt schon beim Anlegen: ist er billig, gibt es nie ein leeres Bild. */
  const erster = useRef<{ gen: Generator<void, T>; fertig?: { wert: T } } | undefined>(undefined)
  const [zustand, setZustand] = useState<{ wert: T; laeuft: boolean }>(() => {
    const gen = erzeuge()
    const r = gen.next()
    erster.current = { gen, fertig: r.done ? { wert: r.value } : undefined }
    return r.done ? { wert: r.value, laeuft: false } : { wert: leer, laeuft: true }
  })
  useEffect(() => {
    let verworfen = false
    const start = erster.current
    erster.current = undefined
    const gen = start?.gen ?? erzeuge()
    if (start?.fertig) return
    void (async () => {
      let von = performance.now()
      for (;;) {
        const r = gen.next()
        if (verworfen) return
        if (r.done) {
          setZustand({ wert: r.value, laeuft: false })
          return
        }
        if (performance.now() - von > BUDGET_MS) {
          setZustand((z) => (z.laeuft ? z : { ...z, laeuft: true }))
          await abgeben()
          if (verworfen) return
          von = performance.now()
        }
      }
    })()
    return () => {
      verworfen = true
    }
    // `erzeuge` ist bei jedem Rendern neu — maßgeblich ist, was in `abhaengig` steht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, abhaengig)
  return zustand
}

/** Ein „Lauf", der sofort fertig ist — für den Zustand, in dem es noch nichts zu rechnen gibt. */
export function* leeresErgebnis<T>(wert: T): Generator<void, T> {
  return wert
}
