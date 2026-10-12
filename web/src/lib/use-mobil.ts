import { useEffect, useState } from 'react'

const ABFRAGE = '(max-width: 767px)'

/** Handy-Breite (unter Tailwind `md`). Der Anfangswert stimmt schon im ersten Rendern, damit nichts umspringt. */
export function useMobil(): boolean {
  const [mobil, setMobil] = useState(() => window.matchMedia(ABFRAGE).matches)
  useEffect(() => {
    const m = window.matchMedia(ABFRAGE)
    const lesen = () => setMobil(m.matches)
    m.addEventListener('change', lesen)
    lesen()
    return () => m.removeEventListener('change', lesen)
  }, [])
  return mobil
}
