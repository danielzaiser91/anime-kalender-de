/*
  **Der Prime-Stand aus dem Briefkasten** (4.31.4, 15.10.2026).

  `amazon.js` holte ihn bis 4.31.1 über `GET /pruefung?token=…` — die ungecachte Liste der offenen
  Meldungen. Jeder Prime-Seitenaufruf las damit rund 36.000 D1-Zeilen, im Durchgang 2,7 Mio. je
  Stunde (D1-Insights, 15.10.2026). Jetzt kommt er aus `?zaehlen=1&nummern=1`: dieselben offenen
  Meldungen (ohne die 500er-Grenze der Token-Liste), zwei Stunden im Edge-Cache und mit derselben
  Adresse, die `disney.js` schon abruft.

  Die Antwort trägt je Meldung nur Adresse, Staffel und Folgennummer. Der Befund (🇩🇪/✕) fehlt dort;
  die Staffel steht deshalb als „✓" (gemeldet). Lokale Meldungen behalten ihren Befund, weil
  `akPrimeStandVereinigen()` den lokalen Befund vorgehen lässt (die Folgenzahl: die größere von beiden).
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

/*
  Die eigene Meldung trägt ihren Befund und ihre geladene Folgenzahl lokal ein: Der Briefkasten
  kennt die Folgenzahl bei einheitlicher Staffel nicht (ohne `folge_nr`), sonst fiele „E1–N" weg.
*/
globalThis.akPrimeMeldungEintragen = (bisher, nr, befund, folgen) => {
  bisher.staffeln = { ...(bisher.staffeln ?? {}), [nr]: befund }
  bisher.folgen = { ...(bisher.folgen ?? {}), [nr]: folgen }
}

/*
  Tab-Eintrag und Speicher-Eintrag derselben Kennung: Befund und Folgenzahl je Staffel werden vereinigt
  (streiten beide um dieselbe Staffel, gewinnt der Tab), `gesamt` ist das Maximum. Ein Tab mit älterem
  Stand darf weder die Gesamtzahl noch fremde Staffeln eines anderen Tabs verdrängen.
*/
globalThis.akPrimeEintragVereinigen = (frisch, wert) => ({
  ...(frisch ?? {}),
  ...wert,
  staffeln: { ...(frisch?.staffeln ?? {}), ...(wert.staffeln ?? {}) },
  folgen: { ...(frisch?.folgen ?? {}), ...(wert.folgen ?? {}) },
  gesamt: Math.max(frisch?.gesamt ?? 1, wert.gesamt ?? 1),
})

/*
  Je Staffel die größere Folgenzahl: Eine fremde Teilmeldung (höchste Folge 3) darf das lokal gemerkte
  „E1–12" der eigenen Meldung nicht kürzen; weiß der Worker mehr, zählt das (CI-Prüfer, 15.10.2026).
*/
const folgenVereinigen = (lokal, ausWorker) => {
  const folgen = { ...(lokal ?? {}) }
  for (const [nr, n] of Object.entries(ausWorker ?? {})) folgen[nr] = Math.max(folgen[nr] ?? 0, n)
  return folgen
}

/**
 * Den Worker-Stand mit dem lokalen vereinigen.
 *
 * **In beide Richtungen**, und das ist der Punkt: Der Worker kennt, was
 * andere Browser und frühere Sitzungen gemeldet haben; der lokale Stand
 * kennt den Klick von vor zwei Sekunden. Beide sind wahr, keine Meldung wird
 * je zurückgenommen.
 *
 * `gesamt` bleibt beim lokalen Wert, wo es einen gibt: Der stammt aus
 * „N Staffeln" auf der Seite und ist genauer als die Zahl der Meldungen.
 * Der Befund (`staffeln`) bleibt ebenfalls lokal; die Folgenzahl ist die größere von beiden.
 */
globalThis.akPrimeStandVereinigen = (lokal, ausWorker) => {
  if (!ausWorker) return lokal
  const zusammen = { ...lokal }
  for (const [asin, wert] of Object.entries(ausWorker)) {
    const da = zusammen[asin]
    zusammen[asin] = {
      ...wert,
      ...(da ?? {}),
      staffeln: { ...(wert.staffeln ?? {}), ...(da?.staffeln ?? {}) },
      folgen: folgenVereinigen(da?.folgen, wert.folgen),
      gesamt: Math.max(da?.gesamt ?? 1, wert.gesamt ?? 1),
      serie: da?.serie ?? wert.serie ?? null,
    }
  }
  return zusammen
}
