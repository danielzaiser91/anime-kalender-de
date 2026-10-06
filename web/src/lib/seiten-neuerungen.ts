import { addDays } from '@shared/time.ts'

/**
 * Neuerungen der Seite selbst, die Nutzer merken und nutzen können (Daniel, 06.10.2026: „news könnten auch updates der webseite sein,
 * neue funktionen die mehrwert für die user sind, nicht jede kleinigkeit"). Von Hand gepflegt, neueste zuerst; ein Eintrag ist ein Satz.
 * Aufnehmen, wenn jemand etwas Neues bedienen oder sehen kann — nicht für Korrekturen und Umbauten.
 */
export interface SeitenNeuerung {
  /** ISO-Tag. */
  datum: string
  text: string
  /** Hash-Adresse der Stelle, an der man es sieht („#/datenbank?t=12"). */
  ziel?: string
}

export const SEITEN_NEUERUNGEN: SeitenNeuerung[] = [
  { datum: '2026-10-06', text: 'Newsletter: weitere Geräte verbinden, „Abo beenden“ steht im Kasten „Dein Abo“.', ziel: '#/newsletter' },
  { datum: '2026-10-06', text: 'News: Älteres in 14-Tage-Schritten, gleichförmige „auch bei …“-Meldungen eingeklappt.' },
  { datum: '2026-10-05', text: 'Handlung nennt ihre Quelle mit Link, auch eingeklappt.', ziel: '#/datenbank?t=12' },
  { datum: '2026-10-05', text: 'Lange Serien wie One Piece: Folgenliste, Folgenpfeil und einzelne Disc-Ausgaben.', ziel: '#/datenbank?t=12' },
  { datum: '2026-10-05', text: 'Teile einer Reihe: Mit „ohne Synchro ausblenden“ bleiben nur Teile mit belegter Synchro.', ziel: '#/datenbank?t=210' },
  { datum: '2026-10-04', text: 'Beleg-Dialog: „Zur Fundstelle“ springt zur Textstelle im Bild.' },
]

/** Die jüngsten Neuerungen der letzten `tage` Tage, höchstens `max`. */
export function jungeNeuerungen(heute: string, tage = 30, max = 3): SeitenNeuerung[] {
  const grenze = addDays(heute, -tage)
  return SEITEN_NEUERUNGEN.filter((n) => n.datum >= grenze).slice(0, max)
}
