import { readJson } from '../lib/util.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'

export function crKatalogUndUsNein({ crDub }: {
  crDub: CrDubData
}) {
  /**
   * Welche Serien der deutsche Katalog mit deutscher Tonspur führt.
   *
   * Nur für die Frage „lohnt ein Verweis überhaupt" — als Sprachbeleg taugt die
   * Liste nicht: Sie gilt der Reihe, nicht der Folge (CLAUDE.md, 22.08.2026).
   */
  const crKatalogDeutsch = new Set(
    (readJson<{ eintraege?: { id?: string; audio?: string[]; tonspuren?: string[] }[] }>('data/cr-katalog-de.json', {})
      .eintraege ?? [])
      .filter((e) => (e.audio ?? e.tonspuren ?? []).includes('de-DE'))
      .map((e) => e.id ?? '')
      .filter(Boolean),
  )
  /**
   * **Ein „nicht mehr verfügbar" aus dem US-Katalog gilt nicht, wo der deutsche Katalog die Serie führt.**
   *
   * Gemessen am 17.09.2026: 109 Serien tragen `nichtVerfuegbar` aus dem Lauf vom
   * 21.08. mit `katalog: us`; 33 davon führt der deutsche Katalog mit deutscher
   * Tonspur — Death Note, One-Punch Man, vier InuYasha-Filme. Der Bau entfernte
   * ihre Verweise trotzdem, und weil sich die Warteschlange des Dub-Laufs aus
   * den Verweisen bildet, kamen sie nie mehr zur Prüfung mit deutschem Zugang.
   * CLAUDE.md sagt es seit dem 22.08.: „Wo eine Serienkennung bekannt ist,
   * entscheidet der Katalog und nicht die Seite." Der Verweis bleibt deshalb
   * ohne Urteil stehen, bis der deutsche Lauf ihn beurteilt.
   *
   * **Nur, wenn es noch keinen deutschen Befund gibt.** 19 der 33 sind unter einer
   * anderen Schreibweise der Adresse längst mit deutschem Zugang geprüft
   * (`/kiss-him-not-me` neben `/de/kiss-him-not-me`); dort entscheidet dieser
   * Befund, und die US-Adresse fliegt wie bisher. Der erste Bau mit der breiten
   * Regel kostete fünf „DE ✓" (Durarara!!, Lupin III. Part 6 …). Übrig bleiben 14.
   */
  let crDeutschGeprueft: Set<string> | undefined
  const usNeinWiderlegt = (serie: { nichtVerfuegbar?: boolean; katalog?: string; seriesId?: string | null }): boolean => {
    if (!serie.nichtVerfuegbar || serie.katalog === 'de' || !serie.seriesId || !crKatalogDeutsch.has(serie.seriesId))
      return false
    /* `crDub` lädt `pruefeSynchroJePlattform` vor dieser Phase. */
    crDeutschGeprueft ??= new Set(
      crDub.serien.filter((c) => c.katalog === 'de' && c.seriesId).map((c) => c.seriesId as string),
    )
    return !crDeutschGeprueft.has(serie.seriesId)
  }
  return { usNeinWiderlegt, crKatalogDeutsch }
}
