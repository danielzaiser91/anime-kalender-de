/**
 * **Aufträge der Pipeline und Aufräumen, soweit sie Folgen in Titelzeilen treffen** (13.10.2026, Migration 055).
 *
 * Abhaken, Wiederöffnen und Löschen kennen die Folgen einer Titelzeile über ihre Id (`titelzeile-format.ts`); eine
 * Anfrage ändert je Titel **eine** Zeile, nicht je Folge eine (vorher 50 Ids je `UPDATE`). Alle Änderungen laufen
 * über `aendereTitelzeile` (Versionsprüfung, `titelzeile-zeile.ts`).
 */
import { type Env } from './env.ts'
import { AM, ausId, FASSUNG, MELDUNG_UEBERNOMMEN, NUMMER, ROHFOLGE_UEBERNOMMEN, STAFFEL, TITEL_ID_AB, type Eintrag, type TitelDaten } from './titelzeile-format.ts'
import { aendereTitelzeile } from './titelzeile-zeile.ts'

/** Ids, die zu Titelzeilen gehören. */
export const sindTitelIds = (ids: number[]) => ids.filter((id) => id >= TITEL_ID_AB)

/** Die Adresse zu jeder Titelnummer, in einer Abfrage über den Index `titel_zeile_nr`. */
async function adressen(env: Env, nummern: number[]): Promise<{ nr: number; url: string; plattform: string }[]> {
  if (!nummern.length) return []
  const { results } = await env.DB.prepare(`SELECT nr, url, plattform FROM titel_zeile WHERE nr IN (${nummern.map(() => '?').join(',')})`)
    .bind(...nummern)
    .all<{ nr: number; url: string; plattform: string }>()
  return results ?? []
}

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
async function aendereFolgen(env: Env, ids: number[], aendere: (e: Eintrag) => Eintrag | null): Promise<void> {
  const je = jeTitel(ids)
  for (const t of await adressen(env, [...je.keys()])) {
    const folgen = je.get(t.nr)!
    await aendereTitelzeile(env, { url: t.url, plattform: t.plattform }, async (alt) => {
      if (!alt) return null
      let n = 0
      const f = alt.f.map((e) => {
        if (!folgen.some((x) => trifft(e, x))) return e
        const neu = aendere(e)
        if (neu) n++
        return neu ?? e
      })
      return n ? { ...alt, f } : null
    })
  }
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
  const { results } = await env.DB.prepare('SELECT url FROM titel_zeile WHERE plattform = ?1').bind(plattform).all<{ url: string }>()
  let offen = 0
  for (const { url } of results ?? []) {
    await aendereTitelzeile(env, { url, plattform }, async (alt) => {
      if (!alt) return null
      let n = 0
      const f = alt.f.map((e) => {
        if (e[MELDUNG_UEBERNOMMEN] !== 1 || e[AM] < seit) return e
        n++
        const neu = [...e] as Eintrag
        neu[MELDUNG_UEBERNOMMEN] = 0
        return neu
      })
      offen += n
      return n ? { ...alt, f } : null
    })
  }
  return offen
}

/** Entfernt Folgen aus ihren Titelzeilen: Ids (`DELETE /pruefung` mit `ids`) oder Nummern einer Adresse. Gibt die Zahl der entfernten Folgen zurück. */
export async function loescheTitelFolgen(env: Env, wahl: { ids: number[] } | { url: string; nummern: number[] }): Promise<number> {
  let entfernt = 0
  const ohne = (alt: TitelDaten, behalte: (e: Eintrag) => boolean) => {
    const f = alt.f.filter(behalte)
    entfernt += alt.f.length - f.length
    return f.length === alt.f.length ? null : { ...alt, f }
  }
  if ('url' in wahl) {
    const { results } = await env.DB.prepare('SELECT url, plattform FROM titel_zeile WHERE url = ?1').bind(wahl.url).all<{ url: string; plattform: string }>()
    for (const t of results ?? []) {
      await aendereTitelzeile(env, t, async (alt) => (alt ? ohne(alt, (e) => !wahl.nummern.includes(e[NUMMER] ?? -1)) : null))
    }
    return entfernt
  }
  const je = jeTitel(sindTitelIds(wahl.ids))
  for (const t of await adressen(env, [...je.keys()])) {
    const folgen = je.get(t.nr)!
    await aendereTitelzeile(env, t, async (alt) => (alt ? ohne(alt, (e) => !folgen.some((x) => trifft(e, x))) : null))
  }
  return entfernt
}

/** Die Titelzeile einer Adresse ganz entfernen (`DELETE /pruefung` mit `url`). */
export async function loescheTitelzeile(env: Env, url: string): Promise<number> {
  const r = await env.DB.prepare('DELETE FROM titel_zeile WHERE url = ?1').bind(url).run()
  return Number(r.meta?.changes ?? 0)
}
