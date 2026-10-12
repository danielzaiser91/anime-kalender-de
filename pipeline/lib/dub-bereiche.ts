/**
 * Folgenbereiche mehrerer Handbelege zu einem Weg vereinen. Cartoons werden je Staffel gemeldet (Archer: 16 Belege
 * zu einer Netflix-Adresse); wer nur den letzten übernimmt, verliert die übrigen und mit ihnen das Häkchen der Staffeln.
 */
export type DubBereich = { from: number; to: number; dub: boolean; checked?: number[] }

/**
 * `neu` überlagert `alt`: Wo beide eine Folge nennen, gilt das spätere Urteil samt seiner Meldung (`checked`).
 * `gleichAlt` (Meldungen vom selben Tag): Nennen beide dasselbe Urteil, bleibt das Häkchen beider.
 */
export function vereinigeBereiche(alt: DubBereich[] | undefined, neu: DubBereich[], gleichAlt = false): DubBereich[] {
  const jeFolge = new Map<number, { dub: boolean; gemeldet: boolean }>()
  for (const r of [...(alt ?? []), ...neu]) {
    const gemeldet = new Set(r.checked ?? [])
    for (let n = r.from; n <= r.to; n++) {
      const davor = jeFolge.get(n)
      const behalten = gleichAlt && davor?.dub === r.dub && davor.gemeldet
      jeFolge.set(n, { dub: r.dub, gemeldet: behalten || gemeldet.has(n) })
    }
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

/** Zwei Meldungen vom selben Tag: Ohne Rangfolge gilt bei einer Folge mit Ja und Nein das Nein (kein Ja ohne Beleg). */
export function vereinigeGleichzeitige(a: DubBereich[], b: DubBereich[]): DubBereich[] {
  const alle = [...a, ...b]
  return vereinigeBereiche(
    alle.filter((r) => r.dub),
    alle.filter((r) => !r.dub),
    true,
  )
}

/** Folgen, für die zwei gleich alte Meldungen Ja und Nein sagen. */
export function widerspruechlicheFolgen(a: DubBereich[], b: DubBereich[]): number[] {
  const urteil = (r: DubBereich[], dub: boolean): Set<number> =>
    new Set(r.filter((x) => x.dub === dub).flatMap((x) => Array.from({ length: x.to - x.from + 1 }, (_, i) => x.from + i)))
  const ja = new Set([...urteil(a, true), ...urteil(b, true)])
  return [...new Set([...urteil(a, false), ...urteil(b, false)])].filter((n) => ja.has(n)).sort((x, y) => x - y)
}
