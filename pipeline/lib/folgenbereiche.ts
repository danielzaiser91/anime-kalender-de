/**
 * Aus einzelnen Folgenmeldungen zusammenhängende Bereiche bilden.
 *
 * Daniel am 22.08.2026: „melden von 1,3,4,13 müsste reichen, um daraus die
 * infos zu ziehen das 1-3 keine und 4-13 eine synchro haben." Genau das
 * passiert hier — vorher schrieb jede Meldung ein `dub: true/false` für die
 * **ganze** Reihe, und sieben Meldungen zu einer Serie hoben einander auf.
 *
 * **Interpoliert wird nur zwischen zwei gleichen Befunden.** Aus „1 nein" und
 * „3 nein" wird 1–3, weil Synchrongrenzen zusammenhängen. Aus „3 nein" und
 * „6 ja" wird dagegen **nicht** 3–5 nein: Wo die Grenze zwischen 4 und 6 genau
 * liegt, weiß niemand, also bleibt sie offen. Eine geratene Grenze wäre
 * schlimmer als eine fehlende — sie sieht aus wie ein Befund.
 */

/** Eine einzelne Meldung: Folge X hat deutschen Ton, oder eben nicht. */
export interface Folgenmeldung {
  folge: number
  dub: boolean
}

/** Ein zusammenhängender Bereich mit einheitlichem Befund. */
export interface Folgenbereich {
  von: number
  bis: number
  dub: boolean
  /** Die Folgen, für die eine echte Meldung vorliegt — der Rest ist gefolgert. */
  belegt: number[]
}

/**
 * Meldungen zu Bereichen zusammenfassen.
 *
 * Doppelte Meldungen zur selben Folge: die **letzte** gewinnt, weil sie die
 * jüngere Beobachtung ist. Widersprechen sie einander, steht das in
 * `widersprueche` — stillschweigend eine Seite zu wählen wäre falsch.
 */
export function bildeBereiche(meldungen: Folgenmeldung[]): {
  bereiche: Folgenbereich[]
  widersprueche: number[]
} {
  const jeFolge = new Map<number, boolean>()
  const widersprueche: number[] = []
  for (const m of meldungen) {
    if (!Number.isFinite(m.folge) || m.folge < 1) continue
    const vorher = jeFolge.get(m.folge)
    if (vorher !== undefined && vorher !== m.dub && !widersprueche.includes(m.folge)) {
      widersprueche.push(m.folge)
    }
    jeFolge.set(m.folge, m.dub)
  }

  const sortiert = [...jeFolge.entries()].sort((a, b) => a[0] - b[0])
  const bereiche: Folgenbereich[] = []
  for (const [folge, dub] of sortiert) {
    const letzter = bereiche[bereiche.length - 1]
    if (letzter && letzter.dub === dub) {
      letzter.bis = folge
      letzter.belegt.push(folge)
    } else {
      bereiche.push({ von: folge, bis: folge, dub, belegt: [folge] })
    }
  }
  return { bereiche, widersprueche }
}

/**
 * Die Bereiche als ein Satz, den ein Mensch lesen kann.
 *
 * Die Lücken werden benannt, nicht verschwiegen: „4–5 ungeprüft" ist eine
 * Angabe, „1–3 ohne, 6–13 mit" allein sähe nach Vollständigkeit aus.
 */
export function beschreibeBereiche(bereiche: Folgenbereich[]): string {
  const teile: string[] = []
  let vorheriges = 0
  for (const b of bereiche) {
    if (vorheriges && b.von > vorheriges + 1) {
      teile.push(`${vorheriges + 1}–${b.von - 1} ungeprüft`)
    }
    const spanne = b.von === b.bis ? `${b.von}` : `${b.von}–${b.bis}`
    teile.push(`${spanne} ${b.dub ? 'mit' : 'ohne'} deutschen Ton`)
    vorheriges = b.bis
  }
  return teile.join(', ')
}
