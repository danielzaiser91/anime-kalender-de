/**
 * Wochenwache des Daten-Detektivs (`tools/wache-woechentlich.mjs`): die weichen Regeln laufen mit, rot wird nur bei **neuen Schlüsseln**.
 * Bekannt ist, was in `data/detektiv-bekannt.json` steht (Regel → Schlüssel). Die Datei darf von Hand nur kleiner werden;
 * ein neuer Fund wird behoben oder mit `--bekannt-schreiben --neue-aufnehmen` bewusst aufgenommen.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { WURZEL } from './laden.ts'
import type { Regel } from './regel.ts'

/** Die weichen Regeln laut `docs/wissen/daten-detektiv.md`; die harten stehen als Bau-Invarianten in `pipeline/lib/invarianten*.ts`. */
export const WEICHE_REGELN = ['D-02', 'D-11', 'D-17', 'D-19', 'D-24', 'D-16', 'D-08', 'D-10', 'D-03', 'D-12', 'D-20']

export type Bekannt = Record<string, string[]>

export const BEKANNT_PFAD = resolve(WURZEL, 'data/detektiv-bekannt.json')

export function ladeBekannt(pfad = BEKANNT_PFAD): Bekannt {
  return existsSync(pfad) ? (JSON.parse(readFileSync(pfad, 'utf8')) as Bekannt) : {}
}

/** Treffer der weichen Regeln, deren Schlüssel nicht bekannt ist. */
export function neueFunde(regeln: Regel[], bekannt: Bekannt): { id: string; schluessel: string; text: string }[] {
  return regeln
    .filter((r) => WEICHE_REGELN.includes(r.id))
    .flatMap((r) => r.treffer.filter((t) => !(bekannt[r.id] ?? []).includes(t.schluessel)).map((t) => ({ id: r.id, schluessel: t.schluessel, text: t.text })))
}

/** Der Stand zum Festschreiben: alle Schlüssel der weichen Regeln; ohne `neueAufnehmen` nur, was schon bekannt war. */
export function festzuschreiben(regeln: Regel[], bekannt: Bekannt, neueAufnehmen: boolean): Bekannt {
  const aus: Bekannt = {}
  for (const r of regeln.filter((x) => WEICHE_REGELN.includes(x.id))) {
    const schluessel = r.treffer.map((t) => t.schluessel).filter((k) => neueAufnehmen || (bekannt[r.id] ?? []).includes(k))
    if (schluessel.length) aus[r.id] = schluessel.sort()
  }
  return aus
}

export function schreibeBekannt(bekannt: Bekannt, pfad = BEKANNT_PFAD): void {
  writeFileSync(pfad, JSON.stringify(bekannt, null, 1) + '\n')
}
