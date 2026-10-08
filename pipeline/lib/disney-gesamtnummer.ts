/**
 * Disney+ zählt je Staffel neu; ein Werk unseres Bestands zählt durch.
 *
 * Führt eine Disney+-Adresse mehrere Staffeln (Naruto Shippuden: 53, 59, 54 Folgen), unser
 * Bestand dahinter aber nur **einen** Eintrag (AniList: 500 Folgen), gilt die Gesamtnummer:
 * Folge in der Staffel + Folgen aller Vorstaffeln. Ohne Umrechnung legte `ordneMeldungZu()`
 * die Zählungen übereinander (Fg. 1–59 statt 1–166).
 *
 * Der Versatz kommt aus der Seite (`davor`, Erweiterung ab 4.24.15), nie aus den gemeldeten
 * Folgen — die können unvollständig sein. Fehlt er oder passt die Summe nicht in den Eintrag,
 * bleibt die Meldung unzugeordnet: eine falsche Nummer sieht aus wie ein Befund.
 */
import { ordneMeldungZu, type AnbieterStaffel, type Staffeleintrag } from './folgenbereiche.ts'

/** Spielraum für Bonusfolgen, die der Anbieter mitzählt und AniList nicht (wie in `ordneNachStaffelliste`). */
const SPIELRAUM = 3

export type DisneyStaffel = AnbieterStaffel & {
  /** Folgen aller Vorstaffeln laut Seite; fehlt bei älteren Meldungen und wenn die Seite es nicht hergab. */
  davor?: number | null
  /** Folgen dieser Staffel laut Seite. */
  gesamt?: number | null
}

type Treffer = { staffel: Staffeleintrag; folgeInStaffel: number } | null

/**
 * Gilt nur, wo ein einziger Eintrag mehrere Disney-Staffeln aufnimmt und die Meldung zu Staffel 2
 * oder später gehört. `undefined` heißt: Fall nicht betroffen, der übliche Weg gilt.
 */
export function gesamtnummerDisney(
  meldung: { folge: number; staffel?: number | null },
  unsere: Staffeleintrag[],
  anbieter: DisneyStaffel[],
): Treffer | undefined {
  const nr = Number(meldung.staffel)
  if (unsere.length !== 1 || !Number.isInteger(nr) || nr < 2) return undefined
  const eigene = anbieter.find((s) => s.seq === nr)
  const davor = eigene?.davor
  const gesamt = eigene?.gesamt
  const eintrag = unsere[0]!
  /* Meldungen vor 4.24.15 kennen die Staffelgröße nicht — für sie bleibt alles wie es war. */
  if (!Number.isFinite(gesamt)) return undefined
  /* Hat der Eintrag so viele Folgen wie diese Staffel, ist er diese Staffel (Yozakura: Staffel 2 = 12) — der übliche Weg gilt. */
  if (Math.abs(eintrag.folgen - (gesamt as number)) <= SPIELRAUM) return undefined
  if (!Number.isFinite(davor) || !eintrag.folgen) return null
  /* Die Staffeln bis hierher müssen in den Eintrag passen — sonst meint die Adresse mehr als ihn. */
  if ((davor as number) + (gesamt as number) > eintrag.folgen + SPIELRAUM) return null
  if (meldung.folge < 1 || meldung.folge > (gesamt as number)) return null
  return { staffel: eintrag, folgeInStaffel: meldung.folge + (davor as number) }
}

/** Der Weg einer Meldung auf unseren Eintrag; für Disney+ mit Gesamtnummer, sonst `ordneMeldungZu()`. */
export function ordneMeldungZuPlattform(
  plattform: string,
  meldung: { folge: number; staffel?: number | null },
  unsere: Staffeleintrag[],
  anbieter: DisneyStaffel[],
): Treffer {
  const gesamt = plattform === 'disneyplus' ? gesamtnummerDisney(meldung, unsere, anbieter) : undefined
  return gesamt === undefined ? ordneMeldungZu(meldung, unsere, anbieter) : gesamt
}
