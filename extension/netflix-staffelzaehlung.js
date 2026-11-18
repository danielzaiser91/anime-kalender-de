/**
 * Zahl der offenen Staffeln für den Tooltip des Prüflisten-Knopfes (Staffeln, nicht Adressen).
 *
 * `fertig` ist die Regel der Liste (`fertig()` in `melder.js`: Worker-Stand, sonst der Tot-Vermerk als Rückfall);
 * ein Titel, den sie erledigt nennt, zählt nicht. Die übrigen Funktionen kommen aus `melder.js`.
 */
globalThis.akNetflixOffeneStaffeln = (offeneTitel, fertig, staffelnVon, empfohleneFolgen, kuerzelErledigt) =>
  Object.entries(offeneTitel).reduce((n, [id, e]) => {
    if (fertig(id, e)) return n
    const kuerzel = empfohleneFolgen({ ...e, staffeln: staffelnVon(id, e) })
    return n + kuerzel.filter((k) => !kuerzelErledigt(id, k)).length
  }, 0)
