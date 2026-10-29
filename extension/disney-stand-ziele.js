/*
  **Die Disney+-Zahl kommt vom Worker, nicht aus dem Paket** (29.10.2026) — wie `prime-stand-ziele.js`, eigene Datei,
  weil `disney.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest nach `pruefstand-zeit.js`.

  Anlass (Daniel, dritte Wiederholung): Laufstatus und Knopf zählen verschieden. `AK_OFFENE_DISNEY` ist beim Packen
  eingefroren; am Worker-Stand vom 29.10.2026 fehlten in einem älteren Paket 3 von 8 Zielen. Jetzt gleicht
  `akDisneyStandEinarbeiten` die Liste mit den Zielen aus `?stand=1` ab (`akPruefstand()`, einmal je Seite geholt, also
  ändert sich der Stand innerhalb einer Seite nicht):
  - Ziel ohne Paket-Eintrag: Eintrag mit Titel, Adresse und `seit` des Workers und **einer offenen Staffel ohne Folgenzahl und
    ohne Kennung** — er zählt mit; gemeldet wird ohne `titelId` (`titelIdFuer` liefert ohne Kennung `null`, nie eine falsche).
  - Paket-Eintrag, dessen Offen-Zustand vom Worker abweicht (Paket offen, Worker kein Ziel — oder umgekehrt): der Worker gilt.
  Ohne Auskunft des Workers (Netz, HTTP-Fehler, Anbieter fehlt) bleibt die Liste, wie sie ist. Mehrfaches Aufrufen ändert nichts.
*/

/** Gleicht `liste` mit den Zielen des Workers ab; ohne Auskunft bleibt sie unverändert. */
globalThis.akDisneyStandEinarbeiten = async (liste) => {
  /* Setzt `akPruefstandAm` für die Vermerke (siehe `akVermerkGilt`) und holt den Stand einmal je Seite. */
  await globalThis.akGemeldetSeit(null)
  const stand = await globalThis.akPruefstand()
  const anbieter = (stand?.anbieter ?? []).find((a) => a.plattform === 'disneyplus')
  if (!anbieter || !Array.isArray(anbieter.ziele)) return
  const imStand = new Set(anbieter.ziele.map((z) => z.url))
  const bekannt = new Set(Object.values(liste).map((e) => e.url))
  for (const e of Object.values(liste)) {
    if (e.staffeln.some((st) => st.offen) === imStand.has(e.url)) continue
    e.staffeln = e.staffeln.map((st) => ({ ...st, offen: imStand.has(e.url) }))
    if (!e.staffeln.length) e.staffeln = [{ nr: 1, folgen: null, film: false, offen: true }]
  }
  for (const z of anbieter.ziele) {
    if (!z.titel || bekannt.has(z.url)) continue
    const eintrag = { titel: z.titel, url: z.url, staffeln: [{ nr: 1, folgen: null, film: false, offen: true }] }
    if (z.seit) eintrag.seit = z.seit
    liste[z.url] = eintrag
  }
}
