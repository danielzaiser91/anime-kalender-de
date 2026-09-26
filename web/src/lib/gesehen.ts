import { useState } from 'react'

/**
 * **„Gesehen bis Folge n" — was der Nutzer selbst einträgt** (18.09.2026, Feature-Vergleich:
 * animeschedule.net, Simkl). Die Seite schätzt nichts: Wer mag, trägt seine Folge ein, und es wird
 * gezählt, wie viele deutsche Folgen seither erschienen sind. Nur im Browser gespeichert; die Zahl
 * ist die Folgennummer des Kalenders — derselbe Anbieter, dieselbe Zählung.
 */
const GESEHEN = 'gesehenBis'

export function gesehenLesen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(GESEHEN) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function gesehenSchreiben(titelId: number, n: number | undefined): void {
  const alle = gesehenLesen()
  if (n === undefined) delete alle[titelId]
  else alle[titelId] = n
  try {
    localStorage.setItem(GESEHEN, JSON.stringify(alle))
  } catch {
    /* Gesperrter Speicher: dann gilt es nur für diesen Besuch. */
  }
}

/** Eingetragener Stand eines Titels samt Setzer. */
export function useGesehen(titelId: number): [number | undefined, (n: number | undefined) => void] {
  const [bis, setBis] = useState<number | undefined>(() => gesehenLesen()[titelId])
  const setzen = (n: number | undefined) => {
    gesehenSchreiben(titelId, n)
    setBis(n)
  }
  return [bis, setzen]
}

/** Wie viele Folgen seit dem eingetragenen Stand erschienen sind — 0 ohne Eintrag. */
export function neuSeitGesehen(bis: number | undefined, neueste: number): number {
  return bis === undefined ? 0 : Math.max(0, neueste - bis)
}
