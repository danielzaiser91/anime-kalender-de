/**
 * **Wann zu einer ausgebliebenen Folge recherchiert wird — eine Regel für Lauf und Seite.**
 *
 * Bis zum 15.09.2026 standen die Fristen nur in `pipeline/lib/ausgeblieben.ts`.
 * Daniel dann unter „Folge 9 ist nicht erschienen": „wann war das letzte mal das
 * wir geprüft haben, und wann steht die nächste Prüfung an? Offen
 * kommunizieren". Die Seite muss dafür dieselbe Regel kennen wie der Lauf —
 * zwei Kopien laufen auseinander, also liegt sie hier.
 */

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
/**
 * Der Lauf `claude-verpasst-recherche.yml` startet laut Plan täglich um 11:17 UTC.
 * GitHub startet geplante Läufe oft Stunden später (siehe CLAUDE.md, „Der
 * stündliche Lauf läuft fünfmal am Tag") — die Seite schreibt deshalb
 * „voraussichtlich … ab".
 */
export const RECHERCHE_LAUF_UTC = { stunde: 11, minute: 17 }

export interface OffenerVermerk {
  erwartetAm: string
  erschienenAm?: string | null
  rechercheAm?: string | null
}

/**
 * Ist dieser Vermerk heute eine Recherche wert?
 *
 * Die Frist hängt am Alter des Ausfalls, nicht an der Zahl der Versuche:
 * „20 Stunden" statt „24", damit ein täglicher Lauf, der mal zehn Minuten
 * früher startet, keinen Tag überspringt.
 */
export function rechercheFaellig(v: OffenerVermerk, jetzt: Date): boolean {
  if (v.erschienenAm) return false
  const seit = jetzt.getTime() - new Date(v.erwartetAm).getTime()
  if (!Number.isFinite(seit) || seit < RECHERCHE_AB_MS || seit > RECHERCHE_BIS_MS) return false
  if (!v.rechercheAm) return true
  const takt = seit > RECHERCHE_SPAET_AB_MS ? RECHERCHE_TAKT_SPAET_MS : RECHERCHE_TAKT_FRUEH_MS
  return jetzt.getTime() - new Date(v.rechercheAm).getTime() >= takt
}

/**
 * Wann die nächste Recherche laut Plan startet — `null`, wenn keine mehr kommt.
 *
 * Frühestens sechs Stunden nach dem Termin, frühestens einen Takt nach der
 * letzten Recherche, und nie in der Vergangenheit; dann der nächste geplante
 * Lauf ab diesem Moment. Liegt der hinter der Zwei-Monats-Grenze, ist Schluss.
 */
export function naechsteRecherche(v: OffenerVermerk, jetzt: Date): Date | null {
  if (v.erschienenAm) return null
  const erwartet = new Date(v.erwartetAm).getTime()
  if (!Number.isFinite(erwartet)) return null
  let frueh = erwartet + RECHERCHE_AB_MS
  if (v.rechercheAm) {
    const letzte = new Date(v.rechercheAm).getTime()
    if (Number.isFinite(letzte)) {
      const takt = letzte + RECHERCHE_TAKT_FRUEH_MS - erwartet > RECHERCHE_SPAET_AB_MS ? RECHERCHE_TAKT_SPAET_MS : RECHERCHE_TAKT_FRUEH_MS
      frueh = Math.max(frueh, letzte + takt)
    }
  }
  frueh = Math.max(frueh, jetzt.getTime())
  const d = new Date(frueh)
  const lauf = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), RECHERCHE_LAUF_UTC.stunde, RECHERCHE_LAUF_UTC.minute)
  const naechster = lauf >= frueh ? lauf : lauf + TAG
  return naechster > erwartet + RECHERCHE_BIS_MS ? null : new Date(naechster)
}
