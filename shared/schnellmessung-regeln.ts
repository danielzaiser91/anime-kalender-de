/** Regeln der Schnellmessung (`worker/src/schnellmessung.ts`); hier, damit `check-logic` sie ohne Worker-Typen prüft. */

/** Ab dieser Gesamtzeit gilt eine Messung als zu langsam. */
export const LANGSAM_MS = 3000
/** So viele schlechte Messungen in Folge lösen den Alarm aus; so viele gute schließen ihn. */
export const SCHLECHT_IN_FOLGE = 3
export const GUT_ZUM_SCHLIESSEN = 2

interface Gemessen {
  ok: number | boolean
  total_ms: number
}

/** Eine Messung gilt als schlecht, wenn sie fehlschlug oder langsamer als `LANGSAM_MS` war. */
export const istSchlecht = (m: Gemessen): boolean => !m.ok || m.total_ms > LANGSAM_MS

/** Aus den letzten Messungen (neueste zuerst): geht ein Alarm auf, schließt er, oder passiert nichts? */
export function alarmEntscheidung(neuesteZuerst: Gemessen[], alarmOffen: boolean): 'auf' | 'zu' | 'nichts' {
  const schlecht = neuesteZuerst.slice(0, SCHLECHT_IN_FOLGE)
  if (!alarmOffen && schlecht.length === SCHLECHT_IN_FOLGE && schlecht.every(istSchlecht)) return 'auf'
  const gut = neuesteZuerst.slice(0, GUT_ZUM_SCHLIESSEN)
  if (alarmOffen && gut.length === GUT_ZUM_SCHLIESSEN && gut.every((m) => !istSchlecht(m))) return 'zu'
  return 'nichts'
}
