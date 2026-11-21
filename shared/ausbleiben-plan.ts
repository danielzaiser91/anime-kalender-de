/**
 * **Wann zu einem fälligen oder ausgebliebenen Termin wieder nachgesehen wird — eine Tabelle für Lauf und Seite.**
 *
 * Jede Prüfart hat Stufen: Je älter der Termin, desto größer der Abstand zwischen zwei Prüfungen.
 * Neue Prüfungen (Suche, Social) docken mit einer Zeile in `STUFEN` an, nicht mit eigenem Zeitplan.
 * Der Abstand zählt immer vom ursprünglich angekündigten Zeitpunkt des Termins.
 */

import { abstandSeitTermin, terminZustand, type TerminFelder } from './termin-zustand.ts'

const MINUTE = 6e4
const STUNDE = 36e5
const TAG = 24 * STUNDE

/** Unter diesem Verzug wird nicht recherchiert — die meisten Fälle erledigen sich vorher. */
export const RECHERCHE_AB_MS = 6 * STUNDE
/** Täglich in den ersten zwei Wochen … */
export const RECHERCHE_TAKT_FRUEH_MS = 20 * STUNDE
/** … danach wöchentlich: Wer zwei Wochen nichts meldet, meldet selten am dritten Tag. */
export const RECHERCHE_TAKT_SPAET_MS = 6.5 * TAG
export const RECHERCHE_SPAET_AB_MS = 14 * TAG
/** Nach zwei Monaten ohne Folge sucht niemand mehr täglich — der Vermerk bleibt stehen. */
export const RECHERCHE_BIS_MS = 60 * TAG

/** Ab diesem Verzug gilt ein Termin als ausgeblieben (Karenz: ein Anbieter stellt selten auf die Sekunde ein); `terminFrist` liest ihn. */
export const AUSBLEIBEN_NACH_MS = 15 * MINUTE

/**
 * Frühestens ab diesem Verzug darf der Messer (`ausbleiben-messen.ts`) „ausgeblieben“ sagen: Der Zwischenspeicher der Folgenliste
 * war im Probelauf 18.11.2026 bis 22 min alt (1320 s), dazu 4 min Reserve. Gilt für die Zeit der Lesung, nicht für die Uhr.
 */
export const MESSER_AUSBLEIBEN_FRUEHESTENS_MS = 26 * MINUTE

export type PruefArt = 'sichtung' | 'recherche' | 'abgleich-anime2you'

/** Von `vonMs` bis `bisMs` nach dem Termin wird alle `taktMs` geprüft. */
export interface Stufe {
  vonMs: number
  bisMs: number
  taktMs: number
}

/**
 * Sichtung beim Anbieter (Katalog): 5 Minuten, weil der Katalog bis zu 3 Minuten alt sein darf (Cache der Gegenseite);
 * danach gröber. „Bis Tagesende“ ist hier ein fester Tag nach dem Termin.
 */
export const STUFEN: Record<PruefArt, Stufe[]> = {
  sichtung: [
    { vonMs: 0, bisMs: 15 * MINUTE, taktMs: 5 * MINUTE },
    { vonMs: 15 * MINUTE, bisMs: STUNDE, taktMs: 15 * MINUTE },
    { vonMs: STUNDE, bisMs: 2 * STUNDE, taktMs: 30 * MINUTE },
    { vonMs: 2 * STUNDE, bisMs: TAG, taktMs: STUNDE },
    { vonMs: TAG, bisMs: 2 * TAG, taktMs: 2 * STUNDE },
    { vonMs: 2 * TAG, bisMs: RECHERCHE_BIS_MS, taktMs: TAG },
  ],
  recherche: [
    { vonMs: RECHERCHE_AB_MS, bisMs: RECHERCHE_SPAET_AB_MS, taktMs: RECHERCHE_TAKT_FRUEH_MS },
    { vonMs: RECHERCHE_SPAET_AB_MS, bisMs: RECHERCHE_BIS_MS, taktMs: RECHERCHE_TAKT_SPAET_MS },
  ],
  /** Anime2You-Meldungen zu einem Vermerk: bei jedem Lauf, solange der Vermerk offen ist (Stand 17.11.2026, ohne Altersgrenze). */
  'abgleich-anime2you': [{ vonMs: AUSBLEIBEN_NACH_MS, bisMs: Infinity, taktMs: 0 }],
}

/** Der Takt der Stufe, in der `abstandMs` liegt; `null` vor der ersten und nach der letzten Stufe. */
export function taktFuer(art: PruefArt, abstandMs: number): number | null {
  const stufe = STUFEN[art].find((s) => abstandMs >= s.vonMs && abstandMs < s.bisMs)
  return stufe ? stufe.taktMs : null
}

/**
 * Wann die nächste Prüfung ansteht (ms seit Epoche); `null`, wenn keine mehr kommt.
 * Nie vor `jetzt`; ohne frühere Prüfung zählt der Beginn der ersten Stufe.
 */
export function naechstePruefung(art: PruefArt, terminMs: number, letzteMs: number | undefined, jetztMs: number): number | null {
  const stufen = STUFEN[art]
  let frueh = terminMs + stufen[0].vonMs
  if (letzteMs !== undefined) {
    const takt = taktFuer(art, Math.max(letzteMs - terminMs, stufen[0].vonMs))
    if (takt === null) return null
    frueh = Math.max(frueh, letzteMs + takt)
  }
  frueh = Math.max(frueh, jetztMs)
  return frueh - terminMs < stufen[stufen.length - 1].bisMs ? frueh : null
}

/** Ist diese Prüfung jetzt dran? Ohne frühere Prüfung sofort, sobald die erste Stufe beginnt. */
export function pruefungFaellig(art: PruefArt, terminMs: number, letzteMs: number | undefined, jetztMs: number): boolean {
  const abstand = jetztMs - terminMs
  const takt = taktFuer(art, abstand)
  if (takt === null) return false
  return letzteMs === undefined || jetztMs - letzteMs >= takt
}

/** Alle Arten, die zu diesem Termin jetzt dran sind (`letzte`: Zeitpunkt der letzten Prüfung je Art). */
export function faelligeArten(terminMs: number, letzte: Partial<Record<PruefArt, number>>, jetztMs: number): PruefArt[] {
  return (Object.keys(STUFEN) as PruefArt[]).filter((art) => pruefungFaellig(art, terminMs, letzte[art], jetztMs))
}

/** Wie die Seite einen fälligen Termin nennt: erst „wird geprüft“, dann „noch nicht gesehen“ — nie „nicht erschienen“, das wüsste nur der Anbieter. */
export type WortStufe = 'wird-geprueft' | 'verspaetet'

export const WORT_VERSPAETET_AB_MS = 5 * MINUTE

export function wortStufe(abstandMs: number): WortStufe {
  return abstandMs >= WORT_VERSPAETET_AB_MS ? 'verspaetet' : 'wird-geprueft'
}

/** Das Wort für einen fälligen Termin; `undefined`, wenn er nicht fällig ist (angekündigt, erschienen, ausgeblieben). */
export function faelligWort(e: TerminFelder, jetzt: Date): WortStufe | undefined {
  return terminZustand(e, jetzt) === 'faellig' ? wortStufe(abstandSeitTermin(e, jetzt)) : undefined
}
