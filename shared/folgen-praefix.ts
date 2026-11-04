/**
 * Der Serienvorsatz in Prime-Folgentiteln: „Eden of the East - Der sorglose Montag“, „Tayo Spielzeit 1 - Tayo verirrt
 * sich“. aniSearch und TMDB führen nur den Teil nach dem Trenner; mit dem Vorsatz trifft kein Titel (03.11.2026: 3 der
 * 20 Anime-Adressen ohne einen einzigen Treffer, 11 + 26 + 26 Folgen).
 */
import type { AnbieterFolge } from './folgen-zuordnung.ts'

/** Gedankenstrich mit Leerzeichen auf beiden Seiten; „Pac-Man“ oder „E0-Zeiten“ trennen nicht. */
const TRENNER = /\s[-–—]\s/

/** Mindestens drei Titel, und so viele (Anteil) müssen den Vorsatz tragen, sonst ist es ein Zufall. */
const MIN_TITEL = 3
const MIN_ANTEIL = 0.8

/** Der Teil vor dem ersten Trenner, klein geschrieben; `null` ohne Trenner. */
function vorsatzVon(titel: string | null): string | null {
  const treffer = titel ? TRENNER.exec(titel) : null
  return treffer ? titel!.slice(0, treffer.index).trim().toLowerCase() : null
}

/** Der Vorsatz, den fast alle Titel der Adresse tragen, sonst `null`. */
function gemeinsamerVorsatz(anbieter: AnbieterFolge[]): string | null {
  const zaehler = new Map<string, number>()
  for (const a of anbieter) {
    const v = vorsatzVon(a.titel)
    if (v) zaehler.set(v, (zaehler.get(v) ?? 0) + 1)
  }
  const [vorsatz, anzahl] = [...zaehler].sort((x, y) => y[1] - x[1])[0] ?? ['', 0]
  return anzahl >= MIN_TITEL && anzahl >= anbieter.length * MIN_ANTEIL ? vorsatz : null
}

/**
 * Dieselbe Liste ohne den gemeinsamen Vorsatz (gleiche Reihenfolge, gleiche Positionen), oder `null`, wenn die Titel
 * keinen gemeinsamen tragen. Titel ohne den Vorsatz bleiben, wie sie sind.
 */
export function ohneSerienVorsatz(anbieter: AnbieterFolge[]): AnbieterFolge[] | null {
  const vorsatz = gemeinsamerVorsatz(anbieter)
  if (!vorsatz) return null
  return anbieter.map((a) => {
    if (vorsatzVon(a.titel) !== vorsatz) return a
    const treffer = TRENNER.exec(a.titel!)!
    return { ...a, titel: a.titel!.slice(treffer.index + treffer[0].length) }
  })
}
