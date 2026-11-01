/**
 * **Lückenliste der deutschen Folgentitel** (Daniel, 01.11.2026: die Restliste darf nicht verstauben). `data/folgentitel-offen.json` führt je Titelkennung die Zahl
 * der Folgen im deutschen Bereich (`de`) ohne Titel, die keine Stufe füllt, samt Grund. Die Zahl darf nur sinken: mehr Lücken oder ein Titel, der nicht
 * auf der Liste steht, ist eine Warnung; weniger Lücken heißt, die Zeile zu kürzen oder zu streichen.
 */
export interface FolgenDatei {
  f: readonly (readonly [number, string, ...unknown[]])[]
  de: readonly (readonly [number, number])[]
}
export type OffenListe = Record<string, { offen: number; grund: string }>

/** Die Nummern der Folgen im deutschen Bereich, deren Titel leer ist. */
export function leereImDeutschen(d: FolgenDatei): number[] {
  const imBereich = (nr: number) => d.de.some(([von, bis]) => nr >= von && nr <= bis)
  return d.f.filter(([nr, titel]) => !titel && imBereich(nr)).map(([nr]) => nr)
}

export interface Bewertung {
  /** Kennungen mit mehr Lücken als gelistet, samt ungelisteter Titel mit Lücken. */
  mehr: string[]
  /** Gelistete Kennungen mit weniger Lücken (Zeile kürzen) oder keiner (Zeile streichen). */
  weniger: string[]
}

export function bewerteLuecken(ist: Readonly<Record<string, number>>, soll: Readonly<OffenListe>): Bewertung {
  const mehr = Object.entries(ist).filter(([id, n]) => n > (soll[id]?.offen ?? 0)).map(([id]) => id)
  const weniger = Object.entries(soll).filter(([id, s]) => (ist[id] ?? 0) < s.offen).map(([id]) => id)
  return { mehr, weniger }
}

export function summe(zahlen: Readonly<Record<string, number>>): number {
  return Object.values(zahlen).reduce((a, n) => a + n, 0)
}
