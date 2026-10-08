/**
 * Entscheidet, was ein Katalog-Lauf holt — rein, damit `check:logic` die Fälle nachstellen kann.
 *
 * Der Frischlauf (`--frisch`) holt immer nur das laufende und die kommenden Jahre plus die jüngsten
 * Kennungen und mergt sie in den vorhandenen Katalog. Ein geänderter Fingerabdruck löst dort nie den
 * Volllauf aus (09.10.2026: der Tageslauf holte zehn Minuten lang ab 1907 und kam nie bei 2026 an);
 * diese Entscheidung gehört dem Wochenlauf. Deshalb behält der Frischlauf Fingerabdruck und fertige
 * Jahre des Katalogs unverändert — der Wochenlauf erkennt den alten Stand dann weiterhin als veraltet.
 */
export interface KatalogStand {
  relFassung?: string
  fertigeJahre?: number[]
}

export interface KatalogPlan {
  /** Frischlauf ohne vorhandenen Katalog: nichts tun (ein Teilkatalog wäre ein falscher Bestand). */
  ueberspringen: boolean
  frisch: boolean
  /** Fingerabdruck des vorhandenen Katalogs weicht ab. */
  veraltet: boolean
  ersteJahr: number
  nachlaufSeiten: number
  /** Fertige Jahre, die der Lauf als erledigt kennt. */
  fertig: number[]
  /** Fingerabdruck, der in die Datei geschrieben wird. */
  relFassung: string | undefined
}

export function planeKatalogLauf(args: {
  vorhanden: KatalogStand | undefined
  frischGewuenscht: boolean
  relFassung: string
  jahr: number
  abJahr: number
  frischSeiten: number
}): KatalogPlan {
  const { vorhanden, frischGewuenscht, relFassung, jahr, abJahr, frischSeiten } = args
  const veraltet = Boolean(vorhanden) && vorhanden?.relFassung !== relFassung
  if (frischGewuenscht) {
    return {
      ueberspringen: !vorhanden,
      frisch: true,
      veraltet,
      ersteJahr: jahr,
      nachlaufSeiten: frischSeiten,
      fertig: vorhanden?.fertigeJahre ?? [],
      relFassung: vorhanden?.relFassung,
    }
  }
  return {
    ueberspringen: false,
    frisch: false,
    veraltet,
    ersteJahr: abJahr,
    nachlaufSeiten: 100,
    fertig: veraltet ? [] : (vorhanden?.fertigeJahre ?? []),
    relFassung,
  }
}
