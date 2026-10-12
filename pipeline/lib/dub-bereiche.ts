/**
 * Folgenbereiche mehrerer Handbelege zu einem Weg vereinen. Cartoons werden je Staffel gemeldet (Archer: 16 Belege
 * zu einer Netflix-Adresse); wer nur den letzten übernimmt, verliert die übrigen und mit ihnen das Häkchen der Staffeln.
 */
export type DubBereich = { from: number; to: number; dub: boolean; checked?: number[] }

/** `neu` überlagert `alt`: Wo beide eine Folge nennen, gilt das spätere Urteil. */
export function vereinigeBereiche(alt: DubBereich[] | undefined, neu: DubBereich[]): DubBereich[] {
  const jeFolge = new Map<number, boolean>()
  for (const r of [...(alt ?? []), ...neu]) for (let n = r.from; n <= r.to; n++) jeFolge.set(n, r.dub)
  const folgen = [...jeFolge.keys()].sort((a, b) => a - b)
  const aus: DubBereich[] = []
  for (const n of folgen) {
    const dub = jeFolge.get(n)!
    const letzte = aus[aus.length - 1]
    if (letzte && letzte.dub === dub && letzte.to === n - 1) letzte.to = n
    else aus.push({ from: n, to: n, dub })
  }
  return aus
}

/** Teilwege mit Häkchen zuerst: Ein Ja gilt dem Teilweg, der es trägt (Cartoon-Wege je Staffel, `check:handbelege`). */
export function nimmJa<T extends { dub?: boolean }>(streams: T[]): T[] {
  return [...streams].sort((a, b) => Number(b.dub === true) - Number(a.dub === true))
}
