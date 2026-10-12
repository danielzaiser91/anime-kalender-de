/**
 * Folgenbereiche mehrerer Handbelege zu einem Weg vereinen. Cartoons werden je Staffel gemeldet (Archer: 16 Belege
 * zu einer Netflix-Adresse); wer nur den letzten übernimmt, verliert die übrigen und mit ihnen das Häkchen der Staffeln.
 */
export type DubBereich = { from: number; to: number; dub: boolean; checked?: number[] }

/** `neu` überlagert `alt`: Wo beide eine Folge nennen, gilt das spätere Urteil samt seiner Meldung (`checked`). */
export function vereinigeBereiche(alt: DubBereich[] | undefined, neu: DubBereich[]): DubBereich[] {
  const jeFolge = new Map<number, { dub: boolean; gemeldet: boolean }>()
  for (const r of [...(alt ?? []), ...neu]) {
    const gemeldet = new Set(r.checked ?? [])
    for (let n = r.from; n <= r.to; n++) jeFolge.set(n, { dub: r.dub, gemeldet: gemeldet.has(n) })
  }
  const folgen = [...jeFolge.keys()].sort((a, b) => a - b)
  const aus: DubBereich[] = []
  for (const n of folgen) {
    const { dub, gemeldet } = jeFolge.get(n)!
    let letzte = aus[aus.length - 1]
    if (letzte && letzte.dub === dub && letzte.to === n - 1) letzte.to = n
    else aus.push((letzte = { from: n, to: n, dub }))
    if (gemeldet) (letzte.checked ??= []).push(n)
  }
  return aus
}

/** Teilwege mit Häkchen zuerst: Ein Ja gilt dem Teilweg, der es trägt (Cartoon-Wege je Staffel, `check:handbelege`). */
export function nimmJa<T extends { dub?: boolean }>(streams: T[]): T[] {
  return [...streams].sort((a, b) => Number(b.dub === true) - Number(a.dub === true))
}
