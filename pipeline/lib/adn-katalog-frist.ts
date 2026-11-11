/**
 * Ablauffrist für leere ADN-Antworten und Wache gegen Katalogsprünge (Vorschlag Bauer 3296, 09.11.2026).
 * Eine Antwort ganz ohne Videos entfernt keine Katalogserie (`mitUngepruftenAlten`), blieb aber unbegrenzt. Jetzt zählt `data/adn-leer-folge.json`
 * je Kennung die Läufe in Folge mit leerer Antwort; die zweite streicht die Serie. Jede vollständige Antwort mit Videos setzt den Zähler zurück,
 * Abbruch und „nicht gefragt“ lassen ihn stehen (keine Auskunft).
 */
import { type KatalogAuskunft, mitUngepruftenAlten } from './adn-sprachriegel.ts'

/** Läufe mit leerer Antwort in Folge, ab denen die Serie aus dem Katalog fällt. */
export const LEERE_LAEUFE_BIS_STREICHUNG = 2
/** Größter erlaubter Schwund des Katalogs je Lauf (Anteil der alten Serienzahl). */
export const SCHWUND_GRENZE = 0.05

export type LeerZaehler = Record<string, number>

/** Neuer Zähler (nur Serien des alten Katalogs) und die Kennungen, die diesen Lauf gestrichen werden. */
export function zaehleLeereLaeufe(
  zaehler: Readonly<LeerZaehler>,
  katalogIds: ReadonlySet<number>,
  auskunft: KatalogAuskunft,
): { zaehler: LeerZaehler; gestrichen: number[] } {
  const neu: LeerZaehler = {}
  const gestrichen: number[] = []
  const leer = auskunft.leer ?? new Set<number>()
  for (const id of katalogIds) {
    const alt = zaehler[String(id)] ?? 0
    if (leer.has(id)) {
      if (alt + 1 >= LEERE_LAEUFE_BIS_STREICHUNG) gestrichen.push(id)
      else neu[String(id)] = alt + 1
    } else if (alt > 0 && !auskunft.entschieden.has(id)) neu[String(id)] = alt
  }
  return { zaehler: neu, gestrichen }
}

/** Schwund über der Grenze: rot. Genau 5 % ist noch grün; ein leerer alter Katalog kann nicht schrumpfen. */
export function schrumpftZuStark(alt: number, neu: number): boolean {
  return alt > 0 && (alt - neu) / alt > SCHWUND_GRENZE
}

/** Der neue Katalog mit Ablauffrist, der fortgeschriebene Zähler und die Zeilen für das Laufprotokoll. */
export function katalogMitFrist<T extends { showId: number }>(
  alt: T[],
  frisch: T[],
  auskunft: KatalogAuskunft,
  zaehler: Readonly<LeerZaehler>,
) {
  const fortschritt = zaehleLeereLaeufe(zaehler, new Set(alt.map((s) => s.showId)), auskunft)
  const gestrichen = new Set(fortschritt.gestrichen)
  const leer = new Set([...(auskunft.leer ?? [])].filter((id) => !gestrichen.has(id)))
  const ergebnis = mitUngepruftenAlten(alt, frisch, { ...auskunft, leer })
  const zeilen = [`ADN-Katalog: ${gestrichen.size} Serien nach ${LEERE_LAEUFE_BIS_STREICHUNG} leeren Antworten in Folge gestrichen${gestrichen.size ? ` (${[...gestrichen].join(', ')})` : ''}, ${Object.keys(fortschritt.zaehler).length} mit leerer Antwort vorgemerkt`]
  const rot = schrumpftZuStark(alt.length, ergebnis.shows.length)
  if (rot) zeilen.push(`⚠ ADN-Katalog schrumpft von ${alt.length} auf ${ergebnis.shows.length} Serien (mehr als ${SCHWUND_GRENZE * 100} %) — Lauf rot.`)
  return { ...ergebnis, zaehler: fortschritt.zaehler, gestrichen: gestrichen.size, zeilen, rot }
}
