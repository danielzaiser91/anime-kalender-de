/**
 * **Prime: regionsgesperrte Folgen sind gelesen, nicht offen** (4.31.17, 24.10.2026, Beyblade Burst S1).
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

  /**
   * **Eine Regel für Knopf und Klick** (24.10.2026, Dragon Quest: Dai): Der Knopf bot nach 15 s Stillstand
   * „melden“ an, der Klick verlangte die volle Zahl und stieg still aus. Ein „kein Deutsch“ aus einem
   * Ausschnitt entsteht nie; „Deutsch gefunden“ und „nicht abrufbar“ brauchen keine volle Zahl.
   */
  globalThis.akPrimeMeldungErlaubt = ({ nichtAbrufbar, deutsch, sollFolgen, geladen, gesperrt }) =>
    Boolean(nichtAbrufbar || deutsch || globalThis.akPrimeMeldungVollstaendig(sollFolgen, geladen, gesperrt))

  /** Text und Hinweis, solange „kein Deutsch“ nicht über die ganze Staffel belegt ist. */
  globalThis.akPrimeKeinDeutschSperre = ({ sollFolgen, geladen, gesperrt, kanal }) => ({
    text: `${geladen} von ${sollFolgen} Folgen gelesen — für „kein Deutsch" fehlen ${Math.max(0, sollFolgen - geladen - gesperrt)}`,
    title: kanal
      ? 'Die übrigen Folgen laufen über ein Kanal-Abo; ohne das nennt Amazon ihre ' +
        'Tonspuren nicht. Ein „kein Deutsch" über die ganze Staffel wäre damit geraten.'
      : 'Noch nicht alle Abschnitte geladen. „Deutsch gefunden" gilt sofort — ' +
        '„kein Deutsch" erst, wenn jede Folge gelesen ist.',
  })

  /** Ausstieg des Klicks ohne Senden; der Durchgang erfährt den Grund sofort (`ok: true` = schon gemeldet). */
  globalThis.akPrimeAbweisung = (grund, ok, pfad, am) => ({ pfad, ok, am, abgewiesen: grund })

  /** Antwort des Durchgangs auf eine Abweisung. */
  globalThis.akPrimeAbweisungAntwort = (m) => ({
    ok: m.ok,
    grund: m.ok ? m.abgewiesen : `nicht gesendet: ${m.abgewiesen}`,
  })

  /** Regionsweg nur, wenn Folgen gesperrt sind und keine lesbare übrig bleibt; ohne Kenntnis der Seitentext. */
  globalThis.akPrimeStaffelRegionWeg = (gesperrt, offen, seitenTextRegionWeg) =>
    gesperrt > 0 || offen > 0 ? gesperrt > 0 && offen === 0 : seitenTextRegionWeg
}
