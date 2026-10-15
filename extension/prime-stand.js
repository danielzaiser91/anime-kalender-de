/*
  **Der Prime-Stand aus dem Briefkasten** (4.31.2, 15.10.2026).

  `amazon.js` holte ihn bis 4.31.1 über `GET /pruefung?token=…` — die ungecachte Liste der offenen
  Meldungen. Jeder Prime-Seitenaufruf las damit rund 36.000 D1-Zeilen, im Durchgang 2,7 Mio. je
  Stunde (D1-Insights, 15.10.2026). Jetzt kommt er aus `?zaehlen=1&nummern=1`: dieselben offenen
  Meldungen (ohne die 500er-Grenze der Token-Liste), zwei Stunden im Edge-Cache und mit derselben
  Adresse, die `disney.js` schon abruft.

  Die Antwort trägt je Meldung nur Adresse, Staffel und Folgennummer. Der Befund (🇩🇪/✕) fehlt dort;
  die Staffel steht deshalb als „✓" (gemeldet). Lokale Meldungen behalten ihren Befund, weil
  `vereinige()` in `amazon.js` den lokalen Wert vorgehen lässt.
*/

/** Meldungen `{ url, folge_nr, staffel }` → je Prime-Kennung die gemeldeten Staffeln, wie `erledigt` sie führt. */
globalThis.akPrimeStandAusBriefkasten = (eintraege) => {
  const jeAdresse = {}
  for (const e of eintraege ?? []) {
    // Nur Prime-Adressen tragen eine solche Kennung; Disney+, Netflix und leere Adressen fallen hier heraus.
    const asin = /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,32})/.exec(e?.url)?.[1]
    if (!asin) continue
    const nr = e.staffel != null ? String(e.staffel) : 'ohne Nummer'
    // Dieselbe Schreibweise wie auf dem Knopf: „201" liest sich als „2, Vol. 1" (staffelText()).
    const bandNr = /^([1-9]\d?)(\d{2})$/.exec(nr)
    const angezeigt = bandNr && Number(bandNr[2]) > 0 ? `${bandNr[1]}, Vol. ${Number(bandNr[2])}` : nr
    const eintrag = jeAdresse[asin] ?? { staffeln: {}, folgen: {}, gesamt: 1, serie: null }
    jeAdresse[asin] = eintrag
    eintrag.staffeln[angezeigt] = '✓'
    /* Höchste gemeldete Folge — für „S1 E1–54 gemeldet". */
    if (Number.isFinite(e.folge_nr) && e.folge_nr > (eintrag.folgen[angezeigt] ?? 0)) eintrag.folgen[angezeigt] = e.folge_nr
    eintrag.gesamt = Math.max(eintrag.gesamt, Object.keys(eintrag.staffeln).length)
  }
  return jeAdresse
}
