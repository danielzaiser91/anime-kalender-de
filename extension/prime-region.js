/**
 * **Prime: regionsgesperrte Folgen sind gelesen, nicht offen** (4.31.17, 24.10.2026, Beyblade Burst S1).
 * Eine gesperrte Folge nennt keine Tonspur und kommt nie nach; sie darf weder „kein Deutsch“ noch
 * die Meldung aufhalten. Reine Entscheidungen, von `amazon.js` (Knopf und Klick) aufgerufen.
 */
{
  /** Gesperrte Folgen: Zählwerk (JSON) oder Kacheln im DOM — beide zählen dieselben, das Größere gilt. */
  globalThis.akPrimeGesperrteZahl = (gesperrtMap, regionFolgenDom) =>
    Math.max(gesperrtMap?.size ?? 0, regionFolgenDom?.length ?? 0)

  /**
   * Wie viele Folgen die Staffel hat, gemessen an dem, was lesbar ist. Die Seitenzahl meint bei Bänden
   * die ganze Staffel (ZEXAL: 96 genannt, 48 erreichbar). Ohne bekannte Abschnitte bleibt die Seitenzahl;
   * der Satz zeigt beim Stillstand dann das Gelieferte (`akPrimeLeseStand`). Sind mindestens zwei Abschnitte
   * bekannt und alle wirklich gelesen (`offen` 0; ein fehlgeschlagener oder unlesbarer Abschnitt bleibt offen),
   * gilt das Gelesene. Sonst die größere Zahl von Zählwerk und Seite.
   */
  globalThis.akPrimeSollFolgen = (gesehen, lautSeite, gelesen) => {
    const genannt = Math.max(gesehen.gesamt || 0, lautSeite || 0)
    const abschnitte = gesehen.abschnitte
    const alleGelesen = abschnitte && abschnitte.gesamt >= 2 && abschnitte.offen === 0
    return alleGelesen && gelesen > 0 ? Math.min(genannt, gelesen) : genannt
  }

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

  /**
   * Der Satz zum Lesestand ohne Deutsch (eine Regel für Ladephase und Stillstand, 25.10.2026). Solange die Seite
   * noch lädt, ist „fehlen N“ wahr; steht sie still (`fertig`), liefert sie nichts nach — bei Bänden nennt Amazon
   * die ganze Staffel (ZEXAL: 96 genannt, 48 erreichbar) —, dann steht nur, was geliefert ist.
   */
  globalThis.akPrimeLeseStand = ({ sollFolgen, geladen, gesperrt, fertig }) =>
    fertig
      ? `${geladen} Folgen gelesen — mehr zeigt die Seite nicht`
      : `${geladen} von ${sollFolgen} Folgen gelesen — für „kein Deutsch" fehlen ${Math.max(0, sollFolgen - geladen - gesperrt)}`

  /** Text und Hinweis, solange „kein Deutsch“ nicht über die ganze Staffel belegt ist (Seite steht still). */
  globalThis.akPrimeKeinDeutschSperre = ({ sollFolgen, geladen, gesperrt, kanal }) => ({
    text: globalThis.akPrimeLeseStand({ sollFolgen, geladen, gesperrt, fertig: true }),
    title: kanal
      ? 'Die übrigen Folgen laufen über ein Kanal-Abo; ohne das nennt Amazon ihre ' +
        'Tonspuren nicht. Ein „kein Deutsch" über die ganze Staffel wäre damit geraten.'
      : `Amazon nennt ${sollFolgen} Folgen, die Seite zeigt weniger (bei geteilten Staffeln liefert sie nur einen Teil). ` +
        '„Deutsch gefunden" gilt sofort — „kein Deutsch" erst, wenn jede Folge gelesen ist.',
  })

  /** Ausstieg des Klicks ohne Senden; der Durchgang erfährt den Grund sofort (`ok: true` = schon gemeldet). */
  globalThis.akPrimeAbweisung = (grund, ok, pfad, am) => ({ pfad, ok, am, abgewiesen: grund })

  /** Nennt `titel` dieselbe Serie wie `seitenTitel`? Verglichen wird der Kern (`kern`), „enthält" genügt. */
  globalThis.akPrimeTitelPasst = (kern, seitenTitel, titel) => {
    const serie = kern(seitenTitel)
    const k = kern(titel)
    return k.length >= 4 && (k === serie || k.includes(serie) || serie.includes(k))
  }

  /**
   * Gehört ein Listeneintrag (`eintraege`: Prüfliste, Erledigtes) zur Serie der Seite? Der Rückfall auf den bisherigen
   * Eintrag gilt nur für einen Staffelwechsel derselben Serie — nach dem Weg zu einem anderen Titel hielt er den der
   * Vorseite fest (Daniel, 07.11.2026). Ohne Seitentitel lässt sich nichts widerlegen.
   */
  globalThis.akPrimeEintragGehoertZurSeite = (kern, seitenTitel, eintraege) =>
    !kern(seitenTitel) ||
    eintraege.some((e) =>
      [e?.serie, e?.titel, ...(e?.eintraege ?? []).map((x) => x?.name)].some((t) => globalThis.akPrimeTitelPasst(kern, seitenTitel, t)),
    )

  /**
   * Weist ab (`abweisen`) und zeigt den Grund vier Sekunden am Knopf — ein Klick ohne Wirkung war stumm (07.11.2026).
   * Danach kommt Text und Hinweis zurück, sofern niemand den Knopf inzwischen neu beschriftet hat.
   */
  globalThis.akPrimeGrundZeigen = (knopf, grund, abweisen) => {
    abweisen(grund)
    const vorher = { text: knopf.textContent, title: knopf.title }
    const jetzt = `⚠ ${grund}`
    knopf.textContent = jetzt
    knopf.title = grund
    setTimeout(() => {
      if (knopf.textContent !== jetzt) return
      knopf.textContent = vorher.text
      knopf.title = vorher.title
    }, 4000)
  }

  /** Antwort des Durchgangs auf eine Abweisung. */
  globalThis.akPrimeAbweisungAntwort = (m) => ({
    ok: m.ok,
    grund: m.ok ? m.abgewiesen : `nicht gesendet: ${m.abgewiesen}`,
  })

  /** Regionsweg nur, wenn Folgen gesperrt sind und keine lesbare übrig bleibt; ohne Kenntnis der Seitentext. */
  globalThis.akPrimeStaffelRegionWeg = (gesperrt, offen, seitenTextRegionWeg) =>
    gesperrt > 0 || offen > 0 ? gesperrt > 0 && offen === 0 : seitenTextRegionWeg
}
