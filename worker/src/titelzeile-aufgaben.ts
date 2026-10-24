/**
 * **Aufträge der Pipeline und Aufräumen, soweit sie Folgen in Titelzeilen treffen** (13.10.2026, Migration 055).
 *
 * Abhaken, Wiederöffnen und Löschen kennen die Folgen einer Titelzeile über ihre Id (`titelzeile-format.ts`); eine
 * Anfrage ändert je Titel **eine** Zeile, nicht je Folge eine (vorher 50 Ids je `UPDATE`). Alle Änderungen laufen
 * über die Versionsprüfung (`titelzeile-zeile.ts`); das Abhaken schreibt gesammelt im Stapel (`aendereFolgen`).
 */
import { type Env } from './env.ts'
import { AM, ausId, FASSUNG, lies, MELDUNG_UEBERNOMMEN, NUMMER, ROHFOLGE_UEBERNOMMEN, STAFFEL, TITEL_ID_AB, type Eintrag, type TitelDaten } from './titelzeile-format.ts'
import { adressen, aendereGebuendelt, JE_STAPEL, type Gelesen } from './titelzeile-buendel.ts'
import { aendereTitelzeile, aktualisierung } from './titelzeile-zeile.ts'

/** Ids, die zu Titelzeilen gehören. */
export const sindTitelIds = (ids: number[]) => ids.filter((id) => id >= TITEL_ID_AB)

/** Die Ids je Titelnummer, getrennt nach Staffel, Nummer und Fassung. */
function jeTitel(ids: number[]): Map<number, { staffel: number; nummer: number; fassung: number }[]> {
  const je = new Map<number, { staffel: number; nummer: number; fassung: number }[]>()
  for (const id of ids) {
    const { nr, ...folge } = ausId(id)
    je.set(nr, [...(je.get(nr) ?? []), folge])
  }
  return je
}

const trifft = (e: Eintrag, f: { staffel: number; nummer: number; fassung: number }) =>
  (e[STAFFEL] ?? 0) === f.staffel && (e[NUMMER] ?? 0) === f.nummer && e[FASSUNG] === f.fassung

/** Setzt in allen Titelzeilen eine Änderung auf die Folgen, die `ids` nennen; `null` aus `aendere` heißt „nichts zu ändern". */
/*
  **Ein Lesen, dann die UPDATEs im Stapel** (16.10.2026). Je Titel zwei Abfragen (lesen, schreiben) kamen bei rund
  1.000 Titeln weit über die 50 Abfragen je Aufruf der freien Stufe; ein `batch` zählt als eine (eine Prime-Meldung
  mit 93 Anweisungen in einem Stapel ging am 19.09.2026 durch). Ein Titel, den jemand zwischen Lesen und Schreiben
  geändert hat, bleibt offen (Versionsprüfung) und kommt mit dem nächsten Bau wieder.
*/
async function aendereFolgen(env: Env, ids: number[], aendere: (e: Eintrag) => Eintrag | null): Promise<void> {
  const je = jeTitel(ids)
  const anweisungen: D1PreparedStatement[] = []
  for (const t of await adressen(env, [...je.keys()])) {
    const folgen = je.get(t.nr)!
    const alt = lies(t.daten)
    let n = 0
    const f = alt.f.map((e) => {
      if (!folgen.some((x) => trifft(e, x))) return e
      const neu = aendere(e)
      if (neu) n++
      return neu ?? e
    })
    if (n) anweisungen.push(aktualisierung(env, t, { ...alt, f }))
  }
  for (let i = 0; i < anweisungen.length; i += JE_STAPEL) await env.DB.batch(anweisungen.slice(i, i + JE_STAPEL))
}

/** `uebernommen: [ids]` bzw. `rohfolgenUebernommen: [ids]` für Folgen in Titelzeilen; eine veraltete Fassung bleibt offen. */
export async function hakeTitelzeilenAb(env: Env, ids: number[], welche: 'meldung' | 'rohfolge'): Promise<void> {
  const stelle = welche === 'meldung' ? MELDUNG_UEBERNOMMEN : ROHFOLGE_UEBERNOMMEN
  await aendereFolgen(env, sindTitelIds(ids), (e) => {
    if (e[stelle] === 1) return null
    const neu = [...e] as Eintrag
    neu[stelle] = 1
    return neu
  })
}

/** Notfall-Werkzeug `reoeffnen`: übernommene Meldungen eines Anbieters seit `seit` wieder öffnen (nur `uebernommen`, wie bei `pruefung`). */
export async function oeffneTitelzeilenWieder(env: Env, plattform: string, seit: string): Promise<number> {
  const { results } = await env.DB.prepare('SELECT nr, url, plattform, version, daten FROM titel_zeile WHERE plattform = ?1').bind(plattform).all<Gelesen>()
  const geschrieben = await aendereGebuendelt(env, results ?? [], (alt) => {
    let n = 0
    const f = alt.f.map((e) => {
      if (e[MELDUNG_UEBERNOMMEN] !== 1 || e[AM] < seit) return e
      n++
      const neu = [...e] as Eintrag
      neu[MELDUNG_UEBERNOMMEN] = 0
      return neu
    })
    return n ? { daten: { ...alt, f }, zaehl: n } : null
  })
  return geschrieben.reduce((summe, g) => summe + g.zaehl, 0)
}

/** Löschen nach Ids: alle betroffenen Titelzeilen gebündelt (`titelzeile-buendel.ts`). */
async function loescheNachIds(env: Env, ids: number[]): Promise<{ entfernt: number; urls: string[] }> {
  const je = jeTitel(sindTitelIds(ids))
  const geschrieben = await aendereGebuendelt(env, await adressen(env, [...je.keys()]), (alt, t) => {
    const folgen = je.get(t.nr)!
    const f = alt.f.filter((e) => !folgen.some((x) => trifft(e, x)))
    return f.length === alt.f.length ? null : { daten: { ...alt, f }, zaehl: alt.f.length - f.length }
  })
  return { entfernt: geschrieben.reduce((summe, g) => summe + g.zaehl, 0), urls: geschrieben.map((g) => g.url) }
}

/** Entfernt Folgen aus ihren Titelzeilen: Ids (`DELETE /pruefung` mit `ids`) oder Nummern einer Adresse. Gibt die Zahl der entfernten Folgen und die Adressen der geänderten Titelzeilen zurück (für den `?gemeldet=`-Cache). */
export async function loescheTitelFolgen(env: Env, wahl: { ids: number[] } | { url: string; nummern: number[] }): Promise<{ entfernt: number; urls: string[] }> {
  if ('ids' in wahl) return await loescheNachIds(env, wahl.ids)
  let entfernt = 0
  const urls: string[] = []
  const ohne = (alt: TitelDaten, behalte: (e: Eintrag) => boolean) => {
    const f = alt.f.filter(behalte)
    entfernt += alt.f.length - f.length
    return f.length === alt.f.length ? null : { ...alt, f }
  }
  const { results } = await env.DB.prepare('SELECT url, plattform FROM titel_zeile WHERE url = ?1').bind(wahl.url).all<{ url: string; plattform: string }>()
  for (const t of results ?? []) {
    const vorher = entfernt
    await aendereTitelzeile(env, t, async (alt) => (alt ? ohne(alt, (e) => !wahl.nummern.includes(e[NUMMER] ?? -1)) : null))
    if (entfernt > vorher) urls.push(t.url)
  }
  return { entfernt, urls }
}

/** Die Titelzeile einer Adresse ganz entfernen (`DELETE /pruefung` mit `url`). */
export async function loescheTitelzeile(env: Env, url: string): Promise<number> {
  const r = await env.DB.prepare('DELETE FROM titel_zeile WHERE url = ?1').bind(url).run()
  return Number(r.meta?.changes ?? 0)
}
