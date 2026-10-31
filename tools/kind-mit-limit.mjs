/**
 * Kindprozess mit Zeitlimit für die Wachphase: ein hängender `gh`/`git` (Netz, Auth-Abfrage) darf die Wache nicht
 * blockieren, bevor eine ALARM-Zeile kommt. Bei Überschreitung wirft der Aufruf eine Meldung „FEHLER: …“.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Gemessen 30.10.2026 (je 3 Läufe): `gh run list --limit 200` 4,2–4,7 s, ganze Wachphase 14–16 s,
// liegegut 8,7–8,9 s. Einzelaufruf 15 s (3× der größte Messwert), Sammelaufruf (viele gh parallel) 30 s.
// Worst-Case-Summe, wenn jeder gh der Wachphase hängt (laeufe-aufraeumen): rote Sammler-PRs 15 s + rotAlarmText
// (Läufe 15 s + bis zu 5× `run view` 75 s + Deploy-Läufe 15 s = 105 s) + Stapel 30 s, nach einem Fehlschlag einmal wiederholt
// 60 s = 180 s, dazu 15 s je roter Workflow-Art (letzterGruenJe). Fällt bereits der erste Abruf aus, entfallen die fünf
// `run view`: dann 15 + 15 + 15 + 60 = 105 s. Frist des Aufrufers: Job „abschluss“ in deploy.yml, timeout-minutes 3 = 180 s
// (mit 60/120 s waren es über 480 s, die Wache wäre vor ihrer ALARM-Zeile abgebrochen worden).
// Ein Timeout im Stapel beendet nur den Kind-`node`; seine `gh`-Enkel können unter Windows weiterlaufen (kein Prozessbaum-Kill),
// sie enden spätestens an ihrem eigenen 60-s-Limit in gh-stapel.mjs.
// WACHE_LIMIT_MS setzt nur der Prozess-Test (hängender Ersatz-gh), damit er nicht 15 s wartet.
const ueberschrieben = Number(process.env.WACHE_LIMIT_MS) || 0
export const LIMIT_EINZEL_MS = ueberschrieben || 15_000
export const LIMIT_STAPEL_MS = ueberschrieben || 30_000
// Kindskripte des Wachen-Dossiers (wache-urteil-dossier): gemessen 30.10.2026 wache-woechentlich --trocken 15,0 s, zugangs-waechter 17,1 s;
// 90 s = gut das Fünffache des größten Werts (Job claude-wache-urteil hat 30 min, fünf Skripte hintereinander ≤ 450 s).
export const LIMIT_SKRIPT_MS = ueberschrieben || 90_000

/** `ausfuehren` ist einspeisbar (Test mit hängendem Ersatzbefehl); Rückgabe wie `execFileSync`. */
export function mitLimit(befehl, args, optionen = {}, { limitMs = LIMIT_EINZEL_MS, ausfuehren = execFileSync } = {}) {
  try {
    return ausfuehren(befehl, args, { ...optionen, windowsHide: true, timeout: limitMs })
  } catch (fehler) {
    if (fehler.code !== 'ETIMEDOUT') throw fehler
    const was = [befehl, ...args.slice(0, 2)].join(' ')
    throw new Error(`FEHLER: ${was} nach ${Math.round(limitMs / 1000)} s abgebrochen`)
  }
}

/**
 * `spawnSync` für Tests: ohne `limitMs` wie bisher ohne Frist; mit Frist wirft ein Hänger „FEHLER: … hing länger als N s“
 * (sonst käme still `status: null` zurück). `ausfuehren` ist einspeisbar.
 */
export function spawnMitLimit(befehl, args, optionen = {}, { limitMs, ausfuehren = spawnSync } = {}) {
  const ergebnis = ausfuehren(befehl, args, { ...optionen, windowsHide: true, ...(limitMs ? { timeout: limitMs } : {}) })
  if (ergebnis.error?.code === 'ETIMEDOUT') {
    const was = [befehl, ...args.slice(0, 2)].join(' ')
    throw new Error(`FEHLER: ${was} hing länger als ${Math.round(limitMs / 1000)} s`)
  }
  return ergebnis
}

/** Alle gh-Aufrufe einer Liste parallel in einem Kindprozess (`tools/gh-stapel.mjs`); `ausfuehren` ist einspeisbar. */
export function ghStapel(liste, { ausfuehren } = {}) {
  const skript = fileURLToPath(new URL('./gh-stapel.mjs', import.meta.url))
  return JSON.parse(mitLimit(process.execPath, [skript], { input: JSON.stringify(liste), encoding: 'utf8', maxBuffer: 256 << 20 }, { limitMs: LIMIT_STAPEL_MS, ausfuehren }))
}

/** Text für den Abschluss einer Wache: ein Zeitlimit (FEHLER: …) als klare Zeile, alles andere mit Stack. */
export const abbruchText = (fehler) => (String(fehler.message).startsWith('FEHLER:') ? fehler.message : fehler.stack)
