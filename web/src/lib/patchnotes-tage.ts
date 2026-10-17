import type { Patchnote } from '@shared/patchnotes.ts'

export type Filter = 'alles' | Patchnote['kategorie']
export interface PatchTag {
  datum: string
  hl: Patchnote[]
  zeilen: Patchnote[]
  /** Mindestens ein Eintrag des Tages ist noch nicht überarbeitet (Stift an der Überschrift). */
  entwurf: boolean
}

/** Gruppiert nach Tag; je Tag höchstens zwei Highlight-Banner, der Rest sind Zeilen. */
export function tageVon(liste: Patchnote[], filter: Filter): PatchTag[] {
  const tage: PatchTag[] = []
  for (const n of liste) {
    if (filter !== 'alles' && n.kategorie !== filter) continue
    let tag = tage.find((t) => t.datum === n.datum)
    if (!tag) tage.push((tag = { datum: n.datum, hl: [], zeilen: [], entwurf: false }))
    if (n.entwurf) tag.entwurf = true
    if (n.highlight && tag.hl.length < 2) tag.hl.push(n)
    else tag.zeilen.push(n)
  }
  return tage
}
