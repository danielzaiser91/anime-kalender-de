/**
 * **Ein Suchfeld für alle Filter** (Daniel, 01.10.2026).
 *
 * Bei 38 Anbietern, 30 Genres und Dutzenden Keywords findet man eine Pille nur noch, wenn man
 * weiß, in welcher Gruppe sie steht. Drei eigene Suchfelder (Genre, Keyword, …) wären drei
 * Gründe, im falschen zu tippen; deshalb durchsucht **ein** Feld in der Klick-Modus-Zeile alle
 * Pillen und blendet aus, was nicht passt.
 *
 * Zwei Regeln, die Daniel vorgegeben hat:
 * - **Ein Bereich ohne Treffer verschwindet** — samt seiner Überschrift.
 * - **Trifft die Suche ein ganzes Wort der Überschrift**, bleibt der ganze Bereich stehen und das
 *   Wort wird hervorgehoben. „der" ist dafür zu häufig: „Sicherheit der Angaben" öffnet sich bei
 *   „Sicherheit" oder „angaben", nicht bei „der".
 */

/** Wörter einer Bereichs-Überschrift, die keinen Bereich aufspannen dürfen. */
const ZU_HAEUFIG = new Set(['der', 'die', 'das', 'und', 'von', 'im', 'in', 'ab', 'an', 'auf', 'für', 'mit', 'ohne', 'nur', 'zu'])

function norm(text: string): string {
  return text.toLocaleLowerCase('de')
}

/** Die Wörter einer Überschrift, „der" & Co. aussortiert. */
export function titelWoerter(label: string): string[] {
  return label
    .split(/[^\p{L}\p{N}]+/u)
    .map(norm)
    .filter((w) => w.length > 0 && !ZU_HAEUFIG.has(w))
}

/** Trifft die Suche ein **ganzes Wort** der Überschrift? */
export function titelTrifft(label: string, query: string): boolean {
  return titelWoerter(label).includes(norm(query))
}

/** Steht die Suche in einem Pillentext? — ein Teilwort genügt („Quellen" trifft „≥2 Quellen"). */
export function pilleTrifft(text: string, query: string): boolean {
  return norm(text).includes(norm(query))
}

export interface BereichsSuche {
  /** Der Suchbegriff, wie er getippt wurde — für die Hervorhebung im Label. */
  query: string
  /** Bleibt der Bereich (samt Überschrift) stehen? */
  bereich: (label: string, pillen: (string | undefined)[]) => boolean
  /** Bleibt diese Pille stehen? */
  zeige: (label: string, text: string) => boolean
}

/** `undefined`, solange nicht gesucht wird — dann gilt überall die normale Ansicht. */
export function bereichsSuche(query: string): BereichsSuche | undefined {
  const q = norm(query.trim())
  if (!q) return undefined
  const label = (l: string) => titelTrifft(l, q)
  const pille = (text: string) => pilleTrifft(text, q)
  return {
    query,
    bereich: (l, pillen) => label(l) || pillen.some((p) => p !== undefined && pille(p)),
    zeige: (l, text) => label(l) || pille(text),
  }
}
