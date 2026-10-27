/** Reine Entscheidungen der Bedienung von „Entdecken“ (Tastatur, verzögerte Antwort); die Komponenten rufen sie nur auf. */

export type TastenAktion = 'zurueck'

export interface TastenEreignis {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  /** Tag des Fokusziels (großgeschrieben), leer wenn keins. */
  ziel: string
}

const EINGABEFELD = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** In der Detailansicht löst nur Esc („zurück“) etwas aus; Browserkürzel und Eingabefelder nie. */
export function tasteZuAktion(e: TastenEreignis): TastenAktion | undefined {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return undefined
  if (EINGABEFELD.has(e.ziel)) return undefined
  return e.key === 'Escape' ? 'zurueck' : undefined
}

export interface Verzoegerung {
  start: (tu: () => void, ms: number) => void
  stopp: () => void
}

/** Eine abbrechbare, verzögerte Aktion; ein neuer Start ersetzt die laufende. */
export function baueVerzoegerung(plane: (f: () => void, ms: number) => number, loesche: (h: number) => void): Verzoegerung {
  let handle: number | undefined
  const stopp = () => {
    if (handle !== undefined) loesche(handle)
    handle = undefined
  }
  return {
    start: (tu, ms) => {
      stopp()
      handle = plane(tu, ms)
    },
    stopp,
  }
}

/** Duell „Zurück“: laufende Antwort abbrechen, Wahl löschen, dann eine Antwort zurück. */
export function geheZurueck(zeit: Pick<Verzoegerung, 'stopp'>, loescheWahl: () => void, zurueck: () => void): void {
  zeit.stopp()
  loescheWahl()
  zurueck()
}

/** Führt die zur Taste gehörende Aktion aus; ohne Aktion passiert nichts. */
export function fuehreTasteAus(aktion: TastenAktion | undefined, tun: Record<TastenAktion, () => void>): void {
  if (aktion) tun[aktion]()
}
