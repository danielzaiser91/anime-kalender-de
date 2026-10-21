import { useSyncExternalStore } from 'react'

/** Tailwinds `sm` (40rem, nicht 640px — sonst weichen JS und CSS bei größerer Browserschrift ab): ab hier Desktop-Teile. */
const AB_SM = '(min-width: 40rem)'

function abfrage(): MediaQueryList {
  return window.matchMedia(AB_SM)
}

function abonnieren(melden: () => void): () => void {
  const m = abfrage()
  m.addEventListener('change', melden)
  return () => m.removeEventListener('change', melden)
}

/**
 * Ab `sm`-Breite? Wer Teile nur dort zeigt, rendert sie am Handy gar nicht erst, statt sie mit `hidden sm:flex` zu verstecken —
 * das spart dort DOM und Rechenzeit beim Umschalten (12.10.2026).
 */
export function useAbSm(): boolean {
  return useSyncExternalStore(abonnieren, () => abfrage().matches, () => true)
}
