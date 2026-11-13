/**
 * Job-Log lesen, das GitHub zeitweise mit 5xx beantwortet (11.11.2026: HTTP 502 für „Kette – Workflows“, andere Jobs desselben
 * Laufs lieferten 200; die Checkout-Zeile „Merge <Kopf> into <Basis>“ steht in jedem Job der Kette). Erst bis zu LOG_VERSUCHE
 * Versuche mit Pause am Hauptjob, dann je ein Versuch an den übrigen fertigen Jobs (höchstens RUECKFALL_JOBS).
 */
export const LOG_VERSUCHE = 3
export const LOG_ABSTAND_MS = 3000
export const RUECKFALL_JOBS = 3

const logAdresse = (id) => ['api', '--allow-escape-sequences', `repos/{owner}/{repo}/actions/jobs/${id}/logs`]

/** Kurzgrund eines gescheiterten gh-Aufrufs: „HTTP 502“ wenn genannt, sonst die erste Zeile der Meldung. */
export function fehlerKurz(e) {
  const m = /HTTP (\d{3})/.exec(String(e?.message))
  return m ? `HTTP ${m[1]}` : String(e?.message).split('\n')[0]
}

/** Log eines Jobs mit Wiederholung; Rückgabe { log } oder { fehler }. */
function logMitVersuchen(gh, id, versuche, warte) {
  let fehler = ''
  for (let i = 0; i < versuche; i++) {
    if (i > 0) warte(LOG_ABSTAND_MS)
    try {
      return { log: gh(logAdresse(id)) }
    } catch (e) {
      fehler = fehlerKurz(e)
    }
  }
  return { fehler }
}

/**
 * Basis aus dem Log des Hauptjobs, bei Lesefehler aus dem Log anderer fertiger Jobs. `basisAus(log)` liefert die Basis oder null.
 * Rückgabe { basis } (auch null: Log gelesen, Zeile fehlt) oder { lesefehler } (nichts lesbar, Text des ersten Fehlers).
 */
export function basisAusJobLogs(gh, job, jobs, basisAus, warte) {
  const erst = logMitVersuchen(gh, job.databaseId, LOG_VERSUCHE, warte)
  if (erst.log !== undefined) return { basis: basisAus(erst.log) }
  const andere = jobs.filter((j) => j.databaseId !== job.databaseId && j.status === 'completed').slice(0, RUECKFALL_JOBS)
  for (const j of andere) {
    const r = logMitVersuchen(gh, j.databaseId, 1, warte)
    const basis = r.log === undefined ? null : basisAus(r.log)
    if (basis !== null) return { basis }
  }
  return { lesefehler: erst.fehler }
}
