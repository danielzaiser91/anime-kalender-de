import type { Antwort } from '@shared/empfehlung-kern.ts'

/** Ablauf einer Duell-Antwort ohne React: Sperre, Zeitplan und Wechsel erst, wenn die nächsten Bilder fertig sind. */

export type DuellSchritt = 'bereit' | 'stoss' | 'abgang' | 'fall' | 'blende' | 'warten' | 'herein'

/** Aufprall in der Mitte. */
export const STOSS_MS = 150
/** Sieger federt zurück, Verlierer fällt. */
export const ABGANG_MS = 350
/** Neue Karten gleiten herein. */
export const HEREIN_MS = 350
/** Kurze Überblendung bei reduzierter Bewegung. */
export const BLENDE_MS = 150
/** Länger als das wartet das Duell nicht auf Bilder; die Karten laden dann sichtbar nach, nie mit dem alten Bild. */
export const LADEN_MAX_MS = 5000

export interface DuellSteuerung {
  /** Nimmt die Wahl nur an, wenn nichts läuft; sonst false und keine Wirkung. */
  waehle: (antwort: Antwort, ladeNaechste: () => Promise<void>) => boolean
  /** Bricht einen laufenden Ablauf ab und gibt die Eingabe frei. */
  abbrechen: () => void
  schritt: () => DuellSchritt
}

interface Optionen {
  plane: (f: () => void, ms: number) => number
  loesche: (h: number) => void
  /** Wird bei jedem Wechsel des Schritts gerufen (für die Anzeige). */
  meldeSchritt: (s: DuellSchritt) => void
  /** Übernimmt die Antwort; ab hier stehen die neuen Karten. */
  wechsle: (antwort: Antwort) => void
  reduziert: () => boolean
}

export function baueDuellSteuerung(o: Optionen): DuellSteuerung {
  let schritt: DuellSchritt = 'bereit'
  let lauf = 0
  let handles: number[] = []
  const setze = (s: DuellSchritt) => {
    schritt = s
    o.meldeSchritt(s)
  }
  const plane = (f: () => void, ms: number) => void handles.push(o.plane(f, ms))
  const abbrechen = () => {
    lauf++
    handles.forEach(o.loesche)
    handles = []
    if (schritt !== 'bereit') setze('bereit')
  }
  const waehle = (antwort: Antwort, ladeNaechste: () => Promise<void>): boolean => {
    if (schritt !== 'bereit') return false
    const mein = ++lauf
    let animationFertig = false
    let bilderFertig = false
    let gewechselt = false
    const versuch = () => {
      if (mein !== lauf || gewechselt || !animationFertig || !bilderFertig) return
      gewechselt = true
      setze('herein')
      o.wechsle(antwort)
      plane(() => setze('bereit'), o.reduziert() ? BLENDE_MS : HEREIN_MS)
    }
    const animationEnde = () => {
      animationFertig = true
      if (!bilderFertig) setze('warten')
      versuch()
    }
    const bilderDa = () => {
      bilderFertig = true
      versuch()
    }
    if (o.reduziert()) {
      setze('blende')
      plane(animationEnde, BLENDE_MS)
    } else if (antwort === 'N') {
      setze('fall')
      plane(animationEnde, ABGANG_MS)
    } else {
      setze('stoss')
      plane(() => setze('abgang'), STOSS_MS)
      plane(animationEnde, STOSS_MS + ABGANG_MS)
    }
    plane(bilderDa, LADEN_MAX_MS)
    ladeNaechste().then(bilderDa, bilderDa)
    return true
  }
  return { waehle, abbrechen, schritt: () => schritt }
}
