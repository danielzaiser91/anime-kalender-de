/**
 * **Prime: regionsgesperrte Folgen sind gelesen, nicht offen** (4.31.15, 24.10.2026, Beyblade Burst S1).
 * Eine gesperrte Folge nennt keine Tonspur und kommt nie nach; sie darf weder „kein Deutsch“ noch
 * die Meldung aufhalten. Reine Entscheidungen, von `amazon.js` (Knopf und Klick) aufgerufen.
 */
{
  /** Gesperrte Folgen: Zählwerk (JSON) oder Kacheln im DOM — beide zählen dieselben, das Größere gilt. */
  globalThis.akPrimeGesperrteZahl = (gesperrtMap, regionFolgenDom) =>
    Math.max(gesperrtMap?.size ?? 0, regionFolgenDom?.length ?? 0)

  /** Ist jede Folge gelesen oder gesperrt? (27 lesbar + 24 gesperrt von 51) */
  globalThis.akPrimeMeldungVollstaendig = (sollFolgen, geladen, gesperrt) =>
    geladen + gesperrt >= sollFolgen

  /** Regionsweg nur, wenn Folgen gesperrt sind und keine lesbare übrig bleibt; ohne Kenntnis der Seitentext. */
  globalThis.akPrimeStaffelRegionWeg = (gesperrt, offen, seitenTextRegionWeg) =>
    gesperrt > 0 || offen > 0 ? gesperrt > 0 && offen === 0 : seitenTextRegionWeg
}
