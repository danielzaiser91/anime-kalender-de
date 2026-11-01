/**
 * Zitate der Nachträge im Kettenlog (tools/pr-kettenlog.mjs): Der Abnahme-Prüfer darf nur lesen, nicht grepen, und
 * `kettenlog.txt` kappt die Ergebniszeilen je Job (check:logic hat Hunderte Schlusszeilen). Zitiert ein Nachtrag eine
 * Zeile jenseits der Kappung, suchen wir sie hier im vollen bereinigten Log und legen Treffer samt Jobnamen ab.
 * Hinweis und Bereinigung kommen von pr-kettenlog.mjs als Parameter (kein Importkreis).
 */

export const ZITAT_MIN = 15
export const ZITAT_MAX_LAENGE = 200
export const ZITATE_MAX = 30
export const TREFFER_JE_ZITAT = 3
const KOPF_NACHTRAEGE = '## Nachträge'

// Zitate stehen in einer Textdatei, die der Prüfer liest: Steuerzeichen raus.
const einzeilig = (text) => String(text).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()

/** Einzeilige Backtick-Zitate ab ZITAT_MIN Zeichen aus dem Abschnitt Nachträge, ohne Dopplungen, höchstens ZITATE_MAX. */
export function zitateAusBeschreibung(text) {
  const roh = String(text ?? '')
  const start = roh.indexOf(KOPF_NACHTRAEGE)
  if (start < 0) return []
  const treffer = [...roh.slice(start).matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim())
  const brauchbar = treffer.filter((z) => z.length >= ZITAT_MIN).map((z) => z.slice(0, ZITAT_MAX_LAENGE))
  return [...new Set(brauchbar)].slice(0, ZITATE_MAX)
}

/** Treffer eines Zitats in den Logs der abgeschlossenen Jobs: [{ job, zeile }], höchstens TREFFER_JE_ZITAT. */
export function zitatTreffer(zitat, jobs, bereinigt) {
  const aus = []
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    for (const zeile of bereinigt(j.log ?? '')) {
      if (zeile.includes(zitat)) aus.push({ job: einzeilig(j.name).slice(0, 80), zeile })
      if (aus.length >= TREFFER_JE_ZITAT) return aus
    }
  }
  return aus
}

/** Dateitext: Hinweis, dann je Zitat die Treffer mit Jobname oder "kein Treffer". */
export function baueZitateDatei({ kopf, zitate, jobs, hinweis, bereinigt, fehlMarke }) {
  const z = [hinweis, `Zitate der Nachträge (Backticks ab ${ZITAT_MIN} Zeichen) und ihre Treffer im vollen Log der abgeschlossenen Jobs des Kopfs ${kopf}.`]
  const offen = jobs.filter((j) => j.status !== 'completed').length
  const ohneLog = jobs.filter((j) => j.status === 'completed' && (j.log ?? '').startsWith(fehlMarke)).length
  const vollstaendig = jobs.length > 0 && !offen && !ohneLog
  z.push(`Logs vollständig: ${vollstaendig ? 'ja' : 'nein'}`)
  if (!jobs.length) z.push('Kein Job-Log vorhanden (kein Kettenlauf): "kein Treffer" gilt nicht, "nicht beurteilt" ist richtig.')
  if (offen) z.push(`${offen} Job(s) liefen beim Abruf noch: "kein Treffer" gilt für sie nicht.`)
  if (ohneLog) z.push(`${ohneLog} Job-Log(s) nicht abrufbar: "kein Treffer" gilt für sie nicht.`)
  if (!zitate.length) z.push('Keine Zitate in den Nachträgen gefunden.')
  for (const zitat of zitate) {
    z.push('', `Zitat: ${einzeilig(zitat)}`)
    const t = zitatTreffer(zitat, jobs, bereinigt)
    z.push(...(t.length ? t.map((x) => `  Treffer in "${x.job}": ${x.zeile}`) : ['  kein Treffer']))
  }
  return `${z.join('\n')}\n`
}
