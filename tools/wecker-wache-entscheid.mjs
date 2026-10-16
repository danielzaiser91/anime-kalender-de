#!/usr/bin/env node
/**
 * **Soll die Wecker-Wache diesen Workflow nachholen?** (`.github/workflows/wecker-wache.yml`)
 *
 * Bisher zählte jeder nicht abgebrochene Start, auch ein roter: ein ausgefallener Lauf wurde erst nach der vollen Frist (30 h) wiederholt.
 * Jetzt gilt zusätzlich: Ist der neueste Start rot (`ROT`, nie `cancelled`) und der letzte Erfolg älter als die Frist, holt die Wache ihn nach `ROT_WARTEN_H` nach —
 * aber nur einmal je Fenster (höchstens `MAX_STARTS_OHNE_ERFOLG` Starts seit dem letzten Erfolg), damit ein dauerhaft roter Lauf nicht alle 3 h neu startet.
 *
 * Aufruf: `gh run list … --json createdAt,conclusion,status | node tools/wecker-wache-entscheid.mjs <frist-h> [ohne-abbruch]` — Ausgabe `ja <grund>` oder `nein <grund>`.
 */
import { readFileSync } from 'node:fs'

export const ROT_WARTEN_H = 6
export const MAX_STARTS_OHNE_ERFOLG = 2
const H = 3600e3
/** Nur diese Ausgänge holt die Wache nach; `cancelled` ist gewollt (D1-Tageslimit, Sperre) und zählt nie als rot. */
export const ROT = ['failure', 'timed_out', 'startup_failure']
const AKTIV = ['in_progress', 'queued', 'pending', 'waiting']

/** `laeufe`: neuester zuerst, wie `gh run list` (createdAt, conclusion, status). */
export function entscheide(laeufe, jetzt, fristH, ohneAbbruch = false) {
  if (laeufe.some((l) => AKTIV.includes(l.status))) return { nachholen: false, grund: 'läuft gerade' }
  const zaehlt = laeufe.filter((l) => !ohneAbbruch || l.conclusion !== 'cancelled')
  if (zaehlt.length === 0) return { nachholen: true, grund: 'nie gestartet' }
  const alterH = (l) => (jetzt - Date.parse(l.createdAt)) / H
  if (Math.floor(alterH(zaehlt[0])) > fristH) return { nachholen: true, grund: `letzter Start vor ${Math.round(alterH(zaehlt[0]))} h` }
  const erfolg = zaehlt.findIndex((l) => l.conclusion === 'success')
  const seitErfolg = erfolg === -1 ? zaehlt.length : erfolg
  const erfolgAlt = erfolg === -1 || alterH(zaehlt[erfolg]) > fristH
  if (ROT.includes(zaehlt[0].conclusion) && erfolgAlt && alterH(zaehlt[0]) > ROT_WARTEN_H && seitErfolg < MAX_STARTS_OHNE_ERFOLG) {
    return { nachholen: true, grund: `letzter Start vor ${Math.round(alterH(zaehlt[0]))} h war rot (${zaehlt[0].conclusion}), kein Erfolg innerhalb ${fristH} h` }
  }
  return { nachholen: false, grund: 'rechtzeitig gestartet' }
}

if (process.argv[1]?.endsWith('wecker-wache-entscheid.mjs')) {
  const r = entscheide(JSON.parse(readFileSync(0, 'utf8')), Date.now(), Number(process.argv[2]), process.argv[3] === 'ohne-abbruch')
  console.log(`${r.nachholen ? 'ja' : 'nein'} ${r.grund}`)
}
