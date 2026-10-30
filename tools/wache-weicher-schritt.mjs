/**
 * Weicher Schritt mit „FEHLER:“-Zeile: Ein Schritt mit `continue-on-error` lässt den Lauf grün, `wache-eskalation` meldet
 * erst ab der doppelten Frist (link-check: 18 Tage, der Schritt lief 6 Tage gelb). Diese Prüfung meldet schon beim ersten
 * Auftreten, und zwar mit Workflow, Job, Schritt, erster FEHLER-Zeile und Lauf-Link. Nur der jüngste Lauf je Workflow zählt:
 * ein grüner Folgelauf nimmt die Zeile von selbst zurück.
 *
 * Kosten: Die Abrufe laufen als Stapel (parallel, `tools/gh-stapel.mjs`), und die Zeilen eines abgeschlossenen Laufs
 * ändern sich nie — sie stehen je Lauf-ID in einer Zwischenspeicher-Datei, nur ein neuer Lauf ruft Jobs und Logs ab.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const TAG_MS = 86_400_000
/** Ein älterer Lauf ist keine Neuigkeit mehr; die Frist-Eskalation (`wache-eskalation`) übernimmt. */
export const LAUF_ALTER_TAGE = 14

/** Workflow-Dateien (nur Name) mit mindestens einem weichen Schritt, sortiert. */
export function workflowMitWeichemSchritt(wurzel) {
  const ordner = join(wurzel, '.github', 'workflows')
  return readdirSync(ordner)
    .filter((f) => f.endsWith('.yml') && /^\s*continue-on-error:\s*true\b/m.test(readFileSync(join(ordner, f), 'utf8')))
    .sort()
}

/** Weiche Fehlschläge einer Jobs-Antwort: Schritt `failure` in einem Job, der trotzdem `success` ist. */
export function weicheSchritte(antwort) {
  const jobs = Array.isArray(antwort?.jobs) ? antwort.jobs : []
  return jobs
    .filter((job) => job.conclusion === 'success')
    .flatMap((job) => (job.steps ?? []).filter((s) => s.conclusion === 'failure').map((s) => ({ jobId: job.id, job: job.name, schritt: s.name })))
}

/**
 * Erste Zeile des Logs, die mit `FEHLER:` beginnt (nach dem Zeitstempel, ohne Einrückung: die `env:`-Zeilen des
 * Schrittkopfs sind eingerückt) und danach Text trägt; sonst undefined.
 */
export function ersteFehlerZeile(log) {
  for (const roh of String(log).split(/\r?\n/)) {
    const inhalt = roh.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '')
    if (/^FEHLER:\s*\S/.test(inhalt)) return inhalt.trim()
  }
  return undefined
}

const ersteZeile = (text) => String(text).split('\n')[0]

/** Stapel aus einer einzelnen (synchronen, werfenden) gh-Funktion: `[[args…], …]` → `[{ ok, aus } | { ok: false, fehler }]`. */
export const stapelVon = (gh) => (liste) =>
  liste.map((args) => {
    try {
      return { ok: true, aus: gh(...args) }
    } catch (fehler) {
      return { ok: false, fehler: ersteZeile(fehler.message) }
    }
  })

/** Ein Stapel; eine unbrauchbare Gesamtantwort (kein Array in der Länge der Liste) zählt als Fehler jedes Abrufs. */
function einStapel(stapel, liste) {
  let antwort
  try {
    antwort = stapel(liste)
  } catch (fehler) {
    return liste.map(() => ({ ok: false, fehler: ersteZeile(fehler.message) }))
  }
  if (Array.isArray(antwort) && antwort.length === liste.length) return antwort
  return liste.map(() => ({ ok: false, fehler: 'Stapelantwort unlesbar' }))
}

/**
 * Alle Abrufe als Stapel; was scheitert (HTTP 502, Zeitüberschreitung), wird genau einmal wiederholt.
 * Ergebnis je Abruf: `{ wert }` oder `{ fehler }`; `lies` wandelt die Rohausgabe (Fehler dabei zählt als Abruffehler).
 */
function abrufe(stapel, liste, lies) {
  const erst = einStapel(stapel, liste)
  const offen = erst.flatMap((r, i) => (r.ok ? [] : [i]))
  const zweit = offen.length ? einStapel(stapel, offen.map((i) => liste[i])) : []
  offen.forEach((i, k) => {
    erst[i] = zweit[k]
  })
  return erst.map((r) => {
    if (!r?.ok) return { fehler: r?.fehler ?? 'kein Ergebnis' }
    try {
      return { wert: lies(r.aus) }
    } catch (fehler) {
      return { fehler: ersteZeile(fehler.message) }
    }
  })
}

/** Zwischenspeicher `{ [lauf-id]: Zeilen }`; fehlt die Datei oder ist sie kaputt, ist er leer (nur Kosten, kein Befund). */
function ladeSpeicher(datei) {
  try {
    const inhalt = JSON.parse(readFileSync(datei, 'utf8'))
    return inhalt && typeof inhalt === 'object' && !Array.isArray(inhalt) ? inhalt : {}
  } catch {
    return {}
  }
}

function speichere(datei, inhalt) {
  try {
    mkdirSync(dirname(datei), { recursive: true })
    writeFileSync(datei, JSON.stringify(inhalt))
  } catch {
    /* nur ein Zwischenspeicher: der nächste Lauf ruft einfach erneut ab */
  }
}

const FELDER = 'databaseId,conclusion,createdAt,url'
const listenAbruf = (repo, datei) => ['run', 'list', '--repo', repo, '--workflow', datei, '--branch', 'main', '--status', 'completed', '--limit', '1', '--json', FELDER]
const jobsAbruf = (repo, id) => ['api', `repos/${repo}/actions/runs/${id}/jobs?per_page=100`]
const logAbruf = (repo, jobId) => ['api', `repos/${repo}/actions/jobs/${jobId}/logs`]

/** Jüngster fertiger Lauf je Datei, der grün und höchstens 14 Tage alt ist; `ausfall` sammelt die Dateien ohne Auskunft. */
function frischeLaeufe(stapel, repo, dateien, jetztMs, ausfall) {
  const antworten = abrufe(stapel, dateien.map((d) => listenAbruf(repo, d)), JSON.parse)
  const laeufe = []
  antworten.forEach((a, i) => {
    if (a.fehler !== undefined) return ausfall.push({ datei: dateien[i], grund: a.fehler })
    const lauf = Array.isArray(a.wert) ? a.wert[0] : undefined
    if (!lauf || lauf.conclusion !== 'success') return
    if (!((jetztMs - Date.parse(lauf.createdAt)) / TAG_MS <= LAUF_ALTER_TAGE)) return
    laeufe.push({ datei: dateien[i], lauf })
  })
  return laeufe
}

/** Zeilen neuer Läufe (Jobs, dann Logs der weichen Schritte); ein Lauf mit Abruffehler liefert `zeilen: undefined`. */
function zeilenNeuerLaeufe(stapel, repo, neue, ausfall) {
  const jobs = abrufe(stapel, neue.map((n) => jobsAbruf(repo, n.lauf.databaseId)), JSON.parse)
  const schritte = neue.map((n, i) => {
    if (jobs[i].fehler !== undefined) {
      ausfall.push({ datei: n.datei, grund: jobs[i].fehler })
      return undefined
    }
    return weicheSchritte(jobs[i].wert)
  })
  const logListe = schritte.flatMap((s, i) => (s ?? []).map((w) => ({ i, w })))
  const logs = abrufe(stapel, logListe.map(({ w }) => logAbruf(repo, w.jobId)), (aus) => ersteFehlerZeile(aus))
  const zeilen = neue.map((n, i) => (schritte[i] === undefined ? undefined : []))
  logListe.forEach(({ i, w }, k) => {
    if (logs[k].fehler !== undefined) {
      ausfall.push({ datei: neue[i].datei, grund: logs[k].fehler })
      zeilen[i] = undefined
    } else if (logs[k].wert && zeilen[i] !== undefined) {
      zeilen[i].push(`WEICH ${neue[i].datei} / ${w.job} / ${w.schritt}: ${logs[k].wert} (${neue[i].lauf.url})`)
    }
  })
  return zeilen
}

/** Alle Warnzeilen; Ausfälle der Abrufe (nach einer Wiederholung) stehen als eine Sammelzeile `WEICH? …`, nie als Schweigen. */
export function weichZeilen(stapel, repo, dateien, jetztMs, speicherDatei) {
  const speicher = ladeSpeicher(speicherDatei)
  const ausfall = []
  const laeufe = frischeLaeufe(stapel, repo, dateien, jetztMs, ausfall)
  const neue = laeufe.filter((l) => !Array.isArray(speicher[l.lauf.databaseId]))
  const neueZeilen = zeilenNeuerLaeufe(stapel, repo, neue, ausfall)
  const naechster = {}
  const zeilen = []
  for (const l of laeufe) {
    const id = l.lauf.databaseId
    const k = neue.indexOf(l)
    const eigene = k < 0 ? speicher[id] : neueZeilen[k]
    if (eigene === undefined) continue
    naechster[id] = eigene
    zeilen.push(...eigene)
  }
  speichere(speicherDatei, naechster)
  if (ausfall.length) {
    const betroffen = new Set(ausfall.map((a) => a.datei)).size
    zeilen.push(`WEICH? Schrittprüfung ausgefallen: ${betroffen} von ${dateien.length} Workflows nicht lesbar, erster Grund: ${ausfall[0].grund}`)
  }
  return zeilen
}

/** Aufruf der Wachphase: Dateiliste und Abrufe in einem; fehlt der Workflow-Ordner, steht das als Zeile da. */
export function weichWache(stapel, repo, wurzel, jetztMs, speicherDatei) {
  try {
    return weichZeilen(stapel, repo, workflowMitWeichemSchritt(wurzel), jetztMs, speicherDatei)
  } catch (fehler) {
    return [`WEICH? Workflows nicht lesbar: ${ersteZeile(fehler.message)}`]
  }
}
