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
  /*
    **Eine Grenze gibt es nur, wenn der Ton genau einmal umschlägt** (Daniel, 23.09.2026:
    „deutsch bis folge 1??"). One Piece auf Netflix: Folge 1 deutsch, 2–33 nicht, 34–61 wieder
    deutsch. Der erste deutsche Block endet bei 1 — „Deutscher Ton bis Folge 1" ist dann eine
    Falschaussage, denn ab 34 gibt es ihn wieder. Bei mehreren Wechseln beantwortet die
    Lücken-Aufzählung (`dubLuecken`) dieselbe Frage richtig, und die steht daneben.
  */
  const wechsel = sortiert.filter((r, i) => i > 0 && r.dub !== sortiert[i - 1]!.dub).length
  if (wechsel > 1) return null
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

/**
 * **Wie viele Folgen sind belegt deutsch — und decken sie die Serie ab?**
 *
 * Der Fall, für den es diese Funktion gibt, ist am 07.09.2026 von Daniel
 * gemeldet worden und war die schwerste Art Fehler, die diese Seite machen
 * kann: eine Falschaussage.
 *
 * „Kill Blue" hat zwölf Folgen. Der ADN-Verweis trug `dub: true` mit
 * `dubRanges: [{ from: 1, to: 4, dub: true }]` — Daniels eigene Prüfung vom
 * 24.08.2026, damals richtig. Im Detail-Panel stand darüber **„Alle 12 Folgen
 * auf Deutsch"**, und auf ADN hat Folge 12 nur Untertitel.
 *
 * **Warum keine der vorhandenen Prüfungen es sah:** `dubLuecken()` sucht
 * Bereiche mit `dub: false`. Hier gibt es keine — die Folgen 5 bis 12 sind
 * schlicht **nicht erfasst**. Für die Aufzählung heißt das „keine Lücke", und
 * die Überschrift las nur `dub === true`.
 *
 * **Nicht erfasst ist nicht dasselbe wie deutsch.** Genau diese Unterscheidung
 * zieht das Projekt an jeder anderen Stelle — „ein unbeantwortetes `undefined`
 * heißt ‚wir wissen es nicht', nicht ‚dort gibt es keine'". In den Bereichen
 * fehlte sie.
 *
 * Rückgabe: die Zahl der belegt deutschen Folgen, und ob sie die Serie
 * abdecken. Ohne Bereiche gilt ein `dub: true` weiterhin für die ganze Serie —
 * das ist der Normalfall und dort auch richtig.
 */
export function dubAbdeckung(
  ranges: DubBereich[] | undefined,
  gesamt: number | undefined,
): { belegt: number; vollstaendig: boolean } {
  if (!ranges?.length) return { belegt: gesamt ?? 0, vollstaendig: true }
  const belegt = ranges
    .filter((r) => r.dub)
    .reduce((n, r) => n + Math.max(0, r.to - r.from + 1), 0)
  /* Ohne bekannte Folgenzahl lässt sich nichts vergleichen — dann keine Aussage. */
  if (!gesamt) return { belegt, vollstaendig: true }
  return { belegt, vollstaendig: belegt >= gesamt }
}

/** Die drei Zustände eines Wegs, jeder als Folgenbereiche. */
export interface DubBild {
  /** Folgen mit deutschem Ton. */
  deutsch: { from: number; to: number }[]
  /** Folgen, die dort liegen, aber nur fremdsprachig. */
  ohneTon: { from: number; to: number }[]
  /** Folgen, die der Anbieter gar nicht führt — nur bekannt, wenn die Folgenzahl es ist. */
  nichtImAngebot: { from: number; to: number }[]
  /** Wie viele Folgen deutschen Ton haben. */
  deutscheFolgen: number
}

/**
 * **Was es auf Deutsch gibt — und was sonst noch bekannt ist.**
 *
 * Die Bereiche kennen drei Zustände, nicht zwei: deutsch (`dub: true`), ohne deutschen Ton
 * (`dub: false`) und **nicht erfasst** — eine Folge, über die kein Bereich etwas sagt. Bei
 * bekannter Folgenzahl ist der dritte Zustand „führt der Anbieter nicht".
 *
 * One Piece auf Netflix zeigt, warum das drei sein müssen (Daniels Handprüfung, 23.09.2026):
 * 1–130 deutsch, 1089–1178 ohne deutschen Ton, 131–1088 stehen dort gar nicht. Wer nur
 * „deutsch" und „nicht deutsch" kennt, macht aus den fehlenden 958 Folgen eine Aussage, die
 * niemand gemessen hat.
 *
 * **Die Reihenfolge der Rückgabe ist die Reihenfolge der Wichtigkeit** (Daniel, 23.09.2026:
 * „die ‚nicht vorhanden' und ‚nicht de' teile, sind weniger interessant, als was es
 * tatsächlich auf de gibt, entsprechend de in fokus und nicht de in tooltip"). Das Label
 * zeigt `deutsch`, der Hinweis daneben den Rest.
 */
export function dubBild(ranges: DubBereich[] | undefined, gesamt: number | undefined): DubBild | null {
  if (!ranges?.length) return null
  const deutsch = ranges.filter((r) => r.dub).sort((a, b) => a.from - b.from)
  const ohneTon = ranges.filter((r) => !r.dub).sort((a, b) => a.from - b.from)
  const deutscheFolgen = deutsch.reduce((n, r) => n + Math.max(0, r.to - r.from + 1), 0)
  const nichtImAngebot: { from: number; to: number }[] = []
  if (gesamt) {
    const erfasst = new Set<number>()
    for (const r of ranges) for (let n = r.from; n <= Math.min(r.to, gesamt); n++) erfasst.add(n)
    for (let n = 1; n <= gesamt; n++) {
      if (erfasst.has(n)) continue
      const letzter = nichtImAngebot[nichtImAngebot.length - 1]
      if (letzter && letzter.to === n - 1) letzter.to = n
      else nichtImAngebot.push({ from: n, to: n })
    }
  }
  return { deutsch, ohneTon, nichtImAngebot, deutscheFolgen }
}

/**
 * Bereiche für ein schmales Label: die ersten, und wie viele noch kommen.
 *
 * „1–2, 4" plus `rest: 2` statt einer Aufzählung, die die Pille sprengt. Wer alle braucht,
 * findet sie im Hinweis daneben — dort steht ohnehin, wie viele Folgen es sind.
 */
export function bereicheGekuerzt(
  bereiche: { from: number; to: number }[],
  hoechstens = 2,
): { text: string; rest: number } {
  return {
    text: bereicheKurz(bereiche.slice(0, hoechstens)),
    rest: Math.max(0, bereiche.length - hoechstens),
  }
}

/** „1–75", „3, 5–7" — die Kurzform, in der Bereiche angezeigt werden. */
export function bereicheKurz(ranges: { from: number; to: number }[]): string {
  return [...ranges]
    .sort((a, b) => a.from - b.from)
    .map((r) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`))
    .join(', ')
}

/**
 * **Welche Folgen kein bekannter Anbieter auf Deutsch führt.**
 *
 * „Dragon Quest: The Adventure of Dai" hat 100 Folgen; der einzige deutsche Weg, die
 * DVD-Box bei Animeversand, enthält 1–75 (Daniel, 16.09.2026: „die restlichen 25 bietet
 * kein uns bekannter anbieter … generische implementierung").
 *
 * Übergeben werden die Bereiche **jedes** deutschen Wegs. Ein Weg ohne Bereiche gilt als
 * vollständig — so, wie `dubAbdeckung()` ihn liest —, und dann fehlt nichts. Rückgabe ist
 * die Kurzform der fehlenden Folgen oder null.
 */
export function folgenOhneAnbieter(
  wege: (DubBereich[] | undefined)[],
  gesamt: number | undefined,
): string | null {
  if (!gesamt || !wege.length || wege.some((w) => !w?.length)) return null
  const da = new Set<number>()
  for (const w of wege) for (const r of w!) if (r.dub) for (let n = r.from; n <= Math.min(r.to, gesamt); n++) da.add(n)
  if (!da.size) return null
  const fehlt: { from: number; to: number }[] = []
  for (let n = 1; n <= gesamt; n++) {
    if (da.has(n)) continue
    const letzter = fehlt[fehlt.length - 1]
    if (letzter && letzter.to === n - 1) letzter.to = n
    else fehlt.push({ from: n, to: n })
  }
  return fehlt.length ? bereicheKurz(fehlt) : null
}
