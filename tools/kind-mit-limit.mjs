/**
 * Kindprozess mit Zeitlimit für die Wachphase: ein hängender `gh`/`git` (Netz, Auth-Abfrage) darf die Wache nicht
 * blockieren, bevor eine ALARM-Zeile kommt. Bei Überschreitung wirft der Aufruf eine Meldung „FEHLER: …“.
 */
import { execFileSync } from 'node:child_process'

// Gemessen 30.10.2026 (je 3 Läufe): `gh run list --limit 200` 4,2–4,7 s, ganze Wachphase 14–16 s,
// liegegut 8,7–8,9 s. Einzelaufruf 60 s, Sammelaufruf (viele gh parallel) 120 s.
// WACHE_LIMIT_MS setzt nur der Prozess-Test (hängender Ersatz-gh), damit er nicht 60 s wartet.
const ueberschrieben = Number(process.env.WACHE_LIMIT_MS) || 0
export const LIMIT_EINZEL_MS = ueberschrieben || 60_000
export const LIMIT_STAPEL_MS = ueberschrieben || 120_000

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
