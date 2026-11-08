/**
 * Wachzeile „Start-Budget wenig Luft“: `tools/start-budget.mjs` druckt die Frühwarnung nur als `::warning::`, das im Lauf niemand liest
 * (06.11.2026: main stand bei 250,0 von 250 KB, vier PR-Ketten rot). Diese Wache liest die Warnung dort, wo sie billig liegt:
 * als Annotation des `build`-Jobs des jüngsten erfolgreichen Deploy-Laufs auf main (3 Abrufe, gemessen 06.11.2026 ~1 s je Abruf;
 * das Job-Log wäre ein Mehrfaches). Deployt die Kette den Bau der PR-Prüfkette, entfällt der `build`-Job; dann zählt der nächste Lauf.
 * Kein Warn-Annotation heißt: Luft ≥ WARNLUFT (die Messung selbst druckt sonst keine).
 */
const ANZAHL_LAEUFE = 6
const WARNUNG = /^start-budget: nur noch (\d+(?:\.\d+)?) KB Luft/

/** KB Luft aus den Annotationen eines Bau-Jobs, `null` ohne Warnung. */
export function luftAusAnnotationen(annotationen) {
  for (const a of annotationen) {
    const treffer = WARNUNG.exec(String(a?.message ?? ''))
    if (a?.annotation_level === 'warning' && treffer) return Number(treffer[1])
  }
  return null
}

/** Wachzeilen: Warnung, Abrufhinweis oder nichts. `gh` gibt den JSON-Text zurück (Argumentliste rein). */
export function startBudgetZeilen(gh, repo) {
  try {
    const laeufe = JSON.parse(gh(['run', 'list', '--repo', repo, '--workflow', 'deploy.yml', '--branch', 'main', '--status', 'success', '--limit', String(ANZAHL_LAEUFE), '--json', 'databaseId']))
    for (const lauf of laeufe) {
      const jobs = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${lauf.databaseId}/jobs`])).jobs
      const bau = jobs.find((j) => j.name === 'build' && j.conclusion === 'success')
      if (!bau) continue
      const luft = luftAusAnnotationen(JSON.parse(gh(['api', `repos/${repo}/check-runs/${bau.id}/annotations`])))
      return luft === null ? [] : [`WARNUNG start-budget: ${luft} KB Luft (Deploy-Lauf ${lauf.databaseId}); Startdateien verkleinern, bevor der nächste Datenlauf die Grenze reißt`]
    }
    return [`START-BUDGET? kein erfolgreicher build-Job in den letzten ${ANZAHL_LAEUFE} Deploy-Läufen auf main`]
  } catch (fehler) {
    return [`START-BUDGET? Messung nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
  }
}
