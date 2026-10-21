/**
 * **Titelzeilen gesammelt lesen und schreiben** (aus `titelzeile-aufgaben.ts`, 21.10.2026).
 */
import { type Env } from './env.ts'
import { lies, type TitelDaten } from './titelzeile-format.ts'
import { aktualisierung, VERSUCHE, type Zeile } from './titelzeile-zeile.ts'

export type Gelesen = Zeile & { url: string; plattform: string }

/** Höchstens so viele Anweisungen je `batch` (D1 nimmt Stapel dieser Größe, siehe `titelzeile-aufgaben.ts`). */
export const JE_STAPEL = 100

/**
 * Die Zeile zu jeder Titelnummer, in einer Abfrage über den Index `titel_zeile_nr`. Die Nummern reisen als ein
 * JSON-Wert: D1 bindet höchstens 100 Werte, mit einem `?` je Nummer scheiterte jedes Abhaken ab 101 Titeln
 * („too many SQL variables“, HTTP 500 in jedem Bestandsbau bis 16.10.2026).
 */
export async function adressen(env: Env, nummern: number[]): Promise<Gelesen[]> {
  if (!nummern.length) return []
  const { results } = await env.DB.prepare('SELECT nr, url, plattform, version, daten FROM titel_zeile WHERE nr IN (SELECT value FROM json_each(?1))')
    .bind(JSON.stringify(nummern))
    .all<Gelesen>()
  return results ?? []
}

/** Ergebnis von `aendere`: der neue Stand und was er für den Aufrufer zählt (gezählt wird nur, was geschrieben wurde). */
export type Aenderung = { daten: TitelDaten; zaehl: number }

/**
 * **Viele Titelzeilen in wenigen Abfragen ändern** (21.10.2026): Wiederöffnen eines Anbieters und Löschen nach Ids.
 * Je Titel lesen und schreiben (`aendereTitelzeile`) kostete 2 Abfragen, bei 215 Disney+-Titeln mehr als die 50 je Aufruf
 * der freien Stufe. Hier kommen die Zeilen gesammelt, die `UPDATE`s gehen im `batch` (zählt als eine Abfrage). Ein Titel, den
 * jemand zwischen Lesen und Schreiben geändert hat (Versionsprüfung), wird in der nächsten Runde neu gelesen, höchstens `VERSUCHE` Runden.
 */
export async function aendereGebuendelt(
  env: Env,
  zeilen: Gelesen[],
  aendere: (alt: TitelDaten, zeile: Gelesen) => Aenderung | null,
): Promise<{ url: string; zaehl: number }[]> {
  const fertig: { url: string; zaehl: number }[] = []
  let dran = zeilen
  for (let runde = 0; runde < VERSUCHE && dran.length; runde++) {
    const anweisungen: { nr: number; url: string; zaehl: number; stmt: D1PreparedStatement }[] = []
    for (const t of dran) {
      const a = aendere(lies(t.daten), t)
      if (a) anweisungen.push({ nr: t.nr, url: t.url, zaehl: a.zaehl, stmt: aktualisierung(env, t, a.daten) })
    }
    const zusammengestossen: number[] = []
    for (let i = 0; i < anweisungen.length; i += JE_STAPEL) {
      const teil = anweisungen.slice(i, i + JE_STAPEL)
      const antworten = await env.DB.batch(teil.map((x) => x.stmt))
      teil.forEach((x, k) => {
        if (Number(antworten[k]?.meta?.changes ?? 0) > 0) fertig.push({ url: x.url, zaehl: x.zaehl })
        else zusammengestossen.push(x.nr)
      })
    }
    dran = await adressen(env, zusammengestossen)
  }
  return fertig
}
