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

/** Wie viele Serien des alten Katalogs im neuen fehlen (brutto: Zugänge verdecken nichts). */
function verloren<T extends { showId: number }>(alt: T[], shows: T[]): number {
  const da = new Set(shows.map((s) => s.showId))
  return alt.filter((s) => !da.has(s.showId)).length
}

/**
 * Der neue Katalog mit Ablauffrist, der fortgeschriebene Zähler und die Zeilen für das Laufprotokoll. Verlöre er brutto mehr als `SCHWUND_GRENZE`
 * (`rot`), wird nichts gestrichen: der Katalog bleibt ungekürzt (Nichtauskunft, etwa ein ausgefallenes Gateway, ist kein Befund), der Zähler läuft weiter.
 */
export function katalogMitFrist<T extends { showId: number }>(
  alt: T[],
  frisch: T[],
  auskunft: KatalogAuskunft,
  zaehler: Readonly<LeerZaehler>,
) {
  const fortschritt = zaehleLeereLaeufe(zaehler, new Set(alt.map((s) => s.showId)), auskunft)
  const leer = new Set([...(auskunft.leer ?? [])].filter((id) => !fortschritt.gestrichen.includes(id)))
  const mitStreichung = mitUngepruftenAlten(alt, frisch, { ...auskunft, leer })
  const fehlt = verloren(alt, mitStreichung.shows)
  const rot = schrumpftZuStark(alt.length, alt.length - fehlt)
  const gestrichen = rot ? [] : fortschritt.gestrichen
  const ergebnis = rot ? mitUngepruftenAlten(alt, frisch, auskunft) : mitStreichung
  const neuerZaehler = { ...fortschritt.zaehler }
  if (rot) for (const id of fortschritt.gestrichen) neuerZaehler[String(id)] = (zaehler[String(id)] ?? 0) + 1
  const zeilen = [`ADN-Katalog: ${gestrichen.length} Serien nach ${LEERE_LAEUFE_BIS_STREICHUNG} leeren Antworten in Folge gestrichen${gestrichen.length ? ` (${gestrichen.join(', ')})` : ''}, ${Object.keys(neuerZaehler).length} mit leerer Antwort vorgemerkt`]
  if (rot) zeilen.push(`⚠ ADN-Katalog verlöre ${fehlt} von ${alt.length} Serien (mehr als ${SCHWUND_GRENZE * 100} %) — nichts gestrichen, Lauf rot.`)
  return { ...ergebnis, zaehler: neuerZaehler, gestrichen: gestrichen.length, zeilen, rot }
}
