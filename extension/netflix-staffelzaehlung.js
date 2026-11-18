/**
 * Zahl der offenen Staffeln für den Knopf der Prüfliste (Staffeln, nicht Adressen).
 *
 * `mitStand`: Der Worker-Stand liegt vor, dann urteilt `fertig`; ohne Stand zählt nur der Tot-Vermerk
 * (`erledigtTot`) als Rückfall. Die übrigen Funktionen kommen aus `melder.js`.
 */
globalThis.akNetflixOffeneStaffeln = (offeneTitel, { mitStand, fertig, erledigtTot, staffelnVon, empfohleneFolgen, kuerzelErledigt }) =>
  Object.entries(offeneTitel).reduce((n, [id, e]) => {
    if (mitStand ? fertig(id, e) : erledigtTot(id)) return n
    const kuerzel = empfohleneFolgen({ ...e, staffeln: staffelnVon(id, e) })
    return n + kuerzel.filter((k) => !kuerzelErledigt(id, k)).length
  }, 0)
