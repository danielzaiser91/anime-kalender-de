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

/**
 * **Wo der deutsche Ton fehlt — als Aufzählung, nicht als Grenze.**
 *
 * `dubGrenze()` kann nur „ab" und „bis". Das reicht, solange der Ton an einer
 * Stelle umschlägt, und liegt falsch, sobald er es zweimal tut: Bei „Hensuki"
 * sind die Folgen 1 bis 4 und 6 bis 12 deutsch, Folge 5 nicht — die Grenze
 * meldete „bis Folge 4" und unterschlug acht Folgen (27.08.2026).
 *
 * Angezeigt wird der Anbieter trotzdem als deutsch, sobald **eine** Folge es
 * ist (Daniels Entscheidung, 27.08.2026: „de anzeigen ab min 1 folge ist die
 * richtige weise"). Wer es genauer braucht, klappt die Erklärung aus — und die
 * nennt dann diese Folgen.
 *
 * Rückgabe ist die Aufzählung der undeutschen Folgen in Kurzform („5", „5, 9"
 * oder „5–7"), oder null, wenn alles deutsch ist oder nichts bekannt.
 */
export function dubLuecken(ranges: DubBereich[] | undefined): string | null {
  if (!ranges?.length) return null
  const ohne = ranges.filter((r) => !r.dub).sort((a, b) => a.from - b.from)
  if (!ohne.length || ohne.length === ranges.length) return null
  return ohne.map((r) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`)).join(', ')
}
