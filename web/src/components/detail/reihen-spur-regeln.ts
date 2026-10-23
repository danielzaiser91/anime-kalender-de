/** Breite einer Karte (Cover 120 px) und Lücke zwischen zwei Karten in der Spur, in CSS-Pixeln. */
export const KARTEN_BREITE = 120
export const KARTEN_LUECKE = 8

/** Cover-Dichte 2: AniList `medium` (230 px) bzw. TMDB w342 — bei 120 CSS-Pixeln auf Handys scharf; die Kachel-Dichte 1,5 lieferte `small` (100 px) hochgezogen. */
export const COVER_DICHTE = 2

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

/** Kennung des scrollenden Panel-Containers (`data-panel`); DetailPanel setzt sie, `useTitelwechsel` sucht sie — eine Quelle, sonst läuft die Suche still ins Leere. */
export const PANEL_KENNUNG = 'titel'

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

/** Ziel eines Pfeilklicks: `richtung` -1 springt zurück, +1 weiter, um `sprungWeite`. */
export function sprungZiel(richtung: 1 | -1, clientWidth: number, wenigerBewegung: boolean): ScrollToOptions {
  return { left: richtung * sprungWeite(clientWidth), behavior: sprungVerhalten(wenigerBewegung) }
}

/** Setzt die Spur beim Öffnen und beim Wechsel des Teils an die Sprungkante des gewählten Teils; ohne gewählte Karte bleibt sie stehen. */
export function setzeStart(spur: { clientWidth: number; scrollLeft: number }, gewaehlt: { offsetLeft: number } | null | undefined): void {
  if (gewaehlt) spur.scrollLeft = startPosition(gewaehlt.offsetLeft, sprungWeite(spur.clientWidth))
}

/** Pfeilklick: scrollt die Spur um eine Sprungweite; `weniger` ist `matchMedia`, damit der Test die Abfrage unterschieben kann. */
export function springeSpur(
  spur: { clientWidth: number; scrollBy: (ziel: ScrollToOptions) => void },
  richtung: 1 | -1,
  weniger: (abfrage: string) => { matches: boolean },
): void {
  spur.scrollBy(sprungZiel(richtung, spur.clientWidth, weniger('(prefers-reduced-motion: reduce)').matches))
}
