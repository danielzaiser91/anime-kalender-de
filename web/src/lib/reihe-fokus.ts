import type { FocusEvent } from 'react'

/**
 * Fokus in einer Wischreihe mit `snap-mandatory`: der Browser rastet auf die nächstgelegene Position ein,
 * bei Kacheln von 80 % Breite war das die vorige, und die fokussierte Kachel blieb angeschnitten.
 * Ist die Kachel nicht ganz zu sehen, wird sie an den Anfang der Reihe gelegt (unter Beachtung von `scroll-padding`).
 */
export function kachelAnlegen(e: FocusEvent<HTMLElement>): void {
  const kachel = e.currentTarget
  const reihe = kachel.parentElement
  if (!reihe || reihe.scrollWidth <= reihe.clientWidth) return
  const k = kachel.getBoundingClientRect()
  const r = reihe.getBoundingClientRect()
  if (k.left >= r.left && k.right <= r.right) return
  const rand = parseFloat(getComputedStyle(reihe).scrollPaddingLeft) || 0
  reihe.scrollTo({ left: reihe.scrollLeft + k.left - r.left - rand })
}
