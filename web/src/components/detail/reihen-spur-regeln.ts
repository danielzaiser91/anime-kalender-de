/** Breite einer Karte (Cover 120 px) und Lücke zwischen zwei Karten in der Spur, in CSS-Pixeln. */
export const KARTEN_BREITE = 120
export const KARTEN_LUECKE = 8

/** Ab so vielen Zeichen bricht der Name unter dem Cover nach zwei Zeilen ab (13 px in 120 px Breite); dann trägt der Tooltip den vollen Namen. */
const NAME_ZEICHEN_ZWEI_ZEILEN = 28

/** Ein Pfeilklick springt um so viele ganze Karten, wie in die Spur passen — mindestens eine. */
export function sprungWeite(clientWidth: number, kartenBreite = KARTEN_BREITE, luecke = KARTEN_LUECKE): number {
  const schritt = kartenBreite + luecke
  return Math.max(1, Math.floor(clientWidth / schritt)) * schritt
}

/** Pfeile fehlen ganz, wenn nichts überläuft (Toleranz 1 px); am Anfang bzw. Ende ist die jeweilige Richtung aus. */
export function pfeilZustand(scrollLeft: number, clientWidth: number, scrollWidth: number): { versteckt: boolean; zurueckAus: boolean; weiterAus: boolean } {
  return {
    versteckt: scrollWidth <= clientWidth + 1,
    zurueckAus: scrollLeft <= 1,
    weiterAus: scrollLeft + clientWidth >= scrollWidth - 1,
  }
}

/** Die Spur startet an der Sprungkante, die den gewählten Teil enthält — nicht mit ihm am linken Rand. */
export function startPosition(offsetLeft: number, sprung: number): number {
  return Math.floor(offsetLeft / sprung) * sprung
}

/** Der volle Name kommt in den Tooltip, wenn der angezeigte Name unter dem Cover abgeschnitten würde. */
export function brauchtTooltip(angezeigterName: string): boolean {
  return angezeigterName.length > NAME_ZEICHEN_ZWEI_ZEILEN
}

/** Pfeiltaste in der Spur: Index der Nachbarkarte, an den Enden stehen bleiben; andere Tasten ändern nichts (`undefined`). */
export function nachbarKarte(index: number, anzahl: number, taste: string): number | undefined {
  if (taste === 'ArrowRight') return Math.min(index + 1, anzahl - 1)
  if (taste === 'ArrowLeft') return Math.max(index - 1, 0)
  return undefined
}

/**
 * Nach dem Klick auf ein Cover beginnt das Panel wieder oben: Dort scrollt der Panel-Container (`data-panel="titel"`, `fixed inset-y-0 overflow-y-auto`),
 * auf dem Handy wie am Desktop, nicht die Seite. Kein `scrollIntoView` — das scrollte das Panel vor (09.10.2026).
 */
export function panelNachOben(von: { closest: (auswahl: string) => { scrollTop: number } | null }): void {
  const panel = von.closest('[data-panel="titel"]')
  if (panel) panel.scrollTop = 0
}

/** Pixeldichte der Cover: bei „Datensparen" 1, sonst die der Kacheln. */
export function coverDichte(sparen: boolean, kachelDichte: number): number {
  return sparen ? 1 : kachelDichte
}

/**
 * Nur der Pfeilsprung gleitet, und nicht bei „weniger Bewegung". Kein CSS `scroll-behavior: smooth` an der Spur: Es ließe auch die Startposition
 * und jedes `scrollIntoView` (Trefferprobe der Kette) gleiten, die Messung liefe dann mitten in der Bewegung.
 */
export function sprungVerhalten(wenigerBewegung: boolean): 'auto' | 'smooth' {
  return wenigerBewegung ? 'auto' : 'smooth'
}
