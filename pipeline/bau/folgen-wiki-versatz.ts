/**
 * **Versatz einer Wikipedia-Folgenliste mit durchgehender Gesamtnummer** (20.11.2026): Die Seite „Pokémon (Anime)/Horizonte“
 * nummeriert `NR_GES` über die ganze Reihe (1235–1393), unsere Folgen zählen ab 1. Eine Liste, die nicht bei 1 beginnt,
 * wird um ihre erste Nummer − 1 verschoben — aber nur, wenn die Folgentitel es belegen: mindestens drei deutsche
 * aniSearch-Titel stimmen nach der Verschiebung wörtlich überein, und Abweichungen bleiben die Ausnahme.
 */
type WikiFolge = { nr: number; dt?: string; ead?: string }
type AsFolge = { nr: number; de?: string }

const MIN_GLEICH = 3

/** Die Liste ab Nummer 1, wenn der Versatz belegt ist; sonst unverändert (`versetzt: false`). */
export function ohneWikiVersatz<T extends WikiFolge>(wiki: T[] | undefined, asFolgen: AsFolge[] | undefined): { folgen: T[] | undefined; versetzt: boolean } {
  if (!wiki?.length) return { folgen: wiki, versetzt: false }
  const versatz = Math.min(...wiki.map((w) => w.nr)) - 1
  if (versatz <= 0) return { folgen: wiki, versetzt: false }
  const deAs = new Map(asFolgen?.filter((x) => x.de).map((x) => [x.nr, x.de]))
  let gleich = 0
  let ungleich = 0
  for (const w of wiki) {
    const d = deAs.get(w.nr - versatz)
    if (d !== undefined) (d === w.dt ? gleich++ : ungleich++)
  }
  if (gleich < MIN_GLEICH || gleich <= 4 * ungleich) return { folgen: wiki, versetzt: false }
  return { folgen: wiki.map((w) => ({ ...w, nr: w.nr - versatz })), versetzt: true }
}
