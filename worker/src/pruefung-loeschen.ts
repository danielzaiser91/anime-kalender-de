import { type Env } from './env.ts'
import { verwirfGemeldet } from './pruefung-gemeldet-cache.ts'
import { exporteVerwerfen } from './export-speicher.ts'
import { loescheTitelFolgen, loescheTitelzeile } from './titelzeile-aufgaben.ts'
import { TITEL_ID_AB } from './titelzeile-format.ts'

export async function loeschePruefungen({ request, env, antwort }: {
  request: Request<unknown, CfProperties<unknown>>
  env: Env
  antwort: (body: unknown, status?: number) => Response
}) {
    /*
      Falsche Meldungen wirklich entfernen — nicht nur abhaken.

      Abhaken heißt „ein Lauf hat es eingearbeitet"; die Route `?gemeldet=`
      zählt solche Meldungen weiter, und das ist richtig. Was falsch war, muss
      dagegen verschwinden, sonst gilt eine Reihe als geprüft, die niemand
      geprüft hat.
    */
    const token = request.headers.get('X-Lauf-Token') ?? ''
    if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)
    let daten: { ids?: number[]; url?: string; nummern?: number[] }
    try {
      daten = (await request.json()) as { ids?: number[]; url?: string; nummern?: number[] }
    } catch {
      return antwort({ error: 'Kein gültiges JSON' }, 400)
    }
    if (Array.isArray(daten.ids) && daten.ids.length) {
      /* Ids ab 2.000.000.000 sind Folgen in Titelzeilen (Migration 055). */
      const titelFolgen = await loescheTitelFolgen(env, { ids: daten.ids })
      daten.ids = daten.ids.filter((id) => id < TITEL_ID_AB)
      if (!daten.ids.length) return antwort({ ok: true, geloescht: titelFolgen })
      const platzhalter = daten.ids.map(() => '?').join(',')
      const { results: betroffen } = await env.DB.prepare(`SELECT DISTINCT url FROM pruefung WHERE id IN (${platzhalter})`)
        .bind(...daten.ids)
        .all<{ url: string }>()
      const ergebnis = await env.DB.prepare(`DELETE FROM pruefung WHERE id IN (${platzhalter})`)
        .bind(...daten.ids)
        .run()
      await verwirfGemeldet(request.url, (betroffen ?? []).map((r) => r.url))
      return antwort({ ok: true, geloescht: (ergebnis.meta?.changes ?? 0) + titelFolgen })
    }
    /*
      Einzelne Folgen einer Adresse — für den Fall, dass nur ein Teil einer
      Reihe neu geprüft werden soll. Bei One Piece waren drei von achtzehn
      Meldungen aus Staffel 1; die übrigen fünfzehn gehören zu anderen
      Staffeln und sollten bleiben.
    */
    if (daten.url && Array.isArray(daten.nummern) && daten.nummern.length) {
      const platzhalter = daten.nummern.map(() => '?').join(',')
      const ergebnis = await env.DB.prepare(
        `DELETE FROM pruefung WHERE url = ? AND folge_nr IN (${platzhalter})`,
      )
        .bind(daten.url, ...daten.nummern)
        .run()
      await verwirfGemeldet(request.url, [daten.url])
      return antwort({ ok: true, geloescht: (ergebnis.meta?.changes ?? 0) + (await loescheTitelFolgen(env, { url: daten.url, nummern: daten.nummern })) })
    }
    if (daten.url) {
      const ergebnis = await env.DB.prepare('DELETE FROM pruefung WHERE url = ?').bind(daten.url).run()
      await verwirfGemeldet(request.url, [daten.url])
      return antwort({ ok: true, geloescht: (ergebnis.meta?.changes ?? 0) + (await loescheTitelzeile(env, daten.url)) })
    }
    return antwort({ error: 'ids oder url erwartet' }, 400)
}

/** Löschen, und die Marke der Bau-Auszüge nur dann, wenn wirklich Zeilen verschwunden sind (`geloescht` der Antwort). */
export async function loeschePruefungenMitMarke(kontext: Parameters<typeof loeschePruefungen>[0]) {
  const antwort = await loeschePruefungen(kontext)
  const { geloescht } = (await antwort.clone().json().catch(() => ({}))) as { geloescht?: number }
  if (Number(geloescht) > 0) await exporteVerwerfen(kontext.env)
  return antwort
}
