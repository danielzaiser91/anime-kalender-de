import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/** Das Ereignis, mit dem eine Ansicht die Einstellungen öffnen lässt (z. B. der Ecchi-Hinweis in der Datenbank). */
export const EINSTELLUNGEN_EREIGNIS = 'ak-einstellungen'

type Ziel = Pick<Window, 'addEventListener' | 'removeEventListener'>

/** Ruft `oeffnen` bei jedem Ereignis; gibt die Abmeldung zurück. */
export function hoereAufEinstellungen(ziel: Ziel, oeffnen: () => void): () => void {
  ziel.addEventListener(EINSTELLUNGEN_EREIGNIS, oeffnen)
  return () => ziel.removeEventListener(EINSTELLUNGEN_EREIGNIS, oeffnen)
}

/** Ob der Einstellungen-Dialog offen ist; öffnet sich auch auf `EINSTELLUNGEN_EREIGNIS`. */
export function useEinstellungenOffen(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [offen, setOffen] = useState(false)
  useEffect(() => hoereAufEinstellungen(window, () => setOffen(true)), [])
  return [offen, setOffen]
}
