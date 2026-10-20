/** Zählt die Fälle, die nicht in Ordnung sind. */
export async function faelleDurchlaufen<F>(faelle: F[], pruefe: (f: F) => Promise<boolean>): Promise<number> {
  let fehler = 0
  for (const f of faelle) {
    if (!(await pruefe(f))) fehler++
  }
  return fehler
}
