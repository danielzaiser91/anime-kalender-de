/**
 * Wo der deutsche Ton mittendrin aufhört oder anfängt.
 *
 * Liegt hier statt in der Komponente, damit `npm run check:logic` sie prüfen
 * kann: Die Fälle, um die es geht, kommen selten vor und sind gerade deshalb
 * die, in denen ein Denkfehler lange unbemerkt bliebe.
 */

/** Ein Folgenbereich einer Staffel, in **ihrer** Zählung. */
export interface DubBereich {
  from: number
  to: number
  dub: boolean
}

/**
 * Gibt nur etwas zurück, wenn die Staffel **gemischt** ist.
 *
 * Ist sie ganz deutsch oder gar nicht, sagt das Häkchen daneben schon alles,
 * und eine zweite Angabe wäre Lärm — die Regel für Nutzertexte fragt bei jedem
 * Satz, was der Leser anders macht, weil er dasteht. Beim gemischten Fall macht
 * er wirklich etwas anders: Bei Black Clover auf Netflix hört der deutsche Ton
 * nach Folge 155 auf, und wer Folge 160 sehen will, braucht diese eine Zahl.
 */
export function dubGrenze(
  ranges: DubBereich[] | undefined,
): { schluessel: 'detail.dubUntil' | 'detail.dubFrom'; n: number } | null {
  if (!ranges?.length) return null
  const sortiert = [...ranges].sort((a, b) => a.from - b.from)
  const mitDeutsch = sortiert.filter((r) => r.dub)
  if (!mitDeutsch.length || mitDeutsch.length === sortiert.length) return null
  // Fängt es mit Deutsch an, ist die Grenze das Ende des ersten deutschen
  // Blocks; fängt es ohne an, ist sie dessen Anfang.
  return sortiert[0]!.dub
    ? { schluessel: 'detail.dubUntil', n: mitDeutsch[0]!.to }
    : { schluessel: 'detail.dubFrom', n: mitDeutsch[0]!.from }
}
