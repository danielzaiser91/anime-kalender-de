/**
 * Absturz-Wiederholung der Bühnen-Werkzeuge: Ein abgestürzter Seiten-Prozess („Page crashed“, „Target crashed“) macht die
 * Messung nicht rot ohne Befund. Die Seite wird ersetzt und die Einheit einmal wiederholt; stürzt auch das zweite Mal ab,
 * kommt eine benannte „Absturz“-Zeile statt einer Ausnahme.
 */

/** Ob die Ausnahme ein Absturz des Seiten-Prozesses ist (nicht ein Befund oder Zeitüberschreitung). */
export const istAbsturz = (fehler) => /(page|target) crashed/i.test(String(fehler?.message ?? fehler))

/**
 * Führt `arbeit(seite)` aus. Bei Absturz: `ersetze(seite)` liefert eine frische Seite, einmal wird wiederholt.
 * Gibt `{ seite, absturz, ergebnis }` zurück: `seite` ist die zuletzt benutzte (ggf. neue), `absturz` ist `null` oder die
 * Meldung des zweiten Absturzes, `ergebnis` der Rückgabewert des erfolgreichen Versuchs (nie eines abgestürzten). Andere Fehler werfen weiter.
 */
export async function mitWiederholung(seite, arbeit, ersetze) {
  let aktuell = seite
  for (let versuch = 1; ; versuch++) {
    try {
      const ergebnis = await arbeit(aktuell)
      return { seite: aktuell, absturz: null, ergebnis }
    } catch (fehler) {
      if (!istAbsturz(fehler)) throw fehler
      aktuell = await ersetze(aktuell)
      if (versuch === 2) return { seite: aktuell, absturz: String(fehler.message ?? fehler).split('\n')[0], ergebnis: undefined }
    }
  }
}
