/**
 * Weicher Schritt scheitert Lauf um Lauf: `wache-weicher-schritt` meldet jeden Fehlschlag als `WEICH`-Zeile, eine
 * Wiederholung bleibt dort aber eine von vielen Zeilen (Anlass ADN, 05.11.2026: acht Tage Dauerausfall, nur gelb).
 * Scheitert derselbe Schritt (Job und Name) in den letzten `SERIE_LAEUFE` fertigen Läufen auf main hintereinander,
 * kommt eine `ALARM`-Zeile. Ein roter oder fehlender Lauf in der Reihe bricht sie ab (Rot gehört dem Rot-Alarm).
 * Zeilen eines fertigen Laufs ändern sich nie: Schlüssel je Lauf-ID im Zwischenspeicher, nur neue Läufe rufen Jobs ab.
 */
import { abrufe, ladeSpeicher, speichere, weicheSchritte, workflowMitWeichemSchritt } from './wache-weicher-schritt.mjs'

export const SERIE_LAEUFE = 3
const TAG_MS = 86_400_000
const ALTER_TAGE = 14

const listenAbruf = (repo, datei) => ['run', 'list', '--repo', repo, '--workflow', datei, '--branch', 'main', '--status', 'completed', '--limit', String(SERIE_LAEUFE), '--json', 'databaseId,conclusion,createdAt,url']
const jobsAbruf = (repo, id) => ['api', `repos/${repo}/actions/runs/${id}/jobs?per_page=100`]

/** Schlüssel `Job / Schritt` der weichen Fehlschläge einer Jobs-Antwort. */
export const schluesselVon = (antwort) => weicheSchritte(antwort).map((w) => `${w.job} / ${w.schritt}`)

/** Schlüssel, die in jeder Liste vorkommen (leer bei weniger als einer Liste). */
export function gemeinsame(listen) {
  if (!listen.length) return []
  return listen[0].filter((k, i) => listen[0].indexOf(k) === i && listen.every((l) => l.includes(k)))
}

/** Die jüngsten `SERIE_LAEUFE` Läufe, wenn es so viele gibt, alle grün sind und der jüngste nicht älter als 14 Tage ist. */
export function reihe(laeufe, jetztMs) {
  if (!Array.isArray(laeufe) || laeufe.length < SERIE_LAEUFE) return undefined
  const jung = laeufe.slice(0, SERIE_LAEUFE)
  if (!jung.every((l) => l.conclusion === 'success')) return undefined
  return (jetztMs - Date.parse(jung[0].createdAt)) / TAG_MS <= ALTER_TAGE ? jung : undefined
}

/** Reihen je Datei; Dateien ohne brauchbare Reihe fehlen, Abruffehler landen in `ausfall`. */
function reihen(stapel, repo, dateien, jetztMs, ausfall) {
  const antworten = abrufe(stapel, dateien.map((d) => listenAbruf(repo, d)), JSON.parse)
  const ergebnis = []
  antworten.forEach((a, i) => {
    if (a.fehler !== undefined) return ausfall.push(a.fehler)
    const r = reihe(a.wert, jetztMs)
    if (r) ergebnis.push({ datei: dateien[i], laeufe: r })
  })
  return ergebnis
}

/** Schlüssel je Lauf-ID (aus dem Speicher oder per Jobs-Abruf); `undefined` bei Abruffehler. */
function schluesselJeLauf(stapel, repo, ids, speicher, ausfall) {
  const fehlend = ids.filter((id) => !Array.isArray(speicher[id]))
  const jobs = abrufe(stapel, fehlend.map((id) => jobsAbruf(repo, id)), (aus) => schluesselVon(JSON.parse(aus)))
  const neu = {}
  fehlend.forEach((id, k) => {
    if (jobs[k].fehler !== undefined) ausfall.push(jobs[k].fehler)
    else neu[id] = jobs[k].wert
  })
  return { ...Object.fromEntries(ids.filter((id) => Array.isArray(speicher[id])).map((id) => [id, speicher[id]])), ...neu }
}

/** ALARM-Zeilen: derselbe weiche Schritt in jedem der letzten `SERIE_LAEUFE` Läufe; Abruffehler als eine `WEICH?`-Zeile. */
export function serienZeilen(stapel, repo, dateien, jetztMs, speicherDatei) {
  const ausfall = []
  const liste = reihen(stapel, repo, dateien, jetztMs, ausfall)
  const ids = liste.flatMap((r) => r.laeufe.map((l) => l.databaseId))
  const je = schluesselJeLauf(stapel, repo, ids, ladeSpeicher(speicherDatei), ausfall)
  speichere(speicherDatei, je)
  const zeilen = []
  for (const { datei, laeufe } of liste) {
    if (!laeufe.every((l) => je[l.databaseId])) continue
    for (const k of gemeinsame(laeufe.map((l) => je[l.databaseId]))) {
      zeilen.push(`ALARM ${datei} / ${k}: ${SERIE_LAEUFE} Läufe in Folge fehlgeschlagen, jüngster ${laeufe[0].url}`)
    }
  }
  if (ausfall.length) zeilen.push(`SERIE? Serienprüfung unvollständig: ${ausfall.length} Abrufe gescheitert, erster Grund: ${ausfall[0]}`)
  return zeilen
}

/** Aufruf der Wachphase; die Dateiliste der Weich-Wache (fehlender Ordner meldet dort schon `WEICH?`). */
export function serienWache(stapel, repo, wurzel, jetztMs, speicherDatei) {
  try {
    return serienZeilen(stapel, repo, workflowMitWeichemSchritt(wurzel), jetztMs, `${speicherDatei}.serie`)
  } catch {
    return []
  }
}
