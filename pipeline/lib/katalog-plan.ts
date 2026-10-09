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

/**
 * Welche bekannten Katalogeinträge ein Lauf nach Kennung auffrischt: die **ohne Startdatum**. Kein Jahrgang erreicht sie, und der Nachlauf
 * sieht nur die jüngsten Kennungen — „The Boxer" (Kennung 163794, angekündigt ohne Datum) blieb so mit dem Stand vom Anlegen stehen (Platzhalter-Cover, falsches
 * Herkunftsland), obwohl AniList das Cover am 09.10.2026 nachgetragen hatte. Höchstens `grenze` je Lauf, die ältesten Stände zuerst gibt es nicht
 * (der Cache führt keinen Abrufzeitpunkt je Eintrag), deshalb nach Kennung.
 */
export function undatierteKennungen(eintraege: { id: number; start?: string | null }[], grenze = 1000): number[] {
  return eintraege.filter((e) => !e.start).map((e) => e.id).sort((a, b) => a - b).slice(0, grenze)
}
