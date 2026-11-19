/**
 * Wächter „Kopf ohne Urteil“ (19.11.2026, löst die Kennzahl „Prüfer sah unfertige Kette“ ab): Der CI-Prüfer schweigt bei laufender Kette
 * (pr-pruefer.yml), das Urteil kommt aus dem Neustart nach Kettenende (pr-pruefer-nach-kette.mjs). Fällt der Neustart aus, bleibt ein Kopf
 * still ohne Urteil: Diese Wache meldet jeden offenen, prüfpflichtigen PR, dessen Kopf seit mehr als 60 min kein Prüfer-Urteil hat.
 * „Basis offen“ gilt als Urteil (der Prüfer wartet dort gewollt auf den Basis-Merge).
 */
export const OHNE_URTEIL_MIN = 60

const BOT = 'github-actions[bot]'
/** Steht im Kommentar eines Prüfer-Laufs, der bei laufender Kette ohne Modell endete (bis 19.11.2026 kommentiert, pr-pruefer.yml): kein Urteil. */
export const MARKE_OHNE_MODELL = '<!-- pruefer-ohne-modell -->'
const URTEIL = /^\*\*Prüfer-Review\*\* für (\S+) - Urteil: \*\*(.*)\*\*/
// Zweige, für die pr-pruefer.yml gar nicht läuft (Job-Bedingung `pruefen`).
const OHNE_PRUEFER = (ref) => ref.startsWith('daten/') || ref === 'zug-fahrt' || ref === 'zug-probe'

/** Hat der Kopf ein Prüfer-Urteil? „nicht beurteilt“ (Kette lief noch, Diff unvollständig) zählt nicht, „Basis offen“ schon. */
export function hatUrteil(kommentare, kopf) {
  return kommentare.some((k) => {
    if (k.user?.login !== BOT || String(k.body ?? '').includes(MARKE_OHNE_MODELL)) return false
    const treffer = URTEIL.exec(String(k.body ?? '').split('\n')[0])
    if (!treffer || treffer[1] !== kopf.slice(0, 9)) return false
    return !treffer[2].startsWith('nicht beurteilt') || treffer[2].includes('Basis offen')
  })
}

/** Offene PRs, für die der Prüfer laufen müsste: kein Entwurf, kein Fork, kein Datenzweig, Basis main oder zug. */
export function pruefpflichtig(pulls) {
  return pulls.filter((p) => !p.draft && p.state === 'open' && p.head?.repo?.full_name === p.base?.repo?.full_name && ['main', 'zug'].includes(p.base?.ref) && !OHNE_PRUEFER(String(p.head?.ref ?? '')))
}

/** Minuten seit dem Push des Kopfes (frühester Prüfer-Lauf, sonst Commit-Datum) und ob der neueste Lauf noch läuft: `{ alter, laeuft }`. */
function kopfStand(gh, repo, sha, jetzt) {
  const laeufe = JSON.parse(gh('api', `repos/${repo}/actions/workflows/pr-pruefer.yml/runs?head_sha=${sha}&per_page=10`)).workflow_runs ?? []
  if (laeufe.length) {
    const frueh = Math.min(...laeufe.map((l) => Date.parse(l.created_at)))
    // Läuft einer (queued/in_progress), arbeitet der Prüfer noch (Job-Frist 60 min); ein übersprungener Lauf heißt: nicht prüfpflichtig.
    const offen = laeufe.some((l) => l.status !== 'completed') || laeufe[0].conclusion === 'skipped'
    return { alter: (jetzt - frueh) / 60_000, laeuft: offen }
  }
  const commit = JSON.parse(gh('api', `repos/${repo}/commits/${sha}`))
  return { alter: (jetzt - Date.parse(commit.commit?.committer?.date)) / 60_000, laeuft: false }
}

/** Wachzeilen: je Kopf ohne Urteil eine `PRUEFER:`-Zeile; ein Abruffehler wird zur eigenen Zeile `PRUEFER? …`. `gh(...args)` gibt den JSON-Text zurück. */
export function prueferZeilen(gh, repo, jetzt = Date.now()) {
  try {
    const zeilen = []
    for (const pr of pruefpflichtig(JSON.parse(gh('api', `repos/${repo}/pulls?state=open&per_page=100`)))) {
      const kopf = pr.head.sha
      const { alter, laeuft } = kopfStand(gh, repo, kopf, jetzt)
      if (laeuft || alter <= OHNE_URTEIL_MIN) continue
      const kommentare = JSON.parse(gh('api', '--paginate', '--slurp', `repos/${repo}/issues/${pr.number}/comments`)).flat()
      if (hatUrteil(kommentare, kopf)) continue
      zeilen.push(`PRUEFER: PR #${pr.number} Kopf ${kopf.slice(0, 9)} ohne Urteil seit ${Math.round(alter)} min (Grenze ${OHNE_URTEIL_MIN} min): Neustart nach Kettenende ausgefallen? pr-pruefer-nachtrag.yml, Job nach-kette`)
    }
    return zeilen
  } catch (fehler) {
    return [`PRUEFER? Prüfer-Urteile nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
  }
}
