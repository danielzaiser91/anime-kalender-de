/**
 * Hängende CI-Jobs: ein Job, der länger als seine Grenze `in_progress` steht, wird gemeldet (`--trocken`) bzw.
 * abgebrochen und mit `gh run rerun --failed` neu gestartet. Nur Node-Bordmittel (Aufrufer: Wachphase in deploy.yml).
 * Anlass 05.11.2026: Job „Kette – Workflows“ (Lauf 42052715208, PR 2935) stand 15:14–16:40 UTC im Schritt
 * „Run ./.github/actions/kette-einrichten“, obwohl der Job `timeout-minutes: 30` hat; erst Abbrechen + Neustart half.
 * Grenze je Job: das größere von 45 min und seinem `timeout-minutes` (Sammler mit 60–330 min laufen regulär lange).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const HAENGER_MINUTEN = 45
/** Ab dieser Versuchsnummer startet die Wache nicht mehr neu, sie meldet nur (Schutz vor Endlosschleife). */
export const MAX_VERSUCH = 3

/** Nur Läufe dieser Ereignisse bricht die Wache ab; Sammler, Bestandsbau, Deploy, Claude-Jobs und Jobs ohne Frist nur melden (betrieb.md). */
export const PR_EREIGNISSE = ['pull_request', 'pull_request_target']

/** `{ 'Job-Kennung oder -Name': timeout-minutes }` aus dem Text einer Workflow-Datei (Einrückung 2/4 Leerzeichen, wie im Repo). */
export function jobTimeouts(yamlText) {
  const aus = {}
  let id
  let name
  let minuten
  const abschliessen = () => {
    if (id === undefined || minuten === undefined) return
    aus[id] = minuten
    if (name) aus[name] = minuten
  }
  for (const zeile of yamlText.split('\n')) {
    const kopf = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(zeile)
    if (kopf) {
      abschliessen()
      id = kopf[1]
      name = undefined
      minuten = undefined
      continue
    }
    const feld = /^ {4}(name|timeout-minutes):\s*(.+?)\s*$/.exec(zeile)
    if (!feld) continue
    if (feld[1] === 'name') name = feld[2].replace(/^['"]|['"]$/g, '')
    else if (/^\d+$/.test(feld[2])) minuten = Number(feld[2])
  }
  abschliessen()
  return aus
}

/**
 * `timeout-minutes` des Jobs: Treffer über Kennung/Name; Matrix-Name („PR-Aussehen – x“ zu `${{ matrix.teil }}`) über das Muster
 * des Namens in der Datei, `kennung (x)` über die Kennung. Kein Wert → undefined.
 */
export function fristMinuten(timeouts, jobName) {
  if (timeouts[jobName] !== undefined) return timeouts[jobName]
  for (const [schluessel, minuten] of Object.entries(timeouts)) {
    if (!schluessel.includes('${{')) continue
    const teile = schluessel.split(/\$\{\{.*?\}\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (new RegExp(`^${teile.join('.+')}$`).test(jobName)) return minuten
  }
  return timeouts[jobName.replace(/ \(.*\)$/, '')]
}

export function grenzeMinuten(timeouts, jobName) {
  return Math.max(HAENGER_MINUTEN, fristMinuten(timeouts, jobName) ?? 0)
}

/**
 * `laeufe`: `[{ id, name, path, head_branch, run_attempt, pull_requests, jobs: [{ name, status, started_at, steps }] }]`
 * (Actions-API); `timeoutsJe(path)` liefert die Tabelle der Workflow-Datei. Ergebnis: ein Eintrag je hängendem Job.
 */
export function haengendeJobs(laeufe, timeoutsJe, jetztMs) {
  const aus = []
  for (const lauf of laeufe) {
    const timeouts = timeoutsJe(lauf.path) ?? {}
    for (const job of lauf.jobs ?? []) {
      if (job.status !== 'in_progress' || !job.started_at) continue
      const minuten = (jetztMs - Date.parse(job.started_at)) / 60_000
      const grenze = grenzeMinuten(timeouts, job.name)
      const hatFrist = fristMinuten(timeouts, job.name) !== undefined
      if (!(minuten > grenze)) continue
      const schritt = (job.steps ?? []).find((s) => s.status === 'in_progress')
      aus.push({
        runId: lauf.id,
        workflow: lauf.name,
        job: job.name,
        schritt: schritt?.name ?? '(kein Schritt aktiv)',
        minuten: Math.round(minuten),
        grenze,
        versuch: lauf.run_attempt ?? 1,
        abbrechbar: hatFrist && PR_EREIGNISSE.includes(lauf.event),
        bezug: lauf.pull_requests?.[0]?.number ? `PR ${lauf.pull_requests[0].number}` : lauf.head_branch,
      })
    }
  }
  return aus
}

export function haengerZeile(h) {
  return `HÄNGER Lauf ${h.runId} ${h.workflow} / ${h.job} — Schritt „${h.schritt}“ seit ${h.minuten} min (Grenze ${h.grenze} min), ${h.bezug}`
}

/**
 * Wer ist nach Abbruch dran? `merk`: `{ [runId]: { versuch } }` (abgebrochen, Neustart steht aus); `info`: `{ [runId]: { status, conclusion, run_attempt } }`.
 * `neustart`: abgeschlossen und nicht grün, jetzt `--failed`; `verwerfen`: grün geworden oder von Hand neu gestartet (höherer run_attempt),
 * kein Neustart; alle anderen bleiben in der Merkdatei.
 */
export function neustartPlan(merk, info) {
  const neustart = []
  const verwerfen = []
  for (const id of Object.keys(merk)) {
    const i = info[id]
    if (!i) continue
    if ((i.run_attempt ?? 1) > merk[id].versuch || i.conclusion === 'success') verwerfen.push(id)
    else if (i.status === 'completed') neustart.push(id)
  }
  return { neustart, verwerfen }
}

function lies(datei) {
  try {
    return existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : {}
  } catch {
    return {}
  }
}

/**
 * Läufe mit Jobs; ein nicht lesbarer Lauf wird übersprungen. `gh(args) → Text`. Ein Lauf, der jünger als die Mindestgrenze ist,
 * kann keinen hängenden Job haben und bekommt keinen Abruf (spart je Lauf ~2 s: Wachphase 20,7 → 30,8 s mit Abruf für jeden Lauf, Median aus 3, 05.11.2026).
 */
export function holeLaeufeMitJobs(gh, repo, jetztMs) {
  const liste = JSON.parse(gh(['api', `repos/${repo}/actions/runs?status=in_progress&per_page=100`])).workflow_runs ?? []
  return liste.map((l) => {
    if (jetztMs - Date.parse(l.run_started_at) < HAENGER_MINUTEN * 60_000) return { ...l, jobs: [] }
    try {
      return { ...l, jobs: JSON.parse(gh(['api', `repos/${repo}/actions/runs/${l.id}/jobs?per_page=100`])).jobs }
    } catch {
      return { ...l, jobs: [] }
    }
  })
}

/**
 * Wachphase: Zeilen für die Konsole. Ohne `trocken` bricht sie hängende Läufe ab und startet bereits abgebrochene
 * (laut Merkdatei) mit `--failed` neu — ohne zu warten; ist der Abbruch noch nicht durch, geschieht der Neustart beim nächsten Aufruf.
 */
export function haengerWache(gh, repo, wurzel, jetztMs, merkDatei, { trocken = false } = {}) {
  const zeilen = []
  try {
    const timeoutsJe = (pfad) => {
      const datei = join(wurzel, String(pfad).split('@')[0])
      return existsSync(datei) ? jobTimeouts(readFileSync(datei, 'utf8')) : {}
    }
    const laeufe = holeLaeufeMitJobs(gh, repo, jetztMs)
    const haenger = haengendeJobs(laeufe, timeoutsJe, jetztMs)
    for (const h of haenger) zeilen.push(haengerZeile(h))
    if (!haenger.length) zeilen.push(`Hänger: keine Jobs über der Grenze (${laeufe.length} laufende Läufe)`)
    if (trocken) return zeilen
    const merk = lies(merkDatei)
    zeilen.push(...abbrechenUndNeustarten(gh, repo, haenger, merk))
    writeFileSync(merkDatei, JSON.stringify(merk))
  } catch (fehler) {
    zeilen.push(`HÄNGER? Jobs nicht lesbar: ${String(fehler.message).split('\n')[0]}`)
  }
  return zeilen
}

function laufInfo(gh, repo, id) {
  const lauf = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${id}`]))
  return { status: lauf.status, conclusion: lauf.conclusion, run_attempt: lauf.run_attempt }
}

/** Ändert `merk` an Ort und Stelle (Abbruch merken, Neustart austragen). */
function abbrechenUndNeustarten(gh, repo, haenger, merk) {
  const zeilen = []
  for (const h of haenger) {
    if (!h.abbrechbar) {
      zeilen.push(`  Lauf ${h.runId}: kein PR-Lauf oder Job ohne timeout-minutes, nur gemeldet`)
      continue
    }
    if (merk[h.runId] || h.versuch >= MAX_VERSUCH) {
      if (h.versuch >= MAX_VERSUCH) zeilen.push(`  Lauf ${h.runId}: Versuch ${h.versuch}, kein Neustart mehr — von Hand ansehen`)
      continue
    }
    try {
      gh(['run', 'cancel', String(h.runId), '--repo', repo])
      merk[h.runId] = { versuch: h.versuch }
      zeilen.push(`  Lauf ${h.runId}: abgebrochen, Neustart folgt`)
    } catch (fehler) {
      zeilen.push(`  Lauf ${h.runId}: Abbruch gescheitert: ${String(fehler.message).split('\n')[0]}`)
    }
  }
  const info = {}
  for (const id of Object.keys(merk)) {
    try {
      info[id] = laufInfo(gh, repo, id)
    } catch {}
  }
  const plan = neustartPlan(merk, info)
  for (const id of plan.verwerfen) delete merk[id]
  for (const id of plan.neustart) {
    try {
      gh(['run', 'rerun', id, '--failed', '--repo', repo])
      zeilen.push(`  Lauf ${id}: mit --failed neu gestartet`)
      delete merk[id]
    } catch (fehler) {
      zeilen.push(`  Lauf ${id}: Neustart gescheitert: ${String(fehler.message).split('\n')[0]}`)
    }
  }
  return zeilen
}
