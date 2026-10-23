/**
 * **Eine Adresse mit der Kennung „OmU“ führt die Fassung mit Untertiteln** (Yaiba, 21.10.2026: Akibapass
 * `…/yaiba-samurai-legend-omu-season-1-2` stand als „Sprache offen“ da).
 *
 * Gemessen am 21.10.2026 über 6.597 Adressen in `streams` und `watchLinks`: „omu“ als eigenes Wort im Pfad tragen
 * Akibapass (28 Wege in drei Shops) und aniSearch-Disc-Artikel; „sub“ trägt nur Treffer ohne Aussage
 * (Crunchyroll-Folgenadressen mit belegter Tonspur, „blue-submarine“) und zählt deshalb nicht.
 */
const OMU_IM_PFAD = /(^|[/_-])omu([/_.-]|$)/i

export function adresseIstOmu(url: string | undefined): boolean {
  if (!url) return false
  try {
    return OMU_IM_PFAD.test(decodeURIComponent(new URL(url).pathname))
  } catch {
    return false
  }
}
