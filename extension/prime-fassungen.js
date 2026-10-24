/**
 * **Prime: die Fassungen eines Films aus „Weitere Versionen verfügbar" (4.32.2, 24.10.2026).**
 *
 * Die Trefferliste kennt nur Suchkarten. „Fischen Impossible" hat drei Fassungen (B0GVNJRZCM KiXi-Kanal,
 * B01HRLV328 Kauf/Leihe, B01MSMV5MA Uncut, in Prime enthalten); die Suche zeigt zwei, die dritte fehlte
 * in der Auswahl. Jede Detailseite führt die jeweils anderen im Hydration-Block unter
 * `init.preparations.body.btf.state.containers.<id>[]` im Container „Weitere Versionen verfügbar"
 * (`entities[]`: `titleID`, `title`, `releaseYear`, `runtime`, `variantMessages`, `entitlementCues`).
 * Gemessen an der gespeicherten Seite B01MSMV5MA (Fixture `prime-fassungen.fixture.json`).
 *
 * Kaufart aus `entitlementCues.focusMessage.message`: „Gratiszeitraum" (mit Kanal-Logo) = Kanal,
 * „Kaufen oder leihen" = Kauf. Eine Prime-Probe lag nicht vor: „Prime" im Text gilt als Prime, ebenso
 * `entitlementType: Entitled` ohne Kanal-Logo.
 */
{
  const ABSCHNITT = 'Weitere Versionen verfügbar'
  /* Prime-enthaltene zuerst, Kanal zuletzt (der Kanal nennt die Sprachen des Kanals, nicht der Folge). */
  const RANG = { prime: 0, kauf: 1, unbekannt: 1, kanal: 2 }

  const text = (v) => String(v ?? '')

  /** Kaufart einer Fassung aus den Angebotshinweisen von Amazon. */
  function kaufart(cues) {
    const meldung = text(cues?.focusMessage?.message || cues?.glanceMessage?.message)
    const kanalLogo = Boolean(cues?.providerLogo?.imageUrl)
    if (/prime/i.test(meldung)) return 'prime'
    if (kanalLogo || /gratis|abo|kanal|channel/i.test(meldung)) return 'kanal'
    if (/kaufen|leihen/i.test(meldung)) return 'kauf'
    return cues?.entitlementType === 'Entitled' ? 'prime' : 'unbekannt'
  }

  /** Die Einträge des Abschnitts im geparsten Hydration-Block; leer, wenn es ihn nicht gibt. */
  function abschnitt(daten) {
    const behaelter = daten?.init?.preparations?.body?.btf?.state?.containers
    for (const reihe of Object.values(behaelter ?? {})) {
      const treffer = Array.isArray(reihe) ? reihe.find((c) => c?.title === ABSCHNITT) : null
      if (Array.isArray(treffer?.entities)) return treffer.entities
    }
    return []
  }

  function fassung(e) {
    const art = kaufart(e.entitlementCues)
    const hinweis = text(e.variantMessages?.[0])
    return {
      kennung: text(e.titleID),
      titel: text(e.title),
      url: `/gp/video/detail/${text(e.titleID)}`,
      zugang: art === 'kanal' ? 'channel' : art,
      kaufart: art,
      jahr: text(e.releaseYear),
      laufzeit: text(e.runtime),
      hinweis,
    }
  }

  /** Eigene Seite als Fassung: Kaufart aus den Zugängen und der Zugangsart, die `amazon.js` schon liest. */
  function eigene(eigen) {
    const abos = Array.isArray(eigen.zugaenge) ? eigen.zugaenge : []
    const art = abos.some((a) => /^prime$/i.test(a))
      ? 'prime'
      : /^kauf/.test(text(eigen.art))
        ? 'kauf'
        : abos.length
          ? 'kanal'
          : 'unbekannt'
    return {
      kennung: text(eigen.kennung),
      titel: text(eigen.titel),
      url: `/gp/video/detail/${text(eigen.kennung)}`,
      zugang: art === 'kanal' ? 'channel' : art,
      kaufart: art,
      jahr: '',
      laufzeit: '',
      hinweis: 'diese Seite',
    }
  }

  /**
   * Fassungen aus dem Hydration-Knoten, Prime-enthaltene vorn (stabil). Ohne den Abschnitt `[]`,
   * sonst samt der eigenen Seite (`eigen.kennung`), damit die Auswahl mindestens zwei Zeilen hat.
   */
  function lesen(knoten, eigen) {
    let daten = null
    try {
      daten = JSON.parse(knoten?.textContent ?? '')
    } catch {
      return []
    }
    const andere = abschnitt(daten).filter((e) => e?.titleID && text(e.titleID) !== text(eigen.kennung))
    if (!andere.length) return []
    const alle = [eigene(eigen), ...andere.map(fassung)]
    return alle.sort((a, b) => RANG[a.kaufart] - RANG[b.kaufart])
  }

  globalThis.akPrimeFassungenLesen = lesen

  const NAME = { prime: 'Prime', kauf: 'Kauf', kanal: 'Kanal', unbekannt: 'Fassung' }

  /** Die Fassungen der Detailseite im Format der Suchkarten (`titel`, `url`, `zugang`) für die Auswahl. */
  globalThis.akPrimeKarten = (dokument, kennung, titel, zugaenge, art) =>
    lesen(dokument.getElementById?.('dv-web-page-hydration-data'), { kennung, titel, zugaenge, art }).map((f) => ({
      ...f,
      titel: `${NAME[f.kaufart]} · ${f.titel} (${f.hinweis})`,
    }))
}
