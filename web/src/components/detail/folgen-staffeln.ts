/**
 * **Staffelabschnitte der Folgenliste** (Daniel, 20.11.2026: „user erwarten aufteilung nach staffel“): Führt die Detaildatei deutsche
 * Staffelgrenzen (`s`, `pipeline/lib/pokemon-staffeln.ts`), zeigt der Kasten je Staffel ihre Folgen und ihren eigenen Deutsch-Stand statt
 * Paketen zu 50. Folgen ohne Titel in der Liste (Horizonte: aniSearch führt 122, die Staffeln reichen bis 137) stehen mit Nummer da.
 */
type Folge = [nr: number, titel: string, minuten?: number]

/** `[Staffel, von, bis]`, die offene letzte Staffel `[Staffel, von]`. */
export type StaffelZeile = [number, number] | [number, number, number]

export type StaffelAbschnitt = { nr: number; von: number; bis: number; offen: boolean; deutsch: number; folgen: Folge[] }

/** Die offene Staffel reicht bis zur höchsten bekannten Folge (Liste oder deutscher Bereich), mindestens bis zu ihrer ersten. */
export function staffelAbschnitte(s: StaffelZeile[] | undefined, f: Folge[], de: [number, number][], istDeutsch: (nr: number) => boolean): StaffelAbschnitt[] {
  if (!s?.length) return []
  const jeNummer = new Map(f.map((x) => [x[0], x]))
  const hoechste = Math.max(0, ...f.map(([nr]) => nr), ...de.map(([, bis]) => bis))
  return s.map(([nr, von, bisBelegt]) => {
    const bis = bisBelegt ?? Math.max(von, hoechste)
    const folgen = Array.from({ length: bis - von + 1 }, (_, i): Folge => jeNummer.get(von + i) ?? [von + i, ''])
    return { nr, von, bis, offen: bisBelegt === undefined, deutsch: folgen.filter(([n]) => istDeutsch(n)).length, folgen }
  })
}

/** „Folge 1–45 · 45 von 45 auf Deutsch“; die offene Staffel ohne „von N“, weil ihr Ende nicht belegt ist. */
export function staffelZeile(a: StaffelAbschnitt): string {
  if (a.offen) return `ab Folge ${a.von} · läuft · ${a.deutsch} auf Deutsch`
  return `Folge ${a.von}–${a.bis} · ${a.deutsch} von ${a.folgen.length} auf Deutsch`
}
